# End-to-end tests

These tests exercise the live FlowSavvy / Tempo Calendar app in a real Chromium browser.

## One-time setup

1. **Install the browser binary** (≈150 MB, only needed once):

   ```bash
   npx playwright install chromium
   ```

2. **Capture an authenticated session.** This launches a headed browser, lets you sign in interactively with Google, and saves the resulting cookies + localStorage to `e2e/.auth/user.json`:

   ```bash
   npm run test:e2e:auth
   ```

   The browser will stay open until you confirm in the terminal. After you see the main calendar view (not the sign-in screen), press **Enter** in the terminal — the script will save the state and close the browser.

3. **Verify the captured state works** by running a single test in headed mode:

   ```bash
   npm run test:e2e:headed -- 01-boot
   ```

   You should see the calendar load without a sign-in prompt.

## Running the full suite

```bash
# Headless (CI-friendly)
npm run test:e2e

# Headed (watch the browser as tests run)
npm run test:e2e:headed

# Open the Playwright UI mode (time-travel debugger)
npm run test:e2e:ui

# Open the last HTML report
npm run test:e2e:report
```

## What gets tested

| File                          | Flow                                                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `01-boot.spec.ts`             | App loads, calendar renders, no console errors, no failed network requests                                       |
| `02-analytics.spec.ts`        | Insights view: 4 KPI cards, 30-day streak strip, sparkline, 7×24 heatmap, time-per-tag, time-per-priority         |
| `03-calendar.spec.ts`         | Switch between week / month / day / agenda, click slots, click events, time gutter visible                        |
| `04-tasks.spec.ts`            | Create / edit / delete a task end-to-end (uses a throwaway task with a timestamped title)                         |
| `05-responsive.spec.ts`       | Layout at 1440×900, 1024×768, 768×1024, 375×667 — no horizontal scroll, no broken layouts                        |

## Refreshing the session

The captured `user.json` contains an access token that expires after **1 hour**. If the test suite starts failing with auth errors (redirected to sign-in, or the `No Google access token in session` console log), re-run the capture step:

```bash
npm run test:e2e:auth
```

## Targeting a different environment

Point the tests at any URL (e.g. a local dev server or a preview deployment) with the `E2E_BASE_URL` env var:

```bash
E2E_BASE_URL=http://localhost:5173 npm run test:e2e:auth
E2E_BASE_URL=http://localhost:5173 npm run test:e2e
```

## Adding a new test

1. Drop a `*.spec.ts` in `e2e/flows/`. It will be picked up automatically.
2. Use semantic selectors (`getByRole`, `getByText`, `getByLabel`) rather than CSS paths so the tests survive cosmetic UI changes.
3. Reuse the saved storage state — don't re-authenticate per test.
4. For destructive operations (delete, drag-and-drop), use a recognizable throwaway entity (timestamped title, etc.) so any test failure can be cleaned up by hand.

## Security note

`e2e/.auth/user.json` contains your Supabase access token, refresh token, **and Google OAuth provider token**. It is in `.gitignore` and **must never be committed**. If you accidentally commit it:

1. Rotate your Supabase session immediately (sign out and back in).
2. Revoke the Google OAuth grant in your Google account's security settings.
3. Force-push to remove the secret from history (or use a tool like `git-filter-repo`).
