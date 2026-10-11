import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { createProject } from "./helpers";
import { staffPage, visitor } from "./portal-helpers";

async function sign(page: Page, scope = page.getByRole("dialog")) {
  const canvas = scope.getByTestId("signature-canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 80, box.y + 90, { steps: 6 });
  await page.mouse.move(box.x + 140, box.y + 40, { steps: 6 });
  await page.mouse.up();
  await expect(canvas).toHaveAttribute("data-signed", "true");
}

test("site diary: the supervisor signs, a different person countersigns, then it is locked and on the timeline", async ({ browser }) => {
  test.setTimeout(180_000);
  const stamp = Date.now();
  const second = { email: `countersign-${stamp}@example.test`, name: "Site Manager Lee", password: "Counter-pass-1" };
  execFileSync("npx", ["tsx", "scripts/add-staff.ts", second.email, second.name, second.password], { env: { ...process.env, DATABASE_URL: "file:./test.db" }, stdio: "pipe" });

  const staff = await staffPage(browser);
  const page = staff.page;
  const project = `Diary ${stamp}`;
  await createProject(page, project, "60000");
  await page.getByRole("link").filter({ hasText: project }).first().click();
  await page.waitForURL(/\/projects\/[^/]+$/);
  const projectUrl = page.url();
  const projectId = projectUrl.split("/").pop();

  // Today's delivery comes from a material cost already entered.
  await page.getByRole("tab", { name: "Costs" }).click();
  await page.getByRole("button", { name: "+ Add Cost" }).first().click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Amount (RM)").fill("900");
  await dialog.getByLabel("Description").fill("Cement 25 bags");
  await dialog.getByRole("button", { name: "Save cost" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("tab", { name: "Site Diary" }).click();
  await page.getByRole("button", { name: "+ Sign Site Diary" }).click();
  dialog = page.getByRole("dialog");
  // Nothing is asked in a way that needs typing numbers: weather is one tap, workers are steppers.
  await dialog.getByRole("button", { name: "Rain", exact: true }).click();
  await dialog.getByRole("button", { name: "More Plumbing" }).click();
  await dialog.getByRole("button", { name: "More Plumbing" }).click();
  await dialog.getByRole("button", { name: "More General worker" }).click();
  await expect(dialog.getByText("(total 3)")).toBeVisible();
  await dialog.getByLabel("Works done today").fill("Laid water pipes in the kitchen wall");
  // Submitting without a signature is refused, gently.
  await dialog.getByRole("button", { name: "Sign and submit diary" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Please sign in the box.");
  await dialog.locator("summary").click();
  await expect(dialog.getByTestId("diary-deliveries")).toContainText("Cement 25 bags");
  await dialog.getByLabel("Generator").check();
  await sign(page, dialog);
  await dialog.getByRole("button", { name: "Sign and submit diary" }).click();
  await expect(dialog).toBeHidden();

  const row = page.getByTestId("diary-row").first();
  await expect(row).toContainText("Awaiting countersignature");
  await expect(row).toContainText("Rain");
  await expect(page.getByTestId("diary-waiting")).toContainText("1 diary is waiting");
  // The preparer cannot countersign their own diary.
  await expect(row.getByRole("button", { name: "Countersign" })).toHaveCount(0);
  const pdf = await page.request.get(`/api/diaries/${(await row.getByRole("link", { name: "PDF" }).getAttribute("href"))!.split("/")[3]}/pdf`);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

  // One diary per day.
  await page.getByRole("button", { name: "+ Sign Site Diary" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Sunny" }).click();
  await dialog.getByLabel("Works done today").fill("Second try");
  await sign(page, dialog);
  await dialog.getByRole("button", { name: "Sign and submit diary" }).click();
  await expect(page.getByText("There is already a diary for that day.")).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();

  // The second person signs in, reads it and countersigns.
  const other = await visitor(browser);
  const o = other.page;
  await o.goto("/login");
  await o.getByLabel("Email").fill(second.email);
  await o.getByLabel("Password").fill(second.password);
  await o.getByRole("button", { name: "Sign in" }).click();
  await expect(o).toHaveURL(/\/dashboard/);
  await o.goto(projectUrl);
  await o.getByRole("tab", { name: "Site Diary" }).click();
  await o.getByTestId("diary-row").first().getByRole("button", { name: "Countersign" }).click();
  const csDialog = o.getByRole("dialog");
  await csDialog.getByRole("button", { name: "Sign and lock" }).click();
  await expect(csDialog.getByRole("alert")).toHaveText("Please sign in the box.");
  await sign(o, csDialog);
  await csDialog.getByRole("button", { name: "Sign and lock" }).click();
  await expect(csDialog).toBeHidden();
  const lockedRow = o.getByTestId("diary-row").first();
  await expect(lockedRow).toContainText("Locked");
  await expect(lockedRow).toContainText(`Countersigned by ${second.name}`);
  await expect(lockedRow.getByRole("button", { name: "Countersign" })).toHaveCount(0);

  // Timeline: both steps recorded, chain intact.
  await page.reload();
  await page.getByRole("tab", { name: "Timeline" }).click();
  await expect(page.getByTestId("timeline-event").filter({ hasText: /Site diary signed for/ })).toBeVisible();
  await expect(page.getByTestId("timeline-event").filter({ hasText: /countersigned and locked/ })).toContainText(second.name);
  expect((await (await page.request.get(`/api/projects/${projectId}/timeline/verify`)).json()).ok).toBe(true);

  // The printable summary lists it.
  await page.goto(`${projectUrl}/diary/report`);
  await expect(page.getByTestId("report-count")).toHaveText("1 (1 countersigned)");
  await expect(page.getByText("Laid water pipes in the kitchen wall")).toBeVisible();

  await other.context.close();
  await staff.context.close();
});
