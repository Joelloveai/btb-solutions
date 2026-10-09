import { expect, test } from "@playwright/test";
import { createProject, login } from "./helpers";

test("generate a claim, get paid against it, and release retention", async ({ page }) => {
  await login(page);
  const name = `Claim job ${Date.now()}`;
  await createProject(page, name, "200000");
  await page.getByRole("link").filter({ hasText: name }).click();

  await page.getByRole("link", { name: "Progress Claims" }).click();
  await page.getByRole("button", { name: "+ Issue Claim" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Work done this period (RM)").fill("50000");
  // 5% retention (default) on 50,000 = 2,500; net claim 47,500
  await expect(dialog).toContainText("RM 47,500.00");
  await dialog.getByRole("button", { name: "Issue claim" }).click();
  await expect(dialog).toBeHidden();
  const row = page.getByRole("row").filter({ hasText: "No. 1" });
  await expect(row).toContainText("RM 47,500.00");

  // claims cannot exceed the contract
  await page.getByRole("button", { name: "+ Issue Claim" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Work done this period (RM)").fill("999999");
  await dialog.getByRole("button", { name: "Issue claim" }).click();
  await expect(page.getByText(/more than the contract/)).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();

  // payment against the claim
  await page.getByRole("link", { name: new RegExp(name) }).click();
  await expect(page.getByTestId("retention-held")).toHaveText("RM 2,500.00");
  await page.getByRole("tab", { name: "Payments" }).click();
  await page.getByRole("button", { name: "+ Add Payment" }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Amount (RM)").fill("47500");
  await dialog.getByLabel("Against claim (optional)").selectOption({ index: 1 });
  await dialog.getByRole("button", { name: "Save payment" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Claim 1")).toBeVisible();

  // retention release only after completion
  await expect(page.getByRole("button", { name: "Release Retention" })).toHaveCount(0);
  await page.getByRole("button", { name: "Edit Project" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Status").selectOption("COMPLETED");
  await dialog.getByRole("button", { name: "Save project" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Release Retention" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Confirm release" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("retention-outstanding")).toHaveText("RM 0.00");
  await expect(page.getByTestId("retention-released")).toHaveText("RM 2,500.00");
  await expect(page.getByTestId("total-payments")).toHaveText("RM 50,000.00");
});
