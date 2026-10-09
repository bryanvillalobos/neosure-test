# neosure-create

Playwright scripts that create a property on the Neosure dev app through the
**Add Property** wizard, so you don't have to click through five steps by hand.

| Command | Creates |
|---|---|
| `npm run create:strata` | one **Strata Plan** property |
| `npm run create:bmc` | one **Building Committee** with 3 linked strata schemes |
| `npm run create` | both |

Add `:headed` (`create:strata:headed`, `create:bmc:headed`) to watch it in a
visible Chrome window, or pass `-- --headed` to any command.

These only create data. There are no assertions beyond "the property was
submitted and shows up".

## Quick start (Windows)

You need **Node.js 18+** (nodejs.org) and **Git**.

**1. Clone and install — once**

```powershell
cd C:\Users\<you>\source
git clone <this repo's URL>
cd neosure-create
npm install
npm run install:browsers
```

**2. Sign in — once, and again whenever a run says "Not signed in"**

```powershell
npm run auth:strata
```

A Chrome window opens. Sign in with **your own** Strata Manager account and
wait until the Dashboard with **Add Property** appears, then close it.

**3. Create properties — as often as you like**

```powershell
npm run create:strata          # one Strata Plan property
npm run create:bmc             # one Building Committee + 3 schemes
npm run create:bmc:headed      # same, but watch it in Chrome
```

The new property ID is printed in the terminal when a run finishes.

**If something fails:** `npm run report` opens the results in your browser —
click the failed test to see where it stopped.

**Get updates:** `git pull` in the `neosure-create` folder.
**Change what gets created** (names, insurer, amounts): `src/property-data.ts`.

## Setup

Requires Node.js 18+.

```bash
npm install
npm run install:browsers
npm run auth:strata      # opens Chrome — sign in as a Strata Manager
```

Wait until the Dashboard with **Add Property** appears before closing the
window. The signed-in session is saved in `.profile/strata/` (gitignored) and
renews itself on every run. If a run says *Not signed in*, run
`npm run auth:strata` again.

Each person signs in with their own account. The session can't be shared or
committed: the app uses AWS Cognito with tokens in `localStorage` that are
rewritten on every load, so a copied session is dead on arrival.

For broker runs, sign in once with `npm run auth:broker` and use
`create:broker:strata` / `create:broker:bmc`.

### Optional: unattended sign-in

Create a `.env` (gitignored, never commit it):

```
NEOSURE_EMAIL=you@lcs.valantic.com
NEOSURE_PASSWORD=...
```

A run that finds itself signed out then signs back in instead of failing.

## Changing what gets created

Everything is in `src/property-data.ts`: `defaultProperty` (Strata Plan) and
`defaultBuildingCommittee` (BMC). Option strings must match the on-screen
dropdown text exactly (e.g. `currentInsurer: 'Hutch Insurance'`). If the named
insurer is no longer offered, the run picks the first one in the list and
prints a warning.

Policy dates are relative to today — expiry is 30 days out
(`DAYS_UNTIL_EXPIRY`) — so new properties land inside the renewal window.
Insured names and policy numbers carry a timestamp so runs don't collide.

Point at another environment with `NEOSURE_URL`:

```bash
NEOSURE_URL=https://neosure-qa.outsystems.app npm run create:bmc
```

## Notes

- Runs write to the shared dev database and use one browser profile per role,
  so they run one at a time. Close any headed window before starting another.
- A run that fails partway leaves a draft property (the row is written at
  step 3). You can finish or delete it from the portfolio.
- On failure, open `npm run report` and the attached trace to see each step.

## Layout

```
src/config.ts             environment URL + where the browser profiles live
src/login.ts              optional .env sign-in
src/roles.ts              strata / broker → which profile a run uses
src/property-data.ts      the data you edit
src/os.ts                 OutSystems widget helpers
src/AddPropertyWizard.ts  page object, one method per wizard step
tests/fixtures.ts         persistent-profile browser fixture
tests/auth.setup.ts       one-time sign-in per role
tests/create-property.spec.ts
tests/create-property-building-committee.spec.ts
```
