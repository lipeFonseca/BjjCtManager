import { chromium } from "playwright";

const baseUrl = "https://413f5c96.bjjctmanager.pages.dev";
const accounts = [
  { role: "mestre", username: "qa.mestre", password: "QAMestre123!", ct: "TFTeam" },
  { role: "aluno", username: "qa.aluno", password: "QAAluno123!", ct: "TFTeam" },
];

const browser = await chromium.launch({ headless: true });
const results = [];

for (const account of accounts) {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.locator("#username").fill(account.username);
  await page.locator("#password").fill(account.password);
  await page.locator("#ct").fill(account.ct);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((url) => url.toString().includes("/dashboard"), { timeout: 60000 });
  await page.waitForTimeout(12000);
  const bodyText = await page.locator("body").innerText();
  results.push({
    role: account.role,
    finalUrl: page.url(),
    bodyText,
  });
  await page.close();
}

await browser.close();
console.log(JSON.stringify({ results }, null, 2));
