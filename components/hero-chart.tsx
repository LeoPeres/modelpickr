"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CatalogModel } from "@/lib/catalog/types";
import { defaultUsage, monthlyCost, pointsPerDoubling } from "@/lib/engine";
import { formatNumber, formatPrice, formatUsdShort } from "@/lib/i18n";

/**
 * Average USD per 1M tokens at the default usage's input/output mix. It is
 * proportional to `monthlyCost(defaultUsage)`, so the value line drawn here
 * agrees with `recommend(models, defaultUsage, "value")`.
 */
export const mixPrice = (m: CatalogModel) =>
  (monthlyCost(defaultUsage, m.price) * 1e6) /
  (defaultUsage.requests *
    (defaultUsage.inputTokens + defaultUsage.outputTokens));

export type HeroMark = {
  model: CatalogModel;
  label: string;
  tone: "accent" | "intel" | "good";
};

const margin = { top: 28, right: 16, bottom: 34, left: 38 };
const eci = (m: CatalogModel) => m.intelligence!.value;

/**
 * Every rated model on price (log x) × ECI (y). Hover or tap shows a model,
 * clicking toggles it in the selection. Decorative for assistive tech: the
 * table below is the accessible way to select.
 */
export function HeroChart({
  models,
  marks,
  frontier,
  selected,
  onToggle,
}: {
  models: CatalogModel[];
  marks: HeroMark[];
  /** Draws the equal-value line through this model. */
  frontier?: CatalogModel;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<string | null>(null);
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry.contentRect.width)),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const height = width && width < 520 ? 280 : 340;
  const plot = useMemo(() => {
    if (width < 200 || !models.length) return null;
    const xs = models.map(mixPrice);
    const ys = models.map(eci);
    const lx0 = Math.log10(Math.min(...xs)) - 0.12;
    const lx1 = Math.log10(Math.max(...xs)) + 0.12;
    const y0 = Math.floor((Math.min(...ys) - 2) / 10) * 10;
    const y1 = Math.ceil((Math.max(...ys) + 4) / 10) * 10;
    const left = margin.left;
    const right = width - margin.right;
    const top = margin.top;
    const bottom = height - margin.bottom;
    const px = (v: number) =>
      left + ((Math.log10(v) - lx0) / (lx1 - lx0)) * (right - left);
    const py = (v: number) => bottom - ((v - y0) / (y1 - y0)) * (bottom - top);
    const points = models
      .map((m) => ({ m, cx: px(mixPrice(m)), cy: py(eci(m)) }))
      .sort((a, b) => a.cx - b.cx);
    const xTicks: number[] = [];
    for (let e = Math.ceil(lx0); e <= Math.floor(lx1); e++)
      xTicks.push(10 ** e);
    const yTicks: number[] = [];
    for (let v = y0; v <= y1; v += 10) yTicks.push(v);
    // Same value as the frontier model: ECI − k·log2(price) is constant.
    let line: [number, number, number, number] | null = null;
    if (frontier) {
      const at = (lx: number) =>
        eci(frontier) +
        pointsPerDoubling * Math.log2(10 ** lx / mixPrice(frontier));
      line = [left, py(at(lx0)), right, py(at(lx1))];
    }
    return { left, right, top, bottom, px, py, points, xTicks, yTicks, line };
  }, [models, frontier, width, height]);

  const nearest = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!plot) return null;
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    let best: string | null = null;
    let min = 26 ** 2;
    for (const p of plot.points) {
      const d = (p.cx - x) ** 2 + (p.cy - y) ** 2;
      if (d < min) [min, best] = [d, p.m.id];
    }
    return best;
  };
  const current = plot?.points.find((p) => p.m.id === active);
  const markOf = new Map(marks.map((mark) => [mark.model.id, mark]));

  return (
    <div
      className={`hero-chart ${active ? "has-active" : ""}`}
      ref={box}
      style={{ height }}
    >
      {plot && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Custo × inteligência de ${models.length} modelos avaliados`}
          style={{ cursor: active ? "pointer" : "default" }}
          onPointerMove={(e) => setActive(nearest(e))}
          onPointerDown={(e) => {
            setTouch(e.pointerType !== "mouse");
            setActive(nearest(e));
          }}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") setActive(null);
          }}
          onClick={(e) => {
            const id = nearest(e);
            if (id) onToggle(id);
          }}
        >
          <defs>
            <clipPath id="hero-plot">
              <rect
                x={plot.left}
                y={plot.top}
                width={plot.right - plot.left}
                height={plot.bottom - plot.top}
              />
            </clipPath>
          </defs>
          <g className="hero-chart-axis">
            {plot.yTicks.map((v) => (
              <g key={v}>
                <line
                  className={v === plot.yTicks[0] ? "baseline" : "grid"}
                  x1={plot.left}
                  x2={plot.right}
                  y1={plot.py(v)}
                  y2={plot.py(v)}
                />
                <text x={plot.left - 8} y={plot.py(v) + 4} textAnchor="end">
                  {v}
                </text>
              </g>
            ))}
            {plot.xTicks.map((v) => (
              <text
                key={v}
                x={plot.px(v)}
                y={plot.bottom + 20}
                textAnchor="middle"
              >
                {formatUsdShort(v)}
              </text>
            ))}
          </g>
          {plot.line && (
            <line
              className="hero-chart-frontier"
              clipPath="url(#hero-plot)"
              x1={plot.line[0]}
              y1={plot.line[1]}
              x2={plot.line[2]}
              y2={plot.line[3]}
            />
          )}
          {plot.points.map(({ m, cx, cy }, i) => {
            const mark = markOf.get(m.id);
            const isSelected = selected.includes(m.id);
            return (
              <g
                key={m.id}
                className={[
                  "hero-dot",
                  mark && `tone-${mark.tone}`,
                  isSelected && "is-selected",
                  active === m.id && "is-active",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ animationDelay: `${120 + i * 9}ms` }}
              >
                {(mark || isSelected || active === m.id) && (
                  <circle className="halo" cx={cx} cy={cy} r={11} />
                )}
                <circle cx={cx} cy={cy} r={mark || isSelected ? 5.5 : 4} />
              </g>
            );
          })}
        </svg>
      )}
      {plot &&
        marks.map(({ model, label, tone }) => {
          const p = plot.points.find((q) => q.m.id === model.id);
          if (!p) return null;
          const flip = p.cx > width * 0.62;
          // Above the point when the label fits there, else below it.
          const below = p.cy - 48 < 0;
          return (
            <span
              key={label}
              className={`hero-mark tone-${tone}`}
              aria-hidden="true"
              style={{
                left: p.cx,
                top: p.cy,
                transform: `translate(${flip ? "calc(-100% - 12px)" : "12px"}, ${below ? "8px" : "calc(-100% - 8px)"})`,
              }}
            >
              <small>{label}</small>
              {model.name}
            </span>
          );
        })}
      {plot && current && (
        <div
          className="chart-tooltip hero-chart-tooltip"
          aria-hidden="true"
          style={{
            left: current.cx,
            top: current.cy,
            transform: `translate(${current.cx > width / 2 ? "calc(-100% - 16px)" : "16px"}, ${current.cy > height / 2 ? "calc(-100% + 8px)" : "-8px"})`,
          }}
        >
          <strong>{current.m.name}</strong>
          <span>
            {current.m.providerName} · ECI{" "}
            {formatNumber(Math.round(eci(current.m)))} ·{" "}
            {formatPrice(mixPrice(current.m))}/1M
          </span>
          <em>
            {selected.includes(current.m.id)
              ? `Selecionado · ${touch ? "toque" : "clique"} para remover`
              : `${touch ? "Toque" : "Clique"} para selecionar`}
          </em>
        </div>
      )}
    </div>
  );
}
