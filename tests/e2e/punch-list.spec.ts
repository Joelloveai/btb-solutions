import { expect, test, type Page } from "@playwright/test";
import { createProject } from "./helpers";
import { createSubWithLogin, png, signInSub, staffPage } from "./portal-helpers";

async function openProject(page: Page, name: string) {
  await page.getByRole("link").filter({ hasText: name }).first().click();
  await page.waitForURL(/\/projects\/[^/]+$/);
  return page.url();
}

async function addPunch(page: Page, item: { location: string; description: string; trade: string; sub?: string }) {
  await page.getByRole("button", { name: "+ Add Punch Item" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Location").fill(item.location);
  await dialog.getByLabel("What needs fixing").fill(item.description);
  await dialog.getByLabel("Trade").selectOption(item.trade);
  if (item.sub) await dialog.getByLabel("Assign to").selectOption({ label: item.sub });
  await dialog.getByLabel("Photo of the defect").setInputFiles(png("defect.png"));
  await dialog.getByRole("button", { name: "Save punch item" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("punch-row").filter({ hasText: item.description })).toBeVisible();
}

test("punch list: raise with a photo, assign, subcontractor fixes with a photo, contractor verifies and closes", async ({ browser }) => {
  test.setTimeout(150_000);
  const stamp = Date.now();
  const staff = await staffPage(browser);
  const page = staff.page;
  const subName = `Tile Masters ${stamp}`;
  const email = `punch-sub-${stamp}@example.test`;
  await createSubWithLogin(page, subName, email, { trade: "Tiling" });

  const project = `Punch job ${stamp}`;
  await page.goto("/projects");
  await createProject(page, project, "120000");
  const projectUrl = await openProject(page, project);
  await page.getByRole("tab", { name: "Punch List" }).click();

  // Two defects: one for the tiler, one not yet assigned.
  await addPunch(page, { location: "Level 3, Unit 12, Master Bath", description: "Cracked tile by the shower", trade: "Tiling", sub: subName });
  await addPunch(page, { location: "Level 1, Lobby", description: "Paint runs on the feature wall", trade: "Painting" });
  const mine = page.getByTestId("punch-row").filter({ hasText: "Cracked tile by the shower" });
  await expect(mine).toContainText("Open");
  await expect(mine.getByRole("img", { name: /Defect:/ })).toBeVisible();

  // The walk sheet: grouped by trade and place, both items still to fix.
  await page.goto(`${projectUrl}/punch/print`);
  await expect(page.getByText("Still to fix", { exact: true }).locator("xpath=following-sibling::dd[1]")).toHaveText("2");
  await expect(page.getByRole("region", { name: "Tiling punch items" })).toContainText("Level 3, Unit 12, Master Bath");
  await expect(page.getByRole("region", { name: "Painting punch items" })).toContainText("Paint runs on the feature wall");
  await page.goBack();
  await page.getByRole("tab", { name: "Punch List" }).click();

  // The subcontractor sees only their own item, across all projects.
  const sub = await signInSub(browser, email);
  await sub.page.getByRole("link", { name: "Punch list" }).click();
  await expect(sub.page).toHaveURL(/\/sub\/punch$/);
  const open = sub.page.getByRole("region", { name: "Open punch items" });
  await expect(open).toContainText("Cracked tile by the shower");
  await expect(open).not.toContainText("Paint runs on the feature wall");

  // The photo of the other trade's defect is invisible to them.
  const otherPhoto = await page
    .getByTestId("punch-row")
    .filter({ hasText: "Paint runs on the feature wall" })
    .getByRole("img", { name: /Defect:/ })
    .getAttribute("src");
  expect((await sub.page.request.get(otherPhoto!)).status()).toBe(404);
  expect((await page.request.get(otherPhoto!)).status()).toBe(200);

  // They fix it and photograph the fix.
  await sub.page.getByLabel("Photo of the fix: Cracked tile by the shower").setInputFiles(png("fixed.png"));
  await sub.page.getByRole("button", { name: "Mark as fixed" }).click();
  await expect(sub.page.getByText("Marked as fixed. Thank you!")).toBeVisible();
  await expect(sub.page.getByRole("region", { name: "Open punch items" })).toContainText("Nothing to fix");
  await expect(sub.page.getByRole("region", { name: "Fixed punch items" })).toContainText("Fixed, to verify");

  // The contractor sees the fix and checks it.
  await page.reload();
  await page.getByRole("tab", { name: "Punch List" }).click();
  const row = page.getByTestId("punch-row").filter({ hasText: "Cracked tile by the shower" });
  await expect(row).toContainText("Fixed, to verify");
  await expect(row.getByRole("img", { name: /Fixed:/ })).toBeVisible();
  await row.getByRole("button", { name: "Verify & close" }).click();
  await expect(page.getByText("Punch item closed")).toBeVisible();
  await expect(row).toContainText("Closed");

  // A closed item is off the walk sheet.
  await page.goto(`${projectUrl}/punch/print`);
  await expect(page.getByText("Still to fix", { exact: true }).locator("xpath=following-sibling::dd[1]")).toHaveText("1");
  await expect(page.getByRole("region", { name: "Tiling punch items" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Painting punch items" })).toBeVisible();

  await sub.context.close();
  await staff.context.close();
});

test("a punch item can be sent back if the fix is not good enough", async ({ browser }) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  const staff = await staffPage(browser);
  const page = staff.page;
  const subName = `Paint Pros ${stamp}`;
  const email = `punch-sub2-${stamp}@example.test`;
  await createSubWithLogin(page, subName, email, { trade: "Painting" });
  const project = `Reopen job ${stamp}`;
  await page.goto("/projects");
  await createProject(page, project, "20000");
  await openProject(page, project);
  await page.getByRole("tab", { name: "Punch List" }).click();
  await addPunch(page, { location: "Bedroom 2", description: "Uneven finish on ceiling", trade: "Painting", sub: subName });

  const sub = await signInSub(browser, email);
  await sub.page.goto("/sub/punch");
  await sub.page.getByRole("button", { name: "Mark as fixed" }).click();
  await expect(sub.page.getByText("Marked as fixed. Thank you!")).toBeVisible();

  await page.reload();
  await page.getByRole("tab", { name: "Punch List" }).click();
  const row = page.getByTestId("punch-row").filter({ hasText: "Uneven finish on ceiling" });
  await row.getByRole("button", { name: "Reopen" }).click();
  await expect(page.getByText("Sent back to the subcontractor")).toBeVisible();
  await expect(row).toContainText("Open");
  await sub.page.goto("/sub/punch");
  await expect(sub.page.getByRole("region", { name: "Open punch items" })).toContainText("Uneven finish on ceiling");

  await sub.context.close();
  await staff.context.close();
});
