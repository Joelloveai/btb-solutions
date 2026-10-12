import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { createProject } from "./helpers";
import { staffPage, visitor } from "./portal-helpers";

/** The row for one person, whichever layout (table or cards) is on screen. */
const userRow = (page: Page, text: string) => page.locator('[data-testid="user-row"]:visible, [data-testid="user-card"]:visible').filter({ hasText: text });

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  // A click before the page has hydrated does nothing; once more if so.
  try {
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8000 });
  } catch {
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).not.toHaveURL(/\/login/);
  }
}

test("admin adds a supervisor; they must set their own password, cannot see money, and are signed out when deactivated", async ({ browser }) => {
  test.setTimeout(240_000);
  const stamp = Date.now();
  const sup = { name: `Site Sam ${stamp}`, email: `sam-${stamp}@example.test`, temp: "Temp-pass-1", own: "Sam-own-pass-1" };

  // The existing admin login still works and can open Users.
  const admin = await staffPage(browser);
  const a = admin.page;
  await createProject(a, `Users job ${stamp}`, "70000");
  await a.goto("/settings/users");
  await expect(a.getByRole("heading", { name: "Users" })).toBeVisible();
  await expect(userRow(a, "boss@btb.my")).toContainText("Admin");
  await expect(userRow(a, "boss@btb.my")).toContainText("This is you");

  // Invite a SUPERVISOR.
  await a.getByRole("button", { name: "Invite User" }).click();
  const dialog = a.getByRole("dialog");
  await dialog.getByLabel("Name").fill(sup.name);
  await dialog.getByLabel("Email").fill(sup.email);
  await dialog.getByLabel("Role").selectOption("SUPERVISOR");
  await dialog.getByLabel(/Temporary password/).fill(sup.temp);
  await dialog.getByRole("button", { name: "Add person" }).click();
  await expect(dialog).toBeHidden();
  const row = userRow(a, sup.email);
  await expect(row).toContainText("Supervisor");
  await expect(row).toContainText("Active");
  await expect(row).toContainText("Never");

  // First sign-in: made to choose their own password before anything else.
  const phone = await visitor(browser);
  const s = phone.page;
  await signIn(s, sup.email, sup.temp);
  await expect(s).toHaveURL(/\/settings\/profile$/);
  await expect(s.getByTestId("must-change")).toBeVisible();
  await s.goto("/projects");
  await expect(s).toHaveURL(/\/settings\/profile$/); // cannot skip it
  await s.getByLabel(/Temporary password you were given/).fill(sup.temp);
  await s.getByLabel("New password (8 or more characters)").fill(sup.own);
  await s.getByLabel("Type the new password again").fill("something-else-1");
  await s.getByRole("button", { name: "Change password" }).click();
  await expect(s.locator("main [role=alert]")).toHaveText("The two new passwords do not match.");
  await s.getByLabel("Type the new password again").fill(sup.own);
  await s.getByRole("button", { name: "Change password" }).click();
  await expect(s).toHaveURL(/\/projects$/);

  // A supervisor cannot see money: no receivables, dashboard, quotes, users, or claims.
  for (const path of ["/receivables", "/dashboard", "/quotes", "/subcons", "/clients", "/settings/users"]) {
    await s.goto(path);
    await expect(s, `${path} should bounce a supervisor`).toHaveURL(/\/projects$/);
  }
  await expect(s.getByRole("link", { name: "Receivables" })).toHaveCount(0);
  await expect(s.getByText(/RM \d/)).toHaveCount(0); // the list of jobs shows no figures
  await s.getByRole("link").filter({ hasText: `Users job ${stamp}` }).first().click();
  await s.waitForURL(/\/projects\/[^/]+$/);
  const projectUrl = s.url();
  await expect(s.getByRole("tab", { name: "Costs" })).toBeVisible();
  for (const hidden of ["Payments", "Change Orders", "BOQ", "For Client"]) await expect(s.getByRole("tab", { name: hidden, exact: true })).toHaveCount(0);
  await expect(s.getByTestId("outstanding")).toHaveCount(0);
  await expect(s.getByTestId("profit-loss")).toHaveCount(0);
  await expect(s.getByRole("link", { name: "Progress Claims" })).toHaveCount(0);
  await expect(s.getByText(/Contract RM/)).toHaveCount(0);
  const id = new URL(projectUrl).pathname.split("/").pop();
  expect((await s.request.get(`/api/export`)).status()).toBe(403);
  expect((await s.request.get(`/api/projects/${id}/cipaa-pack`)).status()).toBe(403);
  expect((await s.request.get(`/api/projects/${id}/timeline/pack`)).status()).toBe(403);

  // They can do site work: add a cost (and are not told the margin).
  await s.getByRole("tab", { name: "Costs" }).click();
  await s.getByRole("button", { name: "+ Add Cost" }).first().click();
  const costDialog = s.getByRole("dialog");
  await costDialog.getByLabel("Amount (RM)").fill("250");
  await costDialog.getByLabel("Description").fill("Screws");
  await costDialog.getByRole("button", { name: "Save cost" }).click();
  await expect(s.getByText("Cost added.", { exact: true })).toBeVisible();
  await expect(s.getByText(/margin/i)).toHaveCount(0);
  // ...and the timeline they see leaves out payments, claims and change orders.
  await s.getByRole("tab", { name: "Timeline" }).click();
  await expect(s.getByTestId("timeline-event").filter({ hasText: "Cost added" })).toBeVisible();
  await expect(s.getByTestId("timeline-event").filter({ hasText: /Payment|claim|Change order/i })).toHaveCount(0);

  // Deactivated mid-session: the very next request signs them out.
  await a.reload();
  await row.getByRole("button", { name: "Deactivate" }).click();
  await expect(row).toContainText("Deactivated");
  await s.goto("/projects");
  await expect(s).toHaveURL(/\/login/);
  await s.getByLabel("Email").fill(sup.email);
  await s.getByLabel("Password").fill(sup.own);
  await s.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(s.getByText("Wrong email or password")).toBeVisible(); // and cannot sign back in
  await expect(s).toHaveURL(/\/login/);

  // Reactivate and reset the password: they are made to choose a new one again.
  await row.getByRole("button", { name: "Reactivate" }).click();
  await expect(row).toContainText("Active");
  await row.getByRole("button", { name: "Reset Password" }).click();
  await a.getByRole("dialog").getByLabel(/New temporary password/).fill("Temp-pass-2");
  await a.getByRole("dialog").getByRole("button", { name: "Set temporary password" }).click();
  await expect(a.getByRole("dialog")).toBeHidden();
  await signIn(s, sup.email, "Temp-pass-2");
  await expect(s).toHaveURL(/\/settings\/profile$/);
  await expect(s.getByTestId("must-change")).toBeVisible();
  await s.getByLabel("Name", { exact: true }).fill(`${sup.name} Jr`);
  await s.getByRole("button", { name: "Save name" }).click();
  await expect(s.getByText("Name saved")).toBeVisible();

  await phone.context.close();
  await admin.context.close();
});

