"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  type IChartApi,
  type Time,
} from "lightweight-charts";
import type { HolderSeriesPoint, PriceSeriesPoint, Verdict } from "@/lib/types";
import { verdictColor } from "./verdict-badge";

interface Props {
  verdict: Verdict;
  price: PriceSeriesPoint[];
  holders: HolderSeriesPoint[];
}

export function PriceChart({ verdict, price, holders }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const accent = verdictColor(verdict);

    const chart = createChart(ref.current, {
      width: ref.current.clientWidth,
      height: 360,
      layout: {
        background: { color: "transparent" },
        textColor: "#a1a1aa",
        fontFamily:
          "var(--font-funnel), ui-sans-serif, system-ui, -apple-system, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: false,
      },
      crosshair: {
        vertLine: { color: "rgba(255,255,255,0.18)", labelBackgroundColor: "#161616" },
        horzLine: { color: "rgba(255,255,255,0.18)", labelBackgroundColor: "#161616" },
      },
    });

    const candle = chart.addSeries(CandlestickSeries, {
      upColor: "rgba(250,250,250,0.92)",
      downColor: "rgba(120,120,120,0.92)",
      borderUpColor: "rgba(250,250,250,0.92)",
      borderDownColor: "rgba(120,120,120,0.92)",
      wickUpColor: "rgba(250,250,250,0.55)",
      wickDownColor: "rgba(120,120,120,0.55)",
    });
    candle.setData(
      price.map((p) => ({
        time: p.time as Time,
        open: p.open,
        high: p.high,
        low: p.low,
        close: p.close,
      })),
    );

    const overlay = chart.addSeries(LineSeries, {
      color: accent,
      lineWidth: 2,
      priceScaleId: "holders",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale("holders").applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
      visible: false,
    });
    overlay.setData(
      holders.map((h) => ({ time: h.time as Time, value: h.value })),
    );

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const onResize = () => {
      if (!ref.current) return;
      chart.applyOptions({ width: ref.current.clientWidth });
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(ref.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [verdict, price, holders]);

  return (
    <div className="surface">
      <div className="flex items-center justify-between px-4 py-3 hairline">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
            Price · 90d candles
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-[var(--color-muted)]">
          <span className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-[2px]"
              style={{ background: "rgba(250,250,250,0.92)" }}
            />
            price
          </span>
          <span className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-[2px]"
              style={{ background: verdictColor(verdict) }}
            />
            holders
          </span>
        </div>
      </div>
      <div ref={ref} className="w-full" />
    </div>
  );
}
