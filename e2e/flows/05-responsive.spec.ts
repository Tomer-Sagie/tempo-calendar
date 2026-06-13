import { test, expect, type Page } from '@playwright/test';

/**
 * Common viewport sizes covering desktop, tablet (landscape and
 * portrait), and a typical phone width. The app should remain usable
 * (no horizontal scroll, app shell rendered) at all of them.
 */
const VIEWPORTS = [
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'tablet-1024x768', width: 1024, height: 768 },
  { name: 'tablet-portrait-768x1024', width: 768, height: 1024 },
  { name: 'mobile-375x667', width: 375, height: 667 },
];

async function assertNoHorizontalScroll(page: Page) {
  const result = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  // Allow a 1px tolerance for sub-pixel rounding.
  expect(
    result.scrollWidth,
    `No horizontal scroll (scrollWidth=${result.scrollWidth}, clientWidth=${result.clientWidth})`
  ).toBeLessThanOrEqual(result.clientWidth + 1);
}

for (const vp of VIEWPORTS) {
  test(`layout is usable at ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/');
    // Wait for the app shell only — `networkidle` is unreliable in
    // dev mode (Vite HMR keeps a WebSocket open) and adds nothing
    // against the deployed app that the selector wait doesn't.
    await page.waitForSelector('[data-onboarding]', { timeout: 15_000 });
    await assertNoHorizontalScroll(page);

    // The app shell should still render meaningful content.
    const bodyText = (await page.locator('body').textContent()) ?? '';
    expect(bodyText.trim().length, 'App shell rendered').toBeGreaterThan(50);
  });
}
