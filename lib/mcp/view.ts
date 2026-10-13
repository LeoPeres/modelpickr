// What the MCP tools return. One shape serves the assistant (structured
// content), hosts without UI (text) and the embedded widget (widget/main.ts
// imports these types only). Pure: no network or framework imports.
import { normalize, sources } from "../catalog/build";
import { searchModels, type SortKey } from "../catalog/search";
import { benchmarks } from "../catalog/tasks";
import type { Catalog, CatalogModel } from "../catalog/types";
import {
  defaultUsage,
  maxModels,
  monthlyCost,
  pointsPerDoubling,
  rankModels,
  recommend,
  type Goal,
  type Usage,
} from "../engine";

export type ModelInfo = {
  /** Catalog id, `${provider}/${modelId}`. */
  id: string;
  name: string;
  provider: string;
  releaseDate: string | null;
  contextTokens: number | null;
  inputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
  cachedInputUsdPerMillionTokens: number | null;
  /** Epoch Capabilities Index; null when Epoch AI has not rated the model. */
  eci: number | null;
  eciLow: number | null;
  eciHigh: number | null;
  /** Position among rated catalog models, 1 = most capable. */
  eciRank: number | null;
  imageInput: boolean;
  toolCalling: boolean;
  reasoning: boolean;
  openWeights: boolean;
  /** Benchmark name → score in %. Only what Epoch AI published. */
  benchmarks: Record<string, number>;
};
export type RankedModel = ModelInfo & {
  /** 1 = best for the goal; ties share a position; null without an ECI. */
  rank: number | null;
  recommended: boolean;
  monthlyCostUsd: number;
};
export type UsageInput = {
  requestsPerMonth?: number;
  inputTokensPerRequest?: number;
  outputTokensPerRequest?: number;
  cachedInputPercent?: number;
};
export type Requirement =
  "image_input" | "tool_calling" | "reasoning" | "open_weights";
export type CompareInput = UsageInput & { models: string[]; goal?: Goal };
export type RecommendInput = UsageInput & {
  goal?: Goal;
  providers?: string[];
  minContextTokens?: number;
  maxMonthlyCostUsd?: number;
  requires?: Requirement[];
  limit?: number;
};
export type ComparisonView = {
  goal: Goal;
  usage: Required<UsageInput>;
  /** Best → worst for the goal. */
  models: RankedModel[];
  /** Requested names that match no catalog model. */
  unresolved: string[];
  /** Models that passed the filters (recommend_model), else those compared. */
  candidates: number;
  /** Lets the widget re-run the same tool with another goal. */
  request: {
    tool: "compare_models" | "recommend_model";
    arguments: Record<string, unknown>;
  };
  compareUrl: string;
  methodologyUrl: string;
  catalogUpdatedAt: string;
  attribution: string;
};
export type SearchView = {
  total: number;
  models: ModelInfo[];
  attribution: string;
};

export const attribution = `Data: ${sources
  .map((s) => `${s.name} (${s.license}, ${s.url})`)
  .join(" and ")}. First-party list prices; ECI = Epoch Capabilities Index.`;
export const goalRules: Record<Goal, string> = {
  value: `best value, the highest ECI − ${pointsPerDoubling} × log2(monthly cost), so doubling the cost must buy at least ${pointsPerDoubling} ECI points`,
  intelligence:
    "maximum intelligence, the cheapest model whose ECI confidence interval reaches the top model's",
  cost: "lowest cost, the cheapest model that has an ECI",
};

const benchmarkNames = new Map(benchmarks.map((b) => [b.id, b.name]));
export function modelInfo(m: CatalogModel): ModelInfo {
  return {
    id: m.id,
    name: m.name,
    provider: m.providerName,
    releaseDate: m.releaseDate,
    contextTokens: m.context,
    inputUsdPerMillionTokens: m.price.input,
    outputUsdPerMillionTokens: m.price.output,
    cachedInputUsdPerMillionTokens: m.price.cacheRead,
    eci: m.intelligence?.value ?? null,
    eciLow: m.intelligence?.low ?? null,
    eciHigh: m.intelligence?.high ?? null,
    eciRank: m.intelligence?.rank ?? null,
    imageInput: m.inputModalities.includes("image"),
    toolCalling: m.toolCall,
    reasoning: m.reasoning,
    openWeights: m.openWeights,
    benchmarks: Object.fromEntries(
      Object.entries(m.scores).map(([id, score]) => [
        benchmarkNames.get(id) ?? id,
        score,
      ]),
    ),
  };
}

