/**
 * Creates a Strata Plan property, then lodges a claim against it.
 *
 *   npm run create:strataclaim           headless
 *   npm run create:strataclaim:headed    watch it
 *
 * Property data: src/property-data.ts (defaultProperty)
 * Claim data:    src/claim-data.ts    (defaultClaim)
 */
import { test, expect } from './fixtures';
import { AddPropertyWizard } from '../src/AddPropertyWizard';
import { LodgeClaimWizard } from '../src/LodgeClaimWizard';
import { defaultProperty } from '../src/property-data';
import { defaultClaim } from '../src/claim-data';

test('creates a strata property and lodges a claim on it', async ({ page }) => {
  // Property wizard (~3-5 min) plus claim wizard (~2-3 min).
  test.setTimeout(15 * 60_000);

  const propertyId = await new AddPropertyWizard(page).createProperty(defaultProperty);
  console.log(`\n  Created PropertyId ${propertyId} — ${defaultProperty.insuredName}`);
  await expect(page.getByText(defaultProperty.insuredName, { exact: false }).first()).toBeVisible({
    timeout: 60_000,
  });

  const claim = await new LodgeClaimWizard(page).lodgeClaim(propertyId, defaultClaim);
  console.log(`  Lodged ClaimId ${claim.claimId} — ${claim.reference ?? '(reference not read)'}\n`);

  await test.info().attach('ids', {
    body: JSON.stringify({ propertyId, ...claim }, null, 2),
    contentType: 'application/json',
  });
});
