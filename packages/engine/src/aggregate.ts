import type {
  RuleOutcome,
  ScoreBreakdown,
  Verdict,
} from "@probity/types";

export function aggregateVerdict(outcomes: RuleOutcome[]): Verdict {
  let anyMaterialFail = false;
  let anyMaterialFlag = false;
  let anyNonMaterialFail = false;

  for (const o of outcomes) {
    if (o.material && o.outcome === "fail") anyMaterialFail = true;
    if (o.material && o.outcome === "flag") anyMaterialFlag = true;
    if (!o.material && o.outcome === "fail") anyNonMaterialFail = true;
  }

  if (anyMaterialFail) return "haram";
  if (anyMaterialFlag || anyNonMaterialFail) return "mushtabah";
  return "halal";
}

const KIND_WEIGHT: Record<RuleOutcome["outcome"], number> = {
  pass: 1,
  flag: 0.55,
  fail: 0,
};

export function computeScoreBreakdown(outcomes: RuleOutcome[]): ScoreBreakdown {
  // Average rule-kind weight per category; categories with no rule default to 1.
  const buckets: Record<keyof ScoreBreakdown, number[]> = {
    riba: [],
    maysir: [],
    gharar: [],
    sector: [],
    governance: [],
    transparency: [],
  };
  for (const o of outcomes) {
    const key = mapCategory(o.category);
    buckets[key].push(KIND_WEIGHT[o.outcome]);
  }
  const avg = (arr: number[]): number =>
    arr.length === 0 ? 1 : arr.reduce((a, b) => a + b, 0) / arr.length;
  return {
    riba: avg(buckets.riba),
    maysir: avg(buckets.maysir),
    gharar: avg(buckets.gharar),
    sector: avg(buckets.sector),
    governance: avg(buckets.governance),
    transparency: avg(buckets.transparency),
  };
}

function mapCategory(c: RuleOutcome["category"]): keyof ScoreBreakdown {
  if (c === "haram-sector") return "sector";
  return c;
}
