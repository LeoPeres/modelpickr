import { defineConfig, devices } from "@playwright/test";

// Runs against a production build served with the frozen catalog in
// tests/e2e/catalog.json, so results never depend on live data. Run it through
// `npm run e2e` (scripts/e2e-docker.sh): the build happens on a copy inside the
// Playwright container, the same image CI uses, so screenshots match pixel
// for pixel and the local `.next` is never touched.
const port = 3100;
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "tests/e2e",
  snapshotPathTemplate:
    "{testDir}/__screenshots__/{projectName}/{testFileName}/{arg}{ext}",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  expect: {
    toHaveScreenshot: { animations: "disabled", maxDiffPixelRatio: 0.002 },
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1400, height: 900 },
      },
    },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${port}`,
    url: baseURL,
    env: { CATALOG_FIXTURE: "tests/e2e/catalog.json" },
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
