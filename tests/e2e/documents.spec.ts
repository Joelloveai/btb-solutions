import { expect, test, type Page } from "@playwright/test";
import { createProject } from "./helpers";
import { addTask, createSubWithLogin, signInSub, staffPage } from "./portal-helpers";

const pdf = (label: string) => ({ name: `${label}.pdf`, mimeType: "application/pdf", buffer: Buffer.from(`%PDF-1.4\n1 0 obj<</Title(${label})>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF`) });

async function openDocuments(page: Page, project: string) {
  await page.getByRole("link").filter({ hasText: project }).first().click();
  await page.waitForURL(/\/projects\/[^/]+$/);
  await page.getByRole("tab", { name: "Documents" }).click();
}

async function upload(page: Page, opts: { button: string | RegExp; label: string; name?: string; trade?: string; note?: string; type?: string; scope?: ReturnType<Page["locator"]> }) {
  await (opts.scope ?? page).getByRole("button", { name: opts.button }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Document file").setInputFiles(pdf(opts.label));
  if (opts.name) await dialog.getByLabel("Document name").fill(opts.name);
  if (opts.type) await dialog.getByLabel("Type").selectOption(opts.type);
  if (opts.trade) await dialog.getByLabel("For trade").selectOption(opts.trade);
  if (opts.note) await dialog.getByLabel("What changed (optional)").fill(opts.note);
  return dialog;
}

test("uploading the same document name again makes version 2, keeps version 1, and shows only the latest", async ({ browser }) => {
  test.setTimeout(120_000);
  const staff = await staffPage(browser);
  const page = staff.page;
  const project = `Docs job ${Date.now()}`;
  await createProject(page, project, "90000");
  await openDocuments(page, project);

  let dialog = await upload(page, { button: "+ Upload Document", label: "ground-v1", name: "Ground floor plan", trade: "Plumbing" });
  await dialog.getByRole("button", { name: "Upload document" }).click();
  await expect(dialog).toBeHidden();
  const row = page.getByTestId("document-row").filter({ hasText: "Ground floor plan" });
  await expect(row).toContainText("v1");
  await expect(row).toContainText("Plumbing");
  await expect(page.getByText("Latest Drawings", { exact: true })).toBeVisible(); // a fresh drawing is flagged on the project

  // Same name again (any capitals, stray spaces): it is version 2, and says so before uploading.
  dialog = await upload(page, { button: "+ Upload Document", label: "ground-v2", name: "  ground FLOOR plan ", trade: "Plumbing", note: "Rev B: kitchen wall moved 300 mm" });
  await expect(dialog.getByTestId("version-hint")).toContainText("version 2");
  await dialog.getByRole("button", { name: "Upload as version 2" }).click();
  await expect(dialog).toBeHidden();

  // One row, now version 2, with the note. No second row for version 1.
  await expect(page.getByTestId("document-row")).toHaveCount(1);
  await expect(row).toContainText("v2");
  await expect(row).toContainText("Rev B: kitchen wall moved 300 mm");

  // History keeps both, newest first, and staff can still open the old one.
  await row.getByRole("button", { name: /Version history \(2\)/ }).click();
  const history = page.getByTestId("version-history");
  await expect(history.getByRole("listitem")).toHaveCount(2);
  await expect(history.getByRole("listitem").first()).toContainText("Version 2");
  await expect(history.getByRole("listitem").first()).toContainText("Current");
  await expect(history.getByRole("listitem").last()).toContainText("Version 1");
  await expect(history.getByRole("listitem").last()).toContainText("Superseded");
  const oldHref = await history.getByRole("listitem").last().getByRole("link", { name: "Open" }).getAttribute("href");
  const oldFile = await page.request.get(oldHref!);
  expect(oldFile.status()).toBe(200);
  expect(await oldFile.text()).toContain("ground-v1");

  // Deleting the newest version makes the previous one current again.
  await history.getByRole("listitem").first().getByRole("button", { name: "Delete version 2" }).click();
  await page.getByRole("dialog").last().getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByTestId("document-row").filter({ hasText: "Ground floor plan" })).toContainText("v1");
  await staff.context.close();
});

test("a subcontractor sees only current drawings for their trade on projects they work on", async ({ browser }) => {
  test.setTimeout(150_000);
  const stamp = Date.now();
  const staff = await staffPage(browser);
  const page = staff.page;
  const subName = `Pipe Co ${stamp}`;
  const email = `docs-sub-${stamp}@example.test`;
  await createSubWithLogin(page, subName, email, { trade: "Plumbing" });

  const mine = `Sub docs job ${stamp}`;
  const other = `Unrelated job ${stamp}`;
  await page.goto("/projects");
  await createProject(page, mine, "40000");
  await createProject(page, other, "40000");

  // The unrelated project has a drawing, but the plumber has no work there.
  await openDocuments(page, other);
  let dialog = await upload(page, { button: "+ Upload Document", label: "secret", name: "Unrelated plan", trade: "Plumbing" });
  await dialog.getByRole("button", { name: "Upload document" }).click();
  await expect(dialog).toBeHidden();

  // The plumber's project: a plumbing drawing (two versions), an electrical drawing, a general drawing, a contract.
  await page.goto("/projects");
  await openDocuments(page, mine);
  for (const d of [
    { label: "pl1", name: "Plumbing layout", trade: "Plumbing" },
    { label: "pl2", name: "Plumbing layout", trade: "Plumbing", note: "Rev B" },
    { label: "el1", name: "Electrical layout", trade: "Electrical" },
    { label: "gen", name: "General arrangement" },
    { label: "con", name: "Main contract", type: "Contract" },
  ]) {
    dialog = await upload(page, { button: "+ Upload Document", label: d.label, name: d.name, trade: d.trade, type: d.type, note: d.note });
    await dialog.getByRole("button", { name: /^Upload/ }).click();
    await expect(dialog).toBeHidden();
  }
  const versions = await (async () => {
    await page.getByTestId("document-row").filter({ hasText: "Plumbing layout" }).getByRole("button", { name: /Version history/ }).click();
    const items = page.getByTestId("version-history").getByRole("listitem");
    const old = await items.last().getByRole("link", { name: "Open" }).getAttribute("href");
    const current = await items.first().getByRole("link", { name: "Open" }).getAttribute("href");
    await page.keyboard.press("Escape");
    return { old: old!, current: current! };
  })();
  await addTask(page, { description: "Install pipework", sub: subName, due: "2026-12-01" });

  const sub = await signInSub(browser, email);
  await sub.page.getByRole("link", { name: "Drawings" }).click();
  await expect(sub.page).toHaveURL(/\/sub\/drawings$/);
  const list = sub.page.getByRole("region", { name: `Drawings for ${mine}` });
  await expect(list).toContainText("Plumbing layout");
  await expect(list).toContainText("Version 2");
  await expect(list).toContainText("General arrangement"); // for every trade
  await expect(list).not.toContainText("Electrical layout"); // someone else's trade
  await expect(list).not.toContainText("Main contract"); // not a drawing
  await expect(list.getByText("Latest Drawings").first()).toBeVisible();
  await expect(sub.page.getByRole("region", { name: `Drawings for ${other}` })).toHaveCount(0); // no work there
  await expect(sub.page.getByTestId("drawings-loaded-at")).toContainText("Latest versions as of");

  // Enforced by the server, not just hidden: the superseded drawing and other trades' drawings are "not found".
  expect((await sub.page.request.get(versions.current)).status()).toBe(200);
  expect((await sub.page.request.get(versions.old)).status()).toBe(404);
  await sub.context.close();
  await staff.context.close();
});
