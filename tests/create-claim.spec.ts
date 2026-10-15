/**
 * Lodges a claim against an EXISTING property.
 *
 *   npm run create:claim:headed --id 1888
 *   npm run create:claim:headed --id=1888
 *   npm run create:claim -- 1888
 *   PROPERTY_ID=1888 npx playwright test --project=strata create-claim.spec
 *
 * scripts/run-claim.js turns any of those forms into PROPERTY_ID.
 * Claim data: src/claim-data.ts (defaultClaim)
 */
import { test } from './fixtures';
import { LodgeClaimWizard } from '../src/LodgeClaimWizard';
import { defaultClaim } from '../src/claim-data';

const propertyId = process.env.PROPERTY_ID;

test('lodges a claim against an existing property', async ({ page }) => {
  test.skip(!propertyId, 'No property id. Use: npm run create:claim:headed --id 1888');
  if (!/^\d+$/.test(propertyId!)) throw new Error(`Property id must be a number, got "${propertyId}"`);
  test.setTimeout(8 * 60_000);

  const claim = await new LodgeClaimWizard(page).lodgeClaim(propertyId!, defaultClaim);
  console.log(
    `\n  Lodged ClaimId ${claim.claimId} — ${claim.reference ?? '(reference not read)'} on PropertyId ${propertyId}\n`,
  );

  await test.info().attach('ids', {
    body: JSON.stringify({ propertyId, ...claim }, null, 2),
    contentType: 'application/json',
  });
});
