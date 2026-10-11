import { expect, test } from "@playwright/test";
import { png, staffPage } from "./portal-helpers";

test("CIPAA pack: one PDF with claim, photos, VOs and a verified chain; evidence prompts only nudge", async ({ browser }) => {
  test.setTimeout(180_000);
  const stamp = Date.now();
  const staff = await staffPage(browser); // no location permission: the photo has no GPS
  const page = staff.page;
  const name = `CIPAA ${stamp}`;
  await page.getByRole("button", { name: "+ New Project" }).first().click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Project name").fill(name);
  await dialog.getByLabel("Contract value (RM)").fill("200000");
  await dialog.getByLabel("Contract reference (optional)").fill("LOA/BTB/2026/017");
  await dialog.getByRole("button", { name: "Create project" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("link").filter({ hasText: name }).first().click();
  await page.waitForURL(/\/projects\/[^/]+$/);
  const projectUrl = page.url();
  const projectId = projectUrl.split("/").pop();
  await expect(page.getByTestId("evidence-quality")).toContainText("nothing recorded yet");

  // A cost with no invoice reference: saved, with a gentle prompt (never a block).
  await page.getByRole("tab", { name: "Costs" }).click();
  await page.getByRole("button", { name: "+ Add Cost" }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Amount (RM)").fill("500");
  await dialog.getByLabel("Description").fill("Sand");
  await dialog.getByRole("button", { name: "Save cost" }).click();
  await expect(page.getByText("Add invoice reference to strengthen this as evidence.")).toBeVisible();
  await expect(dialog).toBeHidden();

  // A photo with no GPS: saved, with a gentle prompt.
  await page.getByRole("tab", { name: "Progress Photos" }).click();
  const photos = page.getByRole("region", { name: "Progress photos" });
  await photos.locator("input[type=file]").setInputFiles(png("slab.png"));
  await photos.getByRole("button", { name: "Save photo" }).click();
  await expect(page.getByText("Add location to strengthen this as evidence.")).toBeVisible();
  await expect(page.getByText(/Added to timeline\. \d+ photos? today\./)).toBeVisible();

  // An approved variation and a claim.
  await page.getByRole("tab", { name: "Change Orders" }).click();
  await page.getByRole("button", { name: "+ Add Change Order" }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Description").fill("Extra column");
  await dialog.getByLabel(/Amount \(RM\)/).fill("5000");
  await dialog.getByRole("button", { name: "Save change order" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Approved", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: "Progress Claims" }).click();
  await page.getByRole("button", { name: "+ Issue Claim" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Work done/).fill("40000");
  await dialog.getByRole("button", { name: "Issue claim" }).click();
  await expect(dialog).toBeHidden();

  await page.goto(projectUrl);
  await expect(page.getByTestId("evidence-quality")).toContainText("0%");
  await expect(page.getByTestId("evidence-quality")).toContainText("1 photo without a location");
  await expect(page.getByRole("link", { name: "Generate CIPAA Pack" })).toBeVisible();

  const response = await page.request.get(`/api/projects/${projectId}/cipaa-pack`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/pdf");
  const body = await response.body();
  expect(body.subarray(0, 5).toString()).toBe("%PDF-");
  expect(body.length).toBeGreaterThan(3000);

  // Generating it is itself on the timeline, and the chain still verifies.
  await page.reload();
  await expect(page.getByTestId("timeline-event").filter({ hasText: /CIPAA pack generated for Progress Claim 1/ })).toBeVisible();
  expect((await (await page.request.get(`/api/projects/${projectId}/timeline/verify`)).json()).ok).toBe(true);

  // Staff only.
  const anon = await browser.newContext();
  expect((await anon.request.get(`http://localhost:3100/api/projects/${projectId}/cipaa-pack`)).status()).toBe(401);
  await anon.close();
  await staff.context.close();
});
