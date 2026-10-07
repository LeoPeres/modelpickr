import { normalize } from "./build";
import type { CatalogModel } from "./types";
export type SortKey = "intelligence" | "price" | "recent";
/** Typical 3:1 input/output mix, used only for ordering by price. */
export const blendedPrice = (m: CatalogModel) =>
  (3 * m.price.input + m.price.output) / 4;
const sorters: Record<SortKey, (a: CatalogModel, b: CatalogModel) => number> = {
  intelligence: (a, b) =>
    (b.intelligence?.value ?? -Infinity) - (a.intelligence?.value ?? -Infinity),
  price: (a, b) => blendedPrice(a) - blendedPrice(b),
  recent: (a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? ""),
};
/**
 * Every query token must appear in the model's name, company or id, ignoring
 * case, accents, spaces and punctuation ("opus47" finds "Claude Opus 4.7").
 * Name matches rank above company/id matches; ties use the chosen order.
 */
export function searchModels(
  models: CatalogModel[],
  query: string,
  options: { provider?: string; sort?: SortKey } = {},
) {
  const tokens = query.split(/\s+/).map(normalize).filter(Boolean);
  const whole = normalize(query);
  const sort = sorters[options.sort ?? "intelligence"];
  return models
    .filter((m) => !options.provider || m.provider === options.provider)
    .map((m) => {
      const name = normalize(m.name);
      const hay =
        name + normalize(`${m.providerName} ${m.id} ${m.family ?? ""}`);
      if (!tokens.every((t) => hay.includes(t))) return null;
      const score = !whole
        ? 0
        : name.startsWith(whole)
          ? 3
          : name.includes(whole)
            ? 2
            : tokens.every((t) => name.includes(t))
              ? 1
              : 0;
      return { m, score };
    })
    .filter((r): r is { m: CatalogModel; score: number } => r !== null)
    .sort((a, b) => b.score - a.score || sort(a.m, b.m))
    .map((r) => r.m);
}
