import { expect, test, type Page } from "@playwright/test";
import { createProject } from "./helpers";
import { staffPage, visitor } from "./portal-helpers";

async function addSubCost(page: Page, project: string, sub: string, description: string, amount: string) {
  await page.goto("/projects");
  await page.getByRole("link").filter({ hasText: project }).first().click();
  await page.waitForURL(/\/projects\/[^/]+$/);
  await page.getByRole("tab", { name: "Costs" }).click();
  await page.getByRole("button", { name: "+ Add Cost" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Category").selectOption("SUBCON");
  await dialog.getByLabel("Description").fill(description);
  await dialog.getByLabel("Amount (RM)").fill(amount);
  await dialog.getByLabel("Subcontractor").selectOption({ label: sub });
  await dialog.getByRole("button", { name: "Save cost" }).click();
  await expect(dialog).toBeHidden();
}

async function pinLogin(page: Page, phone: string, pin: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Subcontractor? Use phone and PIN" }).click();
  await page.getByLabel("Phone number").fill(phone);
  await page.getByLabel("6-digit PIN").fill(pin);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("subcontractor invite link + PIN: invite, sign up, sign in, lockout, and what they are owed", async ({ browser }) => {
  test.setTimeout(240_000);
  const stamp = Date.now();
  const phoneLocal = `012${String(stamp).slice(-7)}`; // e.g. 0123456789
  const subName = `Pipe Pro ${stamp}`;
  const staff = await staffPage(browser);
  const page = staff.page;

  // The contractor's subcontractor record, with a phone number.
  await page.goto("/subcons");
  await page.getByRole("button", { name: "+ New Subcontractor" }).first().click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill(subName);
  await dialog.getByLabel("Contact (phone)").fill(phoneLocal.replace(/^(\d{3})(\d+)$/, "$1-$2"));
  await dialog.getByLabel("Trade").fill("Plumbing");
  await dialog.getByRole("button", { name: "Save subcontractor" }).click();
  await expect(dialog).toBeHidden();

  // Two projects, three costs for them: 3,000 + 500 unpaid, 1,000 paid.
  await page.goto("/projects");
  await createProject(page, `Owed A ${stamp}`, "50000");
  await createProject(page, `Owed B ${stamp}`, "50000");
  await addSubCost(page, `Owed A ${stamp}`, subName, "Pipes level 1", "3000");
  await addSubCost(page, `Owed A ${stamp}`, subName, "Pipes level 2", "1000");
  await addSubCost(page, `Owed B ${stamp}`, subName, "Bathroom rough-in", "500");
  await page.goto("/subcons");
  await page.getByRole("link").filter({ hasText: subName }).first().click();
  await page.waitForURL(/\/subcons\/[^/]+$/);
  const subUrl = page.url();
  await page.getByTestId("sub-balance").waitFor();
  await page.getByRole("button", { name: "Mark as Paid" }).last().click(); // the oldest listed cost
  await page.getByRole("dialog").getByRole("button", { name: "Confirm paid" }).click();
  await expect(page.getByText(/Paid \d/)).toBeVisible();
  const paidText = await page.getByTestId("sub-paid").innerText();
  const paidAmount = Number(paidText.replace(/[^\d.]/g, ""));
  expect([500, 1000, 3000]).toContain(paidAmount);
  const expectedOwed = `RM ${(4500 - paidAmount).toLocaleString("en-MY", { minimumFractionDigits: 2 })}`;
  await expect(page.getByTestId("sub-balance")).toHaveText(expectedOwed);

  // 1) Invite generation: a one-time link and a ready WhatsApp message.
  await page.getByRole("button", { name: "Invite to app" }).click();
  const url = (await page.getByTestId("invite-url").innerText()).trim();
  expect(url).toMatch(/\/join\/[a-f0-9]{48}$/);
  const wa = await page.getByRole("link", { name: "Send on WhatsApp" }).getAttribute("href");
  expect(wa).toContain(`https://wa.me/60${phoneLocal.slice(1)}?text=`);
  expect(decodeURIComponent(wa!)).toContain(url);

  // 2) Sign-up from the link: name is pre-filled, no email, PINs must match.
  const phoneVisitor = await visitor(browser);
  const p = phoneVisitor.page;
  await p.goto(url);
  await expect(p.getByLabel("Your name")).toHaveValue(subName);
  await expect(p.getByText(`+60${phoneLocal.slice(1)}`)).toBeVisible();
  await expect(p.getByLabel("Email")).toHaveCount(0);
  await p.getByLabel("Choose a 6-digit PIN").fill("482915");
  await p.getByLabel("Type the PIN again").fill("482916");
  await p.getByRole("button", { name: "Start" }).click();
  await expect(p.locator("main [role=alert]")).toHaveText("The two PINs do not match");
  await p.getByLabel("Type the PIN again").fill("482915");
  await p.getByRole("button", { name: "Start" }).click();
  await expect(p).toHaveURL(/\/sub\/tasks$/);

  // 3) The value moment: what they are owed, across both projects.
  const stillOwedProjects = paidAmount === 500 ? 1 : 2; // B's only cost was the one paid
  await expect(p.getByTestId("owed-headline")).toHaveText(`You are owed ${expectedOwed} across ${stillOwedProjects} ${stillOwedProjects === 1 ? "project" : "projects"}.`);
  await expect(p.getByTestId("owed-project")).toHaveCount(stillOwedProjects);

  // The link works once.
  const again = await visitor(browser);
  await again.page.goto(url);
  await expect(again.page.locator("main [role=alert]")).toContainText("expired or was already used");
  await again.context.close();

  // The contractor's page now shows they have joined, and no second invite.
  await page.goto(subUrl);
  await expect(page.getByRole("button", { name: "Invite to app" })).toHaveCount(0);
  await expect(page.getByText(`+60${phoneLocal.slice(1)} (phone + PIN)`)).toBeVisible();

  // 4) Returning login with the PIN (a fresh phone), in either phone format.
  const returning = await visitor(browser);
  await pinLogin(returning.page, phoneLocal, "482915");
  await expect(returning.page).toHaveURL(/\/sub\/tasks$/);
  await expect(returning.page.getByTestId("owed-headline")).toContainText("You are owed");
  await returning.context.close();

  // 5) Rate limit: five wrong PINs lock the number for 15 minutes, even for the right PIN.
  const attacker = await visitor(browser);
  const a = attacker.page;
  for (let i = 1; i <= 4; i++) {
    await pinLogin(a, phoneLocal, `00000${i}`);
    await expect(a.getByText("Wrong phone number or PIN")).toBeVisible();
    await a.reload();
  }
  await pinLogin(a, phoneLocal, "000009");
  await expect(a.getByText("Too many tries. Please wait 15 minutes, then try again.")).toBeVisible();
  await a.reload();
  await pinLogin(a, phoneLocal, "482915");
  await expect(a.getByText("Too many tries. Please wait 15 minutes, then try again.")).toBeVisible();
  await expect(a).toHaveURL(/\/login/);
  await attacker.context.close();

  await phoneVisitor.context.close();
  await staff.context.close();
});
