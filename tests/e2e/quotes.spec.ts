import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("create a quote, accept it, and convert it to a project", async ({ page }) => {
  await login(page);
  const title = `Quote job ${Date.now()}`;
  await page.goto("/quotes/new");
  await page.getByLabel("Client name").fill("Encik Razak");
  await page.getByLabel("Project title").fill(title);
  await page.getByLabel("Apply SST (6%)").check();

  await page.getByLabel("Description").first().fill("Supply and lay floor tiles");
  await page.getByLabel("Qty").first().fill("20");
  await page.getByLabel("Unit", { exact: true }).first().fill("m2");
  await page.getByLabel("Unit price (RM)").first().fill("85.50");

  await page.getByRole("button", { name: "+ Add line" }).click();
  await page.getByLabel("Description").nth(1).fill("Painting");
  await page.getByLabel("Qty").nth(1).fill("1");
  await page.getByLabel("Unit price (RM)").nth(1).fill("1290");

  // 20 x 85.50 = 1,710 + 1,290 = 3,000; SST 6% = 180
  await expect(page.getByTestId("quote-subtotal")).toHaveText("RM 3,000.00");
  await expect(page.getByTestId("quote-total")).toHaveText("RM 3,180.00");
  await page.getByRole("button", { name: "Save Quote" }).click();

  await expect(page.getByRole("heading", { name: new RegExp(title) })).toBeVisible();
  await expect(page.getByTestId("quote-total")).toHaveText("RM 3,180.00");
  await expect(page.getByRole("button", { name: "Convert to Project" })).toHaveCount(0);

  await page.getByRole("button", { name: "Mark as Accepted" }).click();
  await page.getByRole("button", { name: "Convert to Project" }).click();

  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByTestId("sst-line")).toHaveText("SST (6%): RM 180.00");
  await expect(page.getByText("Contract RM 3,180.00")).toBeVisible();
  await page.getByRole("tab", { name: "BOQ" }).click();
  await expect(page.getByText("Supply and lay floor tiles")).toBeVisible();
  await expect(page.getByText("Painting")).toBeVisible();
});
