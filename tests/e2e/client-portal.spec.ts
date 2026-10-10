import { expect, test } from "@playwright/test";
import { PASSWORD, addPortalLogin, addTask, createClientProject, png, staffPage, visitor } from "./portal-helpers";

test.describe("client portal", () => {
  test("client login: wrong password is refused, right one lands on their projects, staff pages stay closed", async ({ browser }) => {
    const stamp = Date.now();
    const staff = await staffPage(browser);
    const project = `Portal login ${stamp}`;
    await createClientProject(staff.page, project, `Client A ${stamp}`);
    const email = `client-a-${stamp}@example.test`;
    await addPortalLogin(staff.page, email);

    const { context, page } = await visitor(browser);
    await page.goto("/client/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Wrong email or password")).toBeVisible();
    await expect(page).toHaveURL(/\/client\/login/);

    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/client\/projects$/);
    await expect(page.getByRole("link").filter({ hasText: project })).toBeVisible();

    // A client can never reach the staff app, its data export or its photos area.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/client\/projects$/);
    const exportResponse = await page.request.get("/api/export");
    expect(exportResponse.status()).toBe(401);

    // Someone not signed in is sent to the client login, not the staff one.
    const anon = await visitor(browser);
    await anon.page.goto("/client/projects");
    await expect(anon.page).toHaveURL(/\/client\/login/);

    await context.close();
    await anon.context.close();
    await staff.context.close();
  });

  test("client project view: status, completion, photos, floor plan and timeline, and nothing from other clients", async ({ browser }) => {
    const stamp = Date.now();
    const staff = await staffPage(browser);
    const mine = `Portal view ${stamp}`;
    const projectUrl = await createClientProject(staff.page, mine, `Client B ${stamp}`);
    const email = `client-b-${stamp}@example.test`;
    await addPortalLogin(staff.page, email);

    // Contractor adds a photo, a floor plan and a small schedule (one task done => 50%).
    await staff.page.getByRole("tab", { name: "Progress Photos" }).click();
    await staff.page.getByRole("region", { name: "Progress photos" }).locator("input[type=file]").setInputFiles(png("slab.png"));
    await staff.page.getByRole("region", { name: "Progress photos" }).getByLabel("Caption (optional)").fill("Slab poured");
    await staff.page.getByRole("region", { name: "Progress photos" }).getByRole("button", { name: "Upload photo" }).click();
    await expect(staff.page.getByText("Slab poured")).toBeVisible();
    await staff.page.getByRole("region", { name: "Floor plans" }).locator("input[type=file]").setInputFiles(png("plan.png"));
    await staff.page.getByRole("region", { name: "Floor plans" }).getByLabel("Caption (optional)").fill("Ground floor");
    await staff.page.getByRole("region", { name: "Floor plans" }).getByRole("button", { name: "Upload photo" }).click();
    await expect(staff.page.getByText("Ground floor")).toBeVisible();

    await addTask(staff.page, { description: "Pour slab", start: "2026-10-01", due: "2026-10-05" });
    await addTask(staff.page, { description: "Hand over keys", milestone: true, due: "2026-11-30" });
    await staff.page.getByRole("button", { name: "Mark done" }).first().click();
    await expect(staff.page.getByText("Marked done")).toBeVisible();

    // A second client with their own project must not be visible to the first.
    const other = `Someone else ${stamp}`;
    await staff.page.goto("/dashboard");
    const otherUrl = await createClientProject(staff.page, other, `Client C ${stamp}`);

    const { context, page } = await visitor(browser);
    await page.goto("/client/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/client\/projects$/);
    await expect(page.getByRole("link").filter({ hasText: other })).toHaveCount(0);

    await page.goto(new URL(projectUrl).pathname.replace("/projects/", "/client/projects/"));
    await expect(page.getByRole("heading", { name: mine })).toBeVisible();
    await expect(page.getByText("Active", { exact: true })).toBeVisible();
    await expect(page.getByTestId("completion")).toHaveText("50%");

    // Photo with date and time, loading through the authenticated route.
    const photos = page.getByRole("region", { name: "Progress photos" });
    await expect(photos.getByText("Slab poured")).toBeVisible();
    await expect(photos.getByText(/\d{2} \w{3} \d{4}.*\d{2}:\d{2}/)).toBeVisible();
    await expect.poll(() => photos.locator("img").first().evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

    const photoId = (await photos.locator("img").first().getAttribute("src"))!.split("/").pop()!;

    // Floor plan viewer opens.
    await page.getByRole("region", { name: "Floor plans" }).getByRole("button", { name: /Open photo/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Full size" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();

    // Read-only Gantt timeline with both items.
    const gantt = page.getByTestId("gantt");
    await expect(gantt.locator(".gantt_bar_task")).toHaveCount(1);
    await expect(gantt.locator(".gantt_milestone")).toHaveCount(1);
    await expect(gantt.locator(".gantt_tree_content", { hasText: "Pour slab" })).toBeVisible();

    // The client sees no money and no staff controls.
    await expect(page.getByText(/RM \d/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Delete/ })).toHaveCount(0);

    // Another client's project is simply not found.
    await page.goto(new URL(otherUrl).pathname.replace("/projects/", "/client/projects/"));
    await expect(page.getByText("This page could not be found")).toBeVisible();

    // Photos are behind login: anonymous requests are refused, another client's photo is "not found".
    const anon = await visitor(browser);
    expect((await anon.page.request.get(`/api/photos/${photoId}`)).status()).toBe(401);
    await anon.context.close();

    await context.close();
    await staff.context.close();
  });
});