/** Exact id or name first, so "GPT-5" never resolves to "GPT-5.5 Pro". */
export function resolveModel(models: CatalogModel[], query: string) {
  const key = normalize(query);
  if (!key) return null;
  return (
    models.find((m) => m.id === query.trim()) ??
    models.find((m) => normalize(m.name) === key) ??
    models.find((m) => normalize(m.id.slice(m.id.indexOf("/") + 1)) === key) ??
    searchModels(models, query)[0] ??
    null
  );
}

function usageOf(input: UsageInput): Usage {
  return {
    requests: input.requestsPerMonth ?? defaultUsage.requests,
    inputTokens: input.inputTokensPerRequest ?? defaultUsage.inputTokens,
    outputTokens: input.outputTokensPerRequest ?? defaultUsage.outputTokens,
    cached: input.cachedInputPercent ?? 0,
  };
}
const usageView = (u: Usage): Required<UsageInput> => ({
  requestsPerMonth: u.requests,
  inputTokensPerRequest: u.inputTokens,
  outputTokensPerRequest: u.outputTokens,
  cachedInputPercent: u.cached ?? 0,
});

function view(
  catalog: Catalog,
  origin: string,
  pool: CatalogModel[],
  shown: number,
  usage: Usage,
  goal: Goal,
  extra: Pick<ComparisonView, "unresolved" | "request">,
): ComparisonView {
  const best = new Set(recommend(pool, usage, goal).best);
  const models = rankModels(pool, usage, goal)
    .slice(0, shown)
    .map(({ model, rank }) => ({
      ...modelInfo(model),
      rank,
      recommended: best.has(model),
      monthlyCostUsd: monthlyCost(usage, model.price),
    }));
  // Same params `/compare` reads; ids stay readable ("openai/gpt-6-luna,…").
  const query = new URLSearchParams({
    models: models.map((m) => m.id).join(","),
    goal,
    requests: String(usage.requests),
    input: String(usage.inputTokens),
    output: String(usage.outputTokens),
    cached: String(usage.cached ?? 0),
  })
    .toString()
    .replace(/%2F/g, "/")
    .replace(/%2C/g, ",");
  return {
    goal,
    usage: usageView(usage),
    models,
    candidates: pool.length,
    ...extra,
    compareUrl: `${origin}/compare?${query}`,
    methodologyUrl: `${origin}/methodology`,
    catalogUpdatedAt: catalog.generatedAt,
    attribution,
  };
}

export function compareView(
  catalog: Catalog,
  origin: string,
  input: CompareInput,
): ComparisonView {
  const goal = input.goal ?? "value";
  const usage = usageOf(input);
  const found = new Set<CatalogModel>();
  const unresolved: string[] = [];
  for (const name of input.models) {
    const model = resolveModel(catalog.models, name);
    if (model) found.add(model);
    else unresolved.push(name);
  }
  const pool = [...found].slice(0, maxModels);
  return view(catalog, origin, pool, pool.length, usage, goal, {
    unresolved,
    request: {
      tool: "compare_models",
      arguments: { ...usageView(usage), models: pool.map((m) => m.id), goal },
    },
  });
}

