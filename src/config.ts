/**
 * One place that decides where the suite points and where the signed-in
 * session lives.
 *
 * NEOSURE_URL      environment root. Swap for QA/UAT without touching specs.
 * NEOSURE_PROFILE  Parent directory of the per-role Chrome profiles. This app
 *                  authenticates with AWS Cognito and keeps its tokens in
 *                  localStorage, where they are refreshed on every app load —
 *                  so the session has to live in a profile that runs write
 *                  back to, not in a frozen storageState snapshot.
 */
import * as path from 'path';

export const BASE_URL = process.env.NEOSURE_URL ?? 'https://neosure-dev.outsystems.app';

/** Landing screen after login; also where the "Add Property" button lives. */
export const DASHBOARD_PATH = '/PortfolioManagement/Dashboard';

/** Where the wizard lands once the property row exists. */
export const PORTFOLIO_PATH = '/PortfolioManagement/PortfolioDashboard';

export const LOGIN_PATH = '/PortfolioManagement/Login';

/**
 * Where the app lands once a property has actually been submitted.
 *
 * Deliberately not a single screen. A Strata Plan drops back on the portfolio
 * dashboard, while a Building Committee now opens the new policy straight into
 * the back-office module (`/NeosureBackOffice/...`). Both mean the submit
 * worked. Pinning this to PORTFOLIO_PATH alone is what made a *successful* BMC
 * run sit at the final wait for the full three minutes and then fail, with the
 * property sitting in the database the whole time.
 *
 * Add to this if the app grows another landing screen — it is the one place
 * that decides what "submitted" looks like.
 */
export const SUBMIT_LANDING = new RegExp(
  [PORTFOLIO_PATH, '/NeosureBackOffice/'].map((p) => p.replace(/\//g, '\\/')).join('|'),
);

/**
 * Where a role's signed-in Chrome profile lives.
 *
 * One directory per role, because the Strata Manager and Broker portals are
 * different screens and a run has to be signed in as one or the other. They
 * are separate directories rather than separate storageState files for the
 * reason above: the tokens have to be written back to.
 *
 * NEOSURE_PROFILE overrides the parent directory, not the per-role folder, so
 * pointing it somewhere else still keeps the two roles apart.
 */
export function profileDir(role: 'strata' | 'broker'): string {
  const root = process.env.NEOSURE_PROFILE ?? path.join(__dirname, '..', '.profile');
  return path.join(root, role);
}

/** @deprecated Use profileDir(role). Kept so older scripts keep resolving. */
export const PROFILE_DIR = profileDir('strata');
