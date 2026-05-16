import { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/api-keys";
import { getWebhook } from "@/lib/api/webhook-store";
import {
  dispatchToWebhook,
  type EventPayload,
} from "@/lib/api/webhook-dispatcher";
import {
  badRequest,
  notFound,
  ok,
  unauthorized,
} from "@/lib/api/responses";

export const runtime = "nodejs";

const ALLOWED_EVENTS = [
  "verdict.changed",
  "verdict.computed",
  "attestation.revoked",
] as const;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const key = authenticate(req.headers);
  if (!key) return unauthorized();
  const { id } = await ctx.params;
  const w = getWebhook(id);
  if (!w || w.owner !== key.owner) return notFound("no webhook with that id");

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // accept empty body
  }
  const reqEvent =
    body && typeof body === "object" && "event" in body
      ? (body as { event?: unknown }).event
      : undefined;
  const event =
    typeof reqEvent === "string" && (ALLOWED_EVENTS as readonly string[]).includes(reqEvent)
      ? (reqEvent as EventPayload["event"])
      : ("verdict.computed" as const);

  if (!w.events.includes(event)) {
    return badRequest(
      `webhook is not subscribed to ${event}`,
      { subscribed: w.events },
    );
  }

  const payload: EventPayload = {
    event,
    data: {
      mint: "DemoMint11111111111111111111111111111111111",
      verdict: "halal",
      rule_version: "0.1.0",
      evidence_hash:
        "sha256:test1111111111111111111111111111111111111111111111111111111111111111",
      source: "test",
    },
  };
  const result = await dispatchToWebhook(w, payload);
  return ok({
    sent_to: w.url,
    event,
    attempts: result.attempts,
    final_status: result.finalStatus,
    success: result.success,
    error: result.error,
  });
}
