# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

ModelMatch: an MVP comparator of language models (catalog, side-by-side comparison, cost calculator, recommendation, saved scenarios, a "Pro" interest page). Next.js 16 App Router, React 19, TypeScript, Tailwind v4, lucide-react. **The UI and user-facing copy are in Brazilian Portuguese (`lang="pt-BR"`)**, and so are test names. Keep new copy in pt-BR.

**Data is real and public**: prices, specs and company logos from [models.dev](https://models.dev) (MIT), intelligence (Epoch Capabilities Index, ECI) and task benchmarks from [Epoch AI](https://epoch.ai/benchmarks) (CC BY 4.0, attribution required; it is shown in the sidebar and on `/methodology`). Never invent or estimate a score: missing data is `—`. The server fetches the sources and caches the built catalog for a day; user data (selection, scenarios, Pro interest) persists only to `localStorage`.

## Commands

```sh
npm run dev         # Turbopack dev server on 0.0.0.0:3000
npm run build       # uses --webpack on purpose (Turbopack build fails in this environment)
npm run typecheck   # tsc --noEmit
npm test            # node:test via tsx, runs tests/*.test.ts
npm run sync        # refresh the fallback snapshot data/catalog.json and public/logos/*.svg
npx tsx --test --test-name-pattern="seleção por URL" tests/engine.test.ts   # single test
```

There is no lint script; Prettier is installed (`npx prettier --write <files>`). Browser QA: start the dev server, then `python3 scripts/run-browser-qa.py` (drives `scripts/browser-qa.js` through a Codex Playwright skill wrapper at `~/.codex/skills/playwright/`; screenshots go to `output/playwright/`, gitignored).

## Architecture

- `lib/catalog/build.ts`: pure builder from the three raw sources (`sourceUrls`) to a `Catalog` (`lib/catalog/types.ts`). Keeps only first-party prices (`providerBrands`: each provider keeps its own model brands, so resellers like Alibaba hosting Kimi are dropped), text-output, non-deprecated, paid models; matches Epoch rows by normalized name, then by Epoch `model_version` (effort suffix stripped). Includes an RFC 4180 `parseCsv`.
- `lib/catalog/server.ts`: `getCatalog()` with `"use cache"` + `cacheLife("days")` (Cache Components is enabled in `next.config.ts`); falls back to `data/catalog.json` if a source fails or the live catalog shrinks by half. `app/layout.tsx` awaits it and passes the catalog to `Shell`.
- `lib/catalog/tasks.ts`: advanced comparison tasks, each mapped to exactly one Epoch benchmark (`epochName` must match Epoch's name verbatim). `lib/catalog/search.ts`: picker/catalog search (accent/punctuation-insensitive token match, name hits rank first).
- `lib/engine.ts`: pure logic over `CatalogModel` (cost formula, URL selection parsing, best values/ties, `recommendBalanced`, `recommendForTask`, `detectChanges`, `evaluateAlternatives`). Main target of `tests/engine.test.ts`, which uses inline fixtures, not live data.
- `lib/storage.ts`: localStorage keys (`modelmatch:selection|scenarios|interest`; the theme uses `modelmatch:theme`), validators (`validScenario`) and `InterestAdapter`/`demoInterestAdapter` (stores up to 20 sign-ups locally, sends nothing).
- `lib/i18n.ts`: locale, Intl formatters (`formatNumber`, `formatUsd`, `formatUsdShort`, `formatPrice`, `formatDate`), all pt-BR ("US$ 1.400,00", "167,3", "1,1M"), and a partial message dictionary. Never format user-facing numbers with `toFixed` or a bare `$`. Most editorial text is still inline in components.
- `components/shell.tsx`: client-side layout wrapping every page. Exposes `useCatalog()` (catalog, `byId`, `ids`) and `useSelection()` (selected ids, persisted to localStorage).
- `components/model-picker.tsx`: command-palette dialog for adding or swapping models (search, company chips, sort, ↑↓/Enter/Esc; Ctrl/⌘K opens it on `/compare`). `components/carousel.tsx` is the generic snap carousel for the model cards (swipe, mouse drag, arrows, edge fades, FLIP reorder/enter animations via the Web Animations API, respects reduced motion). Two snap pitfalls it works around: animate the card inside `.carousel-item`, never the snap item (browsers snap to transformed boxes), and items are keyed by `resetKey` (the goal) so a goal change recreates them instead of moving them (browsers re-snap to follow a moved snapped element) before scrolling back to the first card. `components/provider-logo.tsx` renders `public/logos/<provider>.svg` as a CSS mask so it follows the theme.
- `components/catalog.tsx` (`/`), `components/comparison.tsx` (`/compare`), `components/pro.tsx` (`/pro`): the interactive flows. Route files in `app/` are mostly thin wrappers; `app/scenarios/page.tsx` and `app/methodology/page.tsx` contain their content inline.
- `/compare` state lives in the URL: `?models=provider/id,...` (max `maxModels` = 10, validated by `selectionFromUrl` against catalog ids) and optional `&scenario=<id>` to edit a saved scenario. First fold: goal and usage bars (usage presets Chat/RAG/Agente/Classificação set tokens per request and cache %, "Ajustar" opens the fields), recommendation strip, one card per model (logo, ECI with rank, input/output price). Below, in order: cost × intelligence chart, monthly cost, details ("Só diferenças" on by default) and the per-task section (labeled "Pro · prévia", not gated).
- `components/cost-chart.tsx`: hand-rolled SVG scatter (no chart library). Log cost axis, so the value goal's equal-value line (`ECI − 3·log2 cost`) is straight and drawn through the recommendation; greedy label placement that drops labels that would collide (the tooltip still names them); nearest-point hover; clicking a point (second tap on touch, Enter on keyboard) scrolls to and flashes the model's card, and hovering a card highlights its point. The recommended point is violet and the rest gray: violet vs the intel blue fails the CVD/normal-vision separation check. `comparison.tsx` uses `useSearchParams`, so its page wraps it in `<Suspense>`.

### Domain rules (enforced in engine and tests)

- Missing data is `null`/absent, never zero. Models without an ECI never win a recommendation. "Best" respects direction and marks ties.
- Free comparison (`recommend(models, usage, goal)`), goal chosen by the user (URL `&goal=`, saved in scenarios; default `value`):
  - `value` (custo-benefício): highest `ECI − pointsPerDoubling × log2(monthly cost)` (`pointsPerDoubling = 3`): doubling the cost must buy ≥3 ECI points. Scale-invariant in volume; falls back to `intelligence` when costs are zero.
  - `intelligence`: find the highest ECI; every model whose CI `high` reaches that model's CI `low` is tied; cheapest tied model wins.
  - `cost`: cheapest rated model.
  Also returns `smartest` and `cheapest` for card tags.
- `rankModels(models, usage, goal)` orders the cards and details columns on `/compare` best→worst (the monthly cost list is ordered by cost, cheapest first); every #1 is in `recommend(...).best` (tested). Equal keys share a position; unrated models go last with `rank: null`. #1–#3 get gold/silver/bronze trophies (`--gold|silver|bronze*` tokens).
- Per task (`recommendForTask`): one benchmark per task, never mixed; cheapest model with a score meeting the inclusive minimum.
- Cost: `requests * (inputTokens * inputRate + outputTokens * price.output) / 1e6`, where `inputRate` blends `price.input` with `price.cacheRead` by `usage.cached` (0–100 % of input read from cache; a model without a cache price pays the input price). USD per million tokens, first-party list price; no cache writes, batch or tiers. `cached` is optional so older scenarios stay valid.

### Styling

Minimal monochrome design: left sidebar with lucide icons (bottom tab bar under 820px), no header, raised `surface` cards, pill/segmented controls, Geist (`--font-sans`) for UI and Instrument Serif (`--font-display`) for headings, both via `next/font/google` in `app/layout.tsx`. Keep copy short and show only essential elements. The logo (`components/logo.tsx`, also `app/icon.svg`) was generated with Codex `image_gen` and vectorized with potrace; source variants live in `design/logo/`. Model avatars are initials (`components/model-avatar.tsx`), never real brand marks. `app/globals.css` imports Tailwind but mostly defines semantic classes (`button primary`, `field`, `data-table`, `block`, `notice`, …) and grayscale CSS custom properties. Dark mode is `:root[data-theme="dark"]`, set before hydration by an inline script in `app/layout.tsx` and toggled by `components/theme-toggle.tsx`. When adding colors, define a variable for both themes. Color is sparse and semantic on a grayscale base: violet `--accent*` = brand/recommendation/selection, blue `--intel*` = intelligence (ECI bars, score bars, chart dots), green `--good*` = savings and "Melhor" badges (always with text or an icon, never color alone). Text on `--accent` uses `--on-accent`; keep new accent text at ≥4.5:1 contrast in both themes.
