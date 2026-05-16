import { NextResponse } from "next/server";

const ACTIVE_RULE_VERSION = "0.1.0";

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export function ok<T>(body: T, init?: { headers?: Record<string, string> }) {
  return NextResponse.json(body, {
    status: 200,
    headers: {
      "x-probity-rule-version": ACTIVE_RULE_VERSION,
      "cache-control": "public, max-age=0, must-revalidate",
      ...(init?.headers ?? {}),
    },
  });
}

export function err(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
) {
  const body: ApiErrorBody = { error: { code, message, ...(details ? { details } : {}) } };
  return NextResponse.json(body, {
    status,
    headers: {
      "x-probity-rule-version": ACTIVE_RULE_VERSION,
      "cache-control": "no-store",
    },
  });
}

export function notFound(message = "not found") {
  return err(404, "not_found", message);
}

export function badRequest(message: string, details?: Record<string, unknown>) {
  return err(400, "bad_request", message, details);
}

export function unauthorized(message = "missing or invalid API key") {
  return err(401, "unauthorized", message);
}

export function rateLimited(retryAfterSeconds: number) {
  const r = err(429, "rate_limited", "request rate exceeded for this tier", {
    retry_after_seconds: retryAfterSeconds,
  });
  r.headers.set("retry-after", String(retryAfterSeconds));
  return r;
}

export function serverError(message: string) {
  return err(500, "server_error", message);
}

export { ACTIVE_RULE_VERSION };
