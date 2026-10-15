# Claim scripts

Two runs next to the property specs. They reuse the same per-role profiles,
fixtures, sign-in and OutSystems helpers (`src/os.ts`), and run as the
**Strata Manager** (`--project=strata`), so `npm run auth:strata` covers them.

| Command | What it does |
|---|---|
| `npm run create:strataclaim:headed` | Creates a Strata Plan property (same as `create:strata`), then lodges a claim on it |
| `npm run create:claim:headed --id 1888` | Lodges a claim on an existing property |

Headless variants: `create:strataclaim` and `create:claim`. The property id can
be passed as `--id 1888`, `--id=1888`, `-- 1888` or `PROPERTY_ID=1888`;
`scripts/run-claim.js` normalises all of them. (npm handles `--id 1888` oddly:
it sets `npm_config_id=true` and passes `1888` as a plain argument. The wrapper
copes with that.)

Each run prints and attaches the ids:

```
  Created PropertyId 1890 — SP 10111432
  Lodged ClaimId 1231 — CLM-202610-01231
```

To lodge as the broker instead: `npm run create:claim:headed --id 1888 -- --project=broker`
(after `npm run auth:broker`).

## Changing the claim

Edit `src/claim-data.ts` (`defaultClaim`): incident answers, loss cause, items,
attachments, contact, account name and BSB (defaults to `062000`). The damage
date is always 3 days ago, so it never trips the future-date check.

## App behaviour these scripts work around

- **Session id.** Opening any PolicyAndClaimsManagement page without
  `ActiveSessionId` in the URL signs you out. The wizard reads the id from
  `localStorage` (`$OS_Users$PortfolioManagement$ClientVars$ActiveSessionId`)
  and opens `AddClaim?ActiveSessionId=…&ClaimId=0&PropertyId=<id>` directly,
  rather than clicking the property card (which sometimes navigates with an
  empty session id).
- **The draft is written at step 1.** The URL's `ClaimId` turns non-zero after
  the Setup step, so a failed run leaves a draft claim behind.
- **ABN is required** on Setup (since 11 Oct). Default answer: No.
- **Loss-cause radio ids don't match their labels** (`StormDamage-input` is
  "Fire and smoke"), so tiles are picked by visible label.
- **Estimated value drops the decimal point** (12100.50 → 1,210,050). The
  wizard refuses non-integer values instead of saving a wrong amount.
- **First upload often times out** (OS-CLRT-60900, 10 s). The wizard presses
  FilePond's retry, up to 4 times.
- **Primary contact list has duplicate names with no email shown.** Set
  `primaryContactEmail` and the wizard tries each match until the details card
  shows that email.
- **Yes/No boxes on Contacts ignore clicks on the box**; the radio input is
  clicked instead.
- **All three declarations are mandatory**, including "Where I have completed
  this form as a representative…".
- **No account-number field yet.** Only account name and BSB are filled; the
  bank name auto-fills from the BSB.

Selectors were read from the live dev screen on 11 Oct 2026 (widget suffixes
such as `Input_DateDamageOccurred`, `Input_WhoFoundDamageFirst`,
`TextArea_WhatHappen`, `TextArea_LocationDescription`, `Input_ItemName`,
`Input_EstimatedValue`, `Input_PayeeName`, `Input_PayeeBankAccount`,
`Input_PaymentBank`). The full flow has not yet been run end to end with
Playwright, so expect one or two selector tweaks on the first run. Use
`npm run test:ui` on the spec to step through it.
