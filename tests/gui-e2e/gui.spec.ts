import { expect, test, type Page } from "@playwright/test";

async function selectCommandByName(page: Page, commandName: string): Promise<void> {
  await page.getByTestId("command-select").first().click();
  await page.getByRole("option", { name: commandName }).click();
}

test("renders GUI shell and switches command", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("ArticleDownloader GUI (V1)")).toBeVisible();
  await selectCommandByName(page, "fetch");
  await expect(page.getByText("--out (required)")).toBeVisible();
  await expect(page.getByTestId("run-btn")).toBeVisible();
});

test("modal picker applies manual path in desktop mode", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto("/");
  await selectCommandByName(page, "fetch");

  await page.getByTestId("browse-out").click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.getByLabel("Manual path").fill(".");
  await page.getByRole("button", { name: "Use manual path" }).click();

  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByTestId("arg-input-out")).toHaveValue(".");
});

test("inline fallback opens on narrow viewport and run smoke works", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 900 });
  await page.goto("/");
  await selectCommandByName(page, "browse-path");

  await page.getByTestId("browse-path").click();
  await expect(page.getByLabel("Manual path")).toBeVisible();

  await page.getByTestId("arg-input-path").fill(".");
  await page.getByTestId("run-btn").click();
  await expect(page.getByTestId("output-log")).toContainText("[result-summary]");
});

test("picker shows browse errors and still allows manual apply", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto("/");
  await selectCommandByName(page, "fetch");

  await page.getByTestId("arg-input-out").fill("/definitely-not-a-real-folder-for-gui-test");
  await page.getByTestId("browse-out").click();

  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("alert")).toBeVisible();

  await page.getByLabel("Manual path").fill(".");
  await page.getByRole("button", { name: "Use manual path" }).click();
  await expect(page.getByTestId("arg-input-out")).toHaveValue(".");
});
