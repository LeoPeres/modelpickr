"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { pointsPerDoubling } from "@/lib/engine";
import {
  formatNumber as number,
  formatUsd as usd,
  formatUsdShort,
} from "@/lib/i18n";

export type ChartPoint = {
  id: string;
  name: string;
  cost: number;
  eci: number;
  low: number;
  high: number;
};

type Box = { x: number; y: number; w: number; h: number };
type Anchor = "start" | "middle" | "end";

const margin = { top: 28, right: 12, bottom: 44, left: 40 };
const labelSize = 12;
const labelHeight = 16;
const labelGap = 9;

/** 1-2-5 ticks inside [lo, hi] on a log scale, thinned to fit the width. */
function logTicks(lo: number, hi: number, px: (v: number) => number) {
  const first = Math.floor(Math.log10(lo));
  const last = Math.ceil(Math.log10(hi));
  for (const steps of [[1, 2, 5], [1, 3], [1]]) {
    const ticks: number[] = [];
    for (let e = first; e <= last; e++)
      for (const s of steps) {
        const v = s * 10 ** e;
        if (v >= lo && v <= hi) ticks.push(v);
      }
    const tight = ticks.some((v, i) => i && px(v) - px(ticks[i - 1]) < 64);
    if (!tight || steps.length === 1) {
      if (ticks.length >= 3) return ticks;
      break;
    }
  }
  // Narrow ranges (less than a decade): plain round steps read better.
  const step = niceStep(lo, hi, 4);
  const linear: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step)
    if (!linear.length || px(v) - px(linear.at(-1)!) >= 64) linear.push(v);
  return linear;
}

/** Round step (1, 2, 5 × 10^k) giving about `count` ticks over [lo, hi]. */
function niceStep(lo: number, hi: number, count: number) {
  const raw = (hi - lo) / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((s) => s * mag).find((s) => s >= raw) ?? raw;
}

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Monthly cost (log x) against ECI (y). Log scale because costs span orders
 * of magnitude and the value rule is in log2(cost): on this axis the "same
 * value as the recommendation" curve is a straight line.
 */
