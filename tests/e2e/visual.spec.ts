import { test, expect, type Page } from "@playwright/test";

// Screenshot baselines live in __screenshots__/<project>/. Update them with
// `npm run e2e:update` after an intended visual change, and review the diff.
const compare =
  "/compare?models=anthropic/claude-opus-5-5,openai/gpt-6-astra,openai/gpt-6.1-sol,anthropic/claude-sonnet-5-5,openai/gpt-5.5-pro,google/gemini-3.7-flash,openai/gpt-6-luna,deepseek/deepseek-flash,xai/grok-4.6,moonshotai/kimi-k3";

async function open(page: Page, url: string, theme: "light" | "dark") {
  await page.addInitScript(
    (t) => localStorage.setItem("modelpickr:theme", t),
    theme,
  );
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
}
const section = (page: Page, title: string) =>
  page.locator("section.block", {
    has: page.locator("h2", { hasText: title }),
  });

test.describe("visual", { tag: "@visual" }, () => {
  for (const theme of ["light", "dark"] as const) {
    test(`catálogo · ${theme}`, async ({ page }) => {
      await open(page, "/", theme);
      await expect(page).toHaveScreenshot(`catalog-${theme}.png`);
    });

    test(`comparação, primeira dobra · ${theme}`, async ({ page }) => {
      await open(page, compare, theme);
      await expect(page.locator(".verdict-strip")).toBeVisible();
      await expect(page).toHaveScreenshot(`compare-fold-${theme}.png`);
    });

    test(`gráfico custo × inteligência · ${theme}`, async ({ page }) => {
      await open(page, compare, theme);
      const chart = section(page, "Custo × inteligência");
      await expect(chart.locator(".cost-chart svg")).toBeVisible();
      await expect(chart).toHaveScreenshot(`chart-${theme}.png`);
    });
  }

  test("custo mensal", async ({ page }) => {
    await open(page, compare, "light");
    await expect(section(page, "Custo mensal")).toHaveScreenshot("cost.png");
  });

  test("detalhes", async ({ page }) => {
    await open(page, compare, "light");
    await expect(section(page, "Detalhes")).toHaveScreenshot("details.png");
  });

  test("uso aberto com perfil Agente", async ({ page }) => {
    await open(page, compare, "light");
    await page.getByRole("radio", { name: "Agente", exact: true }).click();
    await page.getByRole("button", { name: "Ajustar" }).click();
    await expect(page.locator(".usage-bar")).toHaveScreenshot("usage.png");
  });

  test("cenários vazio", async ({ page }) => {
    await open(page, "/scenarios", "light");
    await expect(page).toHaveScreenshot("scenarios-empty.png");
  });

  test("metodologia", async ({ page }) => {
    await open(page, "/methodology", "light");
    await expect(page).toHaveScreenshot("methodology.png");
  });
});
