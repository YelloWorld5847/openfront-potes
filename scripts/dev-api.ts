import express from "express";
import { registerStandaloneApi } from "../src/server/StandaloneApi";

// local stand-in for the account api when running `npm run dev`. windows can
// reserve 8787 (docker does it), then run with DEV_API_PORT=9150 on both this
// and the server, and set localStorage.apiHost in the browser to match
const port = Number(process.env.DEV_API_PORT ?? 8787);
const app = express();
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
await registerStandaloneApi(app, {
  issuer: `http://localhost:${port}`,
  audience: "localhost",
});
app
  .listen(port, () => console.log(`dev api on http://localhost:${port}`))
  .on("error", (err) => {
    console.error(`dev api could not listen on ${port}: ${err.message}`);
    process.exit(1);
  });
