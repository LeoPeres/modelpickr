// Server-side catalog loader: live public sources, cached for a day, with the
// bundled snapshot as fallback when a source is down or returns bad data.
import { readFile } from "node:fs/promises";
import { cacheLife } from "next/cache";
import snapshot from "@/data/catalog.json";
import { buildCatalog, sourceUrls } from "./build";
import type { Catalog } from "./types";

async function text(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}

export async function getCatalog(): Promise<Catalog> {
  "use cache";
  cacheLife("days");
  // End-to-end tests pin the data so screenshots do not change with it.
  if (process.env.CATALOG_FIXTURE)
    return JSON.parse(await readFile(process.env.CATALOG_FIXTURE, "utf8"));
  try {
    const [modelsDev, eci, benchmarks] = await Promise.all([
      text(sourceUrls.modelsDev).then(JSON.parse),
      text(sourceUrls.eci),
      text(sourceUrls.benchmarks),
    ]);
    const catalog = buildCatalog(modelsDev, eci, benchmarks, {
      generatedAt: new Date().toISOString(),
      live: true,
    });
    // A drastic drop usually means a source changed format; keep the snapshot.
    if (catalog.models.length < snapshot.models.length / 2)
      throw new Error("Catálogo ao vivo incompleto.");
    return catalog;
  } catch (error) {
    console.warn("Usando snapshot do catálogo:", error);
    return snapshot as Catalog;
  }
}
