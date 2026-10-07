import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCatalog, parseCsv } from "../lib/catalog/build";
import { searchModels } from "../lib/catalog/search";
import type { CatalogModel } from "../lib/catalog/types";
import {
  bestValues,
  defaultUsage,
  detectChanges,
  evaluateAlternatives,
  monthlyCost,
  validUsage,
  rankModels,
  recommend,
  maxModels,
  recommendForTask,
  selectionFromUrl,
} from "../lib/engine";
import {
  demoInterestAdapter,
  keys,
  readScenarios,
  validScenario,
} from "../lib/storage";

const model = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: id,
  release_date: "2026-01-01",
  modalities: { input: ["text"], output: ["text"] },
  limit: { context: 200000, output: 64000 },
  cost: { input: 1, output: 4 },
  ...extra,
});
const modelsDev = {
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    models: {
      "claude-big": model("claude-big", {
        name: "Claude Big 2",
        cost: { input: 10, output: 50 },
      }),
      "claude-mid": model("claude-mid", {
        name: "Claude Mid 2",
        cost: { input: 2, output: 10 },
      }),
      "claude-old": model("claude-old", {
        name: "Claude Old",
        status: "deprecated",
      }),
      "claude-embed": model("claude-embed", { name: "Claude Embed" }),
    },
  },
  alibaba: {
    id: "alibaba",
    name: "Alibaba",
    models: {
      "qwen-small": model("qwen-small", {
        name: "Qwen Small",
        cost: { input: 0.1, output: 0.4 },
      }),
      "kimi-resold": model("kimi-resold", { name: "Kimi Resold" }),
      "qwen-free": model("qwen-free", {
        name: "Qwen Free",
        cost: { input: 0, output: 0 },
      }),
      "qwen-image": model("qwen-image", {
        name: "Qwen Painter",
        modalities: { input: ["text"], output: ["image"] },
      }),
    },
  },
};
const eciCsv = `Model,Display name,eci,eci_ci_low,eci_ci_high,date,Organization
Claude Big 2,Claude Big 2,160,157,163,2026-01-01,Anthropic
"Mid, Claude",Claude Mid 2,158,155,161,2026-01-01,Anthropic
Qwen Small,Qwen Small,140,137,143,2026-01-01,Alibaba
`;
const benchCsv = `model_id,benchmark_id,performance,benchmark,model,model_version,Model,date,source
m1,b1,0.9,GPQA diamond,Claude Big 2,claude-big_max,Claude Big 2,2026-01-01,
m2,b1,0.85,GPQA diamond,Claude Mid 2,claude-mid_high,"Mid, Claude",2026-01-01,"Report, v2"
m3,b1,0.5,GPQA diamond,Qwen Small,qwen-small,Qwen Small,2026-01-01,
`;
const catalog = buildCatalog(modelsDev, eciCsv, benchCsv, {
  generatedAt: "2026-10-07T00:00:00Z",
  live: true,
});
const byId = (id: string) => catalog.models.find((m) => m.id === id)!;

