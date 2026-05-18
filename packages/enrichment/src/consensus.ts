import type {
  EnrichmentBundle,
  RevenueModel,
  SectorExposure,
  SectorTag,
  GovernanceShape,
} from "@probity/types";
import type { ClaudeClient } from "./claude";
import { enrichTokenFromDocs, type EnrichmentInput } from "./enrich";

export interface ConsensusOptions {
  client: ClaudeClient;
  runs?: number;
  temperatureSpread?: number[];
}

export interface SectorAgreement {
  tag: SectorTag;
  occurrences: number;
  shareMedian: number;
  shareMin: number;
  shareMax: number;
  shareStddev: number;
}

export interface GovernanceAgreement {
  field: "timelockSeconds" | "multisigThreshold" | "freezeAuthoritySingleKey";
  values: string[];
  agreement: number;
}

export interface ConsensusReport {
  runs: number;
  primaryAgreement: number;
  utilityScoreMedian: number;
  utilityScoreStddev: number;
  zeroSumMedian: number;
  zeroSumStddev: number;
  sectorAgreements: SectorAgreement[];
  governanceAgreements: GovernanceAgreement[];
  confidence: number;
  warnings: string[];
}

export interface ConsensusResult {
  bundle: EnrichmentBundle;
  report: ConsensusReport;
  rawBundles: EnrichmentBundle[];
}

const DEFAULT_RUNS = 3;
const DEFAULT_TEMPERATURE_SPREAD = [0, 0, 0.2];

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  if (s.length % 2 === 1) return s[m]!;
  return (s[m - 1]! + s[m]!) / 2;
}

function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
  return Math.sqrt(v);
}

