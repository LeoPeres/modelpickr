// Shapes shared by the catalog builder, the server loader and the UI.
export type Price = {
  /** USD per 1M input tokens. */
  input: number;
  /** USD per 1M output tokens. */
  output: number;
  /** USD per 1M cached input tokens, when the provider publishes it. */
  cacheRead: number | null;
};
export type Intelligence = {
  /** Epoch Capabilities Index (ECI). */
  value: number;
  /** 90% confidence interval published by Epoch AI. */
  low: number;
  high: number;
  /** Position among catalog models with an ECI (1 = most capable). */
  rank: number;
  /** Model name as published by Epoch AI. */
  source: string;
};
export type CatalogModel = {
  /** `${provider}/${modelId}`, stable and URL-safe. */
  id: string;
  provider: string;
  providerName: string;
  name: string;
  family: string | null;
  releaseDate: string | null;
  knowledge: string | null;
  context: number | null;
  maxOutput: number | null;
  inputModalities: string[];
  reasoning: boolean;
  toolCall: boolean;
  openWeights: boolean;
  price: Price;
  intelligence: Intelligence | null;
  /** Benchmark id (`tasks.ts`) → score in % (0–100). Missing means no data. */
  scores: Record<string, number>;
};
export type Source = {
  name: string;
  url: string;
  license: string;
};
export type Catalog = {
  generatedAt: string;
  /** False when the server fell back to the bundled snapshot. */
  live: boolean;
  sources: Source[];
  models: CatalogModel[];
};
