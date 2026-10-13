// The comparison widget that MCP hosts (ChatGPT, Claude) render in the chat
// for compare_models and recommend_model. Plain DOM on purpose: it ships as
// one inlined script (scripts/build-widget.mts), so every dependency counts
// (the SDK's prebundled build is 80 kB smaller than bundling zod ourselves).
// It shows what the server computed and asks the server again when the goal
// changes; no ranking logic lives here.
import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps/app-with-deps";
import { pointsPerDoubling, type Goal } from "../lib/engine";
import type { ComparisonView, RankedModel } from "../lib/mcp/view";

type Lang = "pt-BR" | "en";
const goalOrder: Goal[] = ["value", "intelligence", "cost"];
const visibleRows = 5;

const copy = {
  "pt-BR": {
    goal: "Objetivo",
    goals: {
      value: "Custo-benefício",
      intelligence: "Inteligência máxima",
      cost: "Menor custo",
    },
    rules: {
      value: `Dobrar o custo só compensa se render ${pointsPerDoubling} ou mais pontos de ECI.`,
      intelligence:
        "O mais barato entre os empatados com o mais inteligente, pelo intervalo de confiança.",
      cost: "O mais barato entre os modelos com índice de inteligência.",
    },
    requests: "requisições/mês",
    input: "tokens de entrada",
    output: "de saída",
    cached: "em cache",
    recommended: "Recomendado",
    perMonth: "/mês",
    prices: (i: string, o: string) => `${i} entrada · ${o} saída por 1M`,
    noEci: "ECI —",
    top: (shown: number, total: number) =>
      `${shown} melhores de ${total} modelos`,
    showAll: (n: number) => `Ver todos (${n})`,
    showLess: "Ver menos",
    open: "Abrir no ModelPickr",
    sources: "Dados: models.dev e Epoch AI (CC BY 4.0)",
    empty: "Nenhum modelo do catálogo atende a esses critérios.",
    unrated: "Nenhum destes modelos tem ECI publicado: não há recomendação.",
    unresolved: "Não encontrados:",
    failed: "Não foi possível atualizar. Tente de novo.",
    loading: "Carregando comparação",
    chart: "Custo mensal (escala log) × inteligência (ECI)",
  },
  en: {
    goal: "Goal",
    goals: {
      value: "Best value",
      intelligence: "Max intelligence",
      cost: "Lowest cost",
    },
    rules: {
      value: `Doubling the cost only pays off if it buys ${pointsPerDoubling} or more ECI points.`,
      intelligence:
        "The cheapest model statistically tied with the smartest one.",
      cost: "The cheapest model that has an intelligence index.",
    },
    requests: "requests/month",
    input: "input tokens",
    output: "output",
    cached: "cached",
    recommended: "Recommended",
    perMonth: "/mo",
    prices: (i: string, o: string) => `${i} in · ${o} out per 1M`,
    noEci: "ECI —",
    top: (shown: number, total: number) => `Top ${shown} of ${total} models`,
    showAll: (n: number) => `Show all (${n})`,
    showLess: "Show less",
    open: "Open in ModelPickr",
    sources: "Data: models.dev and Epoch AI (CC BY 4.0)",
    empty: "No catalog model meets these criteria.",
    unrated: "None of these models has a published ECI: no recommendation.",
    unresolved: "Not found:",
    failed: "Could not update. Try again.",
    loading: "Loading comparison",
    chart: "Monthly cost (log scale) × intelligence (ECI)",
  },
};

let lang: Lang = navigator.language.toLowerCase().startsWith("pt")
  ? "pt-BR"
  : "en";
let view: ComparisonView | null = null;
let notice: string | null = null;
let pending: Goal | null = null;
let expanded = false;
let width = 0;

