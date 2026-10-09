import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

test.use({ viewport: { width: 1280, height: 800 } });

async function openNewProject(page: Page, name: string) {
  await page.getByRole("button", { name: "+ New Project" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Project name").fill(name);
  await dialog.getByLabel("Contract value (RM)").fill("50000");
  return dialog;
}

test("two projects under one client show as one row on /clients", async ({ page }) => {
  await login(page);
  const client = `Picker Client ${Date.now()}`;

  // First project: create the client inline from the picker.
  let dialog = await openNewProject(page, `${client} job A`);
  await dialog.getByLabel("Client (optional)").selectOption({ label: "+ Create new client…" });
  await dialog.getByLabel("New client name").fill(client);
  await dialog.getByRole("button", { name: "Save client" }).click();
  await expect(dialog.getByLabel("Client (optional)")).toContainText(client);
  await dialog.getByRole("button", { name: "Create project" }).click();
  await expect(dialog).toBeHidden();

  // Second project: pick the existing client.
  dialog = await openNewProject(page, `${client} job B`);
  await dialog.getByLabel("Client (optional)").selectOption({ label: client });
  await dialog.getByRole("button", { name: "Create project" }).click();
  await expect(dialog).toBeHidden();

  await page.goto("/clients");
  const row = page.getByRole("row").filter({ hasText: client });
  await expect(row).toHaveCount(1);
  await expect(row.getByRole("cell").nth(1)).toHaveText("2");
  await expect(row.getByRole("cell").nth(2)).toHaveText("RM 100,000.00");
});

test("an old project with only a typed client name can be linked once", async ({ page }) => {
  await login(page);
  // Quotes still create projects with a typed name only, which is the legacy shape.
  const stamp = Date.now();
  await page.goto("/quotes/new");
  await page.getByLabel("Client name").fill(`Legacy ${stamp}`);
  await page.getByLabel("Project title").fill(`Legacy job ${stamp}`);
  await page.getByLabel("Description").first().fill("Work");
  await page.getByLabel("Unit price (RM)").first().fill("1000");
  await page.getByRole("button", { name: "Save Quote" }).click();
  await page.getByRole("button", { name: "Mark as Accepted" }).click();
  await page.getByRole("button", { name: "Convert to Project" }).click();
  await expect(page.getByRole("heading", { name: `Legacy job ${stamp}` })).toBeVisible();

  await page.getByRole("button", { name: "Link to client" }).click();
  await expect(page.getByRole("button", { name: "Link to client" })).toHaveCount(0);

  await page.goto("/clients");
  await expect(page.getByRole("row").filter({ hasText: `Legacy ${stamp}` })).toHaveCount(1);
});
