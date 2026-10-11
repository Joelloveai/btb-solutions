import { expect, test, type Page } from "@playwright/test";
import { PASSWORD, addPortalLogin, createClientProject, png, staffPage, visitor } from "./portal-helpers";

function ymd(offset: number) {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date()).split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!) + offset * 86_400_000).toISOString().slice(0, 10);
}

async function addChangeOrder(page: Page, description: string, amount: string) {
  await page.getByRole("tab", { name: "Change Orders" }).click();
  await page.getByRole("button", { name: "+ Add Change Order" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Description").fill(description);
  await dialog.getByLabel(/Amount \(RM\)/).fill(amount);
  await dialog.getByRole("button", { name: "Save change order" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(description).first()).toBeVisible();
}

async function forClient(page: Page) {
  await page.getByRole("tab", { name: "For Client" }).click();
}

async function addSelection(page: Page, name: string, withPhoto = true) {
  await forClient(page);
  await page.getByRole("region", { name: "Product selections" }).getByRole("button", { name: "+ Add selection" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Product", { exact: true }).fill(name);
  if (withPhoto) await dialog.getByLabel("Photo of the product").setInputFiles(png("swatch.png"));
  await dialog.getByRole("button", { name: "Save selection" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("selection-row").filter({ hasText: name })).toBeVisible();
}

async function signInClient(browser: Parameters<typeof visitor>[0], email: string, projectPath: string) {
  const v = await visitor(browser);
  await v.page.goto("/client/login");
  await v.page.getByLabel("Email").fill(email);
  await v.page.getByLabel("Password").fill(PASSWORD);
  await v.page.getByRole("button", { name: "Sign in" }).click();
  await expect(v.page).toHaveURL(/\/client\/projects$/);
  await v.page.goto(projectPath);
  return v;
}

const portalPath = (url: string) => new URL(url).pathname.replace("/projects/", "/client/projects/");

test.describe("client portal v2", () => {
  test("the client approves a change order and a selection; it is recorded, priced in, and rejection changes nothing", async ({ browser }) => {
    test.setTimeout(180_000);
    const stamp = Date.now();
    const staff = await staffPage(browser);
    const page = staff.page;
    const projectUrl = await createClientProject(page, `Approvals ${stamp}`, `Client V ${stamp}`);
    const email = `approver-${stamp}@example.test`;
    await addPortalLogin(page, email);
    await expect(page.getByTestId("outstanding")).toHaveText("RM 100,000.00");

    // A draft change order is invisible to the client until it is sent.
    await addChangeOrder(page, "Extra bathroom wall", "10000");
    await addChangeOrder(page, "Skylight", "5000");
    await addSelection(page, "Grey matt tile 600x600");
    await addSelection(page, "Wall paint Misty Grey", false);
    const client = await signInClient(browser, email, portalPath(projectUrl));
    const c = client.page;
    await expect(c.getByRole("region", { name: "Change orders" })).toHaveCount(0);
    await expect(c.getByRole("region", { name: "Product selections" })).toBeVisible(); // selections are made for the client

    await page.getByRole("tab", { name: "Change Orders" }).click();
    const send = page.getByRole("button", { name: "Send to client" });
    await expect(send).toHaveCount(2);
    await send.first().click();
    await expect(send).toHaveCount(1);
    await send.first().click();
    await expect(send).toHaveCount(0);

    await c.reload();
    const orders = c.getByRole("region", { name: "Change orders" });
    await expect(orders.getByTestId("client-change-order")).toHaveCount(2);
    await expect(c.getByRole("region", { name: "Needs your decision" })).toContainText("(4)"); // 2 change orders + 2 selections

    // Approve one: a confirmation first, then it is recorded with a server timestamp.
    const wall = orders.getByTestId("client-change-order").filter({ hasText: "Extra bathroom wall" });
    await expect(wall).toContainText("RM 10,000.00");
    await wall.getByRole("button", { name: "Approve" }).click();
    const confirm = c.getByRole("dialog");
    await expect(confirm).toContainText("This changes the price of your job");
    await confirm.getByRole("button", { name: "Yes, approve" }).click();
    await expect(c.getByText("Approved. Thank you.")).toBeVisible();
    await expect(wall).toContainText(/Approved by you on \d{2} \w{3} \d{4}.*\d{2}:\d{2}/);
    await expect(wall.getByRole("button", { name: "Approve" })).toHaveCount(0); // decided: no second go

    // Reject the other: recorded, and the price does not move.
    const sky = orders.getByTestId("client-change-order").filter({ hasText: "Skylight" });
    await sky.getByRole("button", { name: "Reject" }).click();
    await c.getByRole("dialog").getByRole("button", { name: "Yes, reject" }).click();
    await expect(sky).toContainText(/Rejected by you on/);

    // The contractor sees both decisions with their times, and the approved one is in the price.
    await page.reload();
    await page.getByRole("tab", { name: "Change Orders" }).click();
    await expect(page.getByTestId("client-decision").filter({ hasText: "Approved by client" })).toBeVisible();
    await expect(page.getByTestId("client-decision").filter({ hasText: "Rejected by client" })).toBeVisible();
    await expect(page.getByTestId("outstanding")).toHaveText("RM 110,000.00"); // 100,000 + the approved 10,000 only

    // A selection: approve with the same care.
    const tile = c.getByTestId("client-selection").filter({ hasText: "Grey matt tile 600x600" });
    await expect(tile.locator("img")).toBeVisible();
    await tile.getByRole("button", { name: /Approve/ }).click();
    await c.getByRole("dialog").getByRole("button", { name: "Yes, approve" }).click();
    await expect(tile).toContainText(/by you on \d{2} \w{3} \d{4}/);
    await page.reload();
    await forClient(page);
    await expect(page.getByTestId("selection-row").filter({ hasText: "Grey matt tile" })).toContainText("Approved");
    await expect(page.getByTestId("selection-row").filter({ hasText: "Misty Grey" })).toContainText("Awaiting client");

    // An approval needs a connection: with none, nothing is recorded and the client is told why.
    const paint = c.getByTestId("client-selection").filter({ hasText: "Misty Grey" });
    await c.evaluate(() => navigator.serviceWorker?.ready);
    await client.context.setOffline(true);
    await expect(c.getByTestId("offline-indicator")).toBeVisible();
    await paint.getByRole("button", { name: /Approve/ }).click();
    await c.getByRole("dialog").getByRole("button", { name: "Yes, approve" }).click();
    await expect(c.getByText(/You are offline/)).toBeVisible();
    await client.context.setOffline(false);
    await c.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    await c.reload();
    await expect(c.getByTestId("client-selection").filter({ hasText: "Misty Grey" }).getByRole("button", { name: /Approve/ })).toBeVisible();

    await client.context.close();
    await staff.context.close();
  });

  test("the client sees the current stage, and daily logs with that day's photos", async ({ browser }) => {
    test.setTimeout(150_000);
    const stamp = Date.now();
    const staff = await staffPage(browser);
    const page = staff.page;
    const projectUrl = await createClientProject(page, `Stages ${stamp}`, `Client S ${stamp}`);
    const email = `stage-${stamp}@example.test`;
    await addPortalLogin(page, email);

    const client = await signInClient(browser, email, portalPath(projectUrl));
    const c = client.page;
    await expect(c.getByTestId("current-stage")).toContainText("Work has not started yet");

    await forClient(page);
    await page.getByLabel("Current stage").selectOption("Framing");
    await expect(page.getByText("Stage updated")).toBeVisible();

    // A photo taken today, a note for today, and a note for an earlier day with no photos.
    await page.getByRole("tab", { name: "Progress Photos" }).click();
    const photos = page.getByRole("region", { name: "Progress photos" });
    await photos.locator("input[type=file]").setInputFiles(png("rebar.png"));
    await photos.getByLabel("Caption (optional)").fill("Rebar tied");
    await photos.getByRole("button", { name: "Upload photo" }).click();
    await expect(photos.getByText("Rebar tied")).toBeVisible();
    await forClient(page);
    for (const log of [
      { day: ymd(0), note: "Rebar inspection passed" },
      { day: ymd(-3), note: "Site cleared and fenced" },
    ]) {
      await page.getByRole("region", { name: "Daily log" }).getByRole("button", { name: "+ Add daily log" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Day").fill(log.day);
      await dialog.getByLabel("What happened on site").fill(log.note);
      await dialog.getByRole("button", { name: "Save daily log" }).click();
      await expect(dialog).toBeHidden();
      await expect(page.getByTestId("log-row").filter({ hasText: log.note })).toBeVisible();
    }

    await c.reload();
    // Demo done (ticked), Framing is the current stage in amber, the rest still to come.
    const stages = c.getByTestId("stage-tracker").getByRole("listitem");
    await expect(stages).toHaveCount(5);
    await expect(stages.nth(0)).toHaveAttribute("data-state", "done");
    await expect(stages.nth(1)).toHaveAttribute("data-state", "current");
    await expect(stages.nth(2)).toHaveAttribute("data-state", "todo");
    await expect(c.getByTestId("current-stage")).toContainText("Current stage");
    await expect(c.getByTestId("current-stage")).toContainText("Framing");

    // Daily logs, newest first; today's carries today's photo, the earlier one has none.
    const logs = c.getByTestId("daily-log");
    await expect(logs).toHaveCount(2);
    await expect(logs.first()).toContainText("Rebar inspection passed");
    await expect(logs.first()).toContainText("Rebar tied");
    await expect(logs.first().locator("img")).toHaveCount(1);
    await expect(logs.last()).toContainText("Site cleared and fenced");
    await expect(logs.last().locator("img")).toHaveCount(0);

    // Completed ticks every stage.
    await page.getByLabel("Current stage").selectOption("Completed");
    await expect(page.getByText("Stage updated").last()).toBeVisible();
    await c.reload();
    await expect(c.getByTestId("current-stage")).toContainText("Your project is complete.");
    await client.context.close();
    await staff.context.close();
  });

  test("the payment schedule shows each instalment's amount and whether payments received cover it", async ({ browser }) => {
    test.setTimeout(150_000);
    const stamp = Date.now();
    const staff = await staffPage(browser);
    const page = staff.page;
    const projectUrl = await createClientProject(page, `Schedule ${stamp}`, `Client P ${stamp}`);
    const email = `schedule-${stamp}@example.test`;
    await addPortalLogin(page, email);

    await forClient(page);
    for (const m of [
      { label: "Deposit", percent: "10", due: ymd(-30) },
      { label: "On framing", percent: "30", due: ymd(-5) },
      { label: "Handover", percent: "60", due: ymd(40) },
    ]) {
      await page.getByRole("region", { name: "Payment schedule" }).getByRole("button", { name: "+ Add instalment" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Instalment").fill(m.label);
      await dialog.getByLabel("Percent of total").fill(m.percent);
      await dialog.getByLabel("Due date (optional)").fill(m.due);
      await dialog.getByRole("button", { name: "Save instalment" }).click();
      await expect(dialog).toBeHidden();
    }
    await expect(page.getByTestId("schedule-total")).toHaveText("Instalments add up to 100%.");

    // Record one payment of RM 15,000 the normal way. Nothing is entered on the schedule itself.
    await page.getByRole("tab", { name: "Payments" }).click();
    await page.getByRole("button", { name: "+ Add Payment" }).first().click();
    const pay = page.getByRole("dialog");
    await pay.getByLabel("Amount (RM)").fill("15000");
    await pay.getByRole("button", { name: "Save payment" }).click();
    await expect(pay).toBeHidden();

    const client = await signInClient(browser, email, portalPath(projectUrl));
    const rows = client.page.getByTestId("schedule-row");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText("RM 10,000.00");
    await expect(rows.nth(0)).toContainText("Paid");
    await expect(rows.nth(0)).not.toContainText("Overdue");
    await expect(rows.nth(1)).toContainText("RM 30,000.00");
    await expect(rows.nth(1)).toContainText("Part paid"); // 5,000 of 30,000
    await expect(rows.nth(1)).toContainText("Overdue"); // due five days ago and not fully paid
    await expect(rows.nth(2)).toContainText("RM 60,000.00");
    await expect(rows.nth(2)).toContainText("Outstanding");
    await expect(rows.nth(2)).not.toContainText("Overdue"); // not due yet
    await expect(client.page.getByTestId("schedule-received")).toContainText("RM 15,000.00");
    await expect(client.page.getByTestId("schedule-received")).toContainText("RM 100,000.00");

    // The client never sees costs, claims or profit.
    await expect(client.page.getByText(/profit|claim|cost/i)).toHaveCount(0);
    await client.context.close();
    await staff.context.close();
  });
});