const t = () => copy[lang];
const locale = () => (lang === "en" ? "en-US" : lang);
const number = (n: number, digits = 0) =>
  new Intl.NumberFormat(locale(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
const usd = (n: number) =>
  new Intl.NumberFormat(locale(), {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: n < 0.1 ? 3 : 2,
  }).format(n);
const usdShort = (n: number) =>
  new Intl.NumberFormat(locale(), {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: n < 10 ? 2 : 1,
  }).format(n);

type Child = Node | string | null | false | undefined;
type Attrs = Record<string, string | number | boolean | null | undefined>;
function fill<E extends Element>(el: E, attrs: Attrs, children: Child[]) {
  for (const [key, value] of Object.entries(attrs))
    if (value !== null && value !== undefined && value !== false)
      el.setAttribute(key, value === true ? "" : String(value));
  el.append(...children.filter((c): c is Node | string => !!c));
  return el;
}
const h = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
) => fill(document.createElement(tag), attrs, children);
const s = (tag: string, attrs: Attrs = {}, ...children: Child[]) =>
  fill(
    document.createElementNS("http://www.w3.org/2000/svg", tag),
    attrs,
    children,
  );

/** Round values (1, 2, 5 × 10^k) inside [lo, hi]. */
function ticks(lo: number, hi: number, log: boolean) {
  const out: number[] = [];
  if (log) {
    for (let e = Math.floor(lo); e <= Math.ceil(hi); e++)
      for (const m of hi - lo > 2.5 ? [1] : [1, 2, 5]) {
        const v = Math.log10(m) + e;
        if (v >= lo && v <= hi) out.push(v);
      }
    return out;
  }
  const raw = (hi - lo) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((m) => m >= raw) ?? raw;
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v);
  return out;
}

type Box = { x: number; y: number; w: number; h: number };
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Monthly cost (log x) against ECI (y), like the site's chart: costs span
 * orders of magnitude. Only rated models with a cost can be placed.
 */
function chart(models: RankedModel[]) {
  const points = models.filter((m) => m.eci !== null && m.monthlyCostUsd > 0);
  if (points.length < 3 || width < 240) return null;
  const height = 196;
  const pad = { top: 14, right: 14, bottom: 26, left: 36 };
  const xs = points.map((m) => Math.log10(m.monthlyCostUsd));
  const ys = points.map((m) => m.eci!);
  const span = (values: number[], min: number) => {
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const margin = Math.max((hi - lo) * 0.18, min);
    return [lo - margin, hi + margin];
  };
  const [x0, x1] = span(xs, 0.15);
  const [y0, y1] = span(ys, 1.5);
  const px = (v: number) =>
    pad.left + ((v - x0) / (x1 - x0)) * (width - pad.left - pad.right);
  const py = (v: number) =>
    height -
    pad.bottom -
    ((v - y0) / (y1 - y0)) * (height - pad.top - pad.bottom);

  const svg = s("svg", {
    viewBox: `0 0 ${width} ${height}`,
    width,
    height,
    role: "img",
    "aria-label": t().chart,
  });
  for (const v of ticks(y0, y1, false))
    svg.append(
      s("line", {
        class: "grid",
        x1: pad.left,
        x2: width - pad.right,
        y1: py(v),
        y2: py(v),
      }),
      s(
        "text",
        { class: "tick", x: pad.left - 6, y: py(v) + 3, "text-anchor": "end" },
        number(v),
      ),
    );
  let lastTick = -Infinity;
  for (const v of ticks(x0, x1, true)) {
    if (px(v) - lastTick < 52) continue;
    lastTick = px(v);
    svg.append(
      s(
        "text",
        { class: "tick", x: px(v), y: height - 8, "text-anchor": "middle" },
        usdShort(10 ** v),
      ),
    );
  }

  // Recommended first, so their labels are placed before the others'.
  const ordered = [...points].sort(
    (a, b) => Number(b.recommended) - Number(a.recommended),
  );
  const dots: Box[] = ordered.map((m) => ({
    x: px(Math.log10(m.monthlyCostUsd)) - 6,
    y: py(m.eci!) - 6,
    w: 12,
    h: 12,
  }));
  const placed: Box[] = [];
  ordered.forEach((m, i) => {
    const cx = dots[i].x + 6;
    const cy = dots[i].y + 6;
    svg.append(
      s(
        "circle",
        {
          class: m.recommended ? "dot is-best" : "dot",
          cx,
          cy,
          r: m.recommended ? 6 : 4.5,
        },
        s(
          "title",
          {},
          `${m.name}: ${usd(m.monthlyCostUsd)}${t().perMonth} · ECI ${number(m.eci!, 1)}`,
        ),
      ),
    );
    const name = m.name.length > 24 ? `${m.name.slice(0, 23)}…` : m.name;
    const w = name.length * 6.2;
    const spots: [number, number, string][] = [
      [cx + 10, cy + 4, "start"],
      [cx - 10, cy + 4, "end"],
      [cx, cy - 11, "middle"],
      [cx, cy + 19, "middle"],
      [cx + 7, cy + 17, "start"],
      [cx + 7, cy - 9, "start"],
      [cx - 7, cy + 17, "end"],
      [cx - 7, cy - 9, "end"],
    ];
    for (const [x, y, anchor] of spots) {
      const left =
        anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
      const box = { x: left, y: y - 11, w, h: 14 };
      if (
        left < 2 ||
        left + w > width - 2 ||
        box.y < 0 ||
        box.y + box.h > height - pad.bottom + 4 ||
        placed.some((b) => overlaps(b, box)) ||
        dots.some((d, j) => j !== i && overlaps(d, box))
      )
        continue;
      placed.push(box);
      svg.append(
        s(
          "text",
          {
            class: m.recommended ? "label is-best" : "label",
            x,
            y,
            "text-anchor": anchor,
          },
          name,
        ),
      );
      break;
    }
  });
  return h("figure", { class: "chart" }, svg, h("figcaption", {}, t().chart));
}

