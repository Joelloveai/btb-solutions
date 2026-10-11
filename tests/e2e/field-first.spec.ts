import { expect, test } from "@playwright/test";
import { createProject, login } from "./helpers";

test("one-thumb cost entry: three fields, today's date, the rest tucked under More; mic dictates; targets are thumb-sized", async ({ page }) => {
  // A phone with speech recognition: stand-in that "hears" a fixed phrase.
  await page.addInitScript(() => {
    class FakeRecognition {
      onresult: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      lang = "";
      interimResults = false;
      start() {
        setTimeout(() => {
          this.onresult?.({ results: [[{ transcript: "Cement 20 bags" }]] });
          this.onend?.();
        }, 50);
      }
      stop() {
        this.onend?.();
      }
    }
    Object.assign(window, { SpeechRecognition: FakeRecognition, webkitSpeechRecognition: FakeRecognition });
  });
  await login(page);
  const name = `Thumb ${Date.now()}`;
  await createProject(page, name, "50000");
  await page.getByRole("link").filter({ hasText: name }).click();

  // The dev server compiles the form on first use; time the open once it is warm (production has no such step).
  const dialog = page.getByRole("dialog");
  await page.getByRole("tab", { name: "Costs" }).click();
  await page.getByRole("button", { name: "+ Add Cost" }).first().click();
  await expect(dialog.getByLabel("Amount (RM)")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  const opened = Date.now();
  await page.getByRole("tab", { name: "Costs" }).click();
  await page.getByRole("button", { name: "+ Add Cost" }).first().click();
  await expect(dialog.getByLabel("Amount (RM)")).toBeVisible();
  expect(Date.now() - opened).toBeLessThan(1000);

  // Exactly three fields in view; everything else is behind "More".
  await expect(dialog.getByLabel("Amount (RM)")).toBeVisible();
  await expect(dialog.getByLabel("Category")).toBeVisible();
  await expect(dialog.getByLabel("Description")).toBeVisible();
  await expect(dialog.getByLabel("Vendor (optional)")).toBeHidden();
  await expect(dialog.getByLabel("Reference (optional)")).toBeHidden();
  await expect(dialog.getByLabel("Date")).toBeHidden();

  // Touch targets: at least 48px tall, and 8px between neighbours.
  let lastY = -1;
  await expect.poll(async () => { const y = (await dialog.getByLabel("Amount (RM)").boundingBox())?.y ?? -2; const same = y === lastY; lastY = y; return same; }, { message: "dialog settled" }).toBe(true);
  const boxes = [] as { y: number; h: number }[];
  for (const loc of [dialog.getByLabel("Amount (RM)"), dialog.getByLabel("Category"), dialog.getByLabel("Description"), dialog.locator("summary"), dialog.getByRole("button", { name: "Save cost" }), dialog.getByRole("button", { name: "Dictate with microphone" })]) {
    const b = await loc.boundingBox();
    expect(b, "visible").not.toBeNull();
    expect(b!.height).toBeGreaterThanOrEqual(47.5);
    boxes.push({ y: b!.y, h: b!.height });
  }
  const stacked = boxes.slice(0, 5).sort((a, b) => a.y - b.y);
  for (let i = 1; i < stacked.length; i++) expect(stacked[i]!.y - (stacked[i - 1]!.y + stacked[i - 1]!.h)).toBeGreaterThanOrEqual(7.5);

  // Voice: the mic fills Description, which stays editable.
  await dialog.getByRole("button", { name: "Dictate with microphone" }).click();
  await expect(dialog.getByLabel("Description")).toHaveValue("Cement 20 bags");
  await dialog.getByLabel("Amount (RM)").fill("340.5");
  await dialog.getByRole("button", { name: "Save cost" }).click(); // no More opened, date defaults to today
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("total-costs")).toHaveText("RM 340.50");
  await expect(page.getByText("Cement 20 bags").first()).toBeVisible();

  // Every description-style field offers the mic.
  await page.getByRole("tab", { name: "Change Orders" }).click();
  await page.getByRole("button", { name: "+ Add Change Order" }).first().click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Dictate with microphone" })).toBeVisible();
});
