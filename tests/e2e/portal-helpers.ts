import { expect, type Browser, type Page } from "@playwright/test";
import { login } from "./helpers";

/** A valid 1x1 PNG, enough for the server's image check. */
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
export const png = (name = "site.png") => ({ name, mimeType: "image/png", buffer: PNG });

export const PASSWORD = "Portal-pass-1";

/** Staff: create a client from the picker and a project under it, then open the project. */
export async function createClientProject(page: Page, projectName: string, clientName: string) {
  await page.getByRole("button", { name: "+ New Project" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Project name").fill(projectName);
  await dialog.getByLabel("Contract value (RM)").fill("100000");
  await dialog.getByLabel("Client (optional)").selectOption({ label: "+ Create new client…" });
  await dialog.getByLabel("New client name").fill(clientName);
  await dialog.getByRole("button", { name: "Save client" }).click();
  await expect(dialog.getByLabel("Client (optional)")).toContainText(clientName);
  await dialog.getByRole("button", { name: "Create project" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("link").filter({ hasText: projectName }).first().click();
  await page.waitForURL(/\/projects\/[^/]+$/);
  await expect(page.getByRole("heading", { name: projectName, level: 1 })).toBeVisible();
  return page.url();
}

/** Staff: give the project's client a portal login. */
export async function addPortalLogin(page: Page, email: string) {
  await page.getByRole("region", { name: "Client portal access" }).getByRole("button", { name: "+ Add login" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Login email").fill(email);
  await dialog.getByLabel(/Temporary password/).fill(PASSWORD);
  await dialog.getByRole("button", { name: "Create login" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("region", { name: "Client portal access" })).toContainText(email);
}

export async function addTask(page: Page, task: { description: string; sub?: string; milestone?: boolean; due?: string; start?: string }) {
  await page.getByRole("tab", { name: "Tasks" }).click();
  await page.getByRole("button", { name: "+ Add Task" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Task or milestone").fill(task.description);
  if (task.milestone) await dialog.getByLabel(/This is a milestone/).check();
  if (task.sub) await dialog.getByLabel("Assign to subcontractor").selectOption({ label: task.sub });
  if (task.start) await dialog.getByLabel("Start date (optional)").fill(task.start);
  if (task.due) await dialog.getByLabel("Due date").fill(task.due);
  await dialog.getByRole("button", { name: "Save task" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(task.description).first()).toBeVisible();
}

/** A fresh browser context with nobody signed in: how a client or subcontractor really arrives. */
export async function visitor(browser: Browser) {
  const context = await browser.newContext();
  return { context, page: await context.newPage() };
}

export async function staffPage(browser: Browser) {
  const v = await visitor(browser);
  await login(v.page);
  return v;
}

/** Staff on a phone that has allowed location access and is standing in Kuala Lumpur. */
export async function staffPageWithGps(browser: Browser) {
  const context = await browser.newContext({
    geolocation: { latitude: 3.139, longitude: 101.6869, accuracy: 15 },
    permissions: ["geolocation"],
  });
  const page = await context.newPage();
  // The first request to a cold dev server can click "Sign in" before the page has hydrated: try once more.
  await page.goto("/login");
  await page.getByLabel("Email").fill("boss@btb.my");
  await page.getByLabel("Password").fill("btb12345");
  await page.getByRole("button", { name: "Sign in" }).click();
  try {
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 8000 });
  } catch {
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  }
  return { context, page };
}

/**
 * Attach a photo whose file time is `daysAgo` days in the past, as a photo taken earlier would be.
 * (Playwright cannot set a file's modified time, so the file is built inside the page.)
 */
export async function attachPhotoTakenDaysAgo(page: Page, inputLabel: string, daysAgo: number, name = "site.png") {
  await page.getByLabel(inputLabel, { exact: true }).evaluate(
    (input: HTMLInputElement, args: { base64: string; name: string; modified: number }) => {
      const bytes = Uint8Array.from(atob(args.base64), (c) => c.charCodeAt(0));
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], args.name, { type: "image/png", lastModified: args.modified }));
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { base64: PNG.toString("base64"), name, modified: Date.now() - daysAgo * 24 * 60 * 60 * 1000 },
  );
}

/** Staff: create a subcontractor (with a phone number) and a task-log login for them. Returns the login email. */
export async function createSubWithLogin(page: Page, subName: string, email: string, options: { trade?: string; phone?: string } = {}) {
  await page.goto("/subcons");
  await page.getByRole("button", { name: "+ New Subcontractor" }).first().click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill(subName);
  if (options.phone) await dialog.getByLabel("Contact (phone)").fill(options.phone);
  if (options.trade) await dialog.getByLabel("Trade").fill(options.trade);
  await dialog.getByRole("button", { name: "Save subcontractor" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("link").filter({ hasText: subName }).first().click();
  await page.waitForURL(/\/subcons\/[^/]+$/);
  await page.getByRole("region", { name: "Task log login" }).getByRole("button", { name: "+ Add login" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Login email").fill(email);
  await dialog.getByLabel(/Temporary password/).fill(PASSWORD);
  await dialog.getByRole("button", { name: "Create login" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("region", { name: "Task log login" })).toContainText(email);
  return email;
}

/** The subcontractor signs in on their own phone (a fresh browser context). */
export async function signInSub(browser: Browser, email: string) {
  const v = await visitor(browser);
  await v.page.goto("/login");
  await v.page.getByLabel("Email").fill(email);
  await v.page.getByLabel("Password").fill(PASSWORD);
  await v.page.getByRole("button", { name: "Sign in" }).click();
  await expect(v.page).toHaveURL(/\/sub\/tasks$/);
  return v;
}