function dominantTag(bundles: EnrichmentBundle[]): {
  primaries: string[];
  primaryAgreement: number;
} {
  const counts = new Map<string, number>();
  for (const b of bundles) {
    const p = b.revenueModel.primary || "unknown";
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted[0];
  return {
    primaries: sorted.map(([p]) => p),
    primaryAgreement: top ? top[1] / bundles.length : 0,
  };
}

function aggregateExposures(bundles: EnrichmentBundle[]): {
  exposures: SectorExposure[];
  agreements: SectorAgreement[];
} {
  const byTag = new Map<SectorTag, number[]>();
  const sourcesByTag = new Map<SectorTag, SectorExposure["source"][]>();
  for (const b of bundles) {
    for (const ex of b.revenueModel.exposures) {
      const arr = byTag.get(ex.tag) ?? [];
      arr.push(ex.revenueShare);
      byTag.set(ex.tag, arr);
      const srcs = sourcesByTag.get(ex.tag) ?? [];
      srcs.push(ex.source);
      sourcesByTag.set(ex.tag, srcs);
    }
  }
  const agreements: SectorAgreement[] = [];
  const exposures: SectorExposure[] = [];
  for (const [tag, shares] of byTag.entries()) {
    const m = median(shares);
    const sd = stddev(shares);
    agreements.push({
      tag,
      occurrences: shares.length,
      shareMedian: m,
      shareMin: Math.min(...shares),
      shareMax: Math.max(...shares),
      shareStddev: sd,
    });
    const srcs = sourcesByTag.get(tag)!;
    const docSrc = srcs.find((s) => s.type === "document");
    exposures.push({
      tag,
      revenueShare: m,
      source: docSrc ?? {
        type: "derivation",
        formula: `consensus.median(tag=${tag}, n=${shares.length}, sd=${sd.toFixed(3)})`,
        result: `${(m * 100).toFixed(1)}% across ${shares.length} runs`,
      },
    });
  }
  agreements.sort((a, b) => b.shareMedian - a.shareMedian);
  // Trim so the union still sums to ≤ 1 (validator hard-fail otherwise).
  let cumulative = 0;
  const trimmed: SectorExposure[] = [];
  for (const ex of exposures.sort((a, b) => b.revenueShare - a.revenueShare)) {
    if (cumulative + ex.revenueShare > 1) {
      const remaining = Math.max(0, 1 - cumulative);
      if (remaining < 0.005) continue;
      trimmed.push({ ...ex, revenueShare: remaining });
      cumulative = 1;
      continue;
    }
    trimmed.push(ex);
    cumulative += ex.revenueShare;
  }
  return { exposures: trimmed, agreements };
}

function aggregateGovernance(bundles: EnrichmentBundle[]): {
  shape: GovernanceShape;
  agreements: GovernanceAgreement[];
} {
  const timelocks = bundles.map((b) => b.governance.timelockSeconds);
  const multisigs = bundles.map((b) => b.governance.multisigThreshold);
  const freezeFlags = bundles.map((b) => b.governance.freezeAuthoritySingleKey);

  const timelockValues = timelocks.map((v) => (v === null ? "null" : String(v)));
  const multisigValues = multisigs.map((v) =>
    v === null ? "null" : `${v.m}-of-${v.n}`,
  );
  const freezeValues = freezeFlags.map((v) => String(v));

  function modal<T>(xs: T[]): { value: T; agreement: number } {
    const counts = new Map<string, number>();
    for (const x of xs) counts.set(JSON.stringify(x), (counts.get(JSON.stringify(x)) ?? 0) + 1);
    const [top] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    return {
      value: JSON.parse(top![0]) as T,
      agreement: top![1] / xs.length,
    };
  }

  const tlMode = modal(timelocks);
  const msMode = modal(multisigs);
  const fzMode = modal(freezeFlags);

  const agreements: GovernanceAgreement[] = [
    {
      field: "timelockSeconds",
      values: timelockValues,
      agreement: tlMode.agreement,
    },
    {
      field: "multisigThreshold",
      values: multisigValues,
      agreement: msMode.agreement,
    },
    {
      field: "freezeAuthoritySingleKey",
      values: freezeValues,
      agreement: fzMode.agreement,
    },
  ];

  return {
    shape: {
      timelockSeconds: tlMode.value,
      multisigThreshold: msMode.value,
      freezeAuthoritySingleKey: fzMode.value,
    },
    agreements,
  };
}

export function summariseConsensus(
  bundles: EnrichmentBundle[],
): { bundle: EnrichmentBundle; report: ConsensusReport } {
  if (bundles.length === 0) {
    throw new Error("summariseConsensus: no bundles supplied");
  }
  const warnings: string[] = [];
  const { primaries, primaryAgreement } = dominantTag(bundles);
  const top = primaries[0] ?? "unknown";
  if (primaryAgreement < 1) {
    warnings.push(
      `Primary revenue label disagreed across runs: ${primaries.join(" / ")}`,
    );
  }
  const utils = bundles.map((b) => b.revenueModel.utilityScore);
  const utilityScoreMedian = median(utils);
  const utilityScoreStddev = stddev(utils);
  if (utilityScoreStddev > 0.2)
    warnings.push(`Utility score wobble: stddev ${utilityScoreStddev.toFixed(2)}`);

  const zss = bundles.map((b) => b.revenueModel.zeroSumRevenueShare);
  const zeroSumMedian = median(zss);
  const zeroSumStddev = stddev(zss);

  const { exposures, agreements: sectorAgreements } = aggregateExposures(bundles);
  if (sectorAgreements.some((a) => a.shareStddev > 0.2))
    warnings.push("Sector exposure shares wobble across runs");

  const { shape, agreements: governanceAgreements } = aggregateGovernance(
    bundles,
  );

  const sectorAvgAgreement =
    sectorAgreements.length === 0
      ? 1
      : sectorAgreements.reduce((a, x) => a + x.occurrences / bundles.length, 0) /
        sectorAgreements.length;
  const govAvgAgreement =
    governanceAgreements.reduce((a, g) => a + g.agreement, 0) /
    governanceAgreements.length;

  const confidence =
    0.45 * primaryAgreement +
    0.25 * sectorAvgAgreement +
    0.15 * govAvgAgreement +
    0.15 * (1 - Math.min(1, utilityScoreStddev * 4));

  if (confidence < 0.7)
    warnings.push(`Low cross-run confidence: ${confidence.toFixed(2)}`);

  const audits = bundles.flatMap((b) => b.audits);
  const seen = new Set<string>();
  const uniqueAudits = audits.filter((a) => {
    const k = `${a.sourceUrl}::${a.contentHash}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const revenueModel: RevenueModel = {
    primary: top,
    exposures,
    zeroSumRevenueShare: zeroSumMedian,
    utilityScore: utilityScoreMedian,
  };

  return {
    bundle: {
      audits: uniqueAudits,
      revenueModel,
      governance: shape,
    },
    report: {
      runs: bundles.length,
      primaryAgreement,
      utilityScoreMedian,
      utilityScoreStddev,
      zeroSumMedian,
      zeroSumStddev,
      sectorAgreements,
      governanceAgreements,
      confidence,
      warnings,
    },
  };
}

export async function enrichWithConsensus(
  input: EnrichmentInput,
  opts: ConsensusOptions,
): Promise<ConsensusResult> {
  const runs = opts.runs ?? DEFAULT_RUNS;
  const temps = opts.temperatureSpread ?? DEFAULT_TEMPERATURE_SPREAD;
  const bundles = await Promise.all(
    Array.from({ length: runs }, async (_, i) =>
      enrichTokenFromDocs(input, {
        client: opts.client,
        temperature: temps[i] ?? 0,
      }),
    ),
  );
  const { bundle, report } = summariseConsensus(bundles);
  return { bundle, report, rawBundles: bundles };
}

export function confidenceLabel(c: number): "high" | "medium" | "low" {
  if (c >= 0.85) return "high";
  if (c >= 0.65) return "medium";
  return "low";
}
