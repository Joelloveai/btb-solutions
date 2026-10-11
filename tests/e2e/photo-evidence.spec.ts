import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import { expect, test, type Page } from "@playwright/test";
import { createProject } from "./helpers";
import { attachPhotoTakenDaysAgo, staffPageWithGps } from "./portal-helpers";

async function openPhotos(page: Page, name: string) {
  await page.getByRole("link").filter({ hasText: name }).first().click();
  await page.waitForURL(/\/projects\/[^/]+$/);
  await page.getByRole("tab", { name: "Progress Photos" }).click();
  return page.getByRole("region", { name: "Progress photos" });
}

async function uploadTagged(region: ReturnType<Page["getByRole"]>, page: Page, opts: { daysAgo: number; trade: string; phase: string; location: string; caption: string }) {
  await attachPhotoTakenDaysAgo(page, "Add progress photo", opts.daysAgo);
  await region.getByLabel(/^Trade/).selectOption(opts.trade);
  await region.getByLabel(/^Phase/).selectOption(opts.phase);
  await region.getByLabel("Location (optional)").fill(opts.location);
  await region.getByLabel("Caption (optional)").fill(opts.caption);
  await expect(region.getByTestId("geo-status")).toContainText("Location captured (±15 m)");
  await region.getByRole("button", { name: "Upload photo" }).click();
  await expect(region.getByText(opts.caption)).toBeVisible();
}

test.describe("photo evidence", () => {
  test("a photo carries its device time, GPS, trade, phase and location, and is filed by phase and trade", async ({ browser }) => {
    test.setTimeout(90_000);
    const { context, page } = await staffPageWithGps(browser);
    const name = `Evidence job ${Date.now()}`;
    await createProject(page, name, "90000");
    const region = await openPhotos(page, name);

    await region.locator("button", { hasText: "Add progress photo" }).click(); // starts the GPS request, as a real tap does
    await uploadTagged(region, page, { daysAgo: 2, trade: "Plumbing", phase: "Rough-in", location: "Level 3, Unit 12, Master Bath", caption: "Hot and cold lines" });

    // Filed under its phase and trade, with its tags, location and GPS.
    const phase = region.getByRole("region", { name: "Rough-in photos" });
    await expect(phase).toBeVisible();
    await expect(phase).toContainText("Plumbing");
    await expect(phase).toContainText("Level 3, Unit 12, Master Bath");
    await expect(phase.getByRole("link", { name: /3\.13900, 101\.68690 ±15 m/ })).toBeVisible();

    // It shows when it was TAKEN (two days ago on the phone), and says it arrived later.
    const taken = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toLocaleDateString("en-MY", { timeZone: "Asia/Kuala_Lumpur", day: "2-digit", month: "short", year: "numeric" });
    await expect(phase).toContainText(taken);
    await expect(phase).toContainText("Uploaded");

    // Filters narrow the list.
    await region.getByLabel("Filter by phase").selectOption("Framing");
    await expect(region.getByText("No photos match those filters.")).toBeVisible();
    await region.getByLabel("Filter by phase").selectOption("");
    await expect(region.getByText("Hot and cold lines")).toBeVisible();

    // The evidence package: a ZIP filed by phase and trade, with a spreadsheet whose fingerprints match the files.
    const [download] = await Promise.all([page.waitForEvent("download"), region.getByRole("link", { name: "Download Evidence Package" }).click()]);
    expect(download.suggestedFilename()).toMatch(/evidence-\d{4}-\d{2}-\d{2}\.zip$/);
    const zip = await JSZip.loadAsync(await readFile((await download.path())!));
    const names = Object.keys(zip.files);
    const photoFile = names.find((n) => n.startsWith("photos/Rough-in/Plumbing/") && n.endsWith(".png"));
    expect(photoFile).toBeTruthy();
    expect(names).toContain("README.txt");
    const csv = await zip.file("index.csv")!.async("string");
    expect(csv).toContain("Hot and cold lines");
    expect(csv).toContain("Level 3, Unit 12, Master Bath");
    expect(csv).toContain("3.139");
    expect(csv).toContain("101.6869");
    const digest = createHash("sha256").update(await zip.file(photoFile!)!.async("nodebuffer")).digest("hex");
    expect(csv).toContain(digest);
    await context.close();
  });

  test("the before-cover checklist tracks which hidden work has been photographed", async ({ browser }) => {
    test.setTimeout(90_000);
    const { context, page } = await staffPageWithGps(browser);
    const name = `Cover job ${Date.now()}`;
    await createProject(page, name, "70000");
    const region = await openPhotos(page, name);
    const checklist = page.getByRole("region", { name: "Before cover checklist" });

    await expect(checklist.getByTestId("before-cover-status")).toHaveText("0 of 4 photographed");
    await checklist.getByRole("button", { name: "Photograph: Rebar before pour" }).click();
    const dialog = page.getByRole("dialog");
    await attachPhotoTakenDaysAgo(page, "Take photo: Rebar before pour", 0);
    // Filed as Pre-cover under the right trade without anyone choosing it.
    await expect(dialog.getByLabel("Phase")).toHaveValue("Pre-cover");
    await expect(dialog.getByLabel("Trade")).toHaveValue("Structural");
    await dialog.getByRole("button", { name: "Upload photo" }).click();
    await expect(dialog).toBeHidden();

    await expect(checklist.getByTestId("before-cover-status")).toHaveText("1 of 4 photographed");
    await expect(checklist.getByTestId("checklist-REBAR")).toContainText("(1)");
    await expect(checklist.getByTestId("checklist-SLEEVES")).not.toContainText("(1)");
    await expect(region.getByRole("region", { name: "Pre-cover photos" })).toContainText("Structural");
    await context.close();
  });

  test("two photos of the same spot on different dates can be compared side by side", async ({ browser }) => {
    test.setTimeout(90_000);
    const { context, page } = await staffPageWithGps(browser);
    const name = `Compare job ${Date.now()}`;
    await createProject(page, name, "60000");
    const region = await openPhotos(page, name);
    const spot = "Level 2, Kitchen";

    await region.locator("button", { hasText: "Add progress photo" }).click();
    await uploadTagged(region, page, { daysAgo: 3, trade: "Tiling", phase: "Framing", location: spot, caption: "Bare slab" });
    await region.locator("button", { hasText: "Add progress photo" }).click();
    await uploadTagged(region, page, { daysAgo: 0, trade: "Tiling", phase: "Finishing", location: spot, caption: "Tiles laid" });

    await region.getByRole("button", { name: "Compare photos" }).click();
    await region.getByRole("button", { name: /Select photo: Tiles laid/ }).click(); // choose the later one first on purpose
    await region.getByRole("button", { name: /Select photo: Bare slab/ }).click();
    await region.getByRole("button", { name: "Compare 2/2 selected" }).click();

    const comparison = page.getByTestId("comparison");
    await expect(comparison.locator("img")).toHaveCount(2);
    // Earlier on the left, whatever order they were picked in.
    await expect(comparison.locator("figure").first()).toContainText("Bare slab");
    await expect(comparison.locator("figure").last()).toContainText("Tiles laid");
    await expect(comparison).toContainText(spot);
    await context.close();
  });
});
