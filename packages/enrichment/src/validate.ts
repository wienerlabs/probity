// Hand-rolled validators for the enrichment LLM response. No external
// dependency — the shape is small and stable, and validating here keeps
// the LLM's free-form output from poisoning the engine's deterministic
// rule input.

import type {
  EnrichmentBundle,
  GovernanceShape,
  RevenueModel,
  SectorExposure,
  SectorTag,
} from "@probity/types";

const SECTOR_TAGS: readonly SectorTag[] = [
  "alcohol",
  "gambling",
  "adult",
  "tobacco",
  "weapons",
  "conventional-finance",
  "pork",
  "lending-interest",
  "primary-utility",
  "marketplace",
  "gaming",
  "stablecoin",
  "infra",
];

export class EnrichmentValidationError extends Error {
  constructor(message: string, public readonly path?: string) {
    super(path ? `${path}: ${message}` : message);
    this.name = "EnrichmentValidationError";
  }
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function num01(v: unknown, path: string): number {
  if (typeof v !== "number" || Number.isNaN(v)) {
    throw new EnrichmentValidationError("expected number in [0,1]", path);
  }
  if (v < 0 || v > 1) {
    throw new EnrichmentValidationError(`out of range [0,1]: ${v}`, path);
  }
  return v;
}

function parseSectorTag(v: unknown, path: string): SectorTag {
  if (typeof v !== "string") {
    throw new EnrichmentValidationError("expected string", path);
  }
  if (!(SECTOR_TAGS as readonly string[]).includes(v)) {
    throw new EnrichmentValidationError(
      `unknown sector tag "${v}"; allowed: ${SECTOR_TAGS.join(", ")}`,
      path,
    );
  }
  return v as SectorTag;
}

function parseExposure(
  v: unknown,
  path: string,
  defaultSourceUrl: string,
): SectorExposure {
  if (!isObj(v)) throw new EnrichmentValidationError("expected object", path);
  const tag = parseSectorTag(v.tag, `${path}.tag`);
  const revenueShare = num01(v.revenueShare, `${path}.revenueShare`);
  const rationale =
    typeof v.rationale === "string"
      ? v.rationale
      : "(LLM extracted, no rationale provided)";

  // Prefer an LLM-supplied source_url (one of the docs we handed it).
  // Only an https?:// or canonical scheme survives; anything else
  // falls back to the derivation citation so the engine can still
  // record evidence.
  const rawSource = v.source_url;
  const validUrl =
    typeof rawSource === "string" &&
    /^(https?|ipfs|ar):\/\//i.test(rawSource.trim())
      ? rawSource.trim()
      : null;

  if (validUrl) {
    return {
      tag,
      revenueShare,
      source: {
        type: "document",
        sourceUrl: validUrl,
        contentHash: "sha256:claude-extract",
        excerpt: `${tag} · ${(revenueShare * 100).toFixed(1)}% · ${rationale.slice(0, 360)}`,
      },
    };
  }

  return {
    tag,
    revenueShare,
    source: {
      type: "derivation",
      formula: `claude.extract.exposure(tag=${tag}, share=${revenueShare.toFixed(3)})`,
      result: rationale.slice(0, 480),
      ...(defaultSourceUrl
        ? {
            inputs: [
              {
                type: "document",
                sourceUrl: defaultSourceUrl,
                contentHash: "sha256:claude-input",
                excerpt: rationale.slice(0, 200),
              },
            ],
          }
        : {}),
    },
  };
}

export function parseEnrichmentJson(
  raw: string,
  defaultSourceUrl = "",
): { revenueModel: RevenueModel; governance: GovernanceShape } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new EnrichmentValidationError(
      `LLM did not return parseable JSON: ${(e as Error).message}`,
    );
  }
  if (!isObj(parsed)) {
    throw new EnrichmentValidationError("top level must be an object");
  }

  const rm = parsed.revenueModel;
  if (!isObj(rm)) {
    throw new EnrichmentValidationError("missing object", "revenueModel");
  }
  const primary = typeof rm.primary === "string" ? rm.primary : "unknown";
  const exposuresRaw = Array.isArray(rm.exposures) ? rm.exposures : [];
  const exposures = exposuresRaw.map((e, i) =>
    parseExposure(e, `revenueModel.exposures[${i}]`, defaultSourceUrl),
  );
  // Sanity check: revenue shares are *attributions of one revenue line*.
  // The set may sum to ≤ 1 with the residual implicit; never > 1 + ε.
  const sum = exposures.reduce((a, e) => a + e.revenueShare, 0);
  const EPS = 0.01;
  if (sum > 1 + EPS) {
    throw new EnrichmentValidationError(
      `exposures sum to ${sum.toFixed(3)} — must be ≤ 1`,
      "revenueModel.exposures",
    );
  }
  const zeroSumRevenueShare = num01(
    rm.zeroSumRevenueShare ?? 0,
    "revenueModel.zeroSumRevenueShare",
  );
  const utilityScore = num01(rm.utilityScore ?? 0.5, "revenueModel.utilityScore");
  const primarySaleRatio =
    rm.primarySaleRatio === undefined || rm.primarySaleRatio === null
      ? undefined
      : num01(rm.primarySaleRatio, "revenueModel.primarySaleRatio");

  const revenueModel: RevenueModel = {
    primary,
    exposures,
    zeroSumRevenueShare,
    utilityScore,
    ...(primarySaleRatio !== undefined ? { primarySaleRatio } : {}),
  };

  const gv = parsed.governance;
  if (!isObj(gv)) {
    throw new EnrichmentValidationError("missing object", "governance");
  }
  const timelockSeconds =
    gv.timelockSeconds === null || gv.timelockSeconds === undefined
      ? null
      : (() => {
          const n = Number(gv.timelockSeconds);
          if (!Number.isFinite(n) || n < 0) {
            throw new EnrichmentValidationError(
              "expected non-negative number or null",
              "governance.timelockSeconds",
            );
          }
          return n;
        })();
  const multisigThreshold =
    gv.multisigThreshold === null || gv.multisigThreshold === undefined
      ? null
      : (() => {
          if (!isObj(gv.multisigThreshold)) {
            throw new EnrichmentValidationError(
              "expected {m, n} or null",
              "governance.multisigThreshold",
            );
          }
          const m = Number((gv.multisigThreshold as Record<string, unknown>).m);
          const n = Number((gv.multisigThreshold as Record<string, unknown>).n);
          if (!Number.isInteger(m) || !Number.isInteger(n) || m <= 0 || n < m) {
            throw new EnrichmentValidationError(
              `invalid threshold ${m}-of-${n}`,
              "governance.multisigThreshold",
            );
          }
          return { m, n };
        })();
  const freezeAuthoritySingleKey =
    typeof gv.freezeAuthoritySingleKey === "boolean"
      ? gv.freezeAuthoritySingleKey
      : false;

  const governance: GovernanceShape = {
    timelockSeconds,
    multisigThreshold,
    freezeAuthoritySingleKey,
  };

  void defaultSourceUrl;
  return { revenueModel, governance };
}

export function bundleFromExtraction(
  extraction: { revenueModel: RevenueModel; governance: GovernanceShape },
  audits: EnrichmentBundle["audits"] = [],
): EnrichmentBundle {
  return {
    audits,
    revenueModel: extraction.revenueModel,
    governance: extraction.governance,
  };
}
