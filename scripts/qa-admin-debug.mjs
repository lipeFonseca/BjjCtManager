import { chromium } from "playwright";

const baseUrl = "https://413f5c96.bjjctmanager.pages.dev";
const events = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on("console", (msg) => {
  events.push({ type: "console", level: msg.type(), text: msg.text() });
});

page.on("pageerror", (error) => {
  events.push({ type: "pageerror", text: error.message });
});

page.on("requestfailed", (request) => {
  events.push({
    type: "requestfailed",
    url: request.url(),
    method: request.method(),
    failure: request.failure()?.errorText || null,
  });
});

await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle", timeout: 60000 });
await page.locator("#username").fill("admin");
await page.locator("#password").fill("QAAdmin123!");
await page.getByRole("button", { name: "Entrar" }).click();
await page.waitForURL((url) => url.toString().includes("/dashboard"), { timeout: 60000 });
await page.waitForTimeout(15000);

const bodyText = await page.locator("body").innerText();
const screenshotPath = "tmp_admin_dashboard_debug.png";
await page.screenshot({ path: screenshotPath, fullPage: true });

await browser.close();

console.log(JSON.stringify({ finalUrl: page.url(), bodyText, events, screenshotPath }, null, 2));
