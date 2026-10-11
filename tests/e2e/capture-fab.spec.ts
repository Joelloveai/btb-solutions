import { expect, test } from "@playwright/test";
import { createProject } from "./helpers";
import { addTask, createSubWithLogin, png, signInSub, staffPage, staffPageWithGps } from "./portal-helpers";

const fab = (page: import("@playwright/test").Page) => page.getByRole("button", { name: "Add to timeline" });

test.describe("one-tap capture", () => {
  test("the + button is on every staff screen, 56px, with four 56px choices; photo, note, cost and diary each confirm the value they made", async ({ browser }) => {
    test.setTimeout(240_000);
    const stamp = Date.now();
    const staff = await staffPageWithGps(browser);
    const page = staff.page;
    await staff.context.grantPermissions(["geolocation", "microphone"]);
    await page.addInitScript(() => {
      class FakeRecognition {
        onresult: ((e: unknown) => void) | null = null;
        onend: (() => void) | null = null;
        onerror: ((e: unknown) => void) | null = null;
        lang = "";
        interimResults = false;
        start() {
          setTimeout(() => {
            this.onresult?.({ results: [[{ transcript: "Owner wants the sink moved" }]] });
            this.onend?.();
          }, 50);
        }
        stop() {
          this.onend?.();
        }
      }
      Object.assign(window, { SpeechRecognition: FakeRecognition, webkitSpeechRecognition: FakeRecognition });
    });
    const name = `Capture ${stamp}`;
    await page.goto("/projects");
    await createProject(page, name, "50000");

    // On a screen that is not a project, it asks which project (once) and offers four big choices.
    for (const path of ["/dashboard", "/projects", "/subcons", "/receivables"]) {
      await page.goto(path);
      await expect(fab(page)).toBeVisible();
    }
    await page.goto("/dashboard");
    const box = (await fab(page).boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(55.5);
    expect(box.height).toBeGreaterThanOrEqual(55.5);
    const viewport = page.viewportSize()!;
    expect(box.x + box.width).toBeGreaterThan(viewport.width - 40); // bottom-right
    expect(box.y + box.height).toBeGreaterThan(viewport.height - 140);
    await fab(page).click();
    let sheet = page.getByRole("dialog");
    for (const label of ["Photo", "Note", "Cost", "Diary"]) {
      const b = (await sheet.getByRole("button", { name: label, exact: true }).boundingBox())!;
      expect(b.height).toBeGreaterThanOrEqual(55.5);
    }
    await sheet.getByRole("button", { name: "Cost", exact: true }).click();
    await sheet.getByRole("button", { name: name }).click(); // pick the project
    await sheet.getByLabel("Amount (RM)").fill("5000");
    await sheet.getByLabel("Description").fill("Sand and cement");
    await sheet.getByRole("button", { name: "Save cost" }).click();
    await expect(page.getByText("Project margin is now 90.0%.")).toBeVisible();

    // Inside the project the project is already chosen, and the sheet closes after each capture.
    await page.goto("/projects");
    await page.getByRole("link").filter({ hasText: name }).first().click();
    await page.waitForURL(/\/projects\/[^/]+$/);
    await fab(page).click();
    sheet = page.getByRole("dialog");
    await sheet.getByRole("button", { name: "Photo", exact: true }).click();
    await sheet.getByLabel("Take photo").setInputFiles(png("one.png"));
    await sheet.getByRole("button", { name: "Upload photo" }).click();
    await expect(page.getByText("Added to timeline. 1 photo today.")).toBeVisible();
    await expect(sheet).toBeHidden();
    await fab(page).click();
    await page.getByRole("dialog").getByRole("button", { name: "Photo", exact: true }).click();
    await page.getByRole("dialog").getByLabel("Take photo").setInputFiles(png("two.png"));
    await page.getByRole("dialog").getByRole("button", { name: "Upload photo" }).click();
    await expect(page.getByText("Added to timeline. 2 photos today.")).toBeVisible();

    // Note: the microphone starts by itself.
    await fab(page).click();
    await page.getByRole("dialog").getByRole("button", { name: "Note", exact: true }).click();
    await expect(page.getByRole("dialog").getByLabel("Note", { exact: true })).toHaveValue("Owner wants the sink moved");
    await page.getByRole("dialog").getByRole("button", { name: "Save note" }).click();
    await expect(page.getByText("Saved. Will appear in your evidence pack.")).toBeVisible();

    // Diary opens today's site diary.
    await fab(page).click();
    await page.getByRole("dialog").getByRole("button", { name: "Diary", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("button", { name: "Sign and submit diary" })).toBeVisible();
    await page.keyboard.press("Escape");

    // With no signal: still no blocking modal, and the line says it will sync.
    await page.reload();
    await page.evaluate(() => navigator.serviceWorker?.ready);
    await staff.context.setOffline(true);
    await expect(page.getByTestId("offline-indicator")).toBeVisible();
    await fab(page).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cost", exact: true }).click();
    await page.getByRole("dialog").getByLabel("Amount (RM)").fill("120");
    await page.getByRole("dialog").getByLabel("Description").fill("Nails");
    await page.getByRole("dialog").getByRole("button", { name: "Save cost" }).click();
    await expect(page.getByText("Saved. Will sync when online.")).toBeVisible();
    await expect(page.getByRole("dialog")).toBeHidden();
    await staff.context.setOffline(false);
    await staff.context.close();
  });

  test("a subcontractor's + button offers photo and note, and the photo goes on the timeline", async ({ browser }) => {
    test.setTimeout(180_000);
    const stamp = Date.now();
    const staff = await staffPage(browser);
    const page = staff.page;
    const subName = `Capture Sub ${stamp}`;
    const email = `capture-sub-${stamp}@example.test`;
    await createSubWithLogin(page, subName, email, { trade: "Painting" });
    await page.goto("/projects");
    await createProject(page, `Sub capture ${stamp}`, "20000");
    await page.getByRole("link").filter({ hasText: `Sub capture ${stamp}` }).first().click();
    await page.waitForURL(/\/projects\/[^/]+$/);
    const projectUrl = page.url();
    await addTask(page, { description: "Paint the hall", sub: subName, due: "2026-12-01" });

    const sub = await signInSub(browser, email);
    await expect(fab(sub.page)).toBeVisible();
    await fab(sub.page).click();
    const sheet = sub.page.getByRole("dialog");
    await expect(sheet.getByRole("button", { name: "Cost", exact: true })).toHaveCount(0);
    await expect(sheet.getByRole("button", { name: "Diary", exact: true })).toHaveCount(0);
    await sheet.getByRole("button", { name: "Photo", exact: true }).click();
    await sheet.getByRole("button", { name: /Paint the hall/ }).click();
    await sheet.getByLabel("Take photo").setInputFiles(png("wall.png"));
    await sheet.getByRole("button", { name: "Upload photo" }).click();
    await expect(sub.page.getByText(/Added to timeline\. 1 photo today\./)).toBeVisible();

    await fab(sub.page).click();
    await sub.page.getByRole("dialog").getByRole("button", { name: "Note", exact: true }).click();
    await sub.page.getByRole("dialog").getByRole("button", { name: Date.now() ? /Sub capture/ : "" }).click();
    await sub.page.getByRole("dialog").getByLabel("Note", { exact: true }).fill("First coat done");
    await sub.page.getByRole("dialog").getByRole("button", { name: "Save note" }).click();
    await expect(sub.page.getByText("Saved. Will appear in your evidence pack.")).toBeVisible();

    await page.goto(projectUrl);
    await expect(page.getByTestId("timeline-event").filter({ hasText: "Note from subcontractor" })).toContainText("First coat done");
    await expect(page.getByTestId("timeline-event").filter({ hasText: "Task photo added" })).toBeVisible();
    await sub.context.close();
    await staff.context.close();
  });
});
