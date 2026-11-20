// Walks the purchase flow in a phone-sized browser and saves a screenshot of
// each step to docs/screenshots/.
//
// Usage: start the app first (npm run dev, or npm run build && npm start),
// then:   node scripts/capture-screenshots.mjs [baseUrl]

import { mkdirSync } from "node:fs";
import { chromium, devices } from "@playwright/test";

const baseURL = process.argv[2] ?? "http://localhost:3000";
const outDir = "docs/screenshots";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices["iPhone 14"], baseURL });
const page = await context.newPage();

const shot = async (name, options = {}) => {
  await page.waitForLoadState("networkidle");
  // The header sticks to the top of the screen, so a full-page capture taken
  // part-way down would show it in the middle of the page.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: `${outDir}/${name}.png`, ...options });
  console.log(`saved ${outDir}/${name}.png`);
};

await page.goto("/");
await page.getByRole("heading", { name: "All pieces" }).waitFor();
await shot("01-home");

await page.getByRole("link", { name: "Buddhist Mala" }).click();
await page.getByRole("heading", { level: 1, name: "Buddhist Mala" }).waitFor();
await shot("02-category", { fullPage: true });

await page.getByRole("link", { name: /Sandalwood Prayer Mala/ }).click();
await page.getByRole("button", { name: "Add to bag" }).click();
await page.getByText("Added 1 to your bag.").waitFor();
await shot("03-product", { fullPage: true });

await page.goto("/products/minimal-wood-bead-bracelet");
await page.getByRole("button", { name: "Add to bag" }).click();
await page.getByText("Added 1 to your bag.").waitFor();
await page.getByRole("link", { name: "View bag" }).click();
await page.getByText("Estimated total").waitFor();
await shot("04-bag", { fullPage: true });

await page.getByRole("link", { name: "Checkout" }).click();
await page.getByLabel("Email").fill("mei.lin@example.com");
await page.getByLabel("Full name").fill("Mei Lin");
await page.getByLabel("Street address").fill("12 Orchard St");
await page.getByLabel("City").fill("Brooklyn");
await page.getByLabel("State").selectOption("NY");
await page.getByLabel("ZIP code").fill("11201");
await shot("05-checkout", { fullPage: true });

await page.getByRole("button", { name: "Continue to payment" }).click();
await page.getByRole("button", { name: /Card is declined/ }).click();
await page.getByRole("button", { name: /^Pay / }).click();
await page.getByText("The card was declined.").waitFor();
await shot("06-payment-declined", { fullPage: true });

await page.getByRole("button", { name: /Payment succeeds/ }).click();
await shot("07-payment", { fullPage: true });
await page.getByRole("button", { name: /^Pay / }).click();
await page.getByRole("heading", { name: /Your order is confirmed/ }).waitFor();
await shot("08-confirmation", { fullPage: true });

// One wide view, to show the layout is responsive rather than phone-only.
const desktop = await browser.newContext({
  viewport: { width: 1280, height: 860 },
  baseURL,
});
const wide = await desktop.newPage();
await wide.goto("/");
await wide.getByRole("heading", { name: "All pieces" }).waitFor();
await wide.waitForLoadState("networkidle");
await wide.screenshot({ path: `${outDir}/09-desktop-home.png` });
console.log(`saved ${outDir}/09-desktop-home.png`);

await browser.close();
