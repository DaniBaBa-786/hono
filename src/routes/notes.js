import { Hono } from "hono";
import { db } from "../db.js";
import { summarize } from "../ai.js";
import { requireAuth } from "./auth.js";

const app = new Hono();
const cache = new Map();

app.use("/notes", requireAuth);
app.use("/notes/*", requireAuth);

// GET /api/notes?q=coffee
app.get("/notes", (c) => {
  const userId = c.get("userId");
  const key = `${userId}:${c.req.url}`;
  if (cache.has(key)) return c.json(cache.get(key));

  const q = c.req.query("q");
  let list = db.notes.list().filter((n) => n.owner === userId);
  if (q) {
    const match = new RegExp(q, "i");
    list = list.filter((n) => match.test(n.title) || match.test(n.body));
  }
  cache.set(key, list);
  return c.json(list);
});

const MAX_TITLE_LENGTH = 200;
const MAX_BODY_LENGTH = 10000;

app.post("/notes", async (c) => {
  const userId = c.get("userId");
  let payload;
  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: "Request body must be valid JSON" }, 400);
  }

  const { title, body } = payload ?? {};
  if (typeof title !== "string" || title.trim().length === 0) {
    return c.json({ error: "title is required and must be a non-empty string" }, 400);
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return c.json({ error: `title must be at most ${MAX_TITLE_LENGTH} characters` }, 400);
  }
  if (typeof body !== "string" || body.trim().length === 0) {
    return c.json({ error: "body is required and must be a non-empty string" }, 400);
  }
  if (body.length > MAX_BODY_LENGTH) {
    return c.json({ error: `body must be at most ${MAX_BODY_LENGTH} characters` }, 400);
  }

  const note = db.notes.insert({ owner: userId, title, body });
  return c.json(note, 201);
});

app.delete("/notes/:id", (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  if (typeof id !== "string" || id.trim().length === 0) {
    return c.json({ error: "id is required" }, 400);
  }
  const note = db.notes.get(id);
  if (!note || note.owner !== userId) {
    return c.json({ error: "Not found" }, 404);
  }
  db.notes.delete(id);
  return c.json({ ok: true });
});

app.get("/notes/:id/summary", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  if (typeof id !== "string" || id.trim().length === 0) {
    return c.json({ error: "id is required" }, 400);
  }

  const note = db.notes.get(id);
  if (!note || note.owner !== userId) {
    return c.json({ error: "Not found" }, 404);
  }
  if (typeof note.body !== "string" || note.body.trim().length === 0) {
    return c.json({ error: "Note has no content to summarize" }, 400);
  }

  let summary;
  try {
    summary = await summarize(note.body);
  } catch {
    return c.json({ error: "Failed to generate summary" }, 502);
  }
  return c.json({ id: note.id, summary });
});

export default app;
