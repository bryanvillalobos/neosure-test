/**
 * Creates one Building Committee property, with every list populated.
 *
 *   npm run create:bmc
 *
 * "Building Committee" is not the Strata Plan form with one field changed — it
 * renders a different block: no Policy Type, a plain insurer dropdown instead
 * of the searchable one, no property-details section (those questions move
 * into each strata scheme), and an extra Linked Strata Schemes list.
 *
 * Three lists get a record here, four with claims turned on:
 *   1. Committee Details on the step itself
 *   2. Linked Strata Schemes — three ancillaries
 *   3. Committee Details nested inside each strata scheme
 *   4. Claims history — on every Disclosure card (OFF by default, see README) (the step repeats per entity)
 *
 * Two lists are left unpopulated on purpose, both because the app will not
 * accept a row today — see the README:
 *   - Risks & Hazards (Disclosure)
 *   - Excess & Deductibles (Coverage)
 *
 * Edit src/property-data.ts -> defaultBuildingCommittee to change any of it.
 */
import { test, expect } from './fixtures';
import { AddPropertyWizard } from '../src/AddPropertyWizard';
import { defaultBuildingCommittee } from '../src/property-data';

test('creates a Building Committee property with every list populated', async ({ page }) => {
  const data = defaultBuildingCommittee;

  // Guard the intent of this spec: a data edit that empties a list should fail
  // here with a clear message rather than quietly stop covering it.
  expect(data.committee.length, 'committee list must have a record').toBeGreaterThan(0);
  expect(
    data.strataSchemes.length,
    'this spec covers a BMC with at least 3 ancillary schemes',
  ).toBeGreaterThanOrEqual(3);
  // Claims are optional: the list only exists when the 5-year question is Yes.
  if (data.claimsLast5Years === 'Yes') {
    expect(data.claims.length, 'claims list must have a record').toBeGreaterThan(0);
  }
  for (const scheme of data.strataSchemes) {
    expect(
      scheme.committee.length,
      `scheme ${scheme.strataPlanNo} must have a committee record`,
    ).toBeGreaterThan(0);
  }

  const wizard = new AddPropertyWizard(page);
  const propertyId = await wizard.createBuildingCommittee(data);

  console.log(`\n  Created PropertyId ${propertyId} — ${data.insuredName}\n`);

  await expect(page.getByText(data.insuredName, { exact: false }).first()).toBeVisible({
    timeout: 60_000,
  });

  await test.info().attach('property-id', { body: String(propertyId), contentType: 'text/plain' });
});
