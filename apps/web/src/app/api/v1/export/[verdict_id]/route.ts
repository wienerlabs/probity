import { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/api-keys";
import { notFound, ok, unauthorized } from "@/lib/api/responses";
import { buildAuditEnvelope, signEnvelope } from "@/lib/api/audit-export";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ verdict_id: string }>;
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const key = authenticate(req.headers);
  if (!key) return unauthorized();

  const { verdict_id } = await ctx.params;
  const decoded = decodeURIComponent(verdict_id);
  const [mint, ruleVersion] = decoded.split("@");
  if (!mint || !ruleVersion) {
    return notFound(
      "verdict_id must be in the form '<mint>@<rule_version>'",
    );
  }

  const envelope = buildAuditEnvelope(mint, ruleVersion, key.owner);
  if (!envelope) {
    return notFound(
      `no recent verdict for ${mint}@${ruleVersion}; re-screen the mint first via /api/v1/verdict/${mint}`,
    );
  }
  const signed = signEnvelope(envelope);

  return ok(signed, {
    headers: {
      "content-disposition": `attachment; filename="probity-${mint}-${ruleVersion}.json"`,
    },
  });
}
