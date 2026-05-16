import type { HolderSeriesPoint, PriceSeriesPoint } from "./types";

const DAY = 86_400;

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1_664_525 + 1_013_904_223) >>> 0;
    return s / 0xffffffff;
  };
}

// Anchored to a fixed "now" so generation is byte-stable across reruns.
const FIXED_NOW_SEC = Math.floor(
  new Date("2026-05-16T12:00:00.000Z").getTime() / 1000,
);

export function buildPriceSeries(
  seed: number,
  days: number,
  start: number,
  drift: number,
  vol: number,
): PriceSeriesPoint[] {
  const rng = seededRandom(seed);
  const series: PriceSeriesPoint[] = [];
  const startTime = FIXED_NOW_SEC - days * DAY;
  let price = start;
  for (let i = 0; i < days; i++) {
    const t = startTime + i * DAY;
    const open = price;
    const shock = (rng() - 0.5) * vol * 2;
    const close = Math.max(0.0001, open * (1 + drift + shock));
    const high = Math.max(open, close) * (1 + rng() * vol * 0.5);
    const low = Math.min(open, close) * (1 - rng() * vol * 0.5);
    series.push({ time: t, open, high, low, close });
    price = close;
  }
  return series;
}

export function buildHolderSeries(
  seed: number,
  days: number,
  start: number,
  growth: number,
): HolderSeriesPoint[] {
  const rng = seededRandom(seed + 1);
  const series: HolderSeriesPoint[] = [];
  const startTime = FIXED_NOW_SEC - days * DAY;
  let v = start;
  for (let i = 0; i < days; i++) {
    const t = startTime + i * DAY;
    v = Math.max(1, Math.floor(v * (1 + growth + (rng() - 0.5) * 0.04)));
    series.push({ time: t, value: v });
  }
  return series;
}
