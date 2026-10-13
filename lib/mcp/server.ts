// MCP server behind /mcp: the tools that ChatGPT, Claude and other MCP hosts
// call, plus the MCP Apps widget they render for comparisons. Stateless and
// read-only; a fresh instance serves each request.
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Catalog } from "../catalog/types";
import { maxModels, type Goal } from "../engine";
import {
  compareView,
  comparisonText,
  recommendView,
  searchText,
  searchView,
  type ComparisonView,
} from "./view";

/** Hosts cache the widget by URI: bump the version on breaking changes. */
export const widgetUri = "ui://modelpickr/comparison-v1.html";

const instructions =
  "ModelPickr compares language-model APIs with public data: first-party list prices and specs from models.dev, and the Epoch Capabilities Index (ECI) and benchmark scores from Epoch AI (CC BY 4.0). search_models looks models up, compare_models ranks specific models and estimates their monthly cost, recommend_model picks from the whole catalog. Scores are never estimated: a missing value means the source has not published it.";

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
const goal = z
  .enum(["value", "intelligence", "cost"] satisfies Goal[])
  .describe(
    "What to optimize: value (default, ECI gained per doubling of cost), intelligence (highest ECI, cheapest among statistical ties) or cost (cheapest rated model).",
  );
const usage = {
  requestsPerMonth: z
    .number()
    .min(0)
    .optional()
    .describe("API requests per month. Default 100000."),
  inputTokensPerRequest: z
    .number()
    .min(0)
    .optional()
    .describe("Input (prompt) tokens per request. Default 1000."),
  outputTokensPerRequest: z
    .number()
    .min(0)
    .optional()
    .describe("Output (completion) tokens per request. Default 500."),
  cachedInputPercent: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe(
      "Share of input tokens read from prompt cache, 0-100. Default 0.",
    ),
};
const modelInfo = {
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  releaseDate: z.string().nullable(),
  contextTokens: z.number().nullable(),
  inputUsdPerMillionTokens: z.number(),
  outputUsdPerMillionTokens: z.number(),
  cachedInputUsdPerMillionTokens: z.number().nullable(),
  eci: z
    .number()
    .nullable()
    .describe("Epoch Capabilities Index; null when not published."),
  eciLow: z.number().nullable(),
  eciHigh: z.number().nullable(),
  eciRank: z.number().nullable(),
  imageInput: z.boolean(),
  toolCalling: z.boolean(),
  reasoning: z.boolean(),
  openWeights: z.boolean(),
  benchmarks: z
    .record(z.string(), z.number())
    .describe("Benchmark name to score in %, as published by Epoch AI."),
};
const comparison = {
  goal,
  usage: z.object({
    requestsPerMonth: z.number(),
    inputTokensPerRequest: z.number(),
    outputTokensPerRequest: z.number(),
    cachedInputPercent: z.number(),
  }),
  models: z
    .array(
      z.object({
        ...modelInfo,
        rank: z.number().nullable(),
        recommended: z.boolean(),
        monthlyCostUsd: z.number(),
      }),
    )
    .describe("Best to worst for the goal."),
  unresolved: z.array(z.string()),
  candidates: z.number(),
  request: z.object({
    tool: z.enum(["compare_models", "recommend_model"]),
    arguments: z.record(z.string(), z.unknown()),
  }),
  compareUrl: z.string(),
  methodologyUrl: z.string(),
  catalogUpdatedAt: z.string(),
  attribution: z.string(),
};
const ui = { _meta: { ui: { resourceUri: widgetUri } } };
const result = (view: ComparisonView) => ({
  content: [{ type: "text" as const, text: comparisonText(view) }],
  structuredContent: view,
});