const meets: Record<Requirement, (m: CatalogModel) => boolean> = {
  image_input: (m) => m.inputModalities.includes("image"),
  tool_calling: (m) => m.toolCall,
  reasoning: (m) => m.reasoning,
  open_weights: (m) => m.openWeights,
};
export function recommendView(
  catalog: Catalog,
  origin: string,
  input: RecommendInput,
): ComparisonView {
  const goal = input.goal ?? "value";
  const usage = usageOf(input);
  const wanted = (input.providers ?? []).map(normalize).filter(Boolean);
  const pool = catalog.models.filter(
    (m) =>
      (!wanted.length ||
        wanted.includes(normalize(m.provider)) ||
        wanted.includes(normalize(m.providerName))) &&
      (input.minContextTokens === undefined ||
        (m.context ?? 0) >= input.minContextTokens) &&
      (input.maxMonthlyCostUsd === undefined ||
        monthlyCost(usage, m.price) <= input.maxMonthlyCostUsd) &&
      (input.requires ?? []).every((r) => meets[r](m)),
  );
  const limit = Math.min(input.limit ?? 5, maxModels);
  return view(catalog, origin, pool, limit, usage, goal, {
    unresolved: [],
    request: {
      tool: "recommend_model",
      arguments: { ...input, ...usageView(usage), goal, limit },
    },
  });
}

export function searchView(
  catalog: Catalog,
  input: { query?: string; provider?: string; sort?: SortKey; limit?: number },
): SearchView {
  const wanted = input.provider ? normalize(input.provider) : "";
  const found = searchModels(catalog.models, input.query ?? "", {
    sort: input.sort,
  }).filter(
    (m) =>
      !wanted ||
      normalize(m.provider) === wanted ||
      normalize(m.providerName) === wanted,
  );
  return {
    total: found.length,
    models: found.slice(0, input.limit ?? 10).map(modelInfo),
    attribution,
  };
}

// Text for the assistant and for hosts that render no UI. English and plain
// numbers on purpose: the assistant rewrites it in the user's language.
const usd = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n < 0.1 ? 4 : 2,
  }).format(n);
const count = (n: number) => new Intl.NumberFormat("en-US").format(n);
const oneDecimal = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const eciText = (m: ModelInfo) =>
  m.eci === null
    ? "ECI not published"
    : `ECI ${oneDecimal.format(m.eci)} (#${m.eciRank})`;
const priceText = (m: ModelInfo) =>
  `${usd(m.inputUsdPerMillionTokens)} in / ${usd(m.outputUsdPerMillionTokens)} out per 1M tokens`;

export function comparisonText(v: ComparisonView) {
  const u = v.usage;
  const best = v.models.filter((m) => m.recommended);
  const lines = [
    best.length
      ? `Recommended: ${best.map((m) => `${m.name} (${m.provider})`).join(", ")}.`
      : v.models.length
        ? "No recommendation: none of these models has an ECI published by Epoch AI."
        : "No catalog model matches this request.",
    `Goal: ${goalRules[v.goal]}.`,
    `Usage: ${count(u.requestsPerMonth)} requests/month, ${count(u.inputTokensPerRequest)} input + ${count(u.outputTokensPerRequest)} output tokens per request, ${u.cachedInputPercent}% of input read from cache.`,
    "",
    ...v.models.map(
      (m) =>
        `${m.rank ?? "–"}. ${m.name} (${m.provider}, id ${m.id}): ${usd(m.monthlyCostUsd)}/month, ${eciText(m)}, ${priceText(m)}`,
    ),
  ];
  if (v.request.tool === "recommend_model" && v.candidates > v.models.length)
    lines.push(
      "",
      `Top ${v.models.length} of ${v.candidates} matching models.`,
    );
  if (v.unresolved.length)
    lines.push(
      "",
      `Not found in the catalog: ${v.unresolved.join(", ")}. Use search_models to find the exact name.`,
    );
  lines.push("", `Full comparison: ${v.compareUrl}`, attribution);
  return lines.join("\n");
}

export function searchText(v: SearchView) {
  if (!v.models.length) return "No catalog model matches this search.";
  return [
    `${v.total} matching models${v.total > v.models.length ? `, showing ${v.models.length}` : ""}:`,
    ...v.models.map(
      (m) =>
        `- ${m.name} (${m.provider}, id ${m.id}): ${eciText(m)}, ${priceText(m)}`,
    ),
    "",
    attribution,
  ].join("\n");
}
