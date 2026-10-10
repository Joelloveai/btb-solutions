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
