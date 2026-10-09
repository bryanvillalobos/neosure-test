/**
 * Optional unattended sign-in.
 *
 * Off unless you set NEOSURE_EMAIL and NEOSURE_PASSWORD (a gitignored .env,
 * your shell profile, or CI secrets). Nothing is stored in this repo and the
 * values are never logged. With them set, a run that finds the profile signed
 * out logs itself back in instead of failing; without them it tells you to run
 * `npm run auth:strata`.
 */
import { expect, Page } from '@playwright/test';
import { BASE_URL, LOGIN_PATH } from './config';

export function hasCredentials(): boolean {
  return Boolean(process.env.NEOSURE_EMAIL && process.env.NEOSURE_PASSWORD);
}

export async function loginWithEnvCredentials(page: Page): Promise<boolean> {
  if (!hasCredentials()) return false;

  await page.goto(`${BASE_URL}${LOGIN_PATH}`, { waitUntil: 'domcontentloaded' });
  await page.locator('[id$="Input_UsernameVal"]').fill(process.env.NEOSURE_EMAIL!);
  await page.locator('[id$="Input_Password"]').fill(process.env.NEOSURE_PASSWORD!);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();

  await expect(
    page.getByRole('button', { name: 'Add Property' }),
    'Signed in with NEOSURE_EMAIL / NEOSURE_PASSWORD but the dashboard never appeared',
  ).toBeVisible({ timeout: 90_000 });
  return true;
}
