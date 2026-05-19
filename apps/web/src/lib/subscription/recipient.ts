export function subscriptionRecipient(): string {
  return (
    process.env.PROBITY_SUBSCRIPTION_RECIPIENT ||
    "J3Vbra9CobQQsXjm4Lxyo4owfU2dQYbkY53wL4mshM7E"
  );
}

export function subscriptionLamports(): bigint {
  const raw = process.env.PROBITY_SUBSCRIPTION_LAMPORTS ?? "100000000";
  try {
    return BigInt(raw);
  } catch {
    return 100_000_000n;
  }
}

export function subscriptionDays(): number {
  const raw = Number(process.env.PROBITY_SUBSCRIPTION_DAYS ?? "30");
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 30;
}
