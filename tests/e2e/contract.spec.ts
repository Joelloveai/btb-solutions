import { expect, test } from "@playwright/test";
import { createProject } from "./helpers";
import { staffPage } from "./portal-helpers";

const ymd = (offset: number) => {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date()).split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + offset)).toISOString().slice(0, 10);
};

test("a project has contract details, a milestone timeline you can complete and delete, and a team", async ({ browser }) => {
  test.setTimeout(180_000);
  const stamp = Date.now();
  const staff = await staffPage(browser);
  const page = staff.page;
  const name = `Contract ${stamp}`;
  await createProject(page, name, "250000");
  await page.getByRole("link").filter({ hasText: name }).first().click();
  await page.waitForURL(/\/projects\/[^/]+$/);
  const projectId = page.url().split("/").pop();
  await page.getByRole("tab", { name: "Contract", exact: true }).click();

  // Contract particulars.
  await page.getByRole("button", { name: "Edit details" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Project type").selectOption("COMMERCIAL");
  await dialog.getByLabel("Contract type").selectOption("BQ_BASED");
  await dialog.getByLabel("Site address").fill("Lot 12, Jalan Ampang, 50450 Kuala Lumpur");
  await dialog.getByLabel("Contract end date").fill(ymd(180));
  await dialog.locator("summary").click();
  await dialog.getByLabel("CIDB grade").selectOption("G5");
  await dialog.getByLabel("Architect").fill("Ar. Lim");
  await dialog.getByLabel("Site latitude (for weather)").fill("3.139");
  await dialog.getByLabel("Site longitude (for weather)").fill("101.6869");
  await dialog.getByRole("button", { name: "Save contract details" }).click();
  await expect(dialog).toBeHidden();
  const facts = page.getByTestId("contract-facts");
  await expect(facts).toContainText("Commercial");
  await expect(facts).toContainText("Bill of quantities");
  await expect(facts).toContainText("G5");
  await expect(facts).toContainText("Defects liability365 days");
  await expect(facts).toContainText("3.139, 101.6869");

  // Bad GPS is refused.
  await page.getByRole("button", { name: "Edit details" }).click();
  dialog = page.getByRole("dialog");
  await dialog.locator("summary").click();
  await dialog.getByLabel("Site latitude (for weather)").fill("95");
  await dialog.getByRole("button", { name: "Save contract details" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Latitude must be between");
  await dialog.getByRole("button", { name: "Close" }).click();

  // Milestones: one already late, one in the future that triggers a payment.
  for (const m of [
    { name: "Foundation poured", due: ymd(-5), weight: "40", pay: false },
    { name: "Roof on", due: ymd(60), weight: "60", pay: true },
  ]) {
    await page.getByRole("button", { name: "+ Add Milestone" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Milestone").fill(m.name);
    await dialog.getByLabel("Due date").fill(m.due);
    await dialog.getByLabel("Share of the job (%)").fill(m.weight);
    if (m.pay) {
      await dialog.getByLabel("Reaching it triggers a payment claim").check();
      await dialog.getByRole("button", { name: "Save milestone" }).click();
      await expect(dialog.getByRole("alert")).toContainText("Enter the payment amount");
      await dialog.getByLabel("Payment amount (RM)").fill("75000");
    }
    await dialog.getByRole("button", { name: "Save milestone" }).click();
    await expect(dialog).toBeHidden();
  }
  const foundation = page.getByTestId("milestone").filter({ hasText: "Foundation poured" });
  const roof = page.getByTestId("milestone").filter({ hasText: "Roof on" });
  await expect(foundation).toHaveAttribute("data-status", "DELAYED");
  await expect(foundation).toContainText("Late");
  await expect(roof).toHaveAttribute("data-status", "PENDING");
  await expect(roof).toContainText("Triggers a payment claim: RM 75,000.00");
  await expect(page.getByTestId("milestone-progress")).toContainText("0% of the job done");

  // Complete the late one: 40% of the job is done.
  await foundation.getByRole("button", { name: "Mark done" }).click();
  await expect(foundation).toHaveAttribute("data-status", "COMPLETED");
  await expect(page.getByTestId("milestone-progress")).toContainText("40% of the job done");

  // Delete the other; the timeline keeps a record of it.
  await roof.getByRole("button", { name: /Delete milestone Roof on/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByTestId("milestone")).toHaveCount(1);

  // Team.
  await page.getByRole("button", { name: "+ Add Team Member" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Person").selectOption({ index: 1 });
  await dialog.getByLabel("Role on this project").selectOption("PROJECT_MANAGER");
  await dialog.getByRole("button", { name: "Add to team" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("team")).toContainText("Project manager");

  // Everything is on the timeline, and the chain holds.
  await page.getByRole("tab", { name: "Timeline" }).click();
  for (const text of ["Milestone set: Foundation poured", "Milestone reached: Foundation poured", "Milestone removed: Roof on", "Contract details updated", "joined the project team"]) {
    await expect(page.getByTestId("timeline-event").filter({ hasText: text }).first()).toBeVisible();
  }
  expect((await (await page.request.get(`/api/projects/${projectId}/timeline/verify`)).json()).ok).toBe(true);
  await staff.context.close();
});
