import { serve } from "@hono/node-server";
import { Hono } from "hono";
import notes from "./routes/notes.js";
import auth from "./routes/auth.js";
import webhook from "./routes/webhook.js";

const app = new Hono();

app.get("/", (c) => c.json({ app: "quicknotes-api", ok: true }));
app.route("/api", auth);
app.route("/api", notes);
app.route("/api", webhook);

const port = Number(process.env.PORT) || 3000;
// Vercel runs this as a function, where there is no port to listen on.
// Everywhere else -- your machine, the workspace -- this is unchanged.
if (!process.env.VERCEL) {
  serve({ fetch: app.fetch, port, hostname: "0.0.0.0" });
}
console.log(`quicknotes-api on :${port}`);

// So the Vercel function can reach your app.
export default app;
