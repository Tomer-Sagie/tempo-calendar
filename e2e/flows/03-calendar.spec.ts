import { test, expect } from '@playwright/test';

test.describe('Calendar workspace', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-onboarding="calendar"]', { timeout: 15_000 });
  });

  test('calendar workspace is visible by default', async ({ page }) => {
    const workspace = page.locator('[data-onboarding="calendar"]');
    await expect(workspace).toBeVisible();
  });

  test('view-switcher buttons are present', async ({ page }) => {
    // react-big-calendar's toolbar has Month / Week / Day / Agenda buttons.
    const viewButtons = page.locator('button').filter({ hasText: /^(month|week|day|agenda)$/i });
    const count = await viewButtons.count();
    expect(count, 'at least one view-switcher button').toBeGreaterThanOrEqual(1);
  });

  test('time gutter shows hours (e.g. "9 AM", "10 AM")', async ({ page }) => {
    // The time gutter renders cells with text like "9 AM" or "10 AM".
    const timeGutterText = page.locator('text=/^\\d{1,2}\\s?[ap]m$/i').first();
    await expect(timeGutterText).toBeVisible({ timeout: 5_000 });
  });

  test('clicking an empty slot opens the new-task dialog', async ({ page }) => {
    // Find an empty time-slot cell (react-big-calendar renders each
    // 30-min slot as `.rbc-time-slot`). We pick one near the end of
    // the visible time range to minimize collisions with real events
    // (most events happen in the morning / early afternoon).
    const slots = page.locator('.rbc-time-slot');
    const count = await slots.count();
    expect(count, 'time slots rendered').toBeGreaterThan(0);

    // Pick the first slot that has no event child sitting on it.
    let clicked = false;
    for (let i = count - 1; i >= 0; i--) {
      const slot = slots.nth(i);
      const eventsOnSlot = await slot.locator('.rbc-event').count();
      if (eventsOnSlot === 0) {
        await slot.click();
        clicked = true;
        break;
      }
    }
    // If every slot is covered by events, skip the assertion — the
    // calendar is so busy we can't find a free cell to click.
    if (clicked) {
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 3_000 });
    } else {
      test.skip(true, 'No empty time slots available in the visible range');
    }
  });
});
