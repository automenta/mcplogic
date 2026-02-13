import { test, expect } from "@playwright/test";

test("verify playground conversion", async ({ page }) => {
    page.on("console", msg => console.log(msg.text()));

    // Start playground
    await page.goto("http://localhost:3000/src/playground/index.html");

    // Check if the page loaded
    await expect(page).toHaveTitle(/MCP Logic Playground/);

    // Enter a simple formula
    await page.fill("#input-editor", "man(socrates). all x (man(x) -> mortal(x)). mortal(socrates).");

    // Click prove
    await page.click("#btn-prove");

    // Wait for log entry
    await page.waitForSelector(".log-entry", { timeout: 10000 });

    // Take screenshot
    await page.screenshot({ path: "verification/playground.png" });
});
