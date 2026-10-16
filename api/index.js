// Written by Skeamo so this app can run on Vercel.
//
// Vercel runs functions rather than a server that stays listening, so the
// app is exported from its own entry and handed to one request at a time.
// Your entry still listens normally everywhere else.
import { handle } from "@hono/node-server/vercel";
import app from "../src/index.js";

export default handle(app);
