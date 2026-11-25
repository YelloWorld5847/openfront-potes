import { uuidToBase64url } from "@openfront/shared/Base64";
import crypto from "crypto";
import type { IRouter, Request } from "express";
import { exportJWK, generateKeyPair, jwtVerify, SignJWT } from "jose";
import { freeCosmetics } from "./FreeCosmetics";

const DEVICE_COOKIE = "potes_device";
const TOKEN_TTL_S = 60 * 60;

// everything is unlocked, nobody pays for anything
const FLARES = ["pattern:*", "flag:*", "skin:*", "crown:*", "effect:*"];

// stand-in for the closed account api. every browser gets an anonymous
// account tied to a cookie, signed with a key made at boot
export async function registerStandaloneApi(
  app: IRouter,
  opts: { issuer: string; audience: string },
) {
  const { publicKey, privateKey } = await generateKeyPair("EdDSA", {
    crv: "Ed25519",
    extractable: true,
  });
  const jwk = { ...(await exportJWK(publicKey)), alg: "EdDSA" };

  function deviceId(req: Request): string | undefined {
    const raw = req.headers.cookie
      ?.split(";")
      .map((c) => c.trim().split("="))
      .find(([k]) => k === DEVICE_COOKIE)?.[1];
    return raw && /^[0-9a-f-]{36}$/.test(raw) ? raw : undefined;
  }

  app.get("/.well-known/jwks.json", (_req, res) => {
    res.json({ keys: [jwk] });
  });

  app.post("/auth/refresh", async (req, res) => {
    let id = deviceId(req);
    if (id === undefined) {
      id = crypto.randomUUID();
      const secure = opts.issuer.startsWith("https") ? "; Secure" : "";
      res.setHeader(
        "Set-Cookie",
        `${DEVICE_COOKIE}=${id}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${secure}`,
      );
    }
    const jwt = await new SignJWT({})
      .setProtectedHeader({ alg: "EdDSA" })
      .setJti(crypto.randomUUID())
      .setSubject(uuidToBase64url(id))
      .setIssuer(opts.issuer)
      .setAudience(opts.audience)
      .setIssuedAt()
      .setExpirationTime(`${TOKEN_TTL_S}s`)
      .sign(privateKey);
    res.json({ jwt, expiresIn: TOKEN_TTL_S });
  });

  app.post("/auth/logout", (_req, res) => {
    res.sendStatus(200);
  });

  app.get("/users/@me", async (req, res) => {
    const token = req.headers.authorization?.replace(/^Bearer /, "");
    if (!token) return res.status(401).json({ error: "no token" });
    try {
      const { payload } = await jwtVerify(token, publicKey, {
        issuer: opts.issuer,
        audience: opts.audience,
      });
      const sub = String(payload.sub);
      res.json({
        user: {},
        player: {
          publicId: crypto
            .createHash("sha256")
            .update(sub)
            .digest("base64url")
            .slice(0, 8),
          adfree: true,
          canCreatePublicLobbies: true,
          flares: FLARES,
          achievements: { singleplayerMap: [] },
          friends: [],
          subscription: null,
        },
      });
    } catch {
      res.status(401).json({ error: "bad token" });
    }
  });

  app.get("/cluster.json", (_req, res) => {
    res.status(404).json({ error: "no server list" });
  });

  app.get("/reserved_clan_tags", (_req, res) => {
    res.json([]);
  });

  const cosmetics = freeCosmetics();
  app.get("/cosmetics.json", (_req, res) => {
    res.json(cosmetics);
  });
}
