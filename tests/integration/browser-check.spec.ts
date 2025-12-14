
import { test, expect } from '@playwright/test';
import path from 'path';

test('browser compatibility check', async ({ page }) => {
    const fileUrl = 'file://' + path.resolve('spikes/browser-check.html');
    await page.goto(fileUrl);

    // Wait for the completion message
    await expect(page.locator('#output')).toContainText('=== Spike Complete ===', { timeout: 10000 });

    const text = await page.locator('#output').innerText();

    expect(text).toContain('✓ tau-prolog loads');
    expect(text).toContain('✓ tau-prolog query works');
    expect(text).toContain('✓ logic-solver loads');
    expect(text).toContain('✓ logic-solver works');
});