test("CSV respeita aspas, vírgulas internas e aspas escapadas", () => {
  assert.deepEqual(parseCsv('a,b\n"x, y","say ""hi"""\n'), [
    { a: "x, y", b: 'say "hi"' },
  ]);
});
test("catálogo mantém só modelos próprios, ativos, pagos e de texto", () => {
  assert.deepEqual(catalog.models.map((m) => m.id).sort(), [
    "alibaba/qwen-small",
    "anthropic/claude-big",
    "anthropic/claude-mid",
  ]);
});
test("ECI casa por nome ou versão do Epoch, com ranking e intervalo", () => {
  assert.equal(byId("anthropic/claude-big").intelligence?.rank, 1);
  // "Claude Mid 2" only appears in Epoch as display name / model version.
  assert.equal(byId("anthropic/claude-mid").intelligence?.value, 158);
  assert.equal(byId("anthropic/claude-mid").intelligence?.low, 155);
  assert.equal(byId("alibaba/qwen-small").scores.science, 50);
  assert.equal(byId("anthropic/claude-big").scores.science, 90);
  assert.equal(byId("anthropic/claude-big").scores.software, undefined);
});
test("custo mensal segue a fórmula, inclusive volume zero", () => {
  const p = { input: 0.1, output: 0.4 };
  assert.equal(monthlyCost(defaultUsage, p), 30);
  assert.equal(monthlyCost({ ...defaultUsage, requests: 0 }, p), 0);
});
test("entrada em cache usa o preço de cache, ou o de entrada sem ele", () => {
  const usage = { ...defaultUsage, cached: 50 };
  const cost = monthlyCost(usage, { input: 0.1, output: 0.4, cacheRead: 0.01 });
  assert.ok(Math.abs(cost - 25.5) < 1e-9);
  assert.equal(
    monthlyCost(usage, { input: 0.1, output: 0.4, cacheRead: null }),
    30,
  );
  assert.ok(validUsage(usage));
  assert.ok(!validUsage({ ...usage, cached: 120 }));
});
test("seleção por URL elimina IDs inválidos e duplicados, com limite", () => {
  const ids = Array.from({ length: maxModels + 1 }, (_, i) => `a/${i}`);
  assert.deepEqual(selectionFromUrl("a/1,x/9,a/1,a/2", ids), ["a/1", "a/2"]);
  assert.equal(selectionFromUrl(ids.join(","), ids).length, maxModels);
});
test("melhores valores respeitam direção, empates e ausências", () => {
  assert.deepEqual(bestValues([null, 0, 0, 3], false), [1, 2]);
  assert.deepEqual(bestValues([1, 2, 2]), [1, 2]);
  assert.deepEqual(bestValues([null, null]), []);
});
test("melhor escolha é o mais barato empatado (IC do ECI) com o mais capaz", () => {
  const r = recommend(catalog.models, defaultUsage, "intelligence");
  assert.deepEqual(
    r.smartest.map((m) => m.id),
    ["anthropic/claude-big"],
  );
  assert.deepEqual(
    r.best.map((m) => m.id),
    ["anthropic/claude-mid"],
  );
  assert.deepEqual(
    r.cheapest.map((m) => m.id),
    ["alibaba/qwen-small"],
  );
  // Qwen's interval (137–143) does not reach the top model's floor (157).
  assert.ok(!r.tied.some((m) => m.id === "alibaba/qwen-small"));
});
test("modelos sem ECI nunca vencem e ficam listados à parte", () => {
  const noEci = { ...byId("alibaba/qwen-small"), intelligence: null };
  const r = recommend([noEci], defaultUsage);
  assert.equal(r.best.length, 0);
  assert.equal(r.unrated.length, 1);
});
// The user's real case: a frontier model next to much cheaper ones.
const sample = (
  name: string,
  eci: number,
  input: number,
  output: number,
): CatalogModel => ({
  ...byId("alibaba/qwen-small"),
  id: `x/${name}`,
  name,
  price: { input, output, cacheRead: null },
  intelligence: {
    value: eci,
    low: eci - 3,
    high: eci + 3,
    rank: 0,
    source: name,
  },
});
const mix = [
  sample("Opus", 167.3, 4, 20),
  sample("Luna", 156.3, 0.1, 0.5),
  sample("QwenFlash", 145, 0.03, 0.13),
  sample("Mini", 127, 0.15, 0.6),
];
const names = (r: { best: CatalogModel[] }) => r.best.map((m) => m.name);
test("objetivo muda a escolha: custo-benefício, inteligência e menor custo", () => {
  assert.deepEqual(names(recommend(mix, defaultUsage, "value")), ["Luna"]);
  assert.deepEqual(names(recommend(mix, defaultUsage, "intelligence")), [
    "Opus",
  ]);
  assert.deepEqual(names(recommend(mix, defaultUsage, "cost")), ["QwenFlash"]);
  // Value is the default goal.
  assert.deepEqual(names(recommend(mix, defaultUsage)), ["Luna"]);
});
test("custo-benefício não depende do volume, só da proporção de tokens", () => {
  const big = { ...defaultUsage, requests: defaultUsage.requests * 50 };
  assert.deepEqual(names(recommend(mix, big, "value")), ["Luna"]);
  // With zero usage there is no cost to weigh: fall back to intelligence.
  const zero = { ...defaultUsage, requests: 0 };
  assert.deepEqual(names(recommend(mix, zero, "value")), ["Opus"]);
});
test("ranking: #1 é sempre a melhor escolha, sem ECI fica no fim", () => {
  const unrated = { ...sample("SemIndice", 0, 0.01, 0.01), intelligence: null };
  const all = [...mix, unrated];
  for (const goal of ["value", "intelligence", "cost"] as const) {
    const ranked = rankModels(all, defaultUsage, goal);
    const first = ranked.filter((r) => r.rank === 1).map((r) => r.model.name);
    assert.deepEqual(first, names(recommend(all, defaultUsage, goal)));
    assert.equal(ranked.at(-1)!.model.name, "SemIndice");
    assert.equal(ranked.at(-1)!.rank, null);
  }
  assert.deepEqual(
    rankModels(mix, defaultUsage, "value").map((r) => r.model.name),
    ["Luna", "Opus", "QwenFlash", "Mini"],
  );
  assert.deepEqual(
    rankModels(mix, defaultUsage, "cost").map((r) => r.model.name),
    ["QwenFlash", "Luna", "Mini", "Opus"],
  );
});
test("ranking: chaves iguais dividem a posição", () => {
  const twins = [
    sample("A", 150, 1, 1),
    sample("B", 150, 1, 1),
    sample("C", 140, 1, 1),
  ];
  assert.deepEqual(
    rankModels(twins, defaultUsage, "value").map((r) => r.rank),
    [1, 1, 3],
  );
});
test("por tarefa: mínimo inclusivo, ausência excluída e empate preservado", () => {
  const r = recommendForTask(catalog.models, "science", 85, defaultUsage);
  assert.deepEqual(
    r.winners.map((w) => w.model.id),
    ["anthropic/claude-mid"],
  );
  assert.equal(
    recommendForTask(catalog.models, "software", 0, defaultUsage).winners
      .length,
    0,
  );
  const same = catalog.models.map((m) => ({
    ...m,
    price: { ...m.price, input: 1, output: 1 },
  }));
  assert.equal(
    recommendForTask(same, "science", 85, defaultUsage).winners.length,
    2,
  );
});
test("busca ignora acentos e pontuação e filtra por empresa", () => {
  assert.equal(
    searchModels(catalog.models, "mid2")[0].id,
    "anthropic/claude-mid",
  );
  assert.equal(
    searchModels(catalog.models, "anthropic big")[0].name,
    "Claude Big 2",
  );
  assert.deepEqual(
    searchModels(catalog.models, "", { provider: "alibaba" }).map((m) => m.id),
    ["alibaba/qwen-small"],
  );
  assert.equal(
    searchModels(catalog.models, "", { sort: "price" })[0].id,
    "alibaba/qwen-small",
  );
});
const ids = catalog.models.map((m) => m.id);
const scenario = {
  ...defaultUsage,
  id: "test",
  name: "Suporte",
  models: ["anthropic/claude-big", "alibaba/qwen-small"],
  task: "science",
  minimum: 40,
  reference: "anthropic/claude-big",
  createdAt: "2026-10-07T00:00:00Z",
};
test("cenário valida seleção e campos; alternativas só quando mais baratas", () => {
  assert.ok(validScenario(scenario, ids));
  assert.ok(!validScenario({ ...scenario, requests: -1 }, ids));
  assert.ok(validScenario({ ...scenario, cached: 40 }, ids));
  assert.ok(!validScenario({ ...scenario, cached: 101 }, ids));
  assert.ok(!validScenario({ ...scenario, task: "unknown" }, ids));
  assert.ok(!validScenario(scenario, ["alibaba/qwen-small"]));
  const alternatives = evaluateAlternatives(scenario, catalog);
  assert.ok(alternatives.length > 0);
  assert.ok(alternatives.every((a) => a.estimatedSavings > 0));
  assert.equal(detectChanges(catalog, catalog).prices.length, 0);
});
test("persistência local restaura cenários e cadastro permanece demo", async () => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v),
    },
    configurable: true,
  });
  localStorage.setItem(keys.scenarios, JSON.stringify([scenario]));
  assert.deepEqual(readScenarios(ids), [scenario]);
  assert.deepEqual(readScenarios(["alibaba/qwen-small"]), []);
  const r = await demoInterestAdapter.submit({
    email: "test@example.com",
    usage: "science",
    scenario: "Suporte",
    consent: true,
    createdAt: "2026-10-07",
  });
  assert.equal(r.mode, "demo");
  await assert.rejects(() =>
    demoInterestAdapter.submit({
      email: "bad",
      usage: "science",
      scenario: "",
      consent: false,
      createdAt: "2026-10-07",
    }),
  );
});
