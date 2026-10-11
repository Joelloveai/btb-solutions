import { expect, test, type Page } from "@playwright/test";
import { createProject } from "./helpers";
import { PASSWORD, png, staffPage, visitor } from "./portal-helpers";

/** Wait until the service worker controls the page, then reload so this page itself is cached. */
async function readyOffline(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 20_000 }).toBe(true);
  await page.reload();
  // The worker keeps a copy of every page it serves: wait until this one is really saved.
  await expect
    .poll(() => page.evaluate(async () => !!(await caches.match(location.href, { ignoreVary: true }))), { timeout: 20_000 })
    .toBe(true);
}

async function openProject(page: Page, name: string) {
  await page.getByRole("link").filter({ hasText: name }).first().click();
  await page.waitForURL(/\/projects\/[^/]+$/);
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
}

async function addCostThroughDialog(page: Page, description: string, amount: string) {
  await page.getByRole("tab", { name: "Costs" }).click();
  await page.getByRole("button", { name: "+ Add Cost" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Description").fill(description);
  await dialog.getByLabel("Amount (RM)").fill(amount);
  await dialog.getByRole("button", { name: "Save cost" }).click();
  return dialog;
}

test.describe("offline", () => {
  test("a cost added with no signal is kept on the phone and synced once signal returns", async ({ browser }) => {
    test.setTimeout(120_000);
    const { context, page } = await staffPage(browser);
    const name = `Basement job ${Date.now()}`;
    await createProject(page, name, "100000");
    await openProject(page, name);
    await readyOffline(page);

    await context.setOffline(true);
    await expect(page.getByTestId("offline-indicator")).toContainText("Offline — changes will sync when connected.");

    // The project page still opens from the phone's own copy.
    await page.reload();
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
    await expect(page.getByTestId("offline-indicator")).toBeVisible();

    // Adding a cost does not error and does not block: it is saved on the device.
    const dialog = await addCostThroughDialog(page, "Cement 20 bags", "340.50");
    await expect(page.getByText("Saved. Will sync when online.")).toBeVisible();
    await expect(dialog).toBeHidden();
    const pending = page.getByTestId("pending-op").filter({ hasText: "Cement 20 bags" });
    await expect(pending).toBeVisible();
    await expect(pending).toContainText("Pending sync");

    // Signal returns: it syncs by itself, with no button press.
    await context.setOffline(false);
    await expect(page.getByTestId("pending-op")).toHaveCount(0, { timeout: 40_000 });
    await expect(page.getByTestId("offline-indicator")).toHaveCount(0, { timeout: 40_000 });
    await page.reload();
    await expect(page.getByTestId("total-costs")).toHaveText("RM 340.50");
    await context.close();
  });

  test("a page never opened on this phone shows a calm offline page, not an error", async ({ browser }) => {
    const { context, page } = await staffPage(browser);
    await readyOffline(page); // dashboard is cached; /clients is not
    await context.setOffline(true);
    await page.goto("/clients").catch(() => undefined);
    await expect(page.getByRole("heading", { name: "You are offline" })).toBeVisible();
    await context.setOffline(false);
    await context.close();
  });

  test("if the server's reply is lost, the retry does not create a second cost", async ({ browser }) => {
    test.setTimeout(90_000);
    const { context, page } = await staffPage(browser);
    const name = `Lost reply job ${Date.now()}`;
    await createProject(page, name, "50000");
    await openProject(page, name);

    // The first save reaches the server, but the phone never hears back (bad signal).
    let dropped = false;
    await page.route("**/*", async (route) => {
      const request = route.request();
      if (!dropped && request.method() === "POST" && request.headers()["next-action"]) {
        dropped = true;
        await route.fetch(); // the server DOES apply it
        await route.abort("failed"); // ...but the answer never arrives
      } else {
        await route.continue();
      }
    });

    await addCostThroughDialog(page, "Sand 5 loads", "125.00");
    // The app retries with the same request id; the server recognises it.
    await expect(page.getByTestId("pending-op")).toHaveCount(0, { timeout: 40_000 });
    await page.reload();
    await expect(page.getByTestId("total-costs")).toHaveText("RM 125.00");
    await expect(page.getByText("Sand 5 loads")).toHaveCount(1);
    await context.close();
  });

  test("a subcontractor finishes a task with a photo in a basement and it syncs later", async ({ browser }) => {
    test.setTimeout(150_000);
    const stamp = Date.now();
    const staff = await staffPage(browser);
    const sp = staff.page;

    // Staff: a subcontractor, a login for them, a project and a task.
    const subName = `Basement Electrics ${stamp}`;
    await sp.goto("/subcons");
    await sp.getByRole("button", { name: "+ New Subcontractor" }).first().click();
    let dialog = sp.getByRole("dialog");
    await dialog.getByLabel("Name", { exact: true }).fill(subName);
    await dialog.getByRole("button", { name: "Save subcontractor" }).click();
    await expect(dialog).toBeHidden();
    await sp.getByRole("link").filter({ hasText: subName }).first().click();
    await sp.waitForURL(/\/subcons\/[^/]+$/);
    const email = `offline-sub-${stamp}@example.test`;
    await sp.getByRole("region", { name: "Task log login" }).getByRole("button", { name: "+ Add login" }).click();
    dialog = sp.getByRole("dialog");
    await dialog.getByLabel("Login email").fill(email);
    await dialog.getByLabel(/Temporary password/).fill(PASSWORD);
    await dialog.getByRole("button", { name: "Create login" }).click();
    await expect(dialog).toBeHidden();

    const project = `Basement fit-out ${stamp}`;
    await sp.goto("/projects");
    await createProject(sp, project, "30000");
    await openProject(sp, project);
    await sp.getByRole("tab", { name: "Tasks" }).click();
    await sp.getByRole("button", { name: "+ Add Task" }).first().click();
    dialog = sp.getByRole("dialog");
    const task = `Pull cable ${stamp}`;
    await dialog.getByLabel("Task or milestone").fill(task);
    await dialog.getByLabel("Assign to subcontractor").selectOption({ label: subName });
    await dialog.getByRole("button", { name: "Save task" }).click();
    await expect(dialog).toBeHidden();

    // The subcontractor opens their list while they still have signal...
    const sub = await visitor(browser);
    await sub.page.goto("/login");
    await sub.page.getByLabel("Email").fill(email);
    await sub.page.getByLabel("Password").fill(PASSWORD);
    await sub.page.getByRole("button", { name: "Sign in" }).click();
    await expect(sub.page).toHaveURL(/\/sub\/tasks$/);
    await readyOffline(sub.page);

    // ...then goes into the basement.
    await sub.context.setOffline(true);
    await sub.page.reload();
    await expect(sub.page.getByText(task)).toBeVisible();
    await expect(sub.page.getByTestId("offline-indicator")).toContainText("Offline — changes will sync when connected.");
    await sub.page.getByLabel(`Photo for ${task}`).setInputFiles(png("cable.png"));
    await sub.page.getByRole("button", { name: "Mark as done" }).click();
    await expect(sub.page.getByText("Saved. Will sync when online.")).toBeVisible();
    await expect(sub.page.getByTestId("pending-op").filter({ hasText: "with photo" })).toBeVisible();

    // Back at the van: it syncs, and the contractor sees it done with the photo.
    await sub.context.setOffline(false);
    await expect(sub.page.getByTestId("pending-op")).toHaveCount(0, { timeout: 40_000 });
    await sp.reload();
    await sp.getByRole("tab", { name: "Tasks" }).click();
    const row = sp.getByRole("listitem").filter({ hasText: task });
    await expect(row.getByText("Done", { exact: true })).toBeVisible();
    await expect.poll(() => row.locator("img").first().evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

    await sub.context.close();
    await staff.context.close();
  });
});
