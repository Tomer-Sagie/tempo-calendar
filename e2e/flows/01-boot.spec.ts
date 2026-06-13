import { test, expect, type ConsoleMessage } from '@playwright/test';

/**
 * Console output that is benign and shouldn't fail the boot test.
 * Add to this list sparingly — if a log is being filtered, ask
 * "should the user actually be seeing this?" before adding it.
 */
const NOISE_PATTERNS: RegExp[] = [
  /favicon/i,
  // The Google Calendar hook polls every 60s and logs each tick.
  /\[useGoogleCalendar\] Polling/,
  // The Supabase auth client logs token refresh activity; benign.
  /\[Auth\]/,
  // Vite HMR (dev only).
  /\[HMR\]/,
  /Download the React DevTools/,
];

test('app loads, renders the main calendar, has no console errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];

  page.on('console', (msg: ConsoleMessage) => {
    const text = msg.text();
    if (NOISE_PATTERNS.some((re) => re.test(text))) return;
    if (msg.type() === 'error') consoleErrors.push(text);
    if (msg.type() === 'warning') consoleWarnings.push(text);
  });

  const failedRequests: { url: string; error: string }[] = [];
  page.on('requestfailed', (req) => {
    failedRequests.push({
      url: req.url(),
      error: req.failure()?.errorText ?? 'unknown',
    });
  });

  await page.goto('/');

  // The app shell mounts a node with `data-onboarding` once the auth
  // bootstrap completes. This is the most reliable signal that the
  // app is past the "Loading" state.
  await page.waitForSelector('[data-onboarding]', { timeout: 15_000 });

  // The sign-in page is a different layout — if we ended up there the
  // captured storage state is stale or wrong.
  expect(page.url(), 'Not redirected to a sign-in screen').not.toMatch(/auth|signin|sign-in/);

  // The body should have meaningful content (not just "Loading...").
  const bodyText = (await page.locator('body').textContent()) ?? '';
  expect(bodyText.trim().length, 'Page has rendered content').toBeGreaterThan(50);

  if (consoleErrors.length > 0) {
    console.error('Console errors detected:');
    for (const e of consoleErrors) console.error('  -', e);
  }
  if (consoleWarnings.length > 0) {
    console.warn('Console warnings:');
    for (const w of consoleWarnings) console.warn('  -', w);
  }
  if (failedRequests.length > 0) {
    console.error('Failed network requests:');
    for (const f of failedRequests) console.error(`  - ${f.url} — ${f.error}`);
  }

  expect(consoleErrors, 'No console errors on boot').toEqual([]);
  expect(failedRequests, 'No failed network requests on boot').toEqual([]);
});
