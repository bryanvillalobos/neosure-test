/**
 * The two portal roles this suite runs as.
 *
 * Neosure shows a different Add Property wizard depending on who is signed in.
 * A Strata Manager starts the wizard straight from their own dashboard; a
 * Broker first picks the strata firm and manager they are acting for, sees
 * broker-only coverage fields, and lands somewhere different on cancel/submit
 * (NP2-47, NP2-247, NP2-517, NP2-369..372).
 *
 * Because the app authenticates through AWS Cognito and keeps its tokens in
 * localStorage, a role is not something a run can switch mid-flight — each one
 * needs its own signed-in Chrome profile. So "role" here is really "which
 * profile directory does this run use", and it is fixed per Playwright project:
 *
 *   npm run auth:strata     sign the strata profile in, once
 *   npm run auth:broker     sign the broker profile in, once
 *   npm run create:strata   create a Strata Plan property as a Strata Manager
 *   npm run create:bmc      create a Building Committee as a Strata Manager
 */
import type { TestInfo } from '@playwright/test';

export const ROLES = ['strata', 'broker'] as const;

export type Role = (typeof ROLES)[number];

/** How the role reads in test titles and console output. */
export const ROLE_LABEL: Record<Role, string> = {
  strata: 'Strata Manager',
  broker: 'Broker',
};

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/**
 * The role a given Playwright project runs as.
 *
 * Every project in playwright.config.ts carries `metadata: { role }`. Reading
 * it from there rather than from an environment variable means a single
 * `npx playwright test` can run both roles in one go, each against its own
 * profile, without them fighting over one global.
 */
export function roleOf(testInfo: TestInfo): Role {
  const role = testInfo.project.metadata?.role;
  if (!isRole(role)) {
    throw new Error(
      `Project "${testInfo.project.name}" has no valid role in its metadata. ` +
        `Every project must declare metadata: { role: 'strata' | 'broker' } — ` +
        'the role decides which signed-in Chrome profile the run uses.',
    );
  }
  return role;
}
