/**
 * Creates one property through the full Add Property wizard.
 *
 *   npm run auth:strata once, to sign the shared browser profile in
 *   npm run create:strata  every time you want another property
 *
 * Change what gets created in src/property-data.ts — nothing in this file
 * needs editing for ordinary reruns.
 */
import { test, expect } from './fixtures';
import { AddPropertyWizard } from '../src/AddPropertyWizard';
import { defaultProperty } from '../src/property-data';

test('creates a property and adds it to the portfolio', async ({ page }) => {
  const data = defaultProperty;
  const wizard = new AddPropertyWizard(page);

  const propertyId = await wizard.createProperty(data);

  console.log(`\n  Created PropertyId ${propertyId} — ${data.insuredName}\n`);

  // The portfolio list is the receipt: the new row carries the insured name.
  await expect(page.getByText(data.insuredName, { exact: false }).first()).toBeVisible({
    timeout: 60_000,
  });

  await test.info().attach('property-id', { body: String(propertyId), contentType: 'text/plain' });
});
