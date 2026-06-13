#!/usr/bin/env node
/**
 * Interactive auth capture for Playwright E2E tests.
 *
 * Launches a headed Chromium, opens the app, and waits for the user to
 * sign in via Google OAuth. Once the user confirms the calendar is
 * visible, the script saves the browser's cookies + localStorage to
 * `e2e/.auth/user.json` so subsequent headless test runs can reuse the
 * session without re-authenticating.
 *
 * Usage:
 *   npm run test:e2e:auth
 *   E2E_BASE_URL=http://localhost:5173 npm run test:e2e:auth
 */
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mkdir, access } from 'node:fs/promises';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const BASE_URL =
  process.env.E2E_BASE_URL || 'https://tempo-calendar-tomers-team.vercel.app';
const AUTH_DIR = path.join(ROOT, 'e2e', '.auth');
const AUTH_FILE = path.join(AUTH_DIR, 'user.json');

// Supabase auth-token localStorage key, derived from the project ref
// (matches the key in `src/hooks/useAuth.tsx`).
const STORAGE_KEY = 'sb-zpmhsckclybdhcltfxbnp-auth-token';

async function fileExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(AUTH_DIR, { recursive: true });

  console.log(`\n╭─────────────────────────────────────────────────────────╮`);
  console.log(`│ E2E auth capture                                         │`);
  console.log(`╰─────────────────────────────────────────────────────────╯\n`);
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`Auth file:  ${AUTH_FILE}\n`);

  if (await fileExists(AUTH_FILE)) {
    console.log('⚠  An existing auth file was found. This script will overwrite it.');
    console.log('   Press Ctrl-C within 5 seconds to keep the current one.\n');
    await new Promise((r) => setTimeout(r, 5_000));
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: false, slowMo: 30 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Executable doesn't exist") || msg.includes('browserType.launch')) {
      console.error('\n✗ Chromium browser is not installed.');
      console.error('  Run:  npx playwright install chromium\n');
    } else {
      console.error('\n✗ Failed to launch Chromium:', msg);
    }
    process.exit(1);
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', (m) => {
    if (m.type() === 'error') {
      console.log(`  [browser console error] ${m.text()}`);
    }
  });

  console.log(`→ Opening ${BASE_URL} in a headed browser...\n`);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  const rl = readline.createInterface({ input: stdin, output: stdout });
  console.log('─────────────────────────────────────────────────────────');
  console.log('ACTION REQUIRED:');
  console.log('  1. In the browser, click "Sign in with Google" (or "Connect Google Calendar").');
  console.log('  2. Complete the Google OAuth flow.');
  console.log('  3. Wait until you see the main calendar view (not the sign-in screen).');
  console.log('  4. Come back here and press Enter to save the session.\n');
  await rl.question('Press Enter when the calendar is visible: ');
  rl.close();

  // Verify the auth blob is in localStorage.
  const verify = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return { ok: false, reason: `no value at localStorage["${key}"]` };
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return { ok: false, reason: `JSON parse failed: ${e.message}` };
    }
    if (!parsed.access_token) return { ok: false, reason: 'no access_token in JSON' };
    if (!parsed.user) return { ok: false, reason: 'no user in JSON' };
    if (parsed.expires_at && parsed.expires_at * 1000 < Date.now()) {
      return { ok: false, reason: 'access_token is already expired' };
    }
    return { ok: true };
  }, STORAGE_KEY);

  if (!verify.ok) {
    console.error(`\n✗ Auth verification failed: ${verify.reason}`);
    console.error('  The browser will stay open for 10 seconds so you can debug.\n');
    await new Promise((r) => setTimeout(r, 10_000));
    await browser.close();
    process.exit(1);
  }

  await context.storageState({ path: AUTH_FILE });
  console.log(`\n✓ Saved auth state to ${AUTH_FILE}`);
  console.log('  You can now run the test suite:  npm run test:e2e\n');

  await browser.close();
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
