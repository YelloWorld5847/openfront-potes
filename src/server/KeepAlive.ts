import { logger } from "./Logger";
import { startPolling } from "./PollingLoop";

const log = logger.child({ comp: "keepalive" });

const PING_INTERVAL_MS = 10 * 60 * 1000;

// render's free tier stops a service after 15 minutes without inbound
// traffic. pinging our own public url goes through their proxy, so it counts.
export function startKeepAlive() {
  const base = process.env.KEEP_ALIVE_URL ?? process.env.RENDER_EXTERNAL_URL;
  if (!base) return;

  const url = `${base.replace(/\/$/, "")}/api/health`;
  log.info(`keep-alive ping every ${PING_INTERVAL_MS / 60000} min on ${url}`);

  startPolling(async () => {
    await new Promise((r) => setTimeout(r, PING_INTERVAL_MS));
    const res = await fetch(url);
    if (!res.ok) log.warn(`keep-alive got status ${res.status}`);
  }, 0);
}
