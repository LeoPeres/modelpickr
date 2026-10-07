// Refreshes the bundled snapshot (data/catalog.json) and provider logos.
// The app fetches live data on the server; this snapshot is the fallback.
import { mkdir, writeFile } from "node:fs/promises";
import { buildCatalog, providers, sourceUrls } from "../lib/catalog/build";

async function text(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}

const [modelsDev, eci, benchmarks] = await Promise.all([
  text(sourceUrls.modelsDev).then(JSON.parse),
  text(sourceUrls.eci),
  text(sourceUrls.benchmarks),
]);
const catalog = buildCatalog(modelsDev, eci, benchmarks, {
  generatedAt: new Date().toISOString(),
  live: false,
});
await writeFile("data/catalog.json", JSON.stringify(catalog) + "\n");
await mkdir("public/logos", { recursive: true });
for (const p of providers) {
  const res = await fetch(`https://models.dev/logos/${p}.svg`);
  if (res.ok) await writeFile(`public/logos/${p}.svg`, await res.text());
  else console.warn(`Sem logo para ${p}`);
}
const withEci = catalog.models.filter((m) => m.intelligence).length;
console.log(
  `${catalog.models.length} modelos, ${withEci} com ECI → data/catalog.json`,
);
