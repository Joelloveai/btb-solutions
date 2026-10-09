// Screenshots of every page at phone (375) and desktop (1440) width.
// Usage: BASE=http://localhost:3000 OUT=screenshots/enterprise-v2 node scripts/screenshots.mjs
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const base = process.env.BASE ?? "http://localhost:3000";
const out = process.env.OUT ?? "screenshots/enterprise-v2";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const sizes = [
  { tag: "375", width: 375, height: 812 },
  { tag: "1440", width: 1440, height: 900 },
];

async function login(page) {
  await page.goto(`${base}/login`);
  await page.getByLabel("Email").fill("boss@btb.my");
  await page.getByLabel("Password").fill("btb12345");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/dashboard/);
}

for (const size of sizes) {
  const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const shot = async (name) => {
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${out}/${name}-${size.tag}.png`, fullPage: true });
  };

  await page.goto(`${base}/login`);
  await shot("01-login");
  await login(page);
  await shot("02-dashboard");

  await page.getByRole("button", { name: "+ New Project" }).first().click();
  await page.waitForTimeout(400);
  await shot("03-new-project-dialog");
  await page.keyboard.press("Escape");

  await page.goto(`${base}/projects`);
  await shot("04-projects");

  await page.goto(`${base}/projects`);
  const href = await page.getByRole("link", { name: /Taman Desa Terrace Renovation/ }).first().getAttribute("href");
  const projectUrl = `${base}${href}`;
  await page.goto(projectUrl);
  await shot("05-project-costs");
  for (const [i, tab] of ["Payments", "Change Orders", "BOQ"].entries()) {
    await page.getByRole("tab", { name: tab }).click();
    await shot(`0${6 + i}-project-${tab.toLowerCase().replace(" ", "-")}`);
  }
  await page.getByRole("tab", { name: "Costs" }).click();
  await page.getByRole("button", { name: "+ Add Cost" }).first().click();
  await page.waitForTimeout(400);
  await shot("09-add-cost-dialog");
  await page.keyboard.press("Escape");

  await page.goto(`${projectUrl}/claims`);
  await shot("10-claims");
  const claimHref = await page.getByRole("link", { name: "Print" }).first().getAttribute("href");

  await page.goto(`${base}/quotes`);
  await shot("11-quotes");
  await page.goto(`${base}/quotes/new`);
  await shot("12-quote-new");
  await page.goto(`${base}/quotes`);
  await page.getByRole("link", { name: /Q-0001/ }).first().click();
  await page.waitForURL(/\/quotes\/[^/]+$/);
  await shot("13-quote-detail");

  await page.goto(`${base}/receivables`);
  await shot("14-receivables");
  await page.goto(`${base}/subcons`);
  await shot("15-subcons");
  await page.getByRole("link").filter({ hasText: "Ah Seng Electrical" }).first().click();
  await page.waitForURL(/\/subcons\/[^/]+$/);
  await shot("16-subcon-detail");
  await page.goto(`${base}/clients`);
  await shot("17-clients");
  await page.goto(`${base}/settings`);
  await shot("18-settings");

  if (size.tag === "1440") {
    for (const [name, url] of [["claim", `${base}${claimHref}`]]) {
      await page.goto(url);
      await shot(`19-print-${name}-screen`);
    }
  }
  await ctx.close();
}
await browser.close();
console.log("screenshots written to", out);
