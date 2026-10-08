import { chromium } from "@playwright/test";

const base = "http://localhost:3000";
const errors = [];
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
const page = await context.newPage();
page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(`${base}/login`);
await page.screenshot({ path: "screenshots/1-login.png" });
await page.getByLabel("Email").fill("boss@btb.my");
await page.getByLabel("Password").fill("btb12345");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL(/dashboard/);
await page.getByText("Bangsar Shop Lot Fit-Out").waitFor();
await page.screenshot({ path: "screenshots/2-dashboard.png", fullPage: true });

await page.getByRole("button", { name: "+ New Project" }).click();
await page.screenshot({ path: "screenshots/3-new-project-modal.png" });
await page.keyboard.press("Escape");

await page.getByRole("link").filter({ hasText: "Taman Desa Terrace" }).click();
await page.getByRole("tab", { name: "Cost Entries" }).waitFor();
await page.screenshot({ path: "screenshots/4-project-costs.png", fullPage: true });
await page.getByRole("button", { name: "+ Add Cost" }).first().click();
await page.screenshot({ path: "screenshots/5-add-cost-modal.png" });
await page.keyboard.press("Escape");
await page.getByRole("tab", { name: "Payments" }).click();
await page.screenshot({ path: "screenshots/6-payments.png", fullPage: true });
await page.getByRole("tab", { name: "Change Orders" }).click();
await page.screenshot({ path: "screenshots/7-change-orders.png", fullPage: true });

await page.goto(`${base}/projects`);
await page.screenshot({ path: "screenshots/8-projects.png", fullPage: true });
await page.goto(`${base}/settings`);
await page.screenshot({ path: "screenshots/9-settings.png", fullPage: true });

const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
await browser.close();
console.log(JSON.stringify({ errors, horizontalOverflow: overflow }, null, 2));
