import { expect, test, type Page } from "@playwright/test";
import { createProject } from "./helpers";
import { staffPage } from "./portal-helpers";

const ymd = (offset: number) => {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date()).split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + offset)).toISOString().slice(0, 10);
};

async function addBoqLine(page: Page, line: { description: string; qty: string; unit: string; rate: string; section?: string; code?: string }) {
  await page.getByRole("button", { name: "+ Add BOQ Line" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Description").fill(line.description);
  await dialog.getByLabel("Qty").fill(line.qty);
  await dialog.getByLabel("Unit").fill(line.unit);
  await dialog.getByLabel("Rate (RM)").fill(line.rate);
  if (line.section || line.code) {
    await dialog.locator("summary").click();
    if (line.section) await dialog.getByLabel("Section").selectOption({ label: line.section });
    if (line.code) await dialog.getByLabel("Item number").fill(line.code);
  }
  await dialog.getByRole("button", { name: "Save BOQ line" }).click();
  await expect(dialog).toBeHidden();
}

test("BOQ progress becomes a numbered claim, which is certified, ages into CIPAA notices, and shows on receivables and the retention tracker", async ({ browser }) => {
  test.setTimeout(240_000);
  const stamp = Date.now();
  const staff = await staffPage(browser);
  const page = staff.page;
  const name = `Cipaa Claim ${stamp}`;
  await createProject(page, name, "200000");
  await page.getByRole("link").filter({ hasText: name }).first().click();
  await page.waitForURL(/\/projects\/[^/]+$/);
  const projectUrl = page.url();
  const projectId = projectUrl.split("/").pop();

  // BOQ with a section, item numbers and progress.
  await page.getByRole("tab", { name: "BOQ", exact: true }).click();
  await page.getByRole("button", { name: "+ Add Section" }).click();
  await page.getByRole("dialog").getByLabel("Section name").fill("Substructure");
  await page.getByRole("dialog").getByRole("button", { name: "Save section" }).click();
  await expect(page.getByTestId("boq-section")).toContainText("Substructure");
  await addBoqLine(page, { description: "Bored piling", qty: "10", unit: "nos", rate: "5000", section: "Substructure", code: "A.1" });
  await addBoqLine(page, { description: "Ground slab", qty: "100", unit: "m2", rate: "400", section: "Substructure", code: "A.2" });
  await expect(page.getByTestId("boq-section")).toContainText("RM 90,000.00"); // section total = sum of its lines
  const piling = page.locator("tr").filter({ hasText: "Bored piling" });
  await expect(piling).toContainText("A.1");
  await expect(piling.getByTestId("boq-progress")).toContainText("0% done");
  await piling.getByRole("button", { name: /Update progress/ }).click();
  await page.getByRole("dialog").getByLabel(/Done so far/).fill("11");
  await page.getByRole("dialog").getByRole("button", { name: "Save progress" }).click();
  await expect(page.getByRole("dialog").getByText(/only 10 nos in the contract/)).toBeVisible();
  await page.getByRole("dialog").getByLabel(/Done so far/).fill("4");
  await page.getByRole("dialog").getByRole("button", { name: "Save progress" }).click();
  await expect(piling.getByTestId("boq-progress")).toContainText("40% done");
  const slab = page.locator("tr").filter({ hasText: "Ground slab" });
  await slab.getByRole("button", { name: /Update progress/ }).click();
  await page.getByRole("dialog").getByLabel(/Done so far/).fill("50");
  await page.getByRole("dialog").getByRole("button", { name: "Save progress" }).click();
  await expect(slab.getByTestId("boq-progress")).toContainText("50% done");

  // A claim dated 40 days ago, billing the BOQ progress (4 x 5,000 + 50 x 400 = 40,000) plus materials on site.
  await page.getByRole("link", { name: "Progress Claims" }).click();
  await page.getByRole("button", { name: "+ Issue Claim" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Claim date").fill(ymd(-40));
  await dialog.getByRole("button", { name: "Bill the BOQ progress: RM 40,000.00" }).click();
  await expect(dialog.getByLabel("Work done this period (RM)")).toHaveValue("40000.00");
  await dialog.locator("summary").click();
  await dialog.getByLabel("Period from").fill(ymd(-70));
  await dialog.getByLabel("Period to").fill(ymd(-41));
  await dialog.getByLabel(/Materials on site/).fill("1000");
  await expect(dialog.getByText("Net claim")).toBeVisible();
  await dialog.getByRole("button", { name: "Issue claim" }).click();
  await expect(dialog).toBeHidden();

  // Numbered, with retention of 5% of 41,000 held, and BOQ billed once only.
  const row = page.getByRole("row").filter({ hasText: "No. 1" });
  await expect(row).toContainText(/[A-Z0-9]+\/\d{4}\/CLM\/001/);
  await expect(row).toContainText("RM 38,950.00");
  await expect(page.getByTestId("tracker-held")).toHaveText("RM 2,050.00");
  await expect(page.getByTestId("tracker-outstanding")).toHaveText("RM 2,050.00");
  await page.getByRole("button", { name: "+ Issue Claim" }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: /Bill the BOQ progress/ })).toHaveCount(0); // nothing new to bill
  await dialog.getByRole("button", { name: "Close" }).click();

  // The claim page: line items, status and the CIPAA clock.
  await row.getByRole("link").first().click();
  await expect(page.getByTestId("claim-number")).toContainText(/\/CLM\/001$/);
  await expect(page.getByTestId("claim-status")).toHaveText("Submitted");
  await expect(page.getByTestId("claim-lines")).toContainText("Bored piling");
  await expect(page.getByTestId("claim-lines")).toContainText("RM 20,000.00");
  await expect(page.getByTestId("cipaa-countdown")).toContainText("40 days since the claim date");
  await expect(page.getByTestId("cipaa-countdown")).toContainText("Notice of adjudication in 20 days");
  const claimId = page.url().split("/").pop()!;
  await expect(page.getByRole("link", { name: "Payment response notice" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Notice of adjudication" })).toHaveCount(0); // not until 60 days
  const notice = await page.request.get(`/api/claims/${claimId}/notice?type=payment-response`);
  expect(notice.status()).toBe(200);
  expect(notice.headers()["content-type"]).toBe("application/pdf");
  expect((await notice.body()).subarray(0, 5).toString()).toBe("%PDF-");
  expect((await page.request.get(`/api/claims/${claimId}/notice?type=adjudication`)).status()).toBe(409);

  // Certify, dispute and undo.
  await page.getByRole("button", { name: "Certify claim" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Amount certified (RM)").fill("38000.00");
  await dialog.getByLabel("Certified by").fill("QS Ahmad");
  await dialog.getByRole("button", { name: "Save certificate" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("claim-status")).toHaveText("Certified");
  await expect(page.getByTestId("claim-certificate")).toContainText("Certified RM 38,000.00 by QS Ahmad");
  const cert = await page.request.get(`/api/claims/${claimId}/certificate`);
  expect(cert.status()).toBe(200);
  expect((await cert.body()).subarray(0, 5).toString()).toBe("%PDF-");
  await page.getByRole("button", { name: "Mark as disputed" }).click();
  await expect(page.getByTestId("claim-status")).toHaveText("Disputed");
  await page.getByRole("button", { name: "Not disputed any more" }).click();
  await expect(page.getByTestId("claim-status")).toHaveText("Certified");

  // Receivables: aged 31-60 days, with the countdown.
  await page.goto("/receivables");
  await expect(page.getByTestId("aging-31-60")).toContainText("RM 38,950.00");
  await expect(page.getByTestId("aging-0-30")).toContainText("RM 0.00");
  await expect(page.getByTestId("cipaa-countdown").filter({ hasText: "Notice of adjudication in 20 days" }).first()).toBeVisible();

  // Variation orders: an omission typed as a positive amount is stored as a deduction; a time extension has no money.
  await page.goto(projectUrl);
  await page.getByRole("tab", { name: "Change Orders" }).click();
  for (const vo of [
    { description: "Omit the gate", amount: "2000", type: "OMISSION" },
    { description: "Rain delay", amount: "", type: "TIME_EXTENSION" },
  ]) {
    await page.getByRole("button", { name: "+ Add Change Order" }).first().click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Description").fill(vo.description);
    await dialog.locator("summary").click();
    await dialog.getByLabel("Type of variation").selectOption(vo.type);
    if (vo.type === "TIME_EXTENSION") {
      await dialog.getByRole("button", { name: "Save change order" }).click();
      await expect(dialog.getByRole("alert").or(dialog.getByText("Enter how many days are added"))).toBeVisible();
      await dialog.getByLabel("Days added to the contract").fill("14");
    } else await dialog.getByLabel(/Amount \(RM\)/).fill(vo.amount);
    await dialog.getByRole("button", { name: "Save change order" }).click();
    await expect(dialog).toBeHidden();
  }
  await expect(page.getByTestId("vo-number").first()).toHaveText(/VO-00[12]/);
  await expect(page.getByTestId("vo-count")).toHaveText("2");
  for (const d of ["Omit the gate", "Rain delay"]) {
    await page.locator("tr").filter({ hasText: d }).getByRole("button", { name: "Approve" }).click();
    await expect(page.locator("tr").filter({ hasText: d })).toContainText("approved by");
  }
  await expect(page.getByTestId("vo-omissions")).toHaveText("-RM 2,000.00");
  await expect(page.getByTestId("vo-net")).toHaveText("-RM 2,000.00");
  await expect(page.getByTestId("vo-days")).toHaveText("14 days");

  // All on the timeline, chain intact.
  await page.getByRole("tab", { name: "Timeline" }).click();
  for (const text of [/certified: RM 38,000.00/, /disputed/, /Payment response notice prepared/, /BOQ progress: Bored piling is 40% done/, /BOQ section added: Substructure/]) {
    await expect(page.getByTestId("timeline-event").filter({ hasText: text }).first()).toBeVisible();
  }
  expect((await (await page.request.get(`/api/projects/${projectId}/timeline/verify`)).json()).ok).toBe(true);
  await staff.context.close();
});
