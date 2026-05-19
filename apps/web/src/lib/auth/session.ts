import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/db";

const COOKIE_NAME = "probity_session";
const ISSUER = "probity.wienerlabs.com";
const ALG = "HS256";

function secret(): Uint8Array {
  const s =
    process.env.PROBITY_SESSION_SECRET ||
    "dev-only-rotate-before-launch-83ca1f4c97e2b6f1";
  return new TextEncoder().encode(s);
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
    .setSubject(userId)
    .setIssuedAt(now)
    .setExpirationTime(now + 60 * 60 * 24 * 30)
    .sign(secret());
}

export async function readSessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: ISSUER,
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
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
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