test("an admin cannot lock everyone out, and managers and viewers get exactly their share", async ({ browser }) => {
  test.setTimeout(180_000);
  const stamp = Date.now();
  const pw = "Role-test-pass-1";
  for (const [role, who] of [["MANAGER", "mgr"], ["VIEWER", "view"]] as const) {
    execFileSync("npx", ["tsx", "scripts/add-staff.ts", `${who}-${stamp}@example.test`, `${who} ${stamp}`, pw, role], { env: { ...process.env, DATABASE_URL: "file:./test.db" }, stdio: "pipe" });
  }
  const admin = await staffPage(browser);
  await createProject(admin.page, `Roles job ${stamp}`, "10000");

  // The only admin cannot deactivate themselves, and nobody can remove the last admin.
  await admin.page.goto("/settings/users");
  await expect(userRow(admin.page, "boss@btb.my").getByRole("button", { name: "Deactivate" })).toHaveCount(0);

  // A manager sees money, but not Users.
  const manager = await visitor(browser);
  await signIn(manager.page, `mgr-${stamp}@example.test`, pw);
  await expect(manager.page).toHaveURL(/\/dashboard$/);
  await manager.page.goto("/receivables");
  await expect(manager.page).toHaveURL(/\/receivables$/);
  await manager.page.goto("/settings/users");
  await expect(manager.page).toHaveURL(/\/projects$/);
  await expect(manager.page.getByRole("link", { name: "Users", exact: true })).toHaveCount(0);

  // A viewer sees everything and changes nothing.
  const viewer = await visitor(browser);
  await signIn(viewer.page, `view-${stamp}@example.test`, pw);
  await viewer.page.goto("/projects");
  await viewer.page.getByRole("link").filter({ hasText: `Roles job ${stamp}` }).first().click();
  await viewer.page.waitForURL(/\/projects\/[^/]+$/);
  await expect(viewer.page.getByTestId("outstanding")).toBeVisible();
  await expect(viewer.page.getByRole("button", { name: "Add to timeline" })).toHaveCount(0);
  await viewer.page.getByRole("tab", { name: "Costs" }).click();
  await expect(viewer.page.getByRole("button", { name: /^\+ Add/ })).toHaveCount(0);
  await expect(viewer.page.getByRole("button", { name: "New Project" })).toHaveCount(0);

  await manager.context.close();
  await viewer.context.close();
  await admin.context.close();
});