function row(m: RankedModel) {
  const medal = ["", "gold", "silver", "bronze"][m.rank ?? 0] ?? "";
  return h(
    "li",
    { class: m.recommended ? "row is-best" : "row" },
    h(
      "span",
      { class: `rank ${medal}` },
      m.rank === null ? "–" : String(m.rank),
    ),
    h(
      "div",
      { class: "who" },
      h(
        "p",
        { class: "name" },
        h("strong", {}, m.name),
        m.recommended && h("span", { class: "badge" }, t().recommended),
      ),
      h(
        "p",
        { class: "meta" },
        h(
          "span",
          {},
          `${m.provider} · ${m.eci === null ? t().noEci : `ECI ${number(m.eci, 1)}`}`,
        ),
        h(
          "span",
          {},
          t().prices(
            usd(m.inputUsdPerMillionTokens),
            usd(m.outputUsdPerMillionTokens),
          ),
        ),
      ),
    ),
    h(
      "p",
      { class: "cost" },
      h("strong", {}, usd(m.monthlyCostUsd)),
      h("span", {}, t().perMonth),
    ),
  );
}

function skeleton() {
  return h(
    "div",
    { class: "skeleton", role: "status", "aria-label": t().loading },
    ...[0, 1, 2].map(() => h("i")),
  );
}

function render() {
  const root = document.getElementById("root")!;
  const focused = (document.activeElement as HTMLElement | null)?.dataset;
  document.documentElement.lang = lang;
  root.replaceChildren();
  root.append(h("p", { class: "brand" }, "ModelPickr"));
  if (!view) {
    root.append(notice ? h("p", { class: "notice" }, notice) : skeleton());
    return;
  }
  const v = view;
  const u = v.usage;
  root.append(
    h(
      "p",
      { class: "usage" },
      [
        `${number(u.requestsPerMonth)} ${t().requests}`,
        `${number(u.inputTokensPerRequest)} ${t().input}`,
        `${number(u.outputTokensPerRequest)} ${t().output}`,
        u.cachedInputPercent > 0 &&
          `${number(u.cachedInputPercent)}% ${t().cached}`,
      ]
        .filter(Boolean)
        .join(" · "),
    ),
  );
  const goals = h("div", {
    class: "goals",
    role: "group",
    "aria-label": t().goal,
  });
  for (const goal of goalOrder) {
    const active = (pending ?? v.goal) === goal;
    const button = h(
      "button",
      {
        type: "button",
        "aria-pressed": String(active),
        "data-goal": goal,
        disabled: !!pending,
      },
      t().goals[goal],
    );
    button.addEventListener("click", () => changeGoal(goal));
    goals.append(button);
  }
  root.append(goals, h("p", { class: "rule" }, t().rules[pending ?? v.goal]));
  if (notice) root.append(h("p", { class: "notice", role: "alert" }, notice));

  if (!v.models.length) root.append(h("p", { class: "notice" }, t().empty));
  else {
    if (!v.models.some((m) => m.recommended))
      root.append(h("p", { class: "notice" }, t().unrated));
    const graph = chart(v.models);
    if (graph) root.append(graph);
    const shown = expanded ? v.models : v.models.slice(0, visibleRows);
    root.append(
      h("ol", { class: pending ? "rows is-busy" : "rows" }, ...shown.map(row)),
    );
    if (v.models.length > visibleRows) {
      const more = h(
        "button",
        {
          type: "button",
          class: "more",
          "aria-expanded": String(expanded),
          "data-more": true,
        },
        expanded ? t().showLess : t().showAll(v.models.length),
      );
      more.addEventListener("click", () => {
        expanded = !expanded;
        render();
      });
      root.append(more);
    }
  }
  if (v.unresolved.length)
    root.append(
      h("p", { class: "note" }, `${t().unresolved} ${v.unresolved.join(", ")}`),
    );
  if (v.request.tool === "recommend_model" && v.candidates > v.models.length)
    root.append(
      h("p", { class: "note" }, t().top(v.models.length, v.candidates)),
    );

  const open = h("button", { type: "button", class: "open" }, t().open);
  open.addEventListener("click", () => {
    app.openLink({ url: v.compareUrl }).catch(() => {});
  });
  root.append(
    h(
      "footer",
      {},
      v.models.length > 0 && open,
      h("p", { class: "sources" }, t().sources),
    ),
  );
  // Rebuilding the DOM drops focus; put it back on the control just used.
  const selector = focused?.goal
    ? `[data-goal="${focused.goal}"]`
    : focused?.more !== undefined
      ? "[data-more]"
      : null;
  if (selector) root.querySelector<HTMLElement>(selector)?.focus();
}

