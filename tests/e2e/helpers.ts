import { expect, type Page } from "@playwright/test";

export async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("boss@btb.my");
  await page.getByLabel("Password").fill("btb12345");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export async function createProject(page: Page, name: string, contractValue: string) {
  await page.getByRole("button", { name: "+ New Project" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Project name").fill(name);
  await dialog.getByLabel("Contract value (RM)").fill(contractValue);
  await dialog.getByRole("button", { name: "Create project" }).click();
  await expect(dialog).toBeHidden();
}
