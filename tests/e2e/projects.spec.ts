import { expect, test } from "@playwright/test";
import { createProject, login } from "./helpers";

test("create a project and see it on the dashboard", async ({ page }) => {
  await login(page);
  const name = `Taman Sri Petaling ${Date.now()}`;
  await createProject(page, name, "150000");

  const card = page.getByRole("link").filter({ hasText: name });
  await expect(card).toBeVisible();
  await expect(card).toContainText("RM 150,000.00");
  await expect(card.getByTestId("profit-loss")).toContainText("RM 150,000.00");
});

test("seeded projects show correct totals", async ({ page }) => {
  await login(page);
  const card = page.getByRole("link").filter({ hasText: "Taman Desa Terrace Renovation" });
  await expect(card).toContainText("RM 280,000.00");
  await expect(card).toContainText("RM 28,300.00");
  await expect(card).toContainText("RM 56,000.00");
  await expect(card.getByTestId("profit-loss")).toContainText("RM 258,200.00");
});
