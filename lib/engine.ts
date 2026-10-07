// Pure, UI-independent comparison logic over the real catalog.
import type { Catalog, CatalogModel, Price } from "./catalog/types";
import { benchmarkOf, taskById } from "./catalog/tasks";
export type Usage = {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  /** Share of input tokens read from cache, 0–100; absent in older scenarios. */
  cached?: number;
};
export type Scenario = Usage & {
  id: string;
  name: string;
  models: string[];
  /** Task id used by the advanced comparison. */
  task: string;
  /** Benchmark id of that task; older scenarios use the task's first one. */
  benchmark?: string;
  minimum: number;
  reference: string;
  /** Free-comparison goal; older scenarios without it default to "value". */
  goal?: Goal;
  createdAt: string;
};
export const maxModels = 10;
export const defaultUsage: Usage = {
  requests: 100000,
  inputTokens: 1000,
  outputTokens: 500,
  cached: 0,
};
/**
 * Prices are USD per million tokens. The cached share of input is billed at
 * the cache-read price; models without a published one pay the input price.
 */
export function monthlyCost(
  usage: Usage,
  price: Pick<Price, "input" | "output"> & { cacheRead?: number | null },
) {
  const share = (usage.cached ?? 0) / 100;
  const input =
    (1 - share) * price.input + share * (price.cacheRead ?? price.input);
  return (
    (usage.requests *
      (usage.inputTokens * input + usage.outputTokens * price.output)) /
    1000000
  );
}
export function validUsage(u: Usage) {
  return (
    Object.values(u).every(
      (v) => v === undefined || (Number.isFinite(v) && v >= 0),
    ) && (u.cached ?? 0) <= 100
  );
}
export function selectionFromUrl(value: string, knownIds: string[]) {
  const known = new Set(knownIds);
  return [...new Set(value.split(",").filter((id) => known.has(id)))].slice(
    0,
    maxModels,
  );
}
export function bestValues(values: (number | null)[], higher = true) {
  const available = values.filter((v): v is number => v !== null);
  if (!available.length) return [];
  const best = higher ? Math.max(...available) : Math.min(...available);
  return values.map((v, i) => (v === best ? i : -1)).filter((i) => i >= 0);
}
const sameCost = (a: number, b: number) => Math.abs(a - b) < 1e-9;

export type Goal = "value" | "intelligence" | "cost";
export const goals: Goal[] = ["value", "intelligence", "cost"];
export const isGoal = (v: unknown): v is Goal => goals.includes(v as Goal);
/** ECI points a model must add for each doubling of cost (≈ ECI's CI half-width). */
export const pointsPerDoubling = 3;

/**
 * Free comparison, driven by the user's goal. Only models with an ECI can win;
 * the rest come back as `unrated`.
 * - intelligence: cheapest model whose ECI interval reaches the top model's.
 * - value: highest `ECI − pointsPerDoubling × log2(cost)`, i.e. doubling the
 *   cost must buy at least `pointsPerDoubling` ECI points. Scale-invariant, so
 *   the volume of use does not change the winner, only the input/output mix.
 * - cost: cheapest rated model.
 * Ties keep every winner.
 */
export function recommend(
  models: CatalogModel[],
  usage: Usage,
  goal: Goal = "value",
) {
  const rated = models.filter((m) => m.intelligence);
  const unrated = models.filter((m) => !m.intelligence);
  const cost = (m: CatalogModel) => monthlyCost(usage, m.price);
  const eci = (m: CatalogModel) => m.intelligence!.value;
  const minAll = models.length ? Math.min(...models.map(cost)) : 0;
  const cheapest = models.filter((m) => sameCost(cost(m), minAll));
  if (!rated.length)
    return { best: [], smartest: [], cheapest, tied: [], unrated, goal };
  const top = Math.max(...rated.map(eci));
  const smartest = rated.filter((m) => eci(m) === top);
  const floor = Math.max(...smartest.map((m) => m.intelligence!.low));
  const tied = rated.filter((m) => m.intelligence!.high >= floor);
  const cheapestOf = (list: CatalogModel[]) => {
    const min = Math.min(...list.map(cost));
    return list.filter((m) => sameCost(cost(m), min));
  };
  let best: CatalogModel[];
  // Without a positive cost (zero usage) value cannot be measured.
  if (goal === "value" && rated.every((m) => cost(m) > 0)) {
    const score = (m: CatalogModel) =>
      eci(m) - pointsPerDoubling * Math.log2(cost(m));
    const max = Math.max(...rated.map(score));
    best = cheapestOf(rated.filter((m) => Math.abs(score(m) - max) < 1e-9));
  } else if (goal === "cost") best = cheapestOf(rated);
  else best = cheapestOf(tied);
  return { best, smartest, cheapest, tied, unrated, goal };
}

