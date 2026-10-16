import { Hono } from "hono";
import { sign, verify } from "hono/jwt";

const SECRET = process.env.JWT_SECRET;

if (!SECRET) {
  throw new Error("Missing required environment variable: JWT_SECRET");
}

const app = new Hono();

// Demo sign-in: any email gets a token for the first account.
app.post("/session", async (c) => {
  const { email } = await c.req.json();
  const token = await sign({ sub: "u1", email, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 }, SECRET);
  return c.json({ token });
});

export async function requireAuth(c, next) {
  const header = c.req.header("authorization") || c.req.header("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401);
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = await verify(token, SECRET);
    c.set("userId", payload.sub);
    c.set("userEmail", payload.email);
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
  await next();
}

export { SECRET };
export default app;
