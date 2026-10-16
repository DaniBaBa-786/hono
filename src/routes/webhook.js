import { Hono } from "hono";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "../db.js";

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

if (!STRIPE_WEBHOOK_SECRET) {
  throw new Error("Missing required environment variable: STRIPE_WEBHOOK_SECRET");
}

const app = new Hono();

function verifyStripeSignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => part.split("="))
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const expected = createHmac("sha256", STRIPE_WEBHOOK_SECRET)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");
  if (expectedBuffer.length !== signatureBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, signatureBuffer);
}

function isValidStripeEvent(event) {
  if (!event || typeof event !== "object") return false;
  if (typeof event.type !== "string" || event.type.trim().length === 0) return false;
  if (!event.data || typeof event.data !== "object") return false;
  if (!event.data.object || typeof event.data.object !== "object") return false;
  return true;
}

// Stripe tells us when someone upgrades to Pro
app.post("/webhooks/stripe", async (c) => {
  const rawBody = await c.req.text();
  const signatureHeader = c.req.header("stripe-signature");

  if (!verifyStripeSignature(rawBody, signatureHeader)) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return c.json({ error: "Request body must be valid JSON" }, 400);
  }

  if (!isValidStripeEvent(event)) {
    return c.json({ error: "Malformed Stripe event payload" }, 400);
  }

  if (event.type === "checkout.session.completed") {
    const accountId = event.data.object.client_reference_id;
    if (typeof accountId !== "string" || accountId.trim().length === 0) {
      return c.json({ error: "client_reference_id is required" }, 400);
    }
    db.accounts.update(accountId, { plan: "pro" });
  } else if (
    event.type === "charge.refunded" ||
    event.type === "charge.dispute.created" ||
    event.type === "charge.failed"
  ) {
    const accountId = event.data.object.client_reference_id;
    if (typeof accountId !== "string" || accountId.trim().length === 0) {
      return c.json({ error: "client_reference_id is required" }, 400);
    }
    db.accounts.update(accountId, { plan: "free" });
  }
  return c.json({ received: true });
});

export default app;
