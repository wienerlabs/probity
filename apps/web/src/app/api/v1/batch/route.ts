import { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/api-keys";
import { check, RATE_API_KEY } from "@/lib/api/rate-limit";
import {
  badRequest,
  ok,
  rateLimited,
  serverError,
  unauthorized,
} from "@/lib/api/responses";
import { resolveVerdict } from "@/lib/api/screening-runtime";
import { createBatch, markItem } from "@/lib/api/batch-store";

export const runtime = "nodejs";

const MAX_MINTS_PER_BATCH = 100;

export async function POST(req: NextRequest) {
  const key = authenticate(req.headers);
  if (!key) return unauthorized();
  if (key.tier === "free") {
    return unauthorized("batch screening requires growth tier or above");
  }

  const rate = check({ key: `key:${key.id}:batch`, ...RATE_API_KEY });
  if (!rate.allowed) return rateLimited(rate.retryAfterSeconds);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("body must be JSON");
  }

  const mints = parseMints(body);
  if (!mints) {
    return badRequest("body must be { mints: string[] }");
  }
  if (mints.length === 0) return badRequest("mints must be a non-empty array");
  if (mints.length > MAX_MINTS_PER_BATCH) {
    return badRequest(`batch capped at ${MAX_MINTS_PER_BATCH} mints`, {
      received: mints.length,
    });
  }

  const queue: string[] = [...mints];
  const batch = createBatch(key.owner, queue);

  // Fire-and-forget. The runtime keeps the process alive for ~30s on
  // Vercel; small batches finish in-band, large ones progress in the
  // background until the worker is collected.
  void (async () => {
    const concurrency = 8;
    let cursor = 0;
    async function worker() {
      while (cursor < queue.length) {
        const i = cursor++;
        const m = queue[i];
        if (!m) continue;
        markItem(batch.id, m, { status: "running" });
        try {
          const r = await resolveVerdict(m, { useRecentCache: true });
          markItem(batch.id, m, {
            status: "done",
            verdict: r.verdict,
            source: r.source,
          });
        } catch (e) {
          markItem(batch.id, m, {
            status: "error",
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
  })();

  return ok(
    {
      id: batch.id,
      created_at: batch.createdAt,
      total: batch.total,
      status_url: `/api/v1/batch/${batch.id}`,
    },
    { headers: { "x-ratelimit-remaining": String(rate.remaining) } },
  );
}

function parseMints(body: unknown): string[] | null {
  if (!body || typeof body !== "object") return null;
  const arr = (body as { mints?: unknown }).mints;
  if (!Array.isArray(arr)) return null;
  const out: string[] = [];
  for (const v of arr) {
    if (typeof v !== "string") return null;
    out.push(v);
  }
  return out;
}

export async function GET() {
  return serverError("use POST to submit a batch; use /api/v1/batch/{id} to read status");
}
