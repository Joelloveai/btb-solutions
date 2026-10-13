import { expect, test, type Page } from "@playwright/test";
import { createProject } from "./helpers";
import { staffPage } from "./portal-helpers";

async function sign(page: Page) {
  const canvas = page.getByRole("dialog").getByTestId("signature-canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 90, box.y + 90, { steps: 6 });
  await page.mouse.move(box.x + 150, box.y + 40, { steps: 6 });
  await page.mouse.up();
  await expect(canvas).toHaveAttribute("data-signed", "true");
}

async function openProject(page: Page, name: string) {
  await page.goto("/projects");
  await page.getByRole("link").filter({ hasText: name }).first().click();
  await page.waitForURL(/\/projects\/[^/]+$/);
  return page.url();
}

test("site diary: weather fills in from the site's GPS, safety observations are kept, and a site with no GPS asks instead", async ({ browser }) => {
  test.setTimeout(180_000);
  const stamp = Date.now();
  const staff = await staffPage(browser);
  const page = staff.page;
  await createProject(page, `Weather ${stamp}`, "90000");
  await createProject(page, `No GPS ${stamp}`, "10000");
  const url = await openProject(page, `Weather ${stamp}`);

  // Site GPS on the Contract tab.
  await page.getByRole("tab", { name: "Contract", exact: true }).click();
  await page.getByRole("button", { name: "Edit details" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.locator("summary").click();
  await dialog.getByLabel("Site latitude (for weather)").fill("3.139");
  await dialog.getByLabel("Site longitude (for weather)").fill("101.6869");
  await dialog.getByRole("button", { name: "Save contract details" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("tab", { name: "Site Diary" }).click();
  await page.getByRole("button", { name: "+ Sign Site Diary" }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByTestId("weather-auto")).toContainText("27°C, light rain (automatic)");
  await expect(dialog.getByRole("button", { name: "Rain", exact: true })).toHaveAttribute("aria-pressed", "true"); // chosen for them
  await dialog.getByLabel("Works done today").fill("Formwork for the ground slab");
  await dialog.locator("summary").click();
  await dialog.getByLabel("Safety observations").fill("Toolbox talk held. Two workers without helmets reminded.");
  await sign(page);
  await dialog.getByRole("button", { name: "Sign and submit diary" }).click();
  await expect(dialog).toBeHidden();
  const row = page.getByTestId("diary-row").first();
  await expect(row).toContainText("Rain");
  const pdf = await page.request.get((await row.getByRole("link", { name: "PDF" }).getAttribute("href"))!);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  await page.goto(`${url}/diary/report`);
  await expect(page.getByText("Toolbox talk held. Two workers without helmets reminded.")).toBeVisible();

  // A project with no site GPS: nothing is filled in, the person taps the weather, and it still works.
  await openProject(page, `No GPS ${stamp}`);
  await page.getByRole("tab", { name: "Site Diary" }).click();
  await page.getByRole("button", { name: "+ Sign Site Diary" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Sunny", exact: true }).waitFor();
  await expect(dialog.getByTestId("weather-auto")).toHaveCount(0);
  await dialog.getByLabel("Works done today").fill("Site cleared");
  await dialog.getByRole("button", { name: "Sign and submit diary" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Tap today's weather.");
  await staff.context.close();
});

test("RFIs and site instructions are numbered, answered, closed, recorded on the timeline, and can be raised with no signal", async ({ browser }) => {
  test.setTimeout(240_000);
  const stamp = Date.now();
  const staff = await staffPage(browser);
  const page = staff.page;
  await createProject(page, `Records ${stamp}`, "50000");
  const url = await openProject(page, `Records ${stamp}`);
  const projectId = url.split("/").pop();
  await page.getByRole("tab", { name: "Site Records" }).click();

  // RFI: raise, answer, close.
  await page.getByRole("button", { name: "+ Raise RFI" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Subject").fill("Beam size at grid C3");
  await dialog.getByLabel("Question").fill("Drawing shows 300x600 but the schedule says 300x500. Which one?");
  await dialog.getByLabel(/Who should answer/).fill("Structural engineer");
  await dialog.getByRole("button", { name: "Send question" }).click();
  await expect(dialog).toBeHidden();
  const rfi = page.getByTestId("rfi").filter({ hasText: "Beam size at grid C3" });
  await expect(rfi).toContainText("RFI-001");
  await expect(rfi).toContainText("Open");
  await rfi.getByRole("button", { name: "Record answer" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Answer").fill("Use 300x600 as per the drawing.");
  await dialog.getByRole("button", { name: "Save answer" }).click();
  await expect(dialog).toBeHidden();
  await expect(rfi).toContainText("Answered");
  await expect(rfi.getByTestId("rfi-response")).toContainText("Use 300x600 as per the drawing.");
  await rfi.getByRole("button", { name: "Close", exact: true }).click();
  await expect(rfi).toContainText("Closed");

  // Site instruction: issue, acknowledge, close.
  await page.getByRole("button", { name: "+ Issue Instruction" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Who is it for?").fill("Ah Seng Electrical");
  await dialog.getByLabel("What must be done?").fill("Stop wiring on level 2 until the drawings are re-issued.");
  await dialog.getByRole("button", { name: "Issue instruction" }).click();
  await expect(dialog).toBeHidden();
  const si = page.getByTestId("instruction").filter({ hasText: "Ah Seng Electrical" });
  await expect(si).toContainText("SI-001");
  await si.getByRole("button", { name: "Acknowledged" }).click();
  await expect(si).toContainText("acknowledged");
  await si.getByRole("button", { name: "Close", exact: true }).click();
  await expect(si).toContainText("Closed");

  // With no signal: saved on the phone, and appears (numbered next) once it syncs.
  await page.reload();
  await page.getByRole("tab", { name: "Site Records" }).click();
  await page.evaluate(() => navigator.serviceWorker?.ready);
  await staff.context.setOffline(true);
  await expect(page.getByTestId("offline-indicator")).toBeVisible();
  await page.getByRole("button", { name: "+ Raise RFI" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Subject").fill("Waterproofing spec");
  await dialog.getByLabel("Question").fill("Which membrane for the roof slab?");
  await dialog.getByRole("button", { name: "Send question" }).click();
  await expect(page.getByText("Saved. Will sync when online.")).toBeVisible();
  await expect(dialog).toBeHidden();
  await staff.context.setOffline(false);
  await expect(page.getByTestId("pending-op")).toHaveCount(0, { timeout: 40_000 });
  await page.reload();
  await page.getByRole("tab", { name: "Site Records" }).click();
  await expect(page.getByTestId("rfi").filter({ hasText: "Waterproofing spec" })).toContainText("RFI-002");

  // On the timeline, and the chain holds.
  await page.getByRole("tab", { name: "Timeline" }).click();
  await page.getByRole("button", { name: "Site records", exact: true }).click();
  for (const text of ["RFI-001 raised: Beam size at grid C3", "RFI-001 answered", "RFI-001 closed", "Site instruction SI-001 issued to Ah Seng Electrical", "SI-001 acknowledged", "SI-001 closed", "RFI-002 raised"]) {
    await expect(page.getByTestId("timeline-event").filter({ hasText: text }).first()).toBeVisible();
  }
  expect((await (await page.request.get(`/api/projects/${projectId}/timeline/verify`)).json()).ok).toBe(true);
  await staff.context.close();
});