export function CostChart({
  points,
  highlight,
  frontier,
  emphasis,
  onPick,
}: {
  points: ChartPoint[];
  /** Recommended models: accent dot and a label that is always placed. */
  highlight: Set<string>;
  /** Draws the equal-value line through this model (value goal only). */
  frontier?: ChartPoint;
  /** Model highlighted from outside the chart (e.g. its card is hovered). */
  emphasis?: string | null;
  /** Clicking a point (or a second tap on touch) picks its model. */
  onPick?: (id: string) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [font, setFont] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [touch, setTouch] = useState(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry.contentRect.width)),
    );
    observer.observe(el);
    setFont(getComputedStyle(el).fontFamily);
    return () => observer.disconnect();
  }, []);

  const measure = useMemo(() => {
    const ctx = font ? document.createElement("canvas").getContext("2d") : null;
    return (text: string, bold: boolean) => {
      if (!ctx) return text.length * 7;
      ctx.font = `${bold ? 600 : 400} ${labelSize}px ${font}`;
      return ctx.measureText(text).width;
    };
  }, [font]);

  const height = width && width < 560 ? 300 : 360;
  const plot = {
    left: margin.left,
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
  };

  const layout = useMemo(() => {
    // Too narrow to draw (e.g. mid-layout): wait for a real width.
    if (width < 160 || !points.length) return null;
    // X: log domain with a little air on both sides.
    const costs = points.map((p) => p.cost);
    let lx = Math.log10(Math.min(...costs));
    let hx = Math.log10(Math.max(...costs));
    if (hx - lx < 0.5) [lx, hx] = [(lx + hx) / 2 - 0.25, (lx + hx) / 2 + 0.25];
    const padX = (hx - lx) * 0.07;
    [lx, hx] = [lx - padX, hx + padX];
    const x = (v: number) =>
      plot.left + ((Math.log10(v) - lx) / (hx - lx)) * (plot.right - plot.left);
    const xTicks = logTicks(10 ** lx, 10 ** hx, x);

    // Y: linear ECI with a little air; ticks are the round values inside.
    const ecis = points.map((p) => p.eci);
    let ly = Math.min(...ecis);
    let hy = Math.max(...ecis);
    if (hy - ly < 4) [ly, hy] = [(ly + hy) / 2 - 2, (ly + hy) / 2 + 2];
    const padY = (hy - ly) * 0.1;
    [ly, hy] = [ly - padY, hy + padY];
    const y = (v: number) =>
      plot.bottom - ((v - ly) / (hy - ly)) * (plot.bottom - plot.top);
    const step = niceStep(ly, hy, height < 340 ? 4 : 5);
    const yTicks: number[] = [];
    for (let v = Math.ceil(ly / step) * step; v <= hy; v += step)
      yTicks.push(Math.round(v * 100) / 100);

    const placed = points.map((p) => ({ ...p, cx: x(p.cost), cy: y(p.eci) }));

    // Equal-value line: eci = k + pointsPerDoubling · log2(cost).
    let line: [number, number, number, number] | null = null;
    if (frontier) {
      const k = frontier.eci - pointsPerDoubling * Math.log2(frontier.cost);
      const at = (c: number) => k + pointsPerDoubling * Math.log2(c);
      const [c0, c1] = [10 ** lx, 10 ** hx];
      line = [x(c0), y(at(c0)), x(c1), y(at(c1))];
    }

    // Labels: greedy, recommended first, then in ranking order. A label goes
    // where it hits no dot, no other label and not the line, inside the
    // chart; otherwise it is dropped and the tooltip carries the name. The
    // recommended label falls back to its first spot that fits the chart.
    const dots = placed.map((p) => ({
      id: p.id,
      x: p.cx - 7,
      y: p.cy - 7,
      w: 14,
      h: 14,
    }));
    const obstacles: Box[] = [];
    if (line) {
      const [x0, y0, x1, y1] = line;
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4);
      for (let i = 0; i <= n; i++) {
        const [px, py] = [x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n];
        if (py >= plot.top && py <= plot.bottom)
          obstacles.push({ x: px - 1, y: py - 1, w: 2, h: 2 });
      }
    }
    const taken: Box[] = [];
    const labels = new Map<string, { x: number; y: number; anchor: Anchor }>();
    const order = [
      ...placed.filter((p) => highlight.has(p.id)),
      ...placed.filter((p) => !highlight.has(p.id)),
    ];
    for (const p of order) {
      const w = measure(p.name, highlight.has(p.id));
      const h = labelHeight;
      const candidates: [number, number, Anchor][] = [
        [p.cx + labelGap, p.cy - h / 2, "start"],
        [p.cx - labelGap - w, p.cy - h / 2, "end"],
        [p.cx - w / 2, p.cy - labelGap - h, "middle"],
        [p.cx - w / 2, p.cy + labelGap, "middle"],
        [p.cx + 4, p.cy - labelGap - h + 2, "start"],
        [p.cx - 4 - w, p.cy - labelGap - h + 2, "end"],
        [p.cx + 4, p.cy + labelGap - 2, "start"],
        [p.cx - 4 - w, p.cy + labelGap - 2, "end"],
      ];
      const boxOf = ([bx, by]: [number, number, Anchor]) => ({
        x: bx - 2,
        y: by,
        w: w + 4,
        h,
      });
      const inside = (box: Box) =>
        box.x >= 0 &&
        box.x + box.w <= width &&
        box.y >= 0 &&
        box.y + box.h <= plot.bottom;
      const spot =
        candidates.find((c) => {
          const box = boxOf(c);
          return (
            inside(box) &&
            !taken.some((t) => overlaps(t, box)) &&
            !obstacles.some((o) => overlaps(o, box)) &&
            !dots.some((d) => d.id !== p.id && overlaps(d, box))
          );
        }) ??
        (highlight.has(p.id)
          ? candidates.find((c) => inside(boxOf(c)))
          : undefined);
      if (!spot) continue;
      const [bx, by, anchor] = spot;
      taken.push(boxOf(spot));
      labels.set(p.id, {
        x: anchor === "start" ? bx : anchor === "end" ? bx + w : bx + w / 2,
        y: by + h / 2,
        anchor,
      });
    }

    return { placed, labels, xTicks, yTicks, x, y, line };
    // plot is derived from width/height.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, highlight, frontier, width, height, measure]);

  if (!points.length) return null;

  const nearest = (mx: number, my: number) => {
    if (!layout) return null;
    let found: string | null = null;
    let min = 36 ** 2;
    for (const p of layout.placed) {
      const d = (p.cx - mx) ** 2 + (p.cy - my) ** 2;
      if (d < min) [min, found] = [d, p.id];
    }
    return found;
  };
  const hit = (e: React.MouseEvent<SVGRectElement>) => {
    const box = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    return nearest(e.clientX - box.left, e.clientY - box.top);
  };
  const onPointer = (e: React.PointerEvent<SVGRectElement>) => {
    setTouch(e.pointerType !== "mouse");
    if (e.pointerType === "mouse") return setActive(hit(e));
    // Touch: the first tap shows the tooltip, a second one picks.
    if (e.type !== "pointerdown") return;
    const id = hit(e);
    if (id && id === active) onPick?.(id);
    else setActive(id);
  };

  const shown = active ?? emphasis ?? null;
  const current = layout?.placed.find((p) => p.id === shown);
  // Recommended dots are drawn last so they sit on top.
  const drawOrder = layout
    ? [
        ...layout.placed.filter((p) => !highlight.has(p.id)),
        ...layout.placed.filter((p) => highlight.has(p.id)),
      ]
    : [];

  return (
    <div className="cost-chart" ref={wrap} style={{ height: height || 360 }}>
      {layout && (
        <svg
          width={width}
          height={height}
          role="group"
          aria-label="Gráfico de custo mensal por inteligência (ECI)"
        >
          <defs>
            <clipPath id="cost-chart-plot">
              <rect
                x={plot.left}
                y={plot.top}
                width={plot.right - plot.left}
                height={plot.bottom - plot.top}
              />
            </clipPath>
          </defs>

          <g className="cost-chart-axis" aria-hidden>
            {layout.yTicks.map((v) => (
              <g key={v}>
                <line
                  x1={plot.left}
                  x2={plot.right}
                  y1={layout.y(v)}
                  y2={layout.y(v)}
                  className="grid"
                />
                <text x={plot.left - 10} y={layout.y(v)} textAnchor="end">
                  {number(v)}
                </text>
              </g>
            ))}
            <line
              x1={plot.left}
              x2={plot.right}
              y1={plot.bottom}
              y2={plot.bottom}
              className="baseline"
            />
            {layout.xTicks.map((v) => (
              <text
                key={v}
                x={layout.x(v)}
                y={plot.bottom + 18}
                textAnchor="middle"
              >
                {formatUsdShort(v)}
              </text>
            ))}
            <text x={plot.left - 10} y={plot.top - 16} textAnchor="start">
              ECI
            </text>
            <text x={plot.right} y={height - 6} textAnchor="end">
              Custo mensal (escala log) →
            </text>
          </g>

          {layout.line && (
            <line
              className="cost-chart-frontier"
              x1={layout.line[0]}
              y1={layout.line[1]}
              x2={layout.line[2]}
              y2={layout.line[3]}
              clipPath="url(#cost-chart-plot)"
            />
          )}

          {current && (
            <g className="cost-chart-guide" aria-hidden>
              <line
                x1={current.cx}
                x2={current.cx}
                y1={layout.y(current.low)}
                y2={layout.y(current.high)}
                clipPath="url(#cost-chart-plot)"
              />
              {[current.low, current.high].map((v) => (
                <line
                  key={v}
                  x1={current.cx - 4}
                  x2={current.cx + 4}
                  y1={layout.y(v)}
                  y2={layout.y(v)}
                  clipPath="url(#cost-chart-plot)"
                />
              ))}
            </g>
          )}

          {drawOrder.map((p) => {
            const top = highlight.has(p.id);
            const label = layout.labels.get(p.id);
            const on = p.id === shown;
            return (
              <g
                key={p.id}
                className={`cost-chart-point${top ? " is-top" : ""}${on ? " is-active" : ""}`}
                tabIndex={0}
                role="img"
                aria-label={`${p.name}: ECI ${number(p.eci)}, ${usd(p.cost)} por mês${top ? ", recomendado" : ""}`}
                onFocus={() => setActive(p.id)}
                onBlur={() => setActive(null)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onPick?.(p.id);
                  }
                }}
              >
                {top && <circle cx={p.cx} cy={p.cy} r={13} className="halo" />}
                <circle cx={p.cx} cy={p.cy} r={on ? 7 : top ? 6 : 5} />
                {label && (
                  <text
                    x={label.x}
                    y={label.y}
                    textAnchor={label.anchor}
                    dominantBaseline="central"
                  >
                    {p.name}
                  </text>
                )}
              </g>
            );
          })}

          <rect
            x={plot.left}
            y={plot.top - 12}
            width={plot.right - plot.left}
            height={plot.bottom - plot.top + 12}
            fill="transparent"
            style={{ cursor: active && onPick ? "pointer" : "default" }}
            onPointerMove={onPointer}
            onPointerDown={onPointer}
            onClick={(e) => {
              const id = touch ? null : hit(e);
              if (id) onPick?.(id);
            }}
            onPointerLeave={(e) => {
              // A tap ends with a leave; keep its tooltip until the next tap.
              if (e.pointerType === "mouse") setActive(null);
            }}
          />
        </svg>
      )}
      {current && (
        <div
          className="chart-tooltip cost-chart-tooltip"
          style={{
            left: current.cx,
            top: current.cy,
            transform: `translate(${current.cx > width / 2 ? "calc(-100% - 16px)" : "16px"}, ${current.cy > height / 2 ? "calc(-100% + 8px)" : "-8px"})`,
          }}
        >
          <strong>{current.name}</strong>
          <span>
            ECI {number(current.eci)}{" "}
            <em>
              ({Math.round(current.low)}–{Math.round(current.high)})
            </em>
          </span>
          <span>{usd(current.cost)} / mês</span>
          {highlight.has(current.id) && (
            <span className="cost-chart-tip-tag">Recomendado</span>
          )}
          {onPick && current.id === active && (
            <span className="cost-chart-tip-hint">
              {touch
                ? "Toque de novo para ver o card"
                : "Clique para ver o card"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
