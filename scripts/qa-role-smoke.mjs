import { chromium } from "playwright";

const baseUrl = process.env.QA_BASE_URL || "https://413f5c96.bjjctmanager.pages.dev";

const accounts = [
  {
    role: "admin",
    username: "admin",
    password: "QAAdmin123!",
    ct: "",
    expectedUrlPart: "/dashboard",
    expectedText: "ACADEMIA",
    extraCheck: {
      path: "/admin/financeiro",
      expectedText: "Financeiro",
      expectAllowed: true,
    },
  },
  {
    role: "mestre",
    username: "qa.mestre",
    password: "QAMestre123!",
    ct: "TFTeam",
    expectedUrlPart: "/dashboard",
    expectedText: "PAINEL DO CT",
    extraCheck: {
      path: "/admin/financeiro",
      expectedUrlPart: "/dashboard",
      expectAllowed: false,
    },
  },
  {
    role: "aluno",
    username: "qa.aluno",
    password: "QAAluno123!",
    ct: "TFTeam",
    expectedUrlPart: "/dashboard",
    expectedText: "ÁREA DO ALUNO",
    extraCheck: {
      path: "/admin/financeiro",
      expectedUrlPart: "/dashboard",
      expectAllowed: false,
    },
  },
];

const results = [];

const run = async () => {
  const browser = await chromium.launch({ headless: true });

  try {
    for (const account of accounts) {
      const page = await browser.newPage();
      const roleResult = {
        role: account.role,
        loginOk: false,
        expectedTextFound: false,
        extraCheckOk: null,
        finalUrl: null,
        error: null,
      };

      try {
        await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle", timeout: 60000 });
        await page.locator("#username").fill(account.username);
        await page.locator("#password").fill(account.password);
        if (account.ct) {
          await page.locator("#ct").fill(account.ct);
        }
        await page.getByRole("button", { name: "Entrar" }).click();
        await page.waitForURL((url) => url.toString().includes(account.expectedUrlPart), { timeout: 60000 });
        roleResult.finalUrl = page.url();
        roleResult.loginOk = true;

        await page.waitForLoadState("networkidle");
        roleResult.expectedTextFound = await page.locator(`text=${account.expectedText}`).first().isVisible({ timeout: 15000 }).catch(() => false);
        roleResult.bodySnippet = (await page.locator("body").innerText()).slice(0, 500);

        if (account.extraCheck) {
          await page.goto(`${baseUrl}${account.extraCheck.path}`, { waitUntil: "networkidle", timeout: 60000 });
          if (account.extraCheck.expectAllowed) {
            roleResult.extraCheckOk = await page.locator(`text=${account.extraCheck.expectedText}`).first().isVisible({ timeout: 15000 }).catch(() => false);
          } else {
            roleResult.extraCheckOk = page.url().includes(account.extraCheck.expectedUrlPart);
          }
        }
      } catch (error) {
        roleResult.error = error instanceof Error ? error.message : String(error);
      } finally {
        results.push(roleResult);
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify({ baseUrl, results }, null, 2));
};

await run();
