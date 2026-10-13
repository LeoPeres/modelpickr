import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { Catalog, CatalogModel } from "../lib/catalog/types";
import {
  defaultUsage,
  monthlyCost,
  recommend,
  usageFromUrl,
} from "../lib/engine";
import { createMcpServer, widgetUri } from "../lib/mcp/server";
import {
  resolveModel,
  type ComparisonView,
  type SearchView,
} from "../lib/mcp/view";

const model = (
  id: string,
  name: string,
  price: [number, number],
  eci: number | null,
  extra: Partial<CatalogModel> = {},
): CatalogModel => ({
  id,
  provider: id.split("/")[0],
  providerName: id.startsWith("acme") ? "Acme" : "Borealis",
  name,
  family: null,
  releaseDate: "2026-01-01",
  knowledge: null,
  context: 200000,
  maxOutput: null,
  inputModalities: ["text"],
  reasoning: false,
  toolCall: true,
  openWeights: false,
  price: { input: price[0], output: price[1], cacheRead: null },
  intelligence:
    eci === null
      ? null
      : { value: eci, low: eci - 3, high: eci + 3, rank: 1, source: name },
  scores: {},
  ...extra,
});
const catalog: Catalog = {
  generatedAt: "2026-10-07T00:00:00Z",
  live: true,
  sources: [],
  models: [
    model("acme/big", "Acme Big 5", [10, 50], 160, {
      context: 1000000,
      inputModalities: ["text", "image"],
      scores: { "gpqa-diamond": 90 },
    }),
    model("acme/big-5-5", "Acme Big 5.5 Pro", [20, 100], 165),
    model("acme/mid", "Acme Mid", [2, 10], 150),
    model("borealis/small", "Borealis Small", [0.1, 0.4], 140),
    model("borealis/unrated", "Borealis Novo", [0.05, 0.2], null),
  ],
};
const origin = "https://modelpickr.test";

