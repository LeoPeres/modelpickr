import { test, expect, type Page } from "@playwright/test";

const models = [
  "openai/gpt-6-luna",
  "anthropic/claude-opus-5-5",
  "google/gemini-3.7-flash",
  "deepseek/deepseek-flash",
];
const compare = (extra = "") => `/compare?models=${models.join(",")}${extra}`;
const cards = (page: Page) => page.locator("article.model-card");
const verdict = (page: Page) => page.locator(".verdict-strip");

test("do catálogo à comparação", async ({ page }) => {
  await page.goto("/");
  const search = page.getByPlaceholder("Buscar modelo ou empresa");
  await search.fill("gpt-6 luna");
  await page.getByLabel("Selecionar GPT-6 Luna").check();
  await search.fill("opus 5.5");
  await page.getByLabel("Selecionar Claude Opus 5.5").check();
  await page
    .getByLabel("Modelos selecionados")
    .getByRole("link", { name: "Comparar" })
    .click();
  await expect(page).toHaveURL(/\/compare\?models=/);
  await expect(cards(page)).toHaveCount(2);
  await expect(verdict(page)).toContainText("Melhor escolha");
});

test("objetivo vai para a URL e muda a recomendação", async ({ page }) => {
  await page.goto(compare());
  await expect(verdict(page).locator("h2")).toHaveText("GPT-6 Luna");
  await page.getByRole("radio", { name: "Inteligência máxima" }).click();
  await expect(page).toHaveURL(/goal=intelligence/);
  await expect(verdict(page).locator("h2")).toHaveText("Claude Opus 5.5");
});

test("uso recalcula o custo da recomendação", async ({ page }) => {
  await page.goto(compare());
  const figure = verdict(page).locator(".verdict-figures strong");
  await expect(figure).toHaveText("US$ 35,00");
  await page.getByRole("button", { name: "Ajustar" }).click();
  await page.getByLabel("Solicitações por mês").fill("200000");
  await expect(figure).toHaveText("US$ 70,00");
  await page.getByRole("radio", { name: "Agente", exact: true }).click();
  await expect(page.locator(".usage-summary")).toContainText(
    "20.000 tokens de entrada (70% em cache)",
  );
  await expect(figure).not.toHaveText("US$ 70,00");
});

test("custo mensal vai do mais barato ao mais caro", async ({ page }) => {
  await page.goto(compare("&goal=intelligence"));
  const values = await page.locator(".cost-list .cost-value").allTextContents();
  const amounts = values.map((v) =>
    Number(v.replace(/[^\d,]/g, "").replace(",", ".")),
  );
  expect(amounts).toEqual([...amounts].sort((a, b) => a - b));
});

test("nova comparação limpa e o Voltar restaura", async ({ page }) => {
  await page.goto(compare("&goal=intelligence"));
  await expect(cards(page)).toHaveCount(4);
  await page.getByRole("button", { name: "Nova comparação" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(cards(page)).toHaveCount(0);
  await page.getByLabel("Buscar modelo").fill("sonnet 5.5");
  await page.keyboard.press("Enter");
  await expect(cards(page)).toHaveCount(1);
  await page.goBack();
  await expect(cards(page)).toHaveCount(4);
  await expect(page).toHaveURL(/goal=intelligence/);
});

test("ponto do gráfico leva ao card do modelo", async ({ page, isMobile }) => {
  await page.goto(compare());
  const dot = page
    .getByRole("img", { name: /^Gemini 3\.7 Flash:/ })
    .locator("circle")
    .last();
  await dot.scrollIntoViewIfNeeded();
  const box = (await dot.boundingBox())!;
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  if (isMobile) {
    // First tap shows the tooltip, the second one picks.
    await page.touchscreen.tap(x, y);
    await expect(page.locator(".cost-chart-tooltip")).toContainText(
      "Toque de novo",
    );
    await page.touchscreen.tap(x, y);
  } else await page.mouse.click(x, y);
  await expect(page.locator(".model-card.is-pointed")).toContainText(
    "Gemini 3.7 Flash",
  );
});

test("cenário salvo aparece em Cenários", async ({ page }) => {
  await page.goto(compare());
  await page.getByRole("button", { name: "Salvar cenário" }).click();
  await page.getByLabel("Nome do cenário").fill("Suporte e2e");
  await page.getByRole("button", { name: "Salvar neste navegador" }).click();
  await expect(page.getByText("Cenário salvo neste navegador.")).toBeVisible();
  await page.goto("/scenarios");
  await expect(page.getByText("Suporte e2e")).toBeVisible();
});

test("Ctrl+K abre o seletor e adiciona um modelo", async ({ page }) => {
  await page.goto(compare());
  await expect(cards(page)).toHaveCount(4);
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Buscar modelo").fill("grok 4.6");
  await page.keyboard.press("Enter");
  await expect(cards(page)).toHaveCount(5);
  await expect(page).toHaveURL(/xai/);
});
