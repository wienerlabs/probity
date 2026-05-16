import { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/api-keys";
import { check, RATE_API_KEY } from "@/lib/api/rate-limit";
import {
  badRequest,
  ok,
  rateLimited,
  unauthorized,
} from "@/lib/api/responses";
import {
  createWebhook,
  listForOwner,
  type WebhookEvent,
} from "@/lib/api/webhook-store";

export const runtime = "nodejs";

const ALLOWED_EVENTS: WebhookEvent[] = [
  "verdict.changed",
  "verdict.computed",
  "attestation.revoked",
];

export async function GET(req: NextRequest) {
  const key = authenticate(req.headers);
  if (!key) return unauthorized();
  return ok({ webhooks: listForOwner(key.owner) });
}

export async function POST(req: NextRequest) {
  const key = authenticate(req.headers);
  if (!key) return unauthorized();
  if (key.tier === "free") {
    return unauthorized("webhooks require growth tier or above");
  }

  const rate = check({ key: `key:${key.id}:webhooks`, ...RATE_API_KEY });
  if (!rate.allowed) return rateLimited(rate.retryAfterSeconds);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("body must be JSON");
  }
  if (!body || typeof body !== "object") {
    return badRequest("body must be an object");
  }
  const { url, events } = body as { url?: unknown; events?: unknown };
  if (typeof url !== "string" || !url.startsWith("https://")) {
    return badRequest("url must be an https:// URL");
  }
  if (!Array.isArray(events) || events.length === 0) {
    return badRequest("events must be a non-empty array");
  }
  const evts: WebhookEvent[] = [];
  for (const e of events) {
    if (typeof e !== "string" || !ALLOWED_EVENTS.includes(e as WebhookEvent)) {
      return badRequest(
        `events must be a subset of ${ALLOWED_EVENTS.join(", ")}`,
        { invalid: e as string },
      );
    }
    evts.push(e as WebhookEvent);
  }

  const w = createWebhook({ owner: key.owner, url, events: evts });
  return ok({
    id: w.id,
    url: w.url,
    events: w.events,
    // Secret is returned ONCE, on creation, just like a real provider.
    secret: w.secret,
    created_at: w.createdAt,
    signing: {
      algorithm: "hmac-sha256",
      header: "x-probity-signature",
      timestamp_header: "x-probity-timestamp",
    },
  });
}
