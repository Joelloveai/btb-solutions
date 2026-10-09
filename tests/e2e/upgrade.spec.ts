import { expect, test } from "@playwright/test";
import { createProject, login } from "./helpers";

test("CIDB header shows on the login page", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("BTB Builders Sdn Bhd — CIDB Grade G7")).toBeVisible();
  await expect(page.getByText("CIDB Reg. No.")).toBeVisible();
});

test.describe("desktop dashboard", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("shows the profitability table with the required columns", async ({ page }) => {
    await login(page);
    for (const column of ["Project", "Contract Value", "Claims Issued", "Cash Received", "Costs to Date", "Subcon Owed", "Retention Held", "Real Profit"]) {
      await expect(page.getByRole("columnheader", { name: column })).toBeVisible();
    }
    const row = page.getByRole("row").filter({ hasText: "Taman Desa Terrace Renovation" });
    await expect(row).toContainText("RM 280,000.00");
    await expect(row.getByTestId("row-profit-loss")).toContainText("RM 258,200.00");
  });
});

test("SST: create with the checkbox, issue a claim with SST, edit it off", async ({ page, context }) => {
  await login(page);
  const name = `SST ${Date.now()}`;
  await page.getByRole("button", { name: "+ New Project" }).first().click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Project name").fill(name);
  await dialog.getByLabel("Contract value (RM)").fill("100000");
  await dialog.getByLabel("Apply SST (6%)").check();
  await dialog.getByRole("button", { name: "Create project" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("link").filter({ hasText: name }).click();
  await expect(page.getByTestId("sst-line")).toHaveText("SST (6%): RM 6,000.00");
  await expect(page.getByTestId("outstanding")).toHaveText("RM 106,000.00");

  await page.getByRole("link", { name: "Progress Claims" }).click();
  await page.getByRole("button", { name: "+ Issue Claim" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Work done this period (RM)").fill("10000");
  await dialog.getByRole("button", { name: "Issue claim" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("row").filter({ hasText: "No. 1" })).toContainText("RM 10,100.00");

  const [claim] = await Promise.all([
    context.waitForEvent("page"),
    page.getByRole("link", { name: "Print" }).click(),
  ]);
  await expect(claim.getByRole("heading", { name: "Progress Claim No. 1" })).toBeVisible();
  await expect(claim.getByText("SST (6%)")).toBeVisible();
  await expect(claim.getByText("RM 10,600.00")).toBeVisible();
  await claim.close();

  await page.goBack();
  await page.getByRole("button", { name: "Edit Project" }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Apply SST (6%)")).toBeChecked();
  await dialog.getByLabel("Apply SST (6%)").uncheck();
  await dialog.getByRole("button", { name: "Save project" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("sst-line")).toHaveCount(0);
  await expect(page.getByTestId("outstanding")).toHaveText("RM 100,000.00");
});

test("settings: switch to Malay and back, and export all data", async ({ page }) => {
  await login(page);
  const name = `Export ${Date.now()}`;
  await createProject(page, name, "5000");

  await page.goto("/settings");
  try {
    await page.getByRole("button", { name: "Bahasa Melayu" }).click();
    await expect(page.getByRole("heading", { name: "Tetapan" })).toBeVisible();
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Papan Pemuka" })).toBeVisible();
    await expect(page.getByRole("link").filter({ hasText: name })).toContainText("RM 5,000.00");
  } finally {
    await page.goto("/settings");
    await page.getByRole("button", { name: "English" }).click();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  }

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Export All Data" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^btb-jobcost-backup-.*\.csv$/);
  const path = await download.path();
  const csv = (await import("node:fs")).readFileSync(path, "utf8");
  expect(csv).toContain("Record Type");
  expect(csv).toContain("COST");
  expect(csv).toContain("PAYMENT");
  expect(csv).toContain("CHANGE_ORDER");
  expect(csv).toContain(name);
});

test("export endpoint rejects visitors who are not signed in", async ({ request }) => {
  const response = await request.get("/api/export", { maxRedirects: 0 });
  expect(response.status()).not.toBe(200);
});
