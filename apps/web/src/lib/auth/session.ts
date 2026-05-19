import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/db";

const COOKIE_NAME = "probity_session";
const ISSUER = "probity.wienerlabs.com";
const AUDIENCE = "probity-web";
const ALG = "HS256";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const SESSION_MAX_AGE_SECONDS = SESSION_TTL_SECONDS;

let cachedSecret: Uint8Array | null = null;

function secret(): Uint8Array {
  if (cachedSecret) return cachedSecret;
  const raw = process.env.PROBITY_SESSION_SECRET;
  if (!raw || raw.trim().length < 32) {
    throw new Error(
      "PROBITY_SESSION_SECRET must be set to at least 32 characters before the auth subsystem can sign or verify sessions.",
    );
  }
  cachedSecret = new TextEncoder().encode(raw);
  return cachedSecret;
}

export interface SessionPayload {
  sub: string;
  pk: string;
  iat: number;
  exp: number;
}

export async function issueSession(
  userId: string,
  walletPubkey: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({ pk: walletPubkey })
    .setProtectedHeader({ alg: ALG })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(userId)
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_TTL_SECONDS)
    .sign(secret());
}

export async function readSessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: [ALG],
    });
    if (typeof payload.sub !== "string" || typeof payload.pk !== "string") {
      return null;
    }
    return {
      sub: payload.sub,
      pk: payload.pk,
      iat: Number(payload.iat ?? 0),
      exp: Number(payload.exp ?? 0),
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function currentSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const tok = jar.get(COOKIE_NAME)?.value;
  if (!tok) return null;
  return await readSessionToken(tok);
}

export async function currentUser() {
  const s = await currentSession();
  if (!s) return null;
  return await prisma.user.findUnique({
    where: { id: s.sub },
    include: {
      subscriptions: {
        where: { active: true },
        orderBy: { expiresAt: "desc" },
        take: 1,
      },
    },
  });
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

export async function expectedDomain(): Promise<string> {
  const pinned = process.env.PROBITY_DOMAIN?.trim();
  if (pinned) return pinned;
  const h = await headers();
  return (
    h.get("x-forwarded-host") ??
    h.get("host") ??
    "probity.wienerlabs.com"
  );
}
