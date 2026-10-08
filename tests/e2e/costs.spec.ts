import { expect, test } from "@playwright/test";
import { createProject, login } from "./helpers";

test("cost, payment and change order flow updates totals", async ({ page }) => {
  await login(page);
  const name = `Flow ${Date.now()}`;
  await createProject(page, name, "150000");

  const card = page.getByRole("link").filter({ hasText: name });
  await card.click();
  await expect(page.getByRole("heading", { name })).toBeVisible();

  await page.getByRole("button", { name: "+ Add Cost" }).first().click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Category").selectOption("MATERIAL");
  await dialog.getByLabel("Description").fill("Cement 50 bags");
  await dialog.getByLabel("Amount (RM)").fill("2500");
  await dialog.getByRole("button", { name: "Save cost" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("total-costs")).toHaveText("RM 2,500.00");

  await page.getByRole("tab", { name: "Payments" }).click();
  await page.getByRole("button", { name: "+ Add Payment" }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Amount (RM)").fill("30000");
  await dialog.getByLabel("Reference / note (optional)").fill("Progress claim 1");
  await dialog.getByRole("button", { name: "Save payment" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("total-payments")).toHaveText("RM 30,000.00");
  await expect(page.getByText("Progress claim 1")).toBeVisible();

  await expect(page.getByTestId("outstanding")).toHaveText("RM 120,000.00");
  await expect(page.getByTestId("profit-loss")).toHaveText("RM 147,500.00");

  await page.getByRole("tab", { name: "Change Orders" }).click();
  await page.getByRole("button", { name: "+ Add Change Order" }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Description").fill("Extra wall");
  await dialog.getByLabel(/Amount \(RM\)/).fill("10000");
  await dialog.getByRole("button", { name: "Save change order" }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByTestId("outstanding")).toHaveText("RM 120,000.00");
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Approved", { exact: true })).toBeVisible();
  await expect(page.getByTestId("outstanding")).toHaveText("RM 130,000.00");
  await expect(page.getByTestId("profit-loss")).toHaveText("RM 157,500.00");

  await page.goto("/dashboard");
  const dashCard = page.getByRole("link").filter({ hasText: name });
  await expect(dashCard).toContainText("RM 130,000.00");
  await expect(dashCard.getByTestId("profit-loss")).toContainText("RM 157,500.00");
});

test("form validation blocks bad amounts", async ({ page }) => {
  await login(page);
  await page.getByRole("link").filter({ hasText: "Bangsar Shop Lot Fit-Out" }).click();
  await page.getByRole("button", { name: "+ Add Cost" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Description").fill("Bad");
  await dialog.getByLabel("Amount (RM)").fill("0");
  await dialog.getByRole("button", { name: "Save cost" }).click();
  await expect(dialog.getByText("Must be more than 0")).toBeVisible();
});