/**
 * Orders models from best to worst for the goal, consistent with `recommend`:
 * every model ranked #1 is in `recommend(...).best`. Equal ranking keys share
 * a position (1, 1, 3). Models without an ECI go last with `rank: null`.
 */
export function rankModels(
  models: CatalogModel[],
  usage: Usage,
  goal: Goal = "value",
) {
  const cost = (m: CatalogModel) => monthlyCost(usage, m.price);
  const eci = (m: CatalogModel) => m.intelligence!.value;
  const rated = models.filter((m) => m.intelligence);
  const unrated = models
    .filter((m) => !m.intelligence)
    .sort((a, b) => cost(a) - cost(b));
  const effective: Goal =
    goal === "value" && !rated.every((m) => cost(m) > 0)
      ? "intelligence"
      : goal;
  const tied = new Set(recommend(rated, usage, "intelligence").tied);
  const key = (m: CatalogModel): number[] =>
    effective === "value"
      ? [-(eci(m) - pointsPerDoubling * Math.log2(cost(m))), cost(m)]
      : effective === "intelligence"
        ? tied.has(m)
          ? [0, cost(m)]
          : [1, -eci(m), cost(m)]
        : [cost(m)];
  const compare = (a: number[], b: number[]) => {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const d = (a[i] ?? 0) - (b[i] ?? 0);
      if (Math.abs(d) > 1e-9) return d;
    }
    return 0;
  };
  const sorted = [...rated].sort(
    (a, b) => compare(key(a), key(b)) || eci(b) - eci(a),
  );
  let rank = 0;
  const ranked = sorted.map((model, i) => {
    if (i === 0 || compare(key(sorted[i - 1]), key(model)) !== 0) rank = i + 1;
    return { model, rank: rank as number | null };
  });
  return [...ranked, ...unrated.map((model) => ({ model, rank: null }))];
}

export type TaskReason =
  "Atende ao mínimo" | "Abaixo do mínimo" | "Sem resultado nesta tarefa";
/**
 * Advanced comparison: cheapest models with a score on the chosen benchmark
 * that meets the inclusive minimum. Missing scores are excluded, never zero.
 */
export function recommendForTask(
  models: CatalogModel[],
  benchmark: string,
  minimum: number,
  usage: Usage,
) {
  const participants = models.map((m) => {
    const score = m.scores[benchmark] ?? null;
    const reason: TaskReason =
      score === null
        ? "Sem resultado nesta tarefa"
        : score >= minimum
          ? "Atende ao mínimo"
          : "Abaixo do mínimo";
    return { model: m, score, cost: monthlyCost(usage, m.price), reason };
  });
  const eligible = participants.filter((p) => p.reason === "Atende ao mínimo");
  const min = eligible.length ? Math.min(...eligible.map((p) => p.cost)) : null;
  return {
    participants,
    winners: eligible.filter((p) => min !== null && sameCost(p.cost, min)),
  };
}

/** Future Pro monitoring: what changed between two catalog snapshots. */
export function detectChanges(before: Catalog, after: Catalog) {
  const old = new Map(before.models.map((m) => [m.id, m]));
  return {
    added: after.models.filter((m) => !old.has(m.id)),
    prices: after.models.filter((m) => {
      const o = old.get(m.id);
      return (
        o &&
        (o.price.input !== m.price.input || o.price.output !== m.price.output)
      );
    }),
    intelligence: after.models.filter((m) => {
      const o = old.get(m.id);
      return o && o.intelligence?.value !== m.intelligence?.value;
    }),
  };
}
/** Cheaper catalog models that meet a saved scenario's task minimum. */
export function evaluateAlternatives(s: Scenario, catalog: Catalog) {
  const task = taskById(s.task);
  const reference = catalog.models.find((m) => m.id === s.reference);
  if (!task || !reference) return [];
  const benchmark = benchmarkOf(task, s.benchmark).id;
  if (reference.scores[benchmark] === undefined) return [];
  const referenceCost = monthlyCost(s, reference.price);
  return recommendForTask(catalog.models, benchmark, s.minimum, s)
    .participants.filter(
      (p) => p.reason === "Atende ao mínimo" && p.cost < referenceCost,
    )
    .map((p) => ({ ...p, estimatedSavings: referenceCost - p.cost }));
}
