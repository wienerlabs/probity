import { screen } from "@probity/engine";
import type { VerdictRecord, ScreeningContext } from "@probity/types";
import { FIXTURES } from "./fixtures";
import { buildHolderSeries, buildPriceSeries } from "./series";
import type { HolderSeriesPoint, PriceSeriesPoint } from "./types";

export interface DemoRecord {
  context: ScreeningContext;
  verdict: VerdictRecord;
  priceSeries: PriceSeriesPoint[];
  holderSeries: HolderSeriesPoint[];
}

// Computed once at module load. Deterministic: same fixtures + pinned now() →
// byte-identical verdicts across reloads.
async function computeAll(): Promise<DemoRecord[]> {
  const out: DemoRecord[] = [];
  for (const fx of FIXTURES) {
    const verdict = await screen(fx.context, {
      attestationPubkey: fx.attestationPubkey,
    });
    out.push({
      context: fx.context,
      verdict,
      priceSeries: buildPriceSeries(
        fx.seriesSeed,
        90,
        fx.priceStart,
        fx.priceDrift,
        fx.priceVol,
      ),
      holderSeries: buildHolderSeries(
        fx.seriesSeed,
        90,
        fx.holderStart,
        fx.holderGrowth,
      ),
    });
  }
  return out;
}

export const RECORDS: DemoRecord[] = await computeAll();

export function findRecord(query: string): DemoRecord | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  return RECORDS.find(
    (r) =>
      r.verdict.mint.toLowerCase() === q ||
      r.context.state.metadata.symbol.toLowerCase() === q ||
      r.context.state.metadata.name.toLowerCase() === q,
  );
}
