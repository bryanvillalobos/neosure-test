/**
 * One-time sign-in, per role. Run `npm run auth:strata` and `npm run auth:broker`.
 *
 * A real browser window opens on the Neosure dashboard using the profile
 * directory every later run of that ROLE uses. Sign in as the matching kind of
 * user — a strata manager for auth:strata, a broker for auth:broker — or the
 * role-specific specs will assert against the wrong portal. Sign in yourself — no credential touches this
 * repo — and the session stays in that profile, renewing itself on each run.
 *
 * Rerun this whenever a run reports that it is not signed in.
 */
import { test, expect } from './fixtures';
import { BASE_URL, DASHBOARD_PATH, profileDir } from '../src/config';
import { ROLE_LABEL, roleOf } from '../src/roles';

test('save signed-in session', async ({ page }, testInfo) => {
  test.setTimeout(10 * 60_000);
  const role = roleOf(testInfo);

  await page.goto(`${BASE_URL}${DASHBOARD_PATH}`, { waitUntil: 'domcontentloaded' });

  console.log(`\n  Sign in as a ${ROLE_LABEL[role]} in the window that just opened.`);
  console.log('  Waiting up to 5 minutes for the dashboard to appear...\n');

  await expect(page.getByRole('button', { name: 'Add Property' })).toBeVisible({
    timeout: 5 * 60_000,
  });

  console.log(`  Signed in. Session lives in ${profileDir(role)}. You can close the window.\n`);
});
