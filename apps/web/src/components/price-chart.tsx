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

function readThemeColors() {
  if (typeof document === "undefined") {
    return {
      text: "#a1a1aa",
      border: "rgba(255,255,255,0.08)",
      grid: "rgba(255,255,255,0.04)",
      candleUp: "rgba(250,250,250,0.92)",
      candleDown: "rgba(120,120,120,0.92)",
      crosshair: "rgba(255,255,255,0.2)",
      crosshairBg: "#161616",
    };
  }
  const cs = getComputedStyle(document.documentElement);
  const isDark =
    document.documentElement.getAttribute("data-theme") !== "light";
  return {
    text: cs.getPropertyValue("--color-muted").trim() || "#71717a",
    border: cs.getPropertyValue("--color-border").trim() || "rgba(0,0,0,0.08)",
    grid: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)",
    candleUp: isDark ? "rgba(250,250,250,0.92)" : "rgba(24,24,27,0.92)",
    candleDown: isDark ? "rgba(120,120,120,0.85)" : "rgba(161,161,170,0.85)",
    crosshair: isDark ? "rgba(255,255,255,0.22)" : "rgba(24,24,27,0.32)",
    crosshairBg: isDark ? "#1c1c22" : "#ffffff",
  };
}

export function PriceChart({ verdict, price, holders }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const accent = verdictColor(verdict);
    const c = readThemeColors();

    const chart = createChart(ref.current, {
      width: ref.current.clientWidth,
      height: 380,
      layout: {
        background: { color: "transparent" },
        textColor: c.text,
        fontFamily:
          "var(--font-funnel), ui-sans-serif, system-ui, -apple-system, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: c.grid },
        horzLines: { color: c.grid },
      },
      rightPriceScale: { borderColor: c.border },
      timeScale: { borderColor: c.border, timeVisible: false },
      crosshair: {
        vertLine: { color: c.crosshair, labelBackgroundColor: c.crosshairBg },
        horzLine: { color: c.crosshair, labelBackgroundColor: c.crosshairBg },
      },
    });

    const candle = chart.addSeries(CandlestickSeries, {
      upColor: c.candleUp,
      downColor: c.candleDown,
      borderUpColor: c.candleUp,
      borderDownColor: c.candleDown,
      wickUpColor: c.candleUp,
      wickDownColor: c.candleDown,
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
    overlay.setData(holders.map((h) => ({ time: h.time as Time, value: h.value })));

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const onResize = () => {
      if (!ref.current) return;
      chart.applyOptions({ width: ref.current.clientWidth });
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(ref.current);

    const themeObserver = new MutationObserver(() => {
      const nc = readThemeColors();
      chart.applyOptions({
        layout: { textColor: nc.text },
        grid: {
          vertLines: { color: nc.grid },
          horzLines: { color: nc.grid },
        },
        rightPriceScale: { borderColor: nc.border },
        timeScale: { borderColor: nc.border },
        crosshair: {
          vertLine: {
            color: nc.crosshair,
            labelBackgroundColor: nc.crosshairBg,
          },
          horzLine: {
            color: nc.crosshair,
            labelBackgroundColor: nc.crosshairBg,
          },
        },
      });
      candle.applyOptions({
        upColor: nc.candleUp,
        downColor: nc.candleDown,
        borderUpColor: nc.candleUp,
        borderDownColor: nc.candleDown,
        wickUpColor: nc.candleUp,
        wickDownColor: nc.candleDown,
      });
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      ro.disconnect();
      themeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [verdict, price, holders]);

  return (
    <div className="surface overflow-hidden">
      <div
        className="flex items-center justify-between px-5 py-3.5"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-2)]">
          Price · 90d candles
        </p>
        <div className="flex items-center gap-4 text-xs text-[var(--color-muted)]">
          <span className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-[2px] rounded-full"
              style={{ background: "var(--color-text)" }}
            />
            price
          </span>
          <span className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-[2px] rounded-full"
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
