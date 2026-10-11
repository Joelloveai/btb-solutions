import { expect, test } from "@playwright/test";
import { login } from "./helpers";

// Quote -> accepted -> project -> claim -> payment -> subcon paid -> profit on the dashboard.
test("a quote runs the whole money loop with no manual step in between", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);
  const stamp = Date.now();
  const title = `Loop ${stamp}`;
  const subName = `Sub ${stamp}`;

  // subcontractor
  await page.goto("/subcons");
  await page.getByRole("button", { name: "+ New Subcontractor" }).first().click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill(subName);
  await dialog.getByLabel("Trade").fill("Plumbing");
  await dialog.getByRole("button", { name: "Save subcontractor" }).click();
  await expect(dialog).toBeHidden();

  // quote: 100,000, no SST
  await page.goto("/quotes/new");
  await page.getByLabel("Client name").fill("Loop Client");
  await page.getByLabel("Project title").fill(title);
  await page.getByLabel("Description").first().fill("Whole job");
  await page.getByLabel("Unit price (RM)").first().fill("100000");
  await page.getByRole("button", { name: "Save Quote" }).click();
  await expect(page.getByTestId("quote-total")).toHaveText("RM 100,000.00");
  await page.getByRole("button", { name: "Mark as Accepted" }).click();
  await page.getByRole("button", { name: "Convert to Project" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  // claim 40,000 (5% retention = 2,000, net 38,000)
  await page.getByRole("link", { name: "Progress Claims" }).click();
  await page.getByRole("button", { name: "+ Issue Claim" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Work done this period (RM)").fill("40000");
  await dialog.getByRole("button", { name: "Issue claim" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("row").filter({ hasText: "No. 1" })).toContainText("RM 38,000.00");

  // it shows up as receivable until paid
  await page.goto("/receivables");
  await expect(page.locator("div.rounded-xl").filter({ hasText: title }).first()).toContainText("RM 38,000.00");

  // payment against the claim
  await page.goto("/projects");
  await page.getByRole("link").filter({ hasText: title }).click();
  await page.getByRole("tab", { name: "Payments" }).click();
  await page.getByRole("button", { name: "+ Add Payment" }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Amount (RM)").fill("38000");
  await dialog.getByLabel("Against claim (optional)").selectOption({ index: 1 });
  await dialog.getByRole("button", { name: "Save payment" }).click();
  await expect(dialog).toBeHidden();
  await page.goto("/receivables");
  // the claim is cleared; only the 2,000 retention is still listed for this project
  await expect(page.locator("div.rounded-xl").filter({ hasText: title }).filter({ hasText: "Generate Reminder" })).toHaveCount(0);
  await expect(page.getByRole("link").filter({ hasText: title })).toContainText("RM 2,000.00");

  // subcon cost of 30,000 against the BOQ line, then pay the subcon
  await page.goto("/projects");
  await page.getByRole("link").filter({ hasText: title }).click();
  await page.getByRole("tab", { name: "Costs" }).click();
  await page.getByRole("button", { name: "+ Add Cost" }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Category").selectOption("SUBCON");
  await dialog.getByLabel("Description").fill("Plumbing works");
  await dialog.getByLabel("Amount (RM)").fill("30000");
  await dialog.getByLabel("Subcontractor").selectOption({ label: subName });
  await dialog.getByText("More", { exact: true }).click();
  await dialog.getByLabel("BOQ line (optional)").selectOption({ index: 1 });
  await dialog.getByRole("button", { name: "Save cost" }).click();
  await expect(dialog).toBeHidden();

  await page.goto("/projects");
  let card = page.getByRole("link").filter({ hasText: title });
  await expect(card).toContainText("Subcon Owed");
  await expect(card).toContainText("RM 30,000.00");
  await expect(card.getByTestId("profit-loss")).toContainText("RM 70,000.00");

  await page.goto("/subcons");
  await page.getByRole("link").filter({ hasText: subName }).click();
  await expect(page.getByTestId("sub-balance")).toHaveText("RM 30,000.00");
  await page.getByRole("button", { name: "Mark as Paid" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm paid" }).click();
  await expect(page.getByTestId("sub-balance")).toHaveText("RM 0.00");
  await expect(page.getByTestId("sub-paid")).toHaveText("RM 30,000.00");

  // dashboard: subcon no longer owed, real profit unchanged at 70,000, retention held 2,000
  await page.goto("/dashboard");
  card = page.getByRole("link").filter({ hasText: title });
  await expect(card.getByTestId("profit-loss")).toContainText("RM 70,000.00");
  await expect(card).toContainText("RM 2,000.00");
});
