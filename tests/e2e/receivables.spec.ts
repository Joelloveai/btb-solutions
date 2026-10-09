import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("receivables lists the seeded part-paid claim and builds a reminder letter", async ({ page, context }) => {
  await login(page);
  await page.goto("/receivables");
  await expect(page.getByRole("heading", { name: "Receivables" })).toBeVisible();
  // Seeded: Taman Desa claim 1 nets RM 57,000.00 and RM 56,000.00 has been paid against it.
  const card = page.locator("div.rounded-xl").filter({ hasText: "Taman Desa Terrace Renovation" }).filter({ hasText: "Generate Reminder" }).first();
  await expect(card).toContainText("RM 1,000.00");
  await expect(card).toContainText("Partly paid");
  await expect(card).toContainText("Claim 1");

  const [letter] = await Promise.all([
    context.waitForEvent("page"),
    card.getByRole("link", { name: "Generate Reminder" }).click(),
  ]);
  await expect(letter.getByText("Payment reminder: Progress Claim No. 1")).toBeVisible();
  await expect(letter.getByText("Balance outstanding", { exact: true })).toBeVisible();
  await expect(letter.getByText("RM 1,000.00").first()).toBeVisible();
  await letter.close();
});

test("clients and subcons pages show seeded data", async ({ page }) => {
  await login(page);
  await page.goto("/clients");
  await expect(page.getByText("En. Hafiz").first()).toBeVisible();
  await page.goto("/subcons");
  await expect(page.getByTestId("subcon-total-owed")).toHaveText("RM 18,500.00");
});