async function connect() {
  const server = createMcpServer({
    catalog,
    origin,
    widgetHtml: "<!doctype html>",
  });
  const client = new Client({ name: "test", version: "1.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}
const call = async <T>(name: string, args: Record<string, unknown>) => {
  const client = await connect();
  const result = await client.callTool({ name, arguments: args });
  return {
    isError: result.isError === true,
    view: result.structuredContent as T,
    text: (result.content as { text: string }[])[0].text,
  };
};

test("MCP: toda ferramenta tem título e é somente leitura", async () => {
  const { tools } = await (await connect()).listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), [
    "compare_models",
    "recommend_model",
    "search_models",
  ]);
  for (const tool of tools) {
    assert.ok(tool.title, tool.name);
    assert.ok(tool.name.length <= 64);
    assert.equal(tool.annotations?.readOnlyHint, true, tool.name);
    assert.equal(tool.annotations?.destructiveHint, false, tool.name);
  }
});
test("MCP: comparação e recomendação apontam para o widget publicado", async () => {
  const client = await connect();
  const { tools } = await client.listTools();
  const ui = (name: string) =>
    (tools.find((t) => t.name === name)?._meta?.ui as { resourceUri?: string })
      ?.resourceUri;
  assert.equal(ui("compare_models"), widgetUri);
  assert.equal(ui("recommend_model"), widgetUri);
  assert.equal(ui("search_models"), undefined);
  const { contents } = await client.readResource({ uri: widgetUri });
  assert.equal(contents[0].mimeType, "text/html;profile=mcp-app");
  assert.equal((contents[0] as { text: string }).text, "<!doctype html>");
});
test("MCP: comparar segue o motor e mantém o melhor em primeiro", async () => {
  const { view, text } = await call<ComparisonView>("compare_models", {
    models: ["Acme Big 5", "acme/mid", "borealis small"],
  });
  const pool = ["acme/big", "acme/mid", "borealis/small"].map((id) =>
    catalog.models.find((m) => m.id === id)!,
  );
  const best = recommend(pool, defaultUsage, "value").best.map((m) => m.id);
  assert.deepEqual(
    view.models.filter((m) => m.recommended).map((m) => m.id),
    best,
  );
  assert.equal(view.models[0].rank, 1);
  assert.equal(view.models[0].id, best[0]);
  for (const m of view.models)
    assert.equal(
      m.monthlyCostUsd,
      monthlyCost(defaultUsage, pool.find((p) => p.id === m.id)!.price),
    );
  assert.match(text, /Epoch AI \(CC BY 4\.0/);
  assert.deepEqual(view.models.find((m) => m.id === "acme/big")?.benchmarks, {
    "GPQA Diamond": 90,
  });
});
test("MCP: objetivo e uso mudam a recomendação e o custo", async () => {
  const args = { models: ["acme/big", "acme/mid", "borealis/small"] };
  const smart = await call<ComparisonView>("compare_models", {
    ...args,
    goal: "intelligence",
  });
  assert.equal(smart.view.models[0].id, "acme/big");
  const cheap = await call<ComparisonView>("compare_models", {
    ...args,
    goal: "cost",
    requestsPerMonth: 1000,
    inputTokensPerRequest: 2000,
    outputTokensPerRequest: 0,
  });
  assert.equal(cheap.view.models[0].id, "borealis/small");
  assert.equal(cheap.view.models[0].monthlyCostUsd, 0.2);
});
test("MCP: nome exato vence a busca aproximada", () => {
  assert.equal(resolveModel(catalog.models, "acme big 5")?.id, "acme/big");
  assert.equal(resolveModel(catalog.models, "big 5.5")?.id, "acme/big-5-5");
  assert.equal(resolveModel(catalog.models, "nada disso"), null);
});
test("MCP: nomes desconhecidos são avisados, nunca inventados", async () => {
  const some = await call<ComparisonView>("compare_models", {
    models: ["acme/mid", "modelo fantasma"],
  });
  assert.deepEqual(some.view.unresolved, ["modelo fantasma"]);
  assert.equal(some.view.models.length, 1);
  const none = await call<ComparisonView>("compare_models", {
    models: ["modelo fantasma"],
  });
  assert.equal(none.isError, true);
  assert.match(none.text, /search_models/);
});
test("MCP: modelo sem ECI não é recomendado e vai por último", async () => {
  const { view, text } = await call<ComparisonView>("compare_models", {
    models: ["borealis/unrated", "acme/mid"],
    goal: "cost",
  });
  const unrated = view.models.at(-1)!;
  assert.equal(unrated.id, "borealis/unrated");
  assert.equal(unrated.eci, null);
  assert.equal(unrated.rank, null);
  assert.equal(unrated.recommended, false);
  assert.match(text, /ECI not published/);
});
test("MCP: recomendar filtra o catálogo antes de ranquear", async () => {
  const all = await call<ComparisonView>("recommend_model", { limit: 2 });
  assert.equal(all.view.models.length, 2);
  assert.equal(all.view.candidates, catalog.models.length);
  assert.equal(
    all.view.models[0].id,
    recommend(catalog.models, defaultUsage, "value").best[0].id,
  );
  const filtered = await call<ComparisonView>("recommend_model", {
    providers: ["ACME"],
    requires: ["image_input"],
    minContextTokens: 500000,
  });
  assert.deepEqual(
    filtered.view.models.map((m) => m.id),
    ["acme/big"],
  );
  const budget = await call<ComparisonView>("recommend_model", {
    goal: "intelligence",
    maxMonthlyCostUsd: 1000,
  });
  assert.equal(budget.view.models[0].id, "acme/mid");
  const nothing = await call<ComparisonView>("recommend_model", {
    providers: ["ninguém"],
  });
  assert.deepEqual(nothing.view.models, []);
  assert.match(nothing.text, /No catalog model matches/);
});
test("MCP: o link abre a mesma comparação no site", async () => {
  const { view } = await call<ComparisonView>("compare_models", {
    models: ["acme/mid", "borealis/small"],
    goal: "cost",
    requestsPerMonth: 5000,
    cachedInputPercent: 30,
  });
  const url = new URL(view.compareUrl);
  assert.equal(url.origin + url.pathname, `${origin}/compare`);
  assert.match(view.compareUrl, /models=borealis\/small,acme\/mid&/);
  assert.equal(url.searchParams.get("goal"), "cost");
  assert.deepEqual(usageFromUrl(url.searchParams), {
    requests: 5000,
    inputTokens: 1000,
    outputTokens: 500,
    cached: 30,
  });
  // The widget re-runs the tool with these arguments when the goal changes.
  assert.equal(view.request.tool, "compare_models");
  assert.deepEqual(view.request.arguments.models, [
    "acme/mid",
    "borealis/small",
  ]);
});
test("MCP: busca devolve ids para comparar", async () => {
  const { view } = await call<SearchView>("search_models", {
    query: "big",
    limit: 1,
  });
  assert.equal(view.total, 2);
  assert.deepEqual(
    view.models.map((m) => m.id),
    ["acme/big-5-5"],
  );
  const byCompany = await call<SearchView>("search_models", {
    provider: "borealis",
    sort: "price",
  });
  assert.deepEqual(
    byCompany.view.models.map((m) => m.id),
    ["borealis/unrated", "borealis/small"],
  );
});
test("uso pela URL exige os três campos e valores válidos", () => {
  const params = (q: string) => new URLSearchParams(q);
  assert.deepEqual(usageFromUrl(params("requests=10&input=20&output=30")), {
    requests: 10,
    inputTokens: 20,
    outputTokens: 30,
    cached: 0,
  });
  assert.equal(usageFromUrl(params("models=a,b")), null);
  assert.equal(usageFromUrl(params("requests=10&input=20")), null);
  assert.equal(usageFromUrl(params("requests=-1&input=20&output=30")), null);
  assert.equal(usageFromUrl(params("requests=x&input=20&output=30")), null);
  assert.equal(
    usageFromUrl(params("requests=1&input=2&output=3&cached=101")),
    null,
  );
});
