import express from "express";
import { registerStandaloneApi } from "../src/server/StandaloneApi";

// local stand-in for the account api when running `npm run dev`
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
  issuer: "http://localhost:8787",
  audience: "localhost",
});
app.listen(8787, () => console.log("dev api on http://localhost:8787"));
