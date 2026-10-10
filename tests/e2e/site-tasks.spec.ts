import { expect, test } from "@playwright/test";
import { createProject } from "./helpers";
import { PASSWORD, addTask, png, staffPage, visitor } from "./portal-helpers";

async function openProject(page: import("@playwright/test").Page, name: string) {
  await page.getByRole("link").filter({ hasText: name }).first().click();
  await page.waitForURL(/\/projects\/[^/]+$/);
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
}

test("contractor uploads a progress photo with a caption, sees date and time, and can delete it", async ({ browser }) => {
  const { context, page } = await staffPage(browser);
  const name = `Photo job ${Date.now()}`;
  await createProject(page, name, "50000");
  await openProject(page, name);

  await page.getByRole("tab", { name: "Progress Photos" }).click();
  const progress = page.getByRole("region", { name: "Progress photos" });
  await progress.locator("input[type=file]").setInputFiles(png("kitchen.png"));
  await progress.getByLabel("Caption (optional)").fill("Kitchen tiling done");
  await progress.getByRole("button", { name: "Upload photo" }).click();
  await expect(page.getByText("Photo uploaded")).toBeVisible();

  await expect(progress.getByText("Kitchen tiling done")).toBeVisible();
  await expect(progress.getByText(/\d{2} \w{3} \d{4}.*\d{2}:\d{2}/)).toBeVisible();
  await expect.poll(() => progress.locator("img").first().evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

  // Only real images are accepted, whatever the file is called.
  await progress.locator("input[type=file]").setInputFiles({ name: "evil.png", mimeType: "image/png", buffer: Buffer.from("<script>alert(1)</script>") });
  await progress.getByRole("button", { name: "Upload photo" }).click();
  await expect(page.getByText("Only JPEG, PNG or WebP photos are accepted.")).toBeVisible();

  await page.getByRole("button", { name: "Delete photo" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
  await expect(progress.getByText("Kitchen tiling done")).toHaveCount(0);
  await context.close();
});

test("subcontractor: task log, WhatsApp reminder, sign in, finish a task with a photo", async ({ browser }) => {
  const stamp = Date.now();
  const staff = await staffPage(browser);
  const page = staff.page;

  // A subcontractor with a phone number, and a login for the task log.
  const subName = `Mutu Plumbing ${stamp}`;
  await page.goto("/subcons");
  await page.getByRole("button", { name: "+ New Subcontractor" }).first().click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill(subName);
  await dialog.getByLabel("Contact (phone)").fill("012-345 6789");
  await dialog.getByLabel("Trade").fill("Plumbing");
  await dialog.getByRole("button", { name: "Save subcontractor" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("link").filter({ hasText: subName }).first().click();
  await page.waitForURL(/\/subcons\/[^/]+$/);

  const email = `sub-${stamp}@example.test`;
  await page.getByRole("region", { name: "Task log login" }).getByRole("button", { name: "+ Add login" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Login email").fill(email);
  await dialog.getByLabel(/Temporary password/).fill(PASSWORD);
  await dialog.getByRole("button", { name: "Create login" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("region", { name: "Task log login" })).toContainText(email);

  // The contractor assigns a task and gets a ready-to-send WhatsApp reminder.
  const project = `Task job ${stamp}`;
  await page.goto("/projects");
  await createProject(page, project, "80000");
  await openProject(page, project);
  const task = `Replace kitchen pipes ${stamp}`;
  await addTask(page, { description: task, sub: subName, due: "2026-12-31" });
  const reminder = page.getByRole("link", { name: /WhatsApp reminder/ });
  const href = (await reminder.getAttribute("href"))!;
  expect(href.startsWith("https://wa.me/60123456789?text=")).toBe(true);
  expect(decodeURIComponent(href)).toContain(task);
  expect(decodeURIComponent(href)).toContain("/sub/tasks");

  // The subcontractor signs in on their phone and sees only their task.
  const sub = await visitor(browser);
  await sub.page.goto("/login");
  await sub.page.getByLabel("Email").fill(email);
  await sub.page.getByLabel("Password").fill(PASSWORD);
  await sub.page.getByRole("button", { name: "Sign in" }).click();
  await expect(sub.page).toHaveURL(/\/sub\/tasks$/);
  await expect(sub.page.getByText(task)).toBeVisible();
  await expect(sub.page.getByText("Open", { exact: true })).toBeVisible();

  // ...and cannot reach the staff app, the export, or staff-only uploads.
  await sub.page.goto("/dashboard");
  await expect(sub.page).toHaveURL(/\/sub\/tasks$/);
  expect((await sub.page.request.get("/api/export")).status()).toBe(401);
  const forbidden = await sub.page.request.post("/api/photos", {
    multipart: { kind: "PROGRESS", projectId: "anything", file: png() },
  });
  expect(forbidden.status()).toBe(403);

  // Finish the task with a photo.
  await sub.page.getByLabel(`Photo for ${task}`).setInputFiles(png("pipes.png"));
  await sub.page.getByRole("button", { name: "Mark as done" }).click();
  await expect(sub.page.getByText("Marked as done. Thank you!")).toBeVisible();
  const done = sub.page.getByRole("region", { name: "Done tasks" });
  await expect(done.getByText(task)).toBeVisible();
  await expect(done.getByText("Done", { exact: true }).last()).toBeVisible();
  await expect(sub.page.getByRole("region", { name: "Open tasks" })).toContainText("Nothing to do right now");

  // The contractor sees it finished, with the photo.
  await page.reload();
  await page.getByRole("tab", { name: "Tasks" }).click();
  const row = page.getByRole("listitem").filter({ hasText: task });
  await expect(row.getByText("Done", { exact: true })).toBeVisible();
  await expect.poll(() => row.locator("img").first().evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

  // A revoked login stops working at once, even with a live session.
  await page.goto("/subcons");
  await page.getByRole("link").filter({ hasText: subName }).first().click();
  await page.getByRole("button", { name: `Revoke access for ${email}` }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("region", { name: "Task log login" })).not.toContainText(email);
  await sub.page.goto("/sub/tasks");
  await expect(sub.page).toHaveURL(/\/login/);

  await sub.context.close();
  await staff.context.close();
});
