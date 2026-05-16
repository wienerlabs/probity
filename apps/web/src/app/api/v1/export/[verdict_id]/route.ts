import { NextRequest } from "next/server";
import { createHmac } from "node:crypto";
import { authenticate } from "@/lib/api/api-keys";
import { notFound, ok, unauthorized } from "@/lib/api/responses";
import { RECORDS } from "@/lib/screening";

export const runtime = "nodejs";

const HMAC_SECRET = process.env.PROBITY_EXPORT_HMAC_SECRET ?? "probity-dev-export";

interface RouteContext {
  params: Promise<{ verdict_id: string }>;
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const key = authenticate(req.headers);
  if (!key) return unauthorized();

  const { verdict_id } = await ctx.params;
  // verdict_id form: <mint>@<rule_version>  (URL-encoded)
  const decoded = decodeURIComponent(verdict_id);
  const [mint, ruleVersion] = decoded.split("@");
  if (!mint || !ruleVersion) {
    return notFound("verdict_id must be in the form '<mint>@<rule_version>'");
  }
  const record = RECORDS.find(
    (r) => r.verdict.mint === mint && r.verdict.ruleVersion === ruleVersion,
  );
  if (!record) return notFound(`no verdict for ${mint}@${ruleVersion}`);

  const envelope = {
    issuer: "Probity (Wiener Labs)",
    schema: "probity.audit-export.v1",
    issued_at: new Date().toISOString(),
    issued_to: key.owner,
    verdict: record.verdict,
    context: record.context,
  };
  const canonical = JSON.stringify(envelope);
  const sig = createHmac("sha256", HMAC_SECRET).update(canonical).digest("hex");

  return ok(
    {
      envelope,
      signature: { algorithm: "hmac-sha256", value: sig },
    },
    {
      headers: {
        "content-disposition": `attachment; filename="probity-${mint}-${ruleVersion}.json"`,
      },
    },
  );
}
