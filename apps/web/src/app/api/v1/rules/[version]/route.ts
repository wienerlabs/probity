import { NextRequest } from "next/server";
import { listRuleVersions, loadRuleSet } from "@probity/engine";
import { check, clientIp, RATE_PUBLIC } from "@/lib/api/rate-limit";
import { badRequest, notFound, ok, rateLimited } from "@/lib/api/responses";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ version: string }>;
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { version } = await ctx.params;
  if (!version) return badRequest("version path parameter is required");

  const ip = clientIp(req.headers);
  const rate = check({ key: `ip:${ip}:rules`, ...RATE_PUBLIC });
  if (!rate.allowed) return rateLimited(rate.retryAfterSeconds);

  try {
    const rules = loadRuleSet(version);
    return ok({
      version,
      known_versions: listRuleVersions(),
      rules: rules.map((r) => ({
        id: r.id,
        version: r.version,
        category: r.category,
        material: r.material,
        description: r.description,
      })),
    });
  } catch {
    return notFound(
      `unknown rule version "${version}". known: ${listRuleVersions().join(", ")}`,
    );
  }
}
