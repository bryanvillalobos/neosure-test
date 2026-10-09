/**
 * A persistent Chrome profile instead of Playwright's usual fresh context.
 *
 * Why: the app signs in through AWS Cognito and keeps accessToken / idToken /
 * refreshToken in localStorage (there is no auth cookie at all). Those tokens
 * are short-lived and get rewritten every time the app loads. A `storageState`
 * file is a snapshot taken once and replayed forever, so the second run always
 * arrives with expired tokens — and once Cognito has rotated the refresh token,
 * the snapshot is dead for good. A real profile directory is written back to on
 * every run, so the session renews itself exactly as it would in your browser.
 *
 * One consequence: only one run can use the profile at a time. Close any headed
 * window left open before starting another run.
 *
 * There is now ONE PROFILE PER ROLE (.profile/strata, .profile/broker), because
 * the Strata Manager and Broker portals are different screens and a run has to
 * be signed in as one or the other. The role comes from the Playwright
 * project's metadata — see src/roles.ts.
 */
import { test as base, chromium, expect, BrowserContext, Page } from '@playwright/test';
import * as fs from 'fs';
import { profileDir } from '../src/config';
import { AddPropertyWizard } from '../src/AddPropertyWizard';
import { Role, roleOf } from '../src/roles';

export interface NeosureFixtures {
  context: BrowserContext;
  page: Page;
  /** Which portal this run is signed in as. */
  role: Role;
  /** The Add Property page object, already bound to the page. */
  wizard: AddPropertyWizard;
}

export const test = base.extend<NeosureFixtures>({
  role: async ({}, use, testInfo) => {
    await use(roleOf(testInfo));
  },
  context: async ({}, use, testInfo) => {
    const dir = profileDir(roleOf(testInfo));
    fs.mkdirSync(dir, { recursive: true });

    const viewport = testInfo.project.use.viewport ?? { width: 1920, height: 1000 };
    const context = await chromium.launchPersistentContext(dir, {
      headless: testInfo.project.use.headless ?? true,
      viewport: viewport ?? undefined,
      ignoreHTTPSErrors: true,
      executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    });

    // Native dialogs. Playwright's default is to DISMISS every one of them,
    // which on a confirm() means silently pressing Cancel — the submit would
    // look like it simply did nothing. Registering a handler turns that default
    // off, so this must always answer, or the page hangs.
    const dialogs: string[] = [];
    context.on('dialog', async (dialog) => {
      const line = `${dialog.type()}: ${dialog.message()}`;
      dialogs.push(line);
      console.log(`  [dialog] ${line}`);
      await dialog.accept();
    });

    // Overriding the context fixture opts out of Playwright's built-in tracing,
    // so drive it by hand and keep a trace whenever a run fails.
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    await use(context);

    if (dialogs.length) {
      await testInfo.attach('dialogs', {
        body: dialogs.join('\n'),
        contentType: 'text/plain',
      });
    }

    const tracePath = testInfo.outputPath('trace.zip');
    await context.tracing.stop({ path: tracePath });
    if (testInfo.status !== testInfo.expectedStatus) {
      await testInfo.attach('trace', { path: tracePath, contentType: 'application/zip' });
    }
    await context.close();
  },

  page: async ({ context }, use) => {
    await use(context.pages()[0] ?? (await context.newPage()));
  },

  wizard: async ({ page }, use) => {
    await use(new AddPropertyWizard(page));
  },
});

export { expect };
