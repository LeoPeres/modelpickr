<div align="center">

<img src="app/icon.svg" alt="" width="64" height="64">

# ModelPickr

**English** · [Português (Brasil)](README.pt-BR.md)

**Compare models. Pick better.**

A language model comparator built on real prices and real intelligence scores: catalog, side-by-side comparison, cost calculator and a recommendation tuned to your goal.

[![CI](https://github.com/LeoPeres/modelpickr/actions/workflows/ci.yml/badge.svg)](https://github.com/LeoPeres/modelpickr/actions/workflows/ci.yml)
![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React 19](https://img.shields.io/badge/React-19-149eca?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Data: Epoch AI (CC BY 4.0)](https://img.shields.io/badge/data-Epoch%20AI%20%C2%B7%20CC%20BY%204.0-555)](https://epoch.ai/benchmarks)

</div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshot-dark.png">
  <img alt="ModelPickr comparison screen: goal, usage, recommendation and model cards" src="docs/screenshot-light.png">
</picture>

> [!NOTE]
> The app's interface is in Brazilian Portuguese. Prices are in US dollars, as published by each provider.

## Contents

- [Why](#why)
- [Features](#features)
- [How the recommendation works](#how-the-recommendation-works)
- [Data and attribution](#data-and-attribution)
- [Getting started](#getting-started)
- [Testing](#testing)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [License](#license)

## Why

Choosing a language model for production usually means cross-checking each provider's pricing page against leaderboards that all use different scales. ModelPickr puts both in one place, using public and verifiable data, and answers a concrete question: **for my workload, which model gives me the most for what it costs?**

No score is ever made up or estimated. Missing data shows as `—`, never as zero.

## Features

- **Catalog** (`/`): every paid, text-output model with a first-party price, with accent- and punctuation-insensitive search, a provider filter and sorting.
- **Comparison** (`/compare`): up to 10 models side by side, with the whole state in the URL (`?models=anthropic/claude-opus-5-5,openai/gpt-6.1-sol`), ready to share.
  - Goal: **best value**, **highest intelligence** or **lowest cost**.
  - Usage presets (Chat, RAG, Agent, Classification), or volume and tokens set by hand, including the share of input read from cache.
  - Ranked model cards, with trophies for the top three and the best pick highlighted.
  - Cost × intelligence SVG chart, with a log cost axis and the equal-value line drawn through the recommendation.
  - Monthly cost per model, a details table ("only differences") and a per-task comparison using one Epoch AI benchmark at a time.
- **Scenarios** (`/scenarios`): save, reopen, edit and delete comparisons.
- **Methodology** (`/methodology`): formulas, sources, limitations and attribution.
- **Pro** (`/pro`): an interest page for upcoming features. Nothing is charged and nothing is sent.
- Light and dark themes, responsive layout (bottom tab bar on mobile), keyboard navigation in the model picker (<kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>K</kbd>) and support for `prefers-reduced-motion`.

Selection, scenarios and the interest list live **only in the browser's `localStorage`**. There is no database, no accounts and no tracking.

## How the recommendation works

Each model's intelligence is its [Epoch Capabilities Index (ECI)](https://epoch.ai/benchmarks). Monthly cost uses the list price per million tokens:

```
cost = requests × (input_tokens × input_rate + output_tokens × output_price) / 1,000,000
```

where `input_rate` blends the input price with the cache-read price by the cache percentage you set (a model without a cache price pays the input price). Cache writes, batch pricing and pricing tiers are not included.

| Goal                 | Rule                                                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Best value (default) | Highest `ECI − 3 × log2(monthly cost)`: doubling the cost must buy at least 3 ECI points. Independent of volume.      |
| Highest intelligence | Every model whose confidence interval reaches the top ECI model's interval counts as tied; the cheapest of them wins. |
| Lowest cost          | The cheapest rated model.                                                                                             |

Models without an ECI never win a recommendation. In the per-task comparison, scores from different benchmarks are never mixed: each task uses one benchmark at a time, and the cheapest model meeting the (inclusive) minimum score wins. The rules are pure functions in [`lib/engine.ts`](lib/engine.ts), covered by [`tests/engine.test.ts`](tests/engine.test.ts).

## Data and attribution

| Source                                  | Used for                                                                 | License                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| [models.dev](https://models.dev)        | Official API prices, context, capabilities, release dates, company logos | MIT                                                                          |
| [Epoch AI](https://epoch.ai/benchmarks) | ECI and per-task benchmarks                                              | CC BY 4.0 (attribution required, shown in the sidebar and on `/methodology`) |

Only prices from the company that makes the model are kept; resellers (say, one provider hosting another's model) are dropped. The server fetches the sources and caches the built catalog for a day. If a source fails or the live catalog shrinks by half, the app falls back to the snapshot in [`data/catalog.json`](data/catalog.json).

## Getting started

Requirements: Node.js 22 or newer (CI uses Node 24) and npm. Docker is only needed for the end-to-end tests. No environment variables are required.

```sh
git clone https://github.com/LeoPeres/modelpickr.git
cd modelpickr
npm ci
npm run dev   # http://localhost:3000
```

| Script               | What it does                                                            |
| -------------------- | ----------------------------------------------------------------------- |
| `npm run dev`        | Development server (Turbopack) on `0.0.0.0:3000`                        |
| `npm run build`      | Production build (uses Webpack on purpose)                              |
| `npm start`          | Serves the production build                                             |
| `npm run typecheck`  | `tsc --noEmit`                                                          |
| `npm test`           | Unit tests (`node:test` via `tsx`)                                      |
| `npm run sync`       | Refreshes `data/catalog.json` and `public/logos/*.svg` from the sources |
| `npm run e2e`        | Playwright end-to-end and visual tests, in Docker                       |
| `npm run e2e:update` | Same, rewriting the screenshot baselines                                |

## Testing

**Unit.** `npm test` runs [`tests/engine.test.ts`](tests/engine.test.ts) against inline fixtures, independent of live data. To run a single test:

```sh
npx tsx --test --test-name-pattern="seleção por URL" tests/engine.test.ts
```

**End-to-end and visual.** `npm run e2e` copies the project into the official Playwright image, makes a production build and runs the main flows ([`flows.spec.ts`](tests/e2e/flows.spec.ts)) and the screenshot comparisons ([`visual.spec.ts`](tests/e2e/visual.spec.ts)) on desktop (1400×900) and mobile (Pixel 7), in light and dark themes. The catalog is frozen in [`tests/e2e/catalog.json`](tests/e2e/catalog.json), so data changes never break the screenshots.

```sh
npm run e2e -- --project desktop --grep "gráfico"   # a subset
npx playwright show-report                          # report from the last run
```

When a visual test fails, `test-results/` holds the expected, actual and diff images. Always generate baselines through Docker: font rendering differs outside it.

**CI.** The [workflow](.github/workflows/ci.yml) runs typecheck, unit tests, build and the end-to-end suite on every push to `main` and on every pull request.

## Architecture

Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind CSS v4 and [lucide-react](https://lucide.dev). No chart or state management library.

```
app/                  Routes (thin wrappers); /scenarios and /methodology hold their content inline
components/
  shell.tsx           Client layout; useCatalog() and useSelection()
  catalog.tsx         Catalog (/)
  comparison.tsx      Comparison (/compare), state in the URL
  cost-chart.tsx      Cost × intelligence SVG chart
  model-picker.tsx    Command-palette model picker
  carousel.tsx        Snap carousel with drag and FLIP animations
lib/
  catalog/build.ts    Builds the catalog from the three raw sources (pure)
  catalog/server.ts   getCatalog(): live sources, one-day cache, local fallback
  catalog/tasks.ts    Tasks → Epoch AI benchmarks
  engine.ts           Cost, rankings, ties and recommendations (pure)
  storage.ts          localStorage keys and validators
  i18n.ts             pt-BR Intl formatters
data/catalog.json     Fallback catalog snapshot
scripts/              Data sync and the Dockerized e2e runner
tests/                Unit and e2e tests
```

The UI is in Brazilian Portuguese (`lang="pt-BR"`), and numbers, currency and dates go through `Intl` in [`lib/i18n.ts`](lib/i18n.ts) (for example, `US$ 1.400,00`).

## Contributing

Issues and pull requests are welcome. Before opening a PR:

1. Run `npm run typecheck` and `npm test`.
2. If the change alters the UI on purpose, run `npm run e2e:update` and include the new baselines in the PR.
3. Follow the domain rules: never make up or estimate a score (missing data is `null` and shows as `—`), never format numbers with `toFixed` or a bare `$`, and write UI copy and test names in Brazilian Portuguese.
4. New colors need a variable for both themes and a contrast of at least 4.5:1.
5. Write commit messages in English.

Format with Prettier: `npx prettier --write <files>`.

## License

The code is released under the [MIT License](LICENSE). The data follows its sources' licenses: models.dev under MIT and Epoch AI under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), which requires attribution in any redistribution.

Pricing and specs: [models.dev](https://models.dev). Intelligence and benchmarks: [Epoch AI](https://epoch.ai/benchmarks).
