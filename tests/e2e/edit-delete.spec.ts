import { expect, test, type Page } from "@playwright/test";
import { createProject, login } from "./helpers";

async function openNewProject(page: Page, prefix: string) {
  await login(page);
  const name = `${prefix} ${Date.now()}`;
  await createProject(page, name, "100000");
  await page.getByRole("link").filter({ hasText: name }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  return name;
}

test("edit a cost entry and the dashboard total changes", async ({ page }) => {
  const name = await openNewProject(page, "Edit cost");

  await page.getByRole("tab", { name: "Costs" }).click();
  await page.getByRole("button", { name: "+ Add Cost" }).first().click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Description").fill("Cement");
  await dialog.getByLabel("Amount (RM)").fill("1000");
  await dialog.getByRole("button", { name: "Save cost" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("total-costs")).toHaveText("RM 1,000.00");

  await page.getByRole("button", { name: "Edit cost" }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Description")).toHaveValue("Cement");
  await expect(dialog.getByLabel("Amount (RM)")).toHaveValue("1000");
  await dialog.getByLabel("Amount (RM)").fill("1500");
  await dialog.getByRole("button", { name: "Save cost" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("total-costs")).toHaveText("RM 1,500.00");

  await page.goto("/dashboard");
  const card = page.getByRole("link").filter({ hasText: name });
  await expect(card).toContainText("RM 1,500.00");
  await expect(card.getByTestId("profit-loss")).toContainText("RM 98,500.00");
});

test("delete a payment and the dashboard total changes", async ({ page }) => {
  const name = await openNewProject(page, "Delete payment");

  await page.getByRole("tab", { name: "Payments" }).click();
  await page.getByRole("button", { name: "+ Add Payment" }).first().click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Amount (RM)").fill("2500");
  await dialog.getByRole("button", { name: "Save payment" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("outstanding")).toHaveText("RM 97,500.00");

  await page.getByRole("button", { name: "Delete payment" }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Delete this payment of RM 2,500.00?");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByTestId("outstanding")).toHaveText("RM 97,500.00");

  await page.getByRole("button", { name: "Delete payment" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByTestId("total-payments")).toHaveText("RM 0.00");
  await expect(page.getByTestId("outstanding")).toHaveText("RM 100,000.00");

  await page.goto("/dashboard");
  const card = page.getByRole("link").filter({ hasText: name });
  await expect(card).toContainText("Payments Received");
  await expect(card).toContainText("RM 100,000.00");
});
