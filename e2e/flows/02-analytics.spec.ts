import { test, expect } from '@playwright/test';

test.describe('Analytics (Insights) view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-onboarding]', { timeout: 15_000 });

    // The "Insights" rail item is a button in the left rail.
    const insightsButton = page.getByRole('button', { name: /^Insights$/i }).first();
    await insightsButton.click({ timeout: 5_000 });

    // Wait for the analytics panel to actually mount. We use a
    // distinctive KPI label as the signal rather than a fixed delay.
    await expect(
      page.getByText(/completion rate/i).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test('renders the 4 KPI cards', async ({ page }) => {
    // The cards are completion rate, current streak, longest streak, avg/day.
    await expect(page.getByText(/completion rate/i).first()).toBeVisible();
    await expect(page.getByText(/current streak/i).first()).toBeVisible();
    await expect(page.getByText(/longest streak/i).first()).toBeVisible();
    await expect(page.getByText(/avg.*per day|per day/i).first()).toBeVisible();
  });

  test('no NaN or Infinity appears anywhere in the panel', async ({ page }) => {
    // A common sign of a broken aggregation — guard against it.
    const panelText = await page.locator('body').textContent();
    expect(panelText ?? '').not.toContain('NaN');
    expect(panelText ?? '').not.toContain('Infinity');
  });

  test('streak strip is rendered with multiple cells', async ({ page }) => {
    // The 30-day streak strip is a grid of small colored cells.
    // Loose check: at least 20 small grid cells should be on the page.
    const smallCells = page.locator('div').filter({
      has: page.locator('[class*="rounded"]'),
    });
    const count = await smallCells.count();
    expect(count, 'streak strip has 20+ cells').toBeGreaterThanOrEqual(20);
  });

  test('best-hours heatmap is rendered', async ({ page }) => {
    // The 7×24 heatmap is implemented as an SVG with 168 rect cells.
    // Look for any svg with at least 50 rects (the heatmap is the
    // densest SVG on the page).
    const svgs = page.locator('svg');
    const svgCount = await svgs.count();
    let maxRects = 0;
    for (let i = 0; i < svgCount; i++) {
      const rects = await svgs.nth(i).locator('rect').count();
      if (rects > maxRects) maxRects = rects;
    }
    expect(maxRects, 'heatmap SVG has 100+ rect cells').toBeGreaterThanOrEqual(100);
  });

  test('time-per-tag or time-per-priority section is visible', async ({ page }) => {
    // Either the category/tag chart or the priority grid should be
    // present. We check for both as the exact labels may vary.
    const hasTags = await page
      .getByText(/time per (tag|category)|by (tag|category)/i)
      .first()
      .isVisible()
      .catch(() => false);
    const hasPriority = await page
      .getByText(/time per priority|by priority/i)
      .first()
      .isVisible()
      .catch(() => false);
    expect(hasTags || hasPriority, 'one of the time breakdown sections is visible').toBe(true);
  });
});