export function createMcpServer(options: {
  catalog: Catalog;
  /** Public origin of the site, for links back to the full comparison. */
  origin: string;
  widgetHtml: string;
}) {
  const { catalog, origin, widgetHtml } = options;
  const server = new McpServer(
    {
      name: "modelpickr",
      title: "ModelPickr",
      version: "1.0.0",
      websiteUrl: origin,
    },
    { instructions },
  );

  server.registerTool(
    "search_models",
    {
      title: "Search language models",
      description:
        "Use this when the user wants to look up language models (LLMs) by name or company and see their API prices, context window, capabilities and Epoch Capabilities Index. Returns catalog ids for compare_models. An empty query lists the catalog in the chosen order.",
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe('Model name, family or company, e.g. "opus", "gpt-6".'),
        provider: z
          .string()
          .optional()
          .describe('Only this company, e.g. "OpenAI", "anthropic".'),
        sort: z
          .enum(["intelligence", "price", "recent"])
          .optional()
          .describe("Order among equal matches. Default intelligence."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(25)
          .optional()
          .describe("Default 10."),
      },
      outputSchema: {
        total: z.number(),
        models: z.array(z.object(modelInfo)),
        attribution: z.string(),
      },
      annotations: readOnly,
    },
    async (input) => {
      const view = searchView(catalog, input);
      return {
        content: [{ type: "text", text: searchText(view) }],
        structuredContent: view,
      };
    },
  );

  registerAppTool(
    server,
    "compare_models",
    {
      title: "Compare language models",
      description: `Use this when the user wants to compare specific language models (LLMs) on API price and intelligence, or estimate what one or more models would cost per month for a workload. Ranks 1 to ${maxModels} models for the chosen goal and returns each one's monthly cost, list prices, Epoch Capabilities Index and benchmark scores. Do not use it to pick from the whole catalog: recommend_model does that.`,
      inputSchema: {
        models: z
          .array(z.string())
          .min(1)
          .max(maxModels)
          .describe(
            'Model names or catalog ids, e.g. ["Claude Opus 5.5", "openai/gpt-6-luna"].',
          ),
        goal: goal.optional(),
        ...usage,
      },
      outputSchema: comparison,
      annotations: readOnly,
      ...ui,
    },
    async (input) => {
      const view = compareView(catalog, origin, input);
      if (!view.models.length)
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `None of these models is in the catalog: ${input.models.join(", ")}. Call search_models to find the exact names or ids, then try again.`,
            },
          ],
        };
      return result(view);
    },
  );

  registerAppTool(
    server,
    "recommend_model",
    {
      title: "Recommend a language model",
      description:
        "Use this when the user wants help choosing a language model (LLM) for a workload or budget without naming candidates. Ranks the whole catalog for the chosen goal, after optional filters (company, context window, monthly budget, required capabilities), and returns the top models with monthly cost, list prices and Epoch Capabilities Index. Only models with an ECI can be recommended.",
      inputSchema: {
        goal: goal.optional(),
        ...usage,
        providers: z
          .array(z.string())
          .optional()
          .describe('Only these companies, e.g. ["OpenAI", "Google"].'),
        minContextTokens: z
          .number()
          .min(0)
          .optional()
          .describe("Minimum context window in tokens."),
        maxMonthlyCostUsd: z
          .number()
          .min(0)
          .optional()
          .describe("Monthly budget in USD for the given usage."),
        requires: z
          .array(
            z.enum([
              "image_input",
              "tool_calling",
              "reasoning",
              "open_weights",
            ]),
          )
          .optional()
          .describe("Capabilities every candidate must have."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(maxModels)
          .optional()
          .describe("How many models to return. Default 5."),
      },
      outputSchema: comparison,
      annotations: readOnly,
      ...ui,
    },
    async (input) => result(recommendView(catalog, origin, input)),
  );

  registerAppResource(
    server,
    "ModelPickr comparison",
    widgetUri,
    {
      description:
        "Interactive ranking, cost × intelligence chart and monthly cost for compare_models and recommend_model.",
    },
    async () => ({
      contents: [
        {
          uri: widgetUri,
          mimeType: RESOURCE_MIME_TYPE,
          text: widgetHtml,
          // Self-contained: no network access and nothing loaded from outside.
          _meta: { ui: { csp: {}, prefersBorder: true } },
        },
      ],
    }),
  );
  return server;
}
