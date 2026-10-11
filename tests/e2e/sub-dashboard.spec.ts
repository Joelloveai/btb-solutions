import { expect, test, type Page } from "@playwright/test";
import { createProject } from "./helpers";
import { addTask, createSubWithLogin, signInSub, staffPage } from "./portal-helpers";

/** Calendar date in Malaysia, `offset` days from today, as the app itself reckons "today". */
function ymd(offset: number) {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date()).split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!) + offset * 86_400_000).toISOString().slice(0, 10);
}

async function openProject(page: Page, name: string) {
  await page.goto("/projects");
  await page.getByRole("link").filter({ hasText: name }).first().click();
  await page.waitForURL(/\/projects\/[^/]+$/);
}

test("a subcontractor sees every task and punch item on every project, sorted by when it is due, with overdue in red", async ({ browser }) => {
  test.setTimeout(180_000);
  const stamp = Date.now();
  const staff = await staffPage(browser);
  const page = staff.page;
  const mine = `Sparks ${stamp}`;
  const theirs = `Other Sparks ${stamp}`;
  const email = `multi-sub-${stamp}@example.test`;
  await createSubWithLogin(page, mine, email, { trade: "Electrical" });
  await createSubWithLogin(page, theirs, `multi-other-${stamp}@example.test`, { trade: "Electrical" });

  const projectA = `Alpha Tower ${stamp}`;
  const projectB = `Bravo Court ${stamp}`;
  await page.goto("/projects");
  await createProject(page, projectA, "50000");
  await createProject(page, projectB, "60000");

  await openProject(page, projectA);
  await addTask(page, { description: "Chip old plaster", sub: mine, due: ymd(-3) });
  await addTask(page, { description: "Hack the wall today", sub: mine, due: ymd(0) });
  await addTask(page, { description: "Fit tomorrow's boxes", sub: mine, due: ymd(1) });
  await addTask(page, { description: "Someone else's job", sub: theirs, due: ymd(2) });

  await openProject(page, projectB);
  await addTask(page, { description: "Run conduit this week", sub: mine, due: ymd(4) });
  await addTask(page, { description: "Final fix next month", sub: mine, due: ymd(30) });
  await page.getByRole("tab", { name: "Punch List" }).click();
  await page.getByRole("button", { name: "+ Add Punch Item" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Location").fill("Level 1, Utility room");
  await dialog.getByLabel("What needs fixing").fill("Loose socket");
  await dialog.getByLabel("Trade").selectOption("Electrical");
  await dialog.getByLabel("Due (optional)").fill(ymd(1));
  await dialog.getByLabel("Assign to").selectOption({ label: mine });
  await dialog.getByRole("button", { name: "Save punch item" }).click();
  await expect(dialog).toBeHidden();

  const sub = await signInSub(browser, email);
  const s = sub.page;

  // The daily summary: new in the last day, due tomorrow (task + punch item), overdue, new punch items.
  await expect(s.getByTestId("summary-new-tasks")).toContainText("5");
  await expect(s.getByTestId("summary-due-tomorrow")).toContainText("2");
  await expect(s.getByTestId("summary-overdue")).toContainText("1");
  await expect(s.getByTestId("summary-new-punch-items")).toContainText("1");
  await expect(s.getByText(/5 open tasks across 2 projects/)).toBeVisible();

  // Grouped by when it is due, and across both projects.
  const overdue = s.getByTestId("group-overdue");
  await expect(overdue).toContainText("Chip old plaster");
  await expect(overdue).toContainText(projectA);
  await expect(overdue.getByRole("heading")).toHaveClass(/text-loss/); // overdue is red
  await expect(s.getByTestId("group-today")).toContainText("Hack the wall today");
  const week = s.getByTestId("group-week");
  await expect(week).toContainText("Fit tomorrow's boxes");
  await expect(week).toContainText("Run conduit this week");
  await expect(week).toContainText(projectA);
  await expect(week).toContainText(projectB);
  const order = (await week.innerText()).indexOf("Fit tomorrow's boxes") < (await week.innerText()).indexOf("Run conduit this week");
  expect(order).toBe(true); // earliest due date first
  await expect(s.getByTestId("group-later")).toContainText("Final fix next month");

  // Punch items sit on the same screen, and another subcontractor's work does not.
  const punch = s.getByRole("region", { name: "Punch items due" });
  await expect(punch).toContainText("Level 1, Utility room");
  await expect(punch).toContainText(projectB);
  await expect(s.getByText("Someone else's job")).toHaveCount(0);

  // Order in the groups: overdue, today, this week, later.
  const headings = await s.getByRole("region", { name: "Open tasks" }).getByRole("heading").allInnerTexts();
  expect(headings.map((h) => h.replace(/ \(\d+\)/, ""))).toEqual(["Overdue", "Due today", "This week", "Later"]);

  await sub.context.close();
  await staff.context.close();
});
