// Pure catalog builder: turns the raw public sources into the app catalog.
// No network or framework imports, so it runs in tests and scripts alike.
import { tasks } from "./tasks";
import type { Catalog, CatalogModel, Source } from "./types";

export const sourceUrls = {
  modelsDev: "https://models.dev/api.json",
  eci: "https://epoch.ai/data/eci_scores.csv",
  benchmarks: "https://epoch.ai/data/processed_data_for_eci.csv",
};
export const sources: Source[] = [
  {
    name: "models.dev",
    url: "https://models.dev",
    license: "MIT",
  },
  {
    name: "Epoch AI",
    url: "https://epoch.ai/benchmarks",
    license: "CC BY 4.0",
  },
];
/**
 * First-party APIs only: prices come from the company that makes the model.
 * Some providers also resell others' models, so each one keeps its own brands.
 */
export const providerBrands: Record<string, RegExp> = {
  openai: /\bgpt|^o\d|codex/i,
  anthropic: /claude/i,
  google: /gemini|gemma/i,
  xai: /grok/i,
  deepseek: /deepseek/i,
  mistral: /mistral|mixtral|magistral|pixtral|codestral|devstral|ministral/i,
  meta: /muse|llama/i,
  alibaba: /qwen|qwq|qvq/i,
  moonshotai: /kimi/i,
  zai: /glm/i,
  minimax: /minimax/i,
  cohere: /command|aya/i,
  xiaomi: /mimo/i,
  nova: /nova/i,
};
export const providers = Object.keys(providerBrands);
const excluded =
  /custom tools|-mt\b|embed|tts|transcri|realtime|audio|translat|ocr|guard|moderation|search|computer.?use|live|latest|image|lyria|banana|veo|whisper|dall|sora/i;

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((v) => v !== ""));
  if (!header) return [];
  return body.map((r) =>
    Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ""])),
  );
}

export function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\b(preview|exp|experimental)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}
/** Epoch model versions carry an effort suffix (`claude-opus-4-7_max`). */
const stripEffort = (v: string) =>
  v.replace(/_(max|xhigh|high|medium|low|minimal|none|\d+k?)$/i, "");
/** Dated snapshot ids (`gpt-4o-2024-08-06`, `claude-3-5-sonnet-20241022`). */
const stripDate = (v: string) => v.replace(/-?\d{4}-?\d{2}-?\d{2}$/, "");

type RawModel = {
  id: string;
  name: string;
  family?: string;
  release_date?: string;
  knowledge?: string;
  status?: string;
  reasoning?: boolean;
  tool_call?: boolean;
  open_weights?: boolean;
  modalities?: { input?: string[]; output?: string[] };
  limit?: { context?: number; output?: number };
  cost?: { input?: number; output?: number; cache_read?: number };
};
type RawProvider = {
  id: string;
  name: string;
  models: Record<string, RawModel>;
};

function eligible(m: RawModel) {
  const output = m.modalities?.output ?? [];
  const input = m.modalities?.input ?? [];
  return (
    m.status !== "deprecated" &&
    typeof m.cost?.input === "number" &&
    typeof m.cost?.output === "number" &&
    m.cost.input > 0 &&
    output.length === 1 &&
    output[0] === "text" &&
    input.includes("text") &&
    (m.release_date ?? "") >= "2024-01-01" &&
    !excluded.test(`${m.id} ${m.name}`)
  );
}

export function buildCatalog(
  modelsDev: unknown,
  eciCsv: string,
  benchmarksCsv: string,
  options: { generatedAt: string; live: boolean },
): Catalog {
  const eciRows = parseCsv(eciCsv).filter((r) =>
    Number.isFinite(Number(r.eci)),
  );
  const eciByKey = new Map<string, Record<string, string>>();
  for (const r of eciRows)
    for (const key of [r.Model, r["Display name"]])
      if (key) eciByKey.set(normalize(key), r);

  const benchRows = parseCsv(benchmarksCsv);
  const versionToModel = new Map<string, string>();
  const scoresByModel = new Map<string, Map<string, number>>();
  for (const r of benchRows) {
    if (r.model_version)
      versionToModel.set(normalize(stripEffort(r.model_version)), r.Model);
    const value = Number(r.performance);
    if (!r.Model || !Number.isFinite(value)) continue;
    const scores = scoresByModel.get(r.Model) ?? new Map();
    // One row per model and benchmark is expected; keep the best if repeated.
    scores.set(r.benchmark, Math.max(scores.get(r.benchmark) ?? -1, value));
    scoresByModel.set(r.Model, scores);
  }
  function findEpoch(m: RawModel) {
    for (const key of [m.name, m.id, stripDate(m.id)]) {
      const direct = eciByKey.get(normalize(key));
      if (direct) return direct;
      const viaVersion = versionToModel.get(normalize(key));
      if (viaVersion) {
        const row = eciByKey.get(normalize(viaVersion));
        if (row) return row;
      }
    }
    return undefined;
  }

  const raw = (modelsDev ?? {}) as Record<string, RawProvider>;
  const models: CatalogModel[] = [];
  for (const providerId of providers) {
    const provider = raw[providerId];
    if (!provider?.models) continue;
    const seen = new Set<string>();
    const candidates = Object.values(provider.models)
      .filter((m) => eligible(m) && providerBrands[providerId].test(m.name))
      // Prefer undated aliases over dated snapshots of the same model.
      .sort((a, b) => a.id.length - b.id.length);
    for (const m of candidates) {
      const nameKey = normalize(m.name);
      if (seen.has(nameKey)) continue;
      seen.add(nameKey);
      const epoch = findEpoch(m);
      const epochScores = epoch && scoresByModel.get(epoch.Model);
      const scores: Record<string, number> = {};
      if (epochScores)
        for (const t of tasks) {
          const v = epochScores.get(t.epochName);
          if (v !== undefined) scores[t.id] = Math.round(v * 1000) / 10;
        }
      models.push({
        id: `${providerId}/${m.id}`,
        provider: providerId,
        providerName: provider.name,
        name: m.name,
        family: m.family ?? null,
        releaseDate: m.release_date ?? null,
        knowledge: m.knowledge ?? null,
        context: m.limit?.context ?? null,
        maxOutput: m.limit?.output ?? null,
        inputModalities: m.modalities?.input ?? ["text"],
        reasoning: Boolean(m.reasoning),
        toolCall: Boolean(m.tool_call),
        openWeights: Boolean(m.open_weights),
        price: {
          input: m.cost!.input!,
          output: m.cost!.output!,
          cacheRead:
            typeof m.cost?.cache_read === "number" ? m.cost.cache_read : null,
        },
        intelligence: epoch
          ? {
              value: Number(epoch.eci),
              low: Number(epoch.eci_ci_low) || Number(epoch.eci),
              high: Number(epoch.eci_ci_high) || Number(epoch.eci),
              rank: 0,
              source: epoch.Model,
            }
          : null,
        scores,
      });
    }
  }
  const ranked = models
    .filter((m) => m.intelligence)
    .sort((a, b) => b.intelligence!.value - a.intelligence!.value);
  ranked.forEach((m, i) => {
    m.intelligence!.rank = i + 1;
  });
  models.sort(
    (a, b) =>
      (b.intelligence?.value ?? -Infinity) -
        (a.intelligence?.value ?? -Infinity) ||
      (b.releaseDate ?? "").localeCompare(a.releaseDate ?? ""),
  );
  return {
    generatedAt: options.generatedAt,
    live: options.live,
    sources,
    models,
  };
}