function isView(value: unknown): value is ComparisonView {
  const v = value as ComparisonView | undefined;
  return !!v && Array.isArray(v.models) && !!v.usage && !!v.request;
}
type ToolResult = {
  isError?: boolean;
  structuredContent?: unknown;
  content?: { type: string; text?: string }[];
};
function show(result: ToolResult) {
  if (result.isError || !isView(result.structuredContent)) {
    notice = result.content?.find((c) => c.type === "text")?.text ?? t().empty;
    return render();
  }
  view = result.structuredContent;
  notice = null;
  render();
}

/** The ranking depends on the goal, so the server runs the same tool again. */
async function changeGoal(goal: Goal) {
  if (!view || pending || goal === view.goal) return;
  pending = goal;
  notice = null;
  render();
  try {
    const result = await app.callServerTool({
      name: view.request.tool,
      arguments: { ...view.request.arguments, goal },
    });
    if (result.isError || !isView(result.structuredContent)) throw new Error();
    view = result.structuredContent;
    // Keeps the assistant in sync with what the user now sees.
    app
      .updateModelContext({
        content: [
          {
            type: "text",
            text: `The user switched the ModelPickr view to the "${goal}" goal.`,
          },
          ...result.content.filter((c) => c.type === "text"),
        ],
      })
      .catch(() => {});
  } catch {
    notice = t().failed;
  }
  pending = null;
  render();
}

function applyContext(context: McpUiHostContext | undefined) {
  if (!context) return;
  if (context.theme) applyDocumentTheme(context.theme);
  if (context.styles?.variables)
    applyHostStyleVariables(context.styles.variables);
  if (context.styles?.css?.fonts) applyHostFonts(context.styles.css.fonts);
  if (context.locale)
    lang = context.locale.toLowerCase().startsWith("pt") ? "pt-BR" : "en";
  const inset = context.safeAreaInsets;
  if (inset)
    for (const side of ["top", "right", "bottom", "left"] as const)
      document.body.style.setProperty(`--inset-${side}`, `${inset[side]}px`);
}

const app = new App({ name: "ModelPickr", version: "1.0.0" });
app.ontoolresult = show;
app.ontoolcancelled = () => {
  notice = t().empty;
  render();
};
app.onhostcontextchanged = (context) => {
  applyContext(context);
  render();
};
applyDocumentTheme(
  matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
);
new ResizeObserver(([entry]) => {
  const next = Math.round(entry.contentRect.width);
  if (next === width) return;
  width = next;
  render();
}).observe(document.getElementById("root")!);
render();
app.connect().then(() => {
  applyContext(app.getHostContext());
  render();
});
