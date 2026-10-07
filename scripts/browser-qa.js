async (page) => {
  const base = "http://localhost:3000";
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base);
  await page.evaluate(() => localStorage.removeItem("modelpickr:selection"));
  await page.reload();
  const search = page.getByRole("textbox", {
    name: "Buscar modelos ou empresas",
  });
  await search.fill("claude");
  await page.getByRole("checkbox").first().waitFor();
  if ((await page.getByRole("checkbox", { name: /GPT/ }).count()) !== 0)
    throw new Error("Search did not filter");
  await search.fill("");
  await page
    .getByRole("combobox", { name: "Ordenação", exact: true })
    .selectOption("price");
  // Live data changes over time, so select by position, never by name.
  const boxes = page.getByRole("checkbox");
  const max = 10;
  for (let i = 0; i < max; i++) await boxes.nth(i).check();
  await boxes.nth(max).click();
  await page.getByText(`Limite de ${max} modelos.`, { exact: false }).waitFor();
  if ((await page.getByRole("checkbox", { checked: true }).count()) !== max)
    throw new Error("Selection limit failed");
  await page.screenshot({
    path: "output/playwright/catalog-desktop.png",
    fullPage: true,
  });
  for (let i = max - 1; i >= 3; i--) await boxes.nth(i).uncheck();
  await page
    .getByRole("link", { name: "Comparar", exact: true })
    .last()
    .click();
  await page
    .getByRole("heading", { name: "Comparação", exact: true })
    .waitFor();
  if (!page.url().includes("models=")) throw new Error("URL selection missing");
  await page
    .getByText(/Melhor escolha|Sem recomendação/)
    .first()
    .waitFor();
  // Each goal must produce a recommendation and land in the URL.
  for (const [goal, param] of [
    ["Inteligência máxima", "goal=intelligence"],
    ["Menor custo", "goal=cost"],
  ]) {
    await page.getByRole("radio", { name: goal }).click();
    await page.waitForURL((u) => u.toString().includes(param));
  }
  await page.getByRole("radio", { name: "Custo-benefício" }).click();
  await page.waitForURL((u) => !u.toString().includes("goal="));
  const cards = page.locator(".model-card:not(.add-card)");
  if ((await cards.count()) !== 3) throw new Error("Expected 3 model cards");

  // Add with the picker: type, then confirm with the keyboard.
  await page.getByRole("button", { name: /Adicionar modelo/ }).click();
  const picker = page.getByRole("dialog", { name: "Adicionar modelo" });
  await picker.getByRole("combobox", { name: "Buscar modelo" }).fill("gemini");
  await picker.getByRole("option").first().waitFor();
  await page.keyboard.press("Enter");
  await picker.waitFor({ state: "detached" });
  if ((await cards.count()) !== 4) throw new Error("Picker did not add");

  // Ranked carousel: #1 first with a trophy; arrows scroll the track.
  const firstChip = page.locator(".carousel-item .rank-chip").first();
  if ((await firstChip.innerText()).trim() !== "#1")
    throw new Error("Carousel is not ranked");
  if (!(await firstChip.locator("svg").count()))
    throw new Error("Missing trophy on #1");
  const next = page.getByRole("button", { name: "Próximo" });
  if (await next.isVisible()) {
    await next.click();
    await page.waitForFunction(
      () => document.querySelector(".carousel-track").scrollLeft > 0,
    );
    // Changing the goal must bring the carousel back to the new #1.
    await page.getByRole("radio", { name: "Inteligência máxima" }).click();
    await page.waitForTimeout(1300);
    if (
      await page.evaluate(
        () => document.querySelector(".carousel-track").scrollLeft > 1,
      )
    )
      throw new Error("Carousel did not return to the first card");
    await page.getByRole("radio", { name: "Custo-benefício" }).click();
  }

  // Swap the first card for another model; the count must not change.
  const before = page.url();
  await page
    .getByRole("button", { name: /^Trocar / })
    .first()
    .click();
  const swap = page.getByRole("dialog", { name: "Trocar modelo" });
  await swap.getByRole("combobox", { name: "Buscar modelo" }).fill("grok");
  await swap.getByRole("option").first().click();
  await swap.waitFor({ state: "detached" });
  if ((await cards.count()) !== 4) throw new Error("Swap changed count");
  // router.replace updates the URL asynchronously.
  await page.waitForURL((u) => u.toString() !== before, { timeout: 5000 });
  await page.keyboard.press("Control+k");
  await page.getByRole("dialog", { name: "Adicionar modelo" }).waitFor();
  await page.keyboard.press("Escape");

  await page.getByLabel("Solicitações mensais", { exact: true }).fill("200000");
  await page
    .getByRole("radio", { name: /Matemática/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Salvar cenário", exact: true })
    .click();
  await page.getByLabel("Nome do cenário", { exact: true }).fill("QA Suporte");
  await page
    .getByRole("button", { name: "Salvar neste navegador", exact: true })
    .click();
  await page
    .getByText("Cenário salvo neste navegador.", { exact: true })
    .waitFor();
  await page.screenshot({
    path: "output/playwright/compare-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Cenários", exact: true }).click();
  await page
    .getByRole("heading", { name: "QA Suporte", exact: true })
    .waitFor();
  await page.getByRole("link", { name: "Abrir", exact: true }).click();
  await page.getByLabel("Solicitações mensais", { exact: true }).waitFor();
  if (
    (await page
      .getByLabel("Solicitações mensais", { exact: true })
      .inputValue()) !== "200000"
  )
    throw new Error("Scenario values not restored");
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Salvar neste navegador", exact: true })
    .click();
  await page
    .getByRole("link", {
      name: "Avise quando houver uma opção melhor",
      exact: true,
    })
    .click();
  const scenario = page.getByRole("textbox", {
    name: "Cenário desejado",
    exact: true,
  });
  await scenario.waitFor();
  if (!(await scenario.inputValue()).includes("200.000"))
    throw new Error("Prefill missing");
  await page.getByLabel("E-mail", { exact: true }).fill("qa@example.com");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Registrar interesse" }).click();
  await page
    .getByText("Interesse salvo somente neste navegador.", { exact: false })
    .waitFor();

  await page.setViewportSize({ width: 390, height: 844 });
  for (const [route, file] of [
    ["/", "catalog-mobile"],
    ["/compare", "compare-mobile"],
    ["/scenarios", "scenarios-mobile"],
    ["/pro", "pro-mobile"],
    ["/methodology", "methodology-mobile"],
  ]) {
    await page.goto(base + route);
    await page.getByRole("main").waitFor();
    await page.waitForTimeout(300);
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 2,
      )
    )
      throw new Error("Viewport overflow: " + route);
    await page.screenshot({
      path: "output/playwright/" + file + ".png",
      fullPage: true,
    });
  }
  await page.goto(base + "/scenarios");
  await page
    .getByRole("button", { name: "Excluir QA Suporte", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Excluir cenário", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Nenhum cenário salvo.", exact: true })
    .waitFor();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base);
  console.log(
    "PASS: search, ordering, six-model limit, URL, picker add/swap/shortcut, recommendation, save/edit/delete, prefilled interest and five mobile layouts",
  );
};
