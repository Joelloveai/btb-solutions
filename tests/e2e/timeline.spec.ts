import { expect, test, type Page } from "@playwright/test";
import { createProject } from "./helpers";
import { addTask, createSubWithLogin, png, signInSub, staffPage } from "./portal-helpers";

const pdf = (label: string) => ({ name: `${label}.pdf`, mimeType: "application/pdf", buffer: Buffer.from(`%PDF-1.4\n1 0 obj<</Title(${label})>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF`) });

async function openProject(page: Page, name: string) {
  await page.getByRole("link").filter({ hasText: name }).first().click();
  await page.waitForURL(/\/projects\/[^/]+$/);
  return page.url();
}

const timelineEvent = (page: Page, text: string | RegExp) => page.getByTestId("timeline-event").filter({ hasText: text });

async function verify(page: Page, projectUrl: string) {
  const id = new URL(projectUrl).pathname.split("/").pop();
  return (await page.request.get(`/api/projects/${id}/timeline/verify`)).json() as Promise<{ ok: boolean; count: number }>;
}

test("every action leaves an event on the project timeline, in an unbroken hash chain", async ({ browser }) => {
  test.setTimeout(240_000);
  const stamp = Date.now();
  const staff = await staffPage(browser);
  const page = staff.page;
  const project = `Timeline ${stamp}`;
  await createProject(page, project, "80000");
  const projectUrl = await openProject(page, project);

  // The timeline is the first thing you see, and starts empty.
  await expect(page.getByRole("tab", { name: "Timeline", selected: true })).toBeVisible();
  await expect(page.getByTestId("timeline-empty")).toBeVisible();

  // Money.
  await page.getByRole("tab", { name: "Costs" }).click();
  await page.getByRole("button", { name: "+ Add Cost" }).first().click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Amount (RM)").fill("1250");
  await dialog.getByLabel("Description").fill("Cement 25 bags");
  await dialog.getByRole("button", { name: "Save cost" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("tab", { name: "Payments" }).click();
  await page.getByRole("button", { name: "+ Add Payment" }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Amount (RM)").fill("8000");
  await dialog.getByRole("button", { name: "Save payment" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("tab", { name: "Change Orders" }).click();
  await page.getByRole("button", { name: "+ Add Change Order" }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Description").fill("Extra window");
  await dialog.getByLabel(/Amount \(RM\)/).fill("2000");
  await dialog.getByRole("button", { name: "Save change order" }).click();
  await expect(dialog).toBeHidden();

  // A task, a note, a photo and a document, each in the field-friendly way.
  await addTask(page, { description: "Set out the kitchen", due: "2026-12-01" });
  await page.getByRole("tab", { name: "Documents" }).click();
  await page.getByRole("button", { name: "+ Upload Document" }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Document file").setInputFiles(pdf("plan"));
  await dialog.getByLabel("Document name").fill("Ground plan");
  await dialog.getByRole("button", { name: "Upload document" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("tab", { name: "Timeline" }).click();
  await page.getByRole("button", { name: "Add to timeline" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Note" }).click();
  await dialog.getByLabel("Note", { exact: true }).fill("Owner asked to move the sink");
  await dialog.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByText("Saved. This will appear in your evidence pack.")).toBeVisible();

  await page.getByRole("button", { name: "Add to timeline" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Photo" }).click();
  await dialog.getByLabel("Take photo").setInputFiles(png("slab.png"));
  await dialog.getByRole("button", { name: "Upload photo" }).click();
  await expect(dialog).toBeHidden();

  await page.reload();
  await expect(page.getByRole("tab", { name: "Timeline", selected: true })).toBeVisible();
  await expect(timelineEvent(page, "Cost added: RM 1,250.00")).toContainText("Cement 25 bags");
  await expect(timelineEvent(page, "Payment received: RM 8,000.00")).toBeVisible();
  await expect(timelineEvent(page, "Change order raised: RM 2,000.00")).toContainText("Extra window");
  await expect(timelineEvent(page, "Task assigned")).toContainText("Set out the kitchen");
  await expect(timelineEvent(page, /(Drawing|Document) uploaded: Ground plan \(version 1\)/)).toBeVisible();
  await expect(timelineEvent(page, "Owner asked to move the sink")).toContainText("Note");
  const photo = timelineEvent(page, "Photo added");
  await expect(photo.locator("img")).toBeVisible();
  await expect(page.getByTestId("timeline-day").first()).toHaveText("Today");

  // Filter chips narrow the list.
  await page.getByRole("button", { name: "Money", exact: true }).click();
  await expect(page.getByTestId("timeline-event")).toHaveCount(3);
  await page.getByRole("button", { name: "Photos", exact: true }).click();
  await expect(page.getByTestId("timeline-event")).toHaveCount(1);
  await page.getByRole("button", { name: "Documents", exact: true }).click();
  await expect(page.getByTestId("timeline-event")).toHaveCount(1);
  await page.getByRole("button", { name: "Diary", exact: true }).click();
  await expect(page.getByTestId("timeline-event")).toHaveCount(1);
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page.getByTestId("timeline-event")).toHaveCount(7);

  // Nothing is erased: removing a cost adds an event beside the original.
  await page.getByRole("tab", { name: "Costs" }).click();
  await page.getByRole("button", { name: /^Delete cost/ }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: /Delete/ }).last().click();
  await page.reload();
  await expect(timelineEvent(page, "Cost removed: RM 1,250.00")).toBeVisible();
  await expect(timelineEvent(page, "Cost added: RM 1,250.00")).toBeVisible();

  // The chain is intact, and the evidence pack is a real PDF that includes the verification.
  const check = await verify(page, projectUrl);
  expect(check).toMatchObject({ ok: true });
  expect(check.count).toBe(8);
  const id = new URL(projectUrl).pathname.split("/").pop();
  const pack = await page.request.get(`/api/projects/${id}/timeline/pack`);
  expect(pack.status()).toBe(200);
  expect(pack.headers()["content-type"]).toBe("application/pdf");
  const bytes = await pack.body();
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(2000);

  // The timeline API is staff-only.
  const anon = await browser.newContext();
  expect((await anon.request.get(`http://localhost:3100/api/projects/${id}/timeline`)).status()).toBe(401);
  expect((await anon.request.get(`http://localhost:3100/api/projects/${id}/timeline/pack`)).status()).toBe(401);
  await anon.close();
  await staff.context.close();
});

test("a subcontractor's task and punch fix land on the timeline under their name", async ({ browser }) => {
  test.setTimeout(180_000);
  const stamp = Date.now();
  const staff = await staffPage(browser);
  const page = staff.page;
  const subName = `Sparks ${stamp}`;
  const email = `timeline-sub-${stamp}@example.test`;
  await createSubWithLogin(page, subName, email, { trade: "Electrical" });
  const project = `Timeline sub ${stamp}`;
  await page.goto("/projects");
  await createProject(page, project, "30000");
  const projectUrl = await openProject(page, project);
  await addTask(page, { description: "Pull cables level 2", sub: subName, due: "2026-12-01" });
  await page.getByRole("tab", { name: "Punch List" }).click();
  await page.getByRole("button", { name: "+ Add Punch Item" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Location").fill("Level 2 corridor");
  await dialog.getByLabel("What needs fixing").fill("Loose socket");
  await dialog.getByLabel("Trade").selectOption("Electrical");
  await dialog.getByLabel("Assign to").selectOption({ label: subName });
  await dialog.getByRole("button", { name: "Save punch item" }).click();
  await expect(dialog).toBeHidden();

  const sub = await signInSub(browser, email);
  await sub.page.getByLabel("Photo for Pull cables level 2").setInputFiles(png("cable.png"));
  await sub.page.getByRole("button", { name: "Mark as done" }).click();
  await expect(sub.page.getByText("Pull cables level 2")).toHaveCount(1);
  await sub.page.getByRole("link", { name: "Punch list" }).click();
  await sub.page.getByLabel("Photo of the fix: Loose socket").setInputFiles(png("socket.png"));
  await sub.page.getByRole("button", { name: "Mark as fixed" }).click();
  await expect(sub.page.getByText("Marked as fixed. Thank you!")).toBeVisible();

  await page.goto(projectUrl);
  await expect(timelineEvent(page, "Task completed")).toContainText(email);
  await expect(timelineEvent(page, "Defect fixed at Level 2 corridor")).toContainText(email);
  await expect(timelineEvent(page, "Defect raised at Level 2 corridor")).toBeVisible();
  await expect(page.getByTestId("timeline-event").filter({ hasText: "photo added" })).toHaveCount(2);
  expect(await verify(page, projectUrl)).toMatchObject({ ok: true });
  await sub.context.close();
  await staff.context.close();
});
