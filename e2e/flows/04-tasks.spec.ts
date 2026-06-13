import { test, expect } from '@playwright/test';

/**
 * A unique title so this test can run repeatedly without colliding
 * with existing tasks. If a test fails partway, the leftover task
 * can be identified by this prefix and deleted by hand.
 */
const TITLE = `__E2E_TEST_${Date.now()}`;
const EDITED_TITLE = `${TITLE}_EDITED`;

test.describe('Task CRUD (uses a throwaway task)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-onboarding]', { timeout: 15_000 });
  });

  test('create → edit → delete a task', async ({ page }) => {
    // 1. Open the Add Task dialog. Try the explicit button first, then
    //    any "Add"/"+" affordance as a fallback.
    let opened = false;
    for (const selector of [
      'button:has-text("Add task")',
      'button[aria-label*="Add task" i]',
      'button:has-text("+")',
    ]) {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await btn.click();
        opened = true;
        break;
      }
    }
    expect(opened, 'Found an "Add task" button').toBe(true);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 3_000 });

    // 2. Fill in the title. The input is the first text input in the dialog.
    const titleInput = dialog.locator('input[type="text"]').first();
    await titleInput.fill(TITLE);

    // 3. Save.
    const saveButton = dialog.getByRole('button', { name: /create|update|save/i }).first();
    await saveButton.click();
    await expect(dialog).toBeHidden({ timeout: 5_000 });

    // 4. Verify the task appears in the list.
    const taskText = page.getByText(TITLE).first();
    await expect(taskText).toBeVisible({ timeout: 5_000 });

    // 5. Open it for editing.
    await taskText.click();
    await expect(dialog).toBeVisible({ timeout: 3_000 });

    // 6. Edit the title.
    await titleInput.fill(EDITED_TITLE);
    await saveButton.click();
    await expect(dialog).toBeHidden({ timeout: 5_000 });

    // 7. Verify the edit took effect.
    await expect(page.getByText(EDITED_TITLE).first()).toBeVisible({ timeout: 5_000 });

    // 8. Open the kebab menu for the task row.
    const editedText = page.getByText(EDITED_TITLE).first();
    // The row is the closest ancestor with a `group` class (the app
    // uses `group` for hover-reveal actions). Fall back to a 3-deep
    // ancestor if `group` is missing.
    const row = editedText.locator(
      'xpath=ancestor::div[contains(@class, "group")][1] | ancestor::div[3]'
    );
    const kebab = row.getByRole('button', { name: /more actions/i }).first();
    await kebab.click({ timeout: 3_000 });

    // 9. Click "Delete" in the menu (this opens the confirmation).
    const deleteButton = page.getByRole('button', { name: /^delete$/i }).first();
    await deleteButton.click();

    // 10. Wait for the confirmation to render (Cancel button appears).
    await expect(
      page.getByRole('button', { name: /^cancel$/i })
    ).toBeVisible({ timeout: 3_000 });

    // 11. Click "Delete" again to confirm. After re-render, the only
    //     visible "Delete" button is the confirmation one.
    await page.getByRole('button', { name: /^delete$/i }).first().click();

    // 12. Verify the task is gone.
    await expect(page.getByText(EDITED_TITLE)).toHaveCount(0, { timeout: 5_000 });
  });
});
