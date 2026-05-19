import { NextRequest } from "next/server";
import { currentSession } from "@/lib/auth/session";
import { ok, unauthorized } from "@/lib/api/responses";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sess = await currentSession();
  if (!sess) return unauthorized("not authenticated");

  const limit = Math.max(
    1,
    Math.min(100, Number(new URL(req.url).searchParams.get("limit") ?? "50")),
  );
  const rows = await prisma.researchEntry.findMany({
    where: { userId: sess.sub },
    orderBy: { requestedAt: "desc" },
    take: limit,
  });
  return ok({
    history: rows.map((r) => ({
      id: r.id,
      mint: r.mint,
      verdict: r.verdict,
      rule_version: r.ruleVersion,
      enrichment_source: r.enrichmentSource,
      scanned_transactions: r.scannedTransactions,
      documents_ingested: r.documentsIngested,
      consensus_confidence: r.consensusConfidence,
      symbol: r.symbol,
      name: r.name,
      logo_url: r.logoUrl,
      evidence_hash: r.evidenceHash,
      requested_at: r.requestedAt.toISOString(),
    })),
  });
}
