import { expect, test } from "@playwright/test";
import { createProject } from "./helpers";
import { auditTouchTargets } from "./touch-audit";
import { staffPage } from "./portal-helpers";

test("staff screens on a phone: buttons, fields, tabs and links are 48px tall and not squeezed together", async ({ browser }) => {
  test.setTimeout(240_000);
  const staff = await staffPage(browser);
  const page = staff.page;
  const found: Record<string, unknown[]> = {};
  const audit = async (label: string) => {
    const problems = await auditTouchTargets(page);
    if (problems.length) found[label] = problems;
  };

  await page.goto("/projects");
  await createProject(page, `Touch ${Date.now()}`, "30000");
  for (const path of ["/dashboard", "/projects", "/quotes", "/receivables", "/subcons", "/clients"]) {
    await page.goto(path);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByRole("main")).toBeVisible();
    await audit(path);
  }
  await page.goto("/projects");
  await page.getByRole("link").filter({ hasText: "Touch " }).first().click();
  await page.waitForURL(/\/projects\/[^/]+$/);
  for (const tab of ["Timeline", "Costs", "Payments", "Change Orders", "BOQ", "Progress Photos", "Tasks", "Punch List", "Documents", "Site Diary", "For Client"]) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    await audit(`project / ${tab}`);
  }
  await page.getByRole("tab", { name: "Costs" }).click();
  await page.getByRole("button", { name: "+ Add Cost" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await audit("add cost form");
  await page.getByRole("dialog").locator("summary").click();
  await audit("add cost form, More open");

  expect(found, `touch-target problems: ${JSON.stringify(found, null, 2)}`).toEqual({});
  await staff.context.close();
});
