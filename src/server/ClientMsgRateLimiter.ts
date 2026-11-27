import { ClientID } from "@openfront/engine-api/Schemas";
import { RateLimiter } from "limiter";

const INTENTS_PER_SECOND = 10;
const INTENTS_PER_MINUTE = 150;
// games with mass orders on (private lobbies where the host asked for them)
// let a player hold a button down and place things as fast as the turns go
const RELAXED_FACTOR = 20;
const MAX_INTENT_SIZE = 2000;
// A rejoin makes the server serialize and send the turn history since
// `lastTurn`, which is the full game so far when lastTurn is 0. A real client
// only sends one per (re)connect, so anything beyond a handful per minute is
// abuse.
const REJOINS_PER_MINUTE = 5;
const TOTAL_BYTES = 5 * 1024 * 1024; // 5MB per client
export type RateLimitResult = "ok" | "limit" | "kick";

interface ClientBucket {
  relaxed: boolean;
  perSecond: RateLimiter;
  perMinute: RateLimiter;
  rejoinPerMinute: RateLimiter;
  totalBytes: number;
}

export class ClientMsgRateLimiter {
  private buckets = new Map<ClientID, ClientBucket>();

  check(
    clientID: ClientID,
    type: string,
    bytes: number,
    relaxed = false,
  ): RateLimitResult {
    const bucket = this.getOrCreate(clientID, relaxed);
    bucket.totalBytes += bytes;

    if (bucket.totalBytes >= TOTAL_BYTES) return "kick";

    if (type === "intent") {
      // Intents are stored in turn history for the duration of the game, so
      // oversized intents would accumulate and fill up server RAM.
      // Intents are also sent to all players, so it increase outgoing
      // data.
      // Intents should never be larger than MAX_INTENT_SIZE, so we assume the client is malicious.
      if (bytes > MAX_INTENT_SIZE) {
        return "kick";
      }
      if (
        !bucket.perSecond.tryRemoveTokens(1) ||
        !bucket.perMinute.tryRemoveTokens(1)
      ) {
        return "limit";
      }
    } else if (type === "rejoin") {
      if (!bucket.rejoinPerMinute.tryRemoveTokens(1)) {
        return "limit";
      }
    }

    return "ok";
  }

  private getOrCreate(clientID: ClientID, relaxed: boolean): ClientBucket {
    const existing = this.buckets.get(clientID);
    if (existing && existing.relaxed === relaxed) {
      return existing;
    }
    const factor = relaxed ? RELAXED_FACTOR : 1;
    const bucket = {
      relaxed,
      perSecond: new RateLimiter({
        tokensPerInterval: INTENTS_PER_SECOND * factor,
        interval: "second",
      }),
      perMinute: new RateLimiter({
        tokensPerInterval: INTENTS_PER_MINUTE * factor,
        interval: "minute",
      }),
      rejoinPerMinute:
        existing?.rejoinPerMinute ??
        new RateLimiter({
          tokensPerInterval: REJOINS_PER_MINUTE,
          interval: "minute",
        }),
      totalBytes: existing?.totalBytes ?? 0,
    };
    this.buckets.set(clientID, bucket);
    return bucket;
  }
}
