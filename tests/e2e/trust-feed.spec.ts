import { expect, test, type Page } from "@playwright/test";
import { PASSWORD, addPortalLogin, addTask, createClientProject, png, staffPage, visitor } from "./portal-helpers";

const ymd = (offset = 0) => {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date()).split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + offset)).toISOString().slice(0, 10);
};

async function forClient(page: Page) {
  await page.getByRole("tab", { name: "For Client" }).click();
}

test("homeowner trust feed: today, next milestone, decisions, payments and the Sunday summary; questions and approvals reach the timeline", async ({ browser }) => {
  test.setTimeout(240_000);
  const stamp = Date.now();
  const staff = await staffPage(browser);
  const page = staff.page;
  const projectUrl = await createClientProject(page, `Feed ${stamp}`, `Client F ${stamp}`);
  const projectId = projectUrl.split("/").pop();
  const email = `feed-${stamp}@example.test`;
  await addPortalLogin(page, email);

  // A milestone, today's photo and note, a change order sent for approval, a selection, a payment instalment.
  await addTask(page, { description: "Tiling complete", milestone: true, due: ymd(9) });
  await page.getByRole("tab", { name: "Progress Photos" }).click();
  const photos = page.getByRole("region", { name: "Progress photos" });
  await photos.locator("input[type=file]").setInputFiles(png("rebar.png"));
  await photos.getByRole("button", { name: "Upload photo" }).click();
  await expect(page.getByText("Photo uploaded")).toBeVisible();
  await forClient(page);
  await page.getByRole("region", { name: "Daily log" }).getByRole("button", { name: "+ Add daily log" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Day").fill(ymd());
  await dialog.getByLabel("What happened on site").fill("Wall tiles delivered and checked");
  await dialog.getByRole("button", { name: "Save daily log" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("region", { name: "Product selections" }).getByRole("button", { name: "+ Add selection" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Product", { exact: true }).fill("Oak floor 12mm");
  await dialog.getByLabel("Photo of the product").setInputFiles(png("oak.png"));
  await dialog.getByRole("button", { name: "Save selection" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("region", { name: "Payment schedule" }).getByRole("button", { name: "+ Add instalment" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Instalment").fill("Deposit");
  await dialog.getByLabel("Percent of total").fill("20");
  await dialog.getByLabel("Due date (optional)").fill(ymd(5));
  await dialog.getByRole("button", { name: "Save instalment" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("tab", { name: "Change Orders" }).click();
  await page.getByRole("button", { name: "+ Add Change Order" }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Description").fill("Extra power points");
  await dialog.getByLabel(/Amount \(RM\)/).fill("1500");
  await dialog.getByRole("button", { name: "Save change order" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Send to client" }).click();
  await expect(page.getByText("Sent to the client for approval")).toBeVisible();

  // The homeowner signs in and lands on the feed.
  const client = await visitor(browser);
  const c = client.page;
  await c.goto("/client/login");
  await c.getByLabel("Email").fill(email);
  await c.getByLabel("Password").fill(PASSWORD);
  await c.getByRole("button", { name: "Sign in" }).click();
  await expect(c).toHaveURL(/\/client\/projects$/);
  const feed = c.getByTestId("feed");
  await expect(feed.getByTestId("feed-decisions")).toContainText("Needs your decision (2)");
  await expect(feed.getByTestId("feed-today")).toContainText("Wall tiles delivered and checked");
  await expect(feed.getByTestId("feed-today-photos").locator("img")).toHaveCount(1);
  await expect(feed.getByTestId("feed-next")).toContainText("Tiling complete");
  await expect(feed.getByTestId("feed-payments")).toContainText("Next: Deposit");
  await expect(feed.getByTestId("feed-digest")).toContainText(/This week: \d+ photos?, \d+ tasks? completed\. Next week: .*\./);
  expect(await feed.getByRole("link", { name: /Share on WhatsApp/ }).getAttribute("href")).toMatch(/^https:\/\/wa\.me\/\?text=/);
  // Plain words only: no cost, claim or profit language, and no way to Reject here.
  await expect(feed).not.toContainText(/profit|claim|cost|subcontract/i);

  // It is quick: measured on a warm page.
  await c.reload();
  const loaded = await c.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    return nav.domContentLoadedEventEnd - nav.startTime;
  });
  expect(loaded).toBeLessThan(1000);

  // Ask a question about the change order; the staff reply appears under it.
  const order = c.getByTestId("feed-approval").filter({ hasText: "Extra power points" });
  await order.getByRole("button", { name: "Ask a Question" }).click();
  await c.getByRole("dialog").getByLabel("Your question").fill("Is this price for supply and install?");
  await c.getByRole("dialog").getByRole("button", { name: "Send question" }).click();
  await expect(c.getByText("Sent. We will reply here.")).toBeVisible();
  await expect(order.getByRole("list", { name: "Your messages about this" })).toContainText("You: Is this price for supply and install?");

  await page.reload();
  await forClient(page);
  const msg = page.getByTestId("message-row").filter({ hasText: "supply and install" });
  await expect(msg).toContainText('asked about change order "Extra power points"');
  await msg.getByRole("button", { name: "Reply" }).click();
  await page.getByRole("dialog").getByLabel("Your reply").fill("Yes, supply and install, including the wiring.");
  await page.getByRole("dialog").getByRole("button", { name: "Send reply" }).click();
  await expect(page.getByText("Reply sent")).toBeVisible();
  await c.reload();
  await expect(c.getByTestId("feed-approval").filter({ hasText: "Extra power points" })).toContainText("BTB Builders: Yes, supply and install, including the wiring.");

  // Approve the selection from the feed: recorded, and gone from the decisions.
  const oak = c.getByTestId("feed-approval").filter({ hasText: "Oak floor 12mm" });
  await expect(oak.locator("img")).toBeVisible();
  await oak.getByRole("button", { name: "Approve" }).click();
  await c.getByRole("dialog").getByRole("button", { name: "Yes, approve" }).click();
  await expect(c.getByTestId("feed-decisions")).toContainText("Needs your decision (1)");

  // Everything is on the timeline, and the chain still holds.
  await page.reload();
  await expect(page.getByTestId("timeline-event").filter({ hasText: 'Client asked a question about change order "Extra power points"' })).toBeVisible();
  await expect(page.getByTestId("timeline-event").filter({ hasText: "Replied to the client" })).toBeVisible();
  await expect(page.getByTestId("timeline-event").filter({ hasText: "Client approved a product selection" })).toBeVisible();
  await expect(page.getByTestId("timeline-event").filter({ hasText: "Weekly summary ready for the client" })).toBeVisible();
  expect((await (await page.request.get(`/api/projects/${projectId}/timeline/verify`)).json()).ok).toBe(true);

  await client.context.close();
  await staff.context.close();
});
