// Renders the claim, quote and reminder letter for the seeded project to PDF using print CSS.
// Usage: BASE=http://localhost:3001 node scripts/print-verify.mjs
import { chromium } from "@playwright/test";

const base = process.env.BASE ?? "http://localhost:3001";
const out = "screenshots/print";
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();

await page.goto(`${base}/login`);
await page.getByLabel("Email").fill("boss@btb.my");
await page.getByLabel("Password").fill("btb12345");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL(/dashboard/);

// A quote for the seeded project's client.
await page.goto(`${base}/quotes/new`);
await page.getByLabel("Client name").fill("En. Hafiz");
await page.getByLabel("Project title").fill("Taman Desa Terrace Renovation - Phase 2 (Rear Extension)");
await page.getByLabel("Apply SST (6%)").check();
const lines = [
  ["Demolition and site clearing", "1", "lot", "4500.00"],
  ["Reinforced concrete slab, 150mm thick", "42.5", "m2", "185.50"],
  ["Brick wall, 1 brick thick, plastered both sides", "68", "m2", "92.00"],
  ["Supply and lay 600x600 homogeneous floor tiles", "42.5", "m2", "78.25"],
  ["Electrical points (13A socket and lighting)", "18", "nos", "145.00"],
];
for (let i = 0; i < lines.length; i++) {
  if (i > 0) await page.getByRole("button", { name: "+ Add line" }).click();
  await page.getByLabel("Description").nth(i).fill(lines[i][0]);
  await page.getByLabel("Qty").nth(i).fill(lines[i][1]);
  await page.getByLabel("Unit", { exact: true }).nth(i).fill(lines[i][2]);
  await page.getByLabel("Unit price (RM)").nth(i).fill(lines[i][3]);
}
await page.getByLabel("Notes / terms (optional)").fill("Prices exclude any hidden structural defects found after hacking.");
await page.getByRole("button", { name: "Save Quote" }).click();
await page.waitForURL((u) => /\/quotes\/[^/]+$/.test(u.pathname) && !u.pathname.endsWith("/new"));
const quoteId = page.url().split("/").pop();

// Claim 1 of the seeded project.
await page.goto(`${base}/projects`);
await page.getByRole("link", { name: /Taman Desa Terrace Renovation/ }).first().click();
await page.waitForURL(/\/projects\/[^/]+$/);
const projectId = page.url().split("/").pop();
await page.goto(`${base}/projects/${projectId}/claims`);
const claimHref = await page.getByRole("link", { name: "Print" }).first().getAttribute("href");

// Reminder for the same claim.
await page.goto(`${base}/receivables`);
const reminderHref = await page.getByRole("link", { name: "Generate Reminder" }).first().getAttribute("href");

const report = {};
for (const [name, path] of [
  ["claim", claimHref],
  ["quote", `/quotes/${quoteId}/print`],
  ["reminder", reminderHref],
]) {
  await page.goto(`${base}${path}`);
  await page.emulateMedia({ media: "print" });
  report[name] = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth,
    visibleChrome: [...document.querySelectorAll("header, nav, aside, button")].filter((e) => getComputedStyle(e).display !== "none").map((e) => e.tagName + ":" + (e.textContent || "").trim().slice(0, 30)),
  }));
  await page.pdf({ path: `${out}/${name}.pdf`, format: "A4", printBackground: true, margin: { top: "15mm", bottom: "15mm", left: "15mm", right: "15mm" } });
  await page.emulateMedia({ media: null });
}
console.log(JSON.stringify(report, null, 1));
await browser.close();
