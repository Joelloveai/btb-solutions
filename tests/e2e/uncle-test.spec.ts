import { expect, test } from "@playwright/test";
import { createProject } from "./helpers";
import { auditTouchTargets } from "./touch-audit";
import { addTask, png, staffPage, visitor } from "./portal-helpers";

test.describe("the uncle test", () => {
  test("a new subcontractor can sign in, see their work, finish a job with a photo and see what they are owed, in under 90 seconds", async ({ browser }) => {
    test.setTimeout(240_000);
    const stamp = Date.now();
    const phoneLocal = `013${String(stamp).slice(-7)}`;
    const pin = "135790";
    const subName = `Uncle Lim ${stamp}`;

    // ---- Set-up (the contractor's side, and the one-time invite): not part of the timed journey. ----
    const staff = await staffPage(browser);
    const page = staff.page;
    await page.goto("/subcons");
    await page.getByRole("button", { name: "+ New Subcontractor" }).first().click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name", { exact: true }).fill(subName);
    await dialog.getByLabel("Contact (phone)").fill(phoneLocal);
    await dialog.getByLabel("Trade").fill("Painting");
    await dialog.getByRole("button", { name: "Save subcontractor" }).click();
    await expect(dialog).toBeHidden();
    await page.goto("/projects");
    await createProject(page, `Uncle job ${stamp}`, "40000");
    await page.getByRole("link").filter({ hasText: `Uncle job ${stamp}` }).first().click();
    await page.waitForURL(/\/projects\/[^/]+$/);
    await addTask(page, { description: "Paint the front gate", sub: subName, due: "2026-12-01" });
    await page.getByRole("tab", { name: "Costs" }).click();
    await page.getByRole("button", { name: "+ Add Cost" }).first().click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Category").selectOption("SUBCON");
    await dialog.getByLabel("Description").fill("Gate painting");
    await dialog.getByLabel("Amount (RM)").fill("1800");
    await dialog.getByLabel("Subcontractor").selectOption({ label: subName });
    await dialog.getByRole("button", { name: "Save cost" }).click();
    await expect(dialog).toBeHidden();
    await page.goto("/subcons");
    await page.getByRole("link").filter({ hasText: subName }).first().click();
    await page.waitForURL(/\/subcons\/[^/]+$/);
    await page.getByRole("button", { name: "Invite to app" }).click();
    const inviteUrl = (await page.getByTestId("invite-url").innerText()).trim();
    const signup = await visitor(browser);
    await signup.page.goto(inviteUrl);
    await signup.page.getByLabel("Choose a 6-digit PIN").fill(pin);
    await signup.page.getByLabel("Type the PIN again").fill(pin);
    await signup.page.getByRole("button", { name: "Start" }).click();
    await expect(signup.page).toHaveURL(/\/sub\/tasks$/);
    await signup.context.close();

    // ---- The timed journey: a fresh phone, no instructions, only what is on the screen. ----
    const phone = await visitor(browser);
    const p = phone.page;
    const started = Date.now();
    await p.goto("/login");
    await p.getByRole("button", { name: "Subcontractor? Use phone and PIN" }).click();
    await p.getByLabel("Phone number").fill(phoneLocal);
    await p.getByLabel("6-digit PIN").fill(pin);
    await p.getByRole("button", { name: "Sign in", exact: true }).click();

    // They see their work. (A tap before the page finished loading does nothing, so a person taps again; that time counts.)
    try {
      await expect(p).toHaveURL(/\/sub\/tasks$/, { timeout: 8000 });
    } catch {
      await p.getByRole("button", { name: "Sign in", exact: true }).click();
    }
    await expect(p).toHaveURL(/\/sub\/tasks$/);
    await expect(p.getByText("Paint the front gate")).toBeVisible();

    // They finish the job with a photo.
    await p.getByLabel("Photo for Paint the front gate").setInputFiles(png("gate.png"));
    await p.getByRole("button", { name: "Mark as done" }).click();
    await expect(p.getByRole("region", { name: "Done tasks" })).toContainText("Paint the front gate");

    // They see what they are owed.
    await expect(p.getByTestId("owed-headline")).toHaveText("You are owed RM 1,800.00 across 1 project.");
    const elapsed = (Date.now() - started) / 1000;
    console.log(`UNCLE TEST: ${elapsed.toFixed(1)} seconds from /login to seeing what they are owed`);
    expect(elapsed).toBeLessThan(90);

    await phone.context.close();
    await staff.context.close();
  });

  test("no button, field, tab or link on the subcontractor's screens is under 48px tall or squeezed within 8px of another", async ({ browser }) => {
    test.setTimeout(240_000);
    const stamp = Date.now();
    const phoneLocal = `014${String(stamp).slice(-7)}`;
    const pin = "246810";
    const subName = `Audit Sub ${stamp}`;
    const staff = await staffPage(browser);
    const page = staff.page;
    await page.goto("/subcons");
    await page.getByRole("button", { name: "+ New Subcontractor" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name", { exact: true }).fill(subName);
    await dialog.getByLabel("Contact (phone)").fill(phoneLocal);
    await dialog.getByLabel("Trade").fill("Tiling");
    await dialog.getByRole("button", { name: "Save subcontractor" }).click();
    await expect(dialog).toBeHidden();
    await page.goto("/projects");
    await createProject(page, `Audit job ${stamp}`, "10000");
    await page.getByRole("link").filter({ hasText: `Audit job ${stamp}` }).first().click();
    await page.waitForURL(/\/projects\/[^/]+$/);
    await addTask(page, { description: "Tile the bathroom", sub: subName, due: "2026-12-01" });
    await page.getByRole("tab", { name: "Punch List" }).click();
    await page.getByRole("button", { name: "+ Add Punch Item" }).first().click();
    const punch = page.getByRole("dialog");
    await punch.getByLabel("Location").fill("Bathroom");
    await punch.getByLabel("What needs fixing").fill("Chipped tile");
    await punch.getByLabel("Trade").selectOption("Tiling");
    await punch.getByLabel("Assign to").selectOption({ label: subName });
    await punch.getByRole("button", { name: "Save punch item" }).click();
    await expect(punch).toBeHidden();
    await page.goto("/subcons");
    await page.getByRole("link").filter({ hasText: subName }).first().click();
    await page.waitForURL(/\/subcons\/[^/]+$/);
    await page.getByRole("button", { name: "Invite to app" }).click();
    const inviteUrl = (await page.getByTestId("invite-url").innerText()).trim();

    const phone = await visitor(browser);
    const p = phone.page;
    const checked: Record<string, unknown[]> = {};
    const audit = async (label: string) => {
      const problems = await auditTouchTargets(p);
      if (problems.length) checked[label] = problems;
    };

    await p.goto(inviteUrl);
    await expect(p.getByLabel("Your name")).toBeVisible();
    await audit("join page");
    await p.getByLabel("Choose a 6-digit PIN").fill(pin);
    await p.getByLabel("Type the PIN again").fill(pin);
    await p.getByRole("button", { name: "Start" }).click();
    await expect(p).toHaveURL(/\/sub\/tasks$/);
    await expect(p.getByText("Tile the bathroom")).toBeVisible();
    await audit("tasks");
    await p.getByRole("link", { name: "Punch list" }).click();
    await expect(p.getByText("Chipped tile")).toBeVisible();
    await audit("punch list");
    await p.getByRole("link", { name: "Drawings" }).click();
    await expect(p).toHaveURL(/\/sub\/drawings$/);
    await audit("drawings");
    await p.getByRole("button", { name: "Add to timeline" }).click();
    await expect(p.getByRole("dialog")).toBeVisible();
    await audit("+ sheet");
    await p.getByRole("dialog").getByRole("button", { name: "Note", exact: true }).click();
    await p.getByRole("dialog").getByRole("button", { name: /Audit job/ }).click();
    await audit("note form");
    await p.keyboard.press("Escape");
    await p.getByRole("button", { name: "Sign out" }).click();
    await p.waitForURL(/\/login/);
    await audit("sign in");
    await p.getByRole("button", { name: "Subcontractor? Use phone and PIN" }).click();
    await audit("sign in with phone");

    expect(checked, `touch-target problems: ${JSON.stringify(checked, null, 2)}`).toEqual({});
    await phone.context.close();
    await staff.context.close();
  });
});
