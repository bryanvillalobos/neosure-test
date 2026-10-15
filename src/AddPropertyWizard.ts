/**
 * Page object for PortfolioManagement -> Add New Property.
 *
 * The wizard is five steps: Property, Construction, Disclosure, Coverage,
 * Review. The property row is written to the database when step 3 is submitted
 * (the URL picks up a real `PropertyId` at that point) and is only promoted
 * into the portfolio by "Add to Portfolio" on step 5 — so a run that dies
 * mid-way leaves a draft behind rather than nothing.
 */
import { expect, Locator, Page } from '@playwright/test';
import { BASE_URL, DASHBOARD_PATH, SUBMIT_LANDING } from './config';
import { loginWithEnvCredentials } from './login';
import {
  BmcCoverage,
  BuildingCommitteeInput,
  ClaimRecord,
  ConstructionData,
  CoverageData,
  DisclosureData,
  PropertyInput,
  ReviewData,
  StrataScheme,
} from './property-data';
import {
  answerYesNo,
  byIdSuffix,
  clickButton,
  clickSymbolCard,
  clickUntilChecked,
  OPEN_PANEL,
  openPanel,
  setCheckbox,
  setDate,
  setSelect,
  setText,
  setTextBySuffix,
} from './os';

/** Facility widget name per data key, in the order they appear on screen. */
const FACILITY_FIELDS: Record<string, string> = {
  liftsElevators: 'txtLiftsElevators',
  carStackers: 'txtCarStacker',
  swimmingPools: 'txtSwimmingpool',
  spaOrSauna: 'txtSpa',
  gym: 'txGym',
  playground: 'txtplayground',
  waterFeatures: 'txtwaterFeature',
  jettyWharf: 'txtjattey',
  evChargers: 'txtEV',
};

/**
 * Fire-protection checkbox widget name per on-screen label.
 * (`chkFireExtinguishers2` is the first row in that list and is not mapped
 * here — add it if you ever need it.)
 */
const FIRE_PROTECTION_FIELDS: Record<string, string> = {
  'Automatic Sprinklers': 'chksprinklers',
  'Smoke detectors': 'chhSmoke',
  'Fire Detectors': 'chkFireDetectors',
  'Hose Reels': 'chkHosereels',
  'Fire Hydrants': 'chkFireHydrants',
  'Fire Extinguishers': 'chkFireExtinguishers',
};

/** Coverage widget name per data key. */
const COVERAGE_FIELDS: Record<string, string> = {
  building: 'txtbulidingLimit',
  commonContents: 'txtCommonCoverageLimit',
  lossOfRent: 'txtLossOfRent',
  catastropheCover: 'txtCatastroperCoverLimit',
  machineryBreakdown: 'txtMachineryBreakdown',
  publicLiability: 'txtPublicLiabilityCoverageLim',
  officeBearersLiability: 'txtOfficeBearerLiabilityCover',
  fidelityGuarantee: 'txtFidelityGuaranteeCoverageL',
  voluntaryWorkers: 'txtVoluntaryWorkerCoverageLim',
  governmentAuditCosts: 'txtGovernmentAuditCostCoverag',
  legalExpenses: 'txtLegalExpensesCoverageLimit',
  whsBreaches: 'txtWhsBreachesCoverageLimit',
  lotOwnersImprovements: 'txtLotOwnerImprovementLimit',
};

/**
 * Answering "Do you have an onsite building manager?" with Yes reveals a block
 * of required manager-detail fields that this suite has not mapped. Without
 * them the surrounding form silently refuses to save, which surfaces much later
 * as a missing row — so refuse up front with an explanation instead.
 */
function assertBuildingManagerSupported(answer: 'Yes' | 'No', where: string): void {
  if (answer === 'Yes') {
    throw new Error(
      `${where}: onsiteBuildingManager 'Yes' is not supported yet — it reveals ` +
        'required building-manager detail fields that are not mapped, and the ' +
        'form will not save without them. Use \'No\', or map those fields first.',
    );
  }
}

/** Generic `RadioButtonN` fallback id for a Yes/No pair. */
function yesNoId(answer: 'Yes' | 'No', yes: number, no: number): string {
  return `RadioButton${answer === 'Yes' ? yes : no}-input`;
}

export class AddPropertyWizard {
  constructor(protected readonly page: Page) {}

  /** Property id assigned once step 3 is submitted; null before that. */
  propertyId: string | null = null;

  // -------------------------------------------------------------------------

  async open(): Promise<void> {
    await this.page.goto(`${BASE_URL}${DASHBOARD_PATH}`, { waitUntil: 'domcontentloaded' });

    // Cognito tokens can lapse between runs. If the profile comes up signed
    // out, sign back in when credentials are available rather than failing.
    const addProperty = this.page.getByRole('button', { name: 'Add Property' });
    const signedIn = await addProperty
      .waitFor({ state: 'visible', timeout: 45_000 })
      .then(() => true)
      .catch(() => false);

    if (!signedIn) {
      const recovered = await loginWithEnvCredentials(this.page);
      if (!recovered) {
        throw new Error(
          'Not signed in. Run `npm run auth:strata` (or `npm run auth:broker` for broker runs) and sign in until the dashboard shows, ' +
            'or set NEOSURE_EMAIL / NEOSURE_PASSWORD so runs can sign themselves in.',
        );
      }
      await this.page.goto(`${BASE_URL}${DASHBOARD_PATH}`, { waitUntil: 'domcontentloaded' });
      await expect(addProperty).toBeVisible({ timeout: 45_000 });
    }

    await addProperty.click();
    await this.page.waitForURL(/PropertyDetails/, { timeout: 45_000 });
    await expect(this.page.locator('.symbol-card').first()).toBeVisible({ timeout: 45_000 });
  }

  // --- Step 1: Property ----------------------------------------------------

  async fillPropertyStep(data: PropertyInput): Promise<void> {
    assertBuildingManagerSupported(data.onsiteBuildingManager, 'Property step');
    await clickSymbolCard(this.page, data.buildingTitleType);

    // Let the whole Insured Details block render before typing into it — see
    // the note on the Building Committee step.
    await expect(byIdSuffix(this.page, 'txtInsuredName')).toBeVisible({ timeout: 30_000 });
    await expect(byIdSuffix(this.page, 'SearchInput')).toBeVisible({ timeout: 30_000 });

    await setSelect(this.page, 'PolicyType', data.policyType);
    await setTextBySuffix(this.page, 'txtInsuredName', data.insuredName);
    await setTextBySuffix(this.page, 'txtBulidingName', data.buildingName);

    await this.pickAddress(data.addressSearch, data.addressPick);
    await this.pickInsurer(data.currentInsurer);

    await setDate(this.page, 'PolicyStartDate', data.policyStartDate);
    await setDate(this.page, 'PolicyExpiryDate', data.policyExpiryDate);
    await setTextBySuffix(this.page, 'PolicyNumber', data.policyNumber);
    await setTextBySuffix(this.page, 'PremiumPaid', data.premiumPaid, undefined, { money: true });

    // Choosing the primary use reveals the rest of the Property Details card.
    await clickSymbolCard(this.page, data.primaryUse);
    await expect(byIdSuffix(this.page, 'txtyearbuilt')).toBeVisible();

    await setTextBySuffix(this.page, 'txtyearbuilt', data.yearBuilt);
    // Substring on purpose: the on-screen label reads "Is this buliding...".
    await answerYesNo(this.page, 'heritage listed', data.heritageListed);
    await setTextBySuffix(this.page, 'txtFlooraboveground', data.floorsAboveGround);
    await setTextBySuffix(this.page, 'txtbasement', data.basementLevels);
    await setTextBySuffix(this.page, 'txtResidentialsApartment', data.residentialApartments);
    await answerYesNo(this.page, 'onsite building manager', data.onsiteBuildingManager);

    for (const member of data.committee) await this.addCommitteeMember(member);

    await clickButton(this.page, 'Continue');
  }

  /**
   * The five address boxes are disabled by design — they are only ever filled
   * from the lookup. (There is a "you can enter your address manually" link if
   * a site ever falls outside the provider's data.)
   */
  protected async pickAddress(query: string, pick: string): Promise<void> {
    const search = byIdSuffix(this.page, 'SearchInput');
    await search.click();
    await search.pressSequentially(query, { delay: 30 });

    const suggestion = this.page.getByRole('link').filter({ hasText: new RegExp(pick, 'i') }).first();
    await suggestion.click({ timeout: 30_000 });

    await expect(byIdSuffix(this.page, 'Input_Suburb')).not.toHaveValue('', { timeout: 15_000 });
  }

  /**
   * Current Insurer is a virtual-select with its own search box. Both the
   * Strata Plan and (since early Oct) the Building Committee step use it.
   * `root` narrows which one, e.g. the DropdownSearch_CurrentInsurer block.
   */
  protected async pickInsurer(name: string, root?: Locator): Promise<void> {
    // .vscomp-wrapper also matches the zero-sized dropbox virtual-select
    // parks on <body>; .vscomp-ele-wrapper is the visible control.
    const dropdown = (root ?? this.page.locator('body')).locator('.vscomp-ele-wrapper').first();
    await dropdown.scrollIntoViewIfNeeded();
    // The option list arrives from a data action after the control renders.
    await expect(dropdown).not.toHaveClass(/has-no-options/, { timeout: 30_000 });
    await dropdown.click();

    // Search box and options live in the dropbox this control points at.
    const boxId = await dropdown.getAttribute('aria-controls');
    const box = boxId ? this.page.locator(`[id="${boxId}"]`) : this.page.locator('body');

    const search = box.locator('.vscomp-search-input').first();
    await search.waitFor({ state: 'visible' });
    await search.pressSequentially(name.slice(0, 12), { delay: 20 });

    // If the named insurer is not offered, clear the search and take the
    // first real option rather than stalling and failing the whole run.
    const options = box.locator('.vscomp-option:visible');
    const wanted = options.filter({ hasText: name }).first();
    if (await wanted.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await wanted.click();
      await expect(dropdown).toContainText(name.slice(0, 8));
      return;
    }
    await search.fill('');
    const first = options.filter({ hasNotText: /no results|select/i }).first();
    await expect(first).toBeVisible({ timeout: 15_000 });
    const picked = ((await first.textContent()) ?? '').trim();
    console.warn(`  Insurer "${name}" not in the list — using "${picked}" instead.`);
    await first.click();
    await expect(dropdown).toContainText(picked.slice(0, 8));
  }

  /**
   * Turning on Linked Limits for a scheme now asks "Are you sure? Switching to
   * Linked Limits will replace any values you've entered for this scheme with
   * the BMC master values." (added to the app early Oct 2026). Its backdrop
   * blocks every click behind it, so accept it before moving on. If the popup
   * does not appear (older builds, or a scheme with nothing entered yet), this
   * returns after a short wait.
   */
  protected async confirmLinkedLimitsPopup(): Promise<void> {
    const dialog = this.page
      .getByRole('dialog')
      .filter({ hasText: /Linked Limits/i })
      .last();
    const shown = await dialog
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    if (shown) {
      await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
      await expect(dialog).toBeHidden({ timeout: 20_000 });
    }
    await expect(this.page.locator('[data-popup-backdrop]:visible')).toHaveCount(0, {
      timeout: 20_000,
    });
    await expect(this.page.locator('.loader-overlay:visible')).toHaveCount(0, { timeout: 30_000 });
  }

  /**
   * Opens the side panel, fills it, saves, and waits for the table row.
   *
   * `within` picks which committee list to add to: omitted means the one on the
   * step itself, or pass the open strata-scheme panel to add to that scheme's
   * own committee. Both forms are in the DOM simultaneously, so every locator
   * here is scoped to the panel that is actually open.
   */
  protected async addCommitteeMember(
    member: PropertyInput['committee'][number],
    within?: Locator,
  ): Promise<void> {
    const host = within ?? this.page;
    await host.getByRole('button', { name: 'Add Committee Member', exact: true }).first().click();

    const panel = openPanel(this.page);
    const firstName = byIdSuffix(this.page, 'txtFirstname', panel);
    await expect(firstName).toBeVisible({ timeout: 20_000 });

    await setSelect(this.page, 'ddlCommitteMemberPosition', member.position, panel);
    await setText(firstName, member.firstName);
    await setTextBySuffix(this.page, 'txtLastname', member.lastName, panel);
    await setTextBySuffix(this.page, 'txtEmail', member.email, panel);
    await setTextBySuffix(this.page, 'txtPhoneNumber', member.phone, panel);

    // The "Set as primary contact" switch is a visually-replaced checkbox, so
    // toggle it through the input itself rather than chasing the skin.
    const primary = byIdSuffix(this.page, 'Switch1', panel);
    if ((await primary.isChecked()) !== member.primaryContact) {
      await primary.evaluate((el) => (el as HTMLInputElement).click());
    }

    await clickButton(this.page, 'Save', { scope: panel });
    await expect(
      host.getByText(`${member.firstName} ${member.lastName}`, { exact: false }).first(),
    ).toBeVisible({ timeout: 30_000 });
  }

  // --- Step 1 (Building Committee variant) ---------------------------------

  /**
   * "Building Committee" renders a different block from "Strata Plan":
   * no Policy Type, a plain insurer dropdown rather than the searchable one,
   * `Policy`/`Premium` instead of `PolicyNumber`/`PremiumPaid`, no
   * property-details section (those questions move into each strata scheme),
   * and an extra Linked Strata Schemes list.
   */
  async fillBuildingCommitteeStep(data: BuildingCommitteeInput): Promise<void> {
    assertBuildingManagerSupported(data.onsiteBuildingManager, 'Building Committee');
    await clickSymbolCard(this.page, 'Building Committee');

    // Wait for the WHOLE Insured Details block, not just the first field in it.
    // The insurer dropdown is populated by a data action that finishes last; if
    // we start typing before it lands, OutSystems re-renders and blanks the
    // fields typed so far.
    await expect(byIdSuffix(this.page, 'txtInsuredName')).toBeVisible({ timeout: 30_000 });
    // Current Insurer is now a searchable dropdown (DropdownSearch_CurrentInsurer),
    // no longer the plain ddlCurrentInsurer select. Wait for its options to load.
    const insurer = byIdSuffix(this.page, 'DropdownSearch_CurrentInsurer');
    await expect(insurer.locator('.vscomp-ele-wrapper').first()).toBeVisible({ timeout: 30_000 });
    await expect(insurer.locator('.vscomp-ele-wrapper').first()).not.toHaveClass(/has-no-options/, {
      timeout: 30_000,
    });

    await setTextBySuffix(this.page, 'txtInsuredName', data.insuredName);
    await setTextBySuffix(this.page, 'txtBulidingName', data.buildingName);

    await this.pickAddress(data.addressSearch, data.addressPick);
    await this.pickInsurer(data.currentInsurer, insurer);

    await setDate(this.page, 'PolicyStartDate', data.policyStartDate);
    await setDate(this.page, 'PolicyExpiryDate', data.policyExpiryDate);
    await setTextBySuffix(this.page, 'Policy', data.policyNumber);
    await setTextBySuffix(this.page, 'Premium', data.premiumPaid);

    await answerYesNo(this.page, 'onsite building manager', data.onsiteBuildingManager);

    for (const member of data.committee) await this.addCommitteeMember(member);
    for (const scheme of data.strataSchemes) await this.addStrataScheme(scheme);

    await clickButton(this.page, 'Continue');
  }

  /**
   * One row of Linked Strata Schemes. The panel carries the property-details
   * questions the Strata Plan flow asks on the step itself, plus a committee
   * list of its own — so this opens a panel inside a panel.
   */
  protected async addStrataScheme(scheme: StrataScheme): Promise<void> {
    assertBuildingManagerSupported(
      scheme.onsiteBuildingManager,
      `strata scheme ${scheme.strataPlanNo}`,
    );
    await clickButton(this.page, 'Add Strata Scheme');

    const panel = openPanel(this.page);
    const planNo = byIdSuffix(this.page, 'Input_InsuredName', panel);
    await expect(planNo).toBeVisible({ timeout: 30_000 });
    // Same race inside the panel: wait for the tail of it to render too.
    await expect(byIdSuffix(this.page, 'Input_BuildingName', panel)).toBeVisible({
      timeout: 30_000,
    });

    await setText(planNo, scheme.strataPlanNo);
    await setTextBySuffix(this.page, 'Input_BuildingName', scheme.developmentName, panel);
    await setCheckbox(
      this.page,
      { suffix: 'Switch_SameCoverageAsBMC' },
      scheme.useSameCoverageAsBMC,
      panel,
    );
    await answerYesNo(this.page, 'different strata management firm', scheme.managedByDifferentFirm, {
      scope: panel,
      rootSelector: OPEN_PANEL,
    });

    // Picking the primary use reveals the rest of the panel.
    await clickSymbolCard(this.page, scheme.primaryUse, panel);
    await expect(byIdSuffix(this.page, 'YearOfBuilding', panel)).toBeVisible({ timeout: 20_000 });

    await setTextBySuffix(this.page, 'YearOfBuilding', scheme.yearBuilt, panel);
    await answerYesNo(this.page, 'heritage listed', scheme.heritageListed, {
      scope: panel,
      rootSelector: OPEN_PANEL,
    });
    await setTextBySuffix(this.page, 'txtFlooraboveground', scheme.floorsAboveGround, panel);
    await setTextBySuffix(this.page, 'txtbasement', scheme.basementLevels, panel);
    await setTextBySuffix(this.page, 'txtResidentialsApartment', scheme.residentialApartments, panel);
    await answerYesNo(this.page, 'onsite building man', scheme.onsiteBuildingManager, {
      scope: panel,
      rootSelector: OPEN_PANEL,
    });

    for (const member of scheme.committee) await this.addCommitteeMember(member, panel);

    // Same guard as the claim panel: the primary-use tile re-renders this panel
    // after the name fields were typed, so make sure they survived.
    await expect(planNo, 'strata plan number was cleared before Save').not.toHaveValue('');

    await clickButton(this.page, 'Save', { scope: panel });
    // The row lists the plan number, not the development name. A missing row
    // almost always means the panel refused to save — usually a required field
    // revealed by a "Yes" answer that nothing filled in.
    await expect(
      this.page.getByText(scheme.strataPlanNo, { exact: false }).first(),
      `Strata scheme "${scheme.strataPlanNo}" did not appear in Linked Strata Schemes — ` +
        'the panel likely refused to save because a required field was left empty',
    ).toBeVisible({ timeout: 30_000 });
  }

  // --- Step 2: Construction ------------------------------------------------

  async fillConstructionStep(data: ConstructionData): Promise<void> {
    await expect(byIdSuffix(this.page, 'ddlWallMade')).toBeVisible({ timeout: 60_000 });

    await setSelect(this.page, 'ddlWallMade', data.wallsMadeOf);
    await setSelect(this.page, 'ddlFloorMade', data.floorsMadeOf);
    await setSelect(this.page, 'ddlroofMade', data.roofMadeOf);

    // Fallback ids are the generic RadioButton1..12 OutSystems assigned here,
    // in screen order: solar 1/2, renovated 3/4, asbestos 5/6, dangerous 7/8,
    // ACP 9/10, other recreation 11/12.
    await answerYesNo(this.page, 'solar panels', data.solarPanels, yesNoId(data.solarPanels, 1, 2));
    await answerYesNo(this.page, 'renovated or refurbished', data.renovated, yesNoId(data.renovated, 3, 4));
    await answerYesNo(this.page, 'contain asbestos', data.asbestos, yesNoId(data.asbestos, 5, 6));
    await answerYesNo(
      this.page,
      'dangerous materials',
      data.dangerousMaterials,
      yesNoId(data.dangerousMaterials, 7, 8),
    );
    await answerYesNo(
      this.page,
      'Aluminium Composite Panels',
      data.combustibleACP,
      yesNoId(data.combustibleACP, 9, 10),
    );

    for (const item of data.fireProtection) {
      await setCheckbox(this.page, { suffix: FIRE_PROTECTION_FIELDS[item], labelText: item }, true);
    }

    // Ticking Automatic Sprinklers reveals "Sprinkler System Used". Leaving it
    // unanswered blocks Continue silently — the only feedback is a toast that
    // vanishes, and no field is marked invalid.
    if (data.fireProtection.includes('Automatic Sprinklers')) {
      const system = data.sprinklerSystem ?? 'Full';
      const radio = this.page.locator(
        `input[id$="-RBSprinklerSystemType-input"][value="${system}"]`,
      );
      await expect(radio, 'Sprinkler System Used did not appear').toBeAttached({ timeout: 15_000 });
      await radio.evaluate((el) => (el as HTMLInputElement).click());
      await expect(radio).toBeChecked();
    }

    for (const [key, suffix] of Object.entries(FACILITY_FIELDS)) {
      const value = (data.facilities as Record<string, number | undefined>)[key];
      if (value !== undefined) await setTextBySuffix(this.page, suffix, value);
    }

    await answerYesNo(
      this.page,
      'sports or recreation facilities',
      data.otherRecreationFacilities,
      yesNoId(data.otherRecreationFacilities, 11, 12),
    );
    await clickButton(this.page, 'Continue');
  }

  // --- Step 3: Disclosure --------------------------------------------------

  async fillDisclosureStep(data: DisclosureData): Promise<void> {
    await expect(
      this.page.getByText('Do you have any claims to report in the last 5 years?').first(),
    ).toBeVisible({ timeout: 60_000 });

    await answerYesNo(
      this.page,
      'claims to report in the last 5 years',
      data.claimsLast5Years,
      data.claimsLast5Years === 'Yes' ? 'RBFiveyearyes-input' : 'RBFiveyearNo-input',
    );
    await answerYesNo(
      this.page,
      'unreported claims',
      data.unreportedClaims,
      data.unreportedClaims === 'Yes' ? 'RBUnReportedClaimYes-input' : 'RBUnReportedClamsNo-input',
    );
    await answerYesNo(
      this.page,
      'ever been declined',
      data.everDeclined,
      data.everDeclined === 'Yes' ? 'RBDeclineClaimYes-input' : 'RBDeclineClamsNo-input',
    );
    await answerYesNo(this.page, 'known hazards', data.knownHazards, yesNoId(data.knownHazards, 7, 8));
    await answerYesNo(
      this.page,
      'contract or construction works',
      data.contractWorksOver250k,
      data.contractWorksOver250k === 'Yes' ? 'RBContractYes-input' : 'RBContractNo-input',
    );
    await answerYesNo(
      this.page,
      'other matters you wish to disclose',
      data.otherMattersToDisclose,
      data.otherMattersToDisclose === 'Yes' ? 'RBMatterDiscloseYes-input' : 'RBMatterDiscloseNo-input',
    );

    // Submitting this step is what actually inserts the property.
    await clickButton(this.page, 'Continue');
    await this.capturePropertyId(90_000);
  }

  // --- Step 3 (Building Committee variant) ---------------------------------

  /**
   * On this title type the Disclosure step repeats per entity: one card for the
   * BMC plus one per linked strata scheme. So every question exists N+1 times
   * and each copy has to be answered.
   *
   * Answering "Yes" to the 5-year claims question turns that card into a
   * counter ("Yes - 0 claims added") with a "Provide details" button that opens
   * the claims-history panel.
   */
  async fillBuildingCommitteeDisclosureStep(data: BuildingCommitteeInput): Promise<void> {
    // Wait for EVERY card, not just the first one.
    //
    // The BMC card renders immediately and the scheme cards a moment later.
    // Counting as soon as one existed gave 1, so only the BMC was answered —
    // and when the remaining cards arrived they re-rendered the list and wiped
    // that answer, so the "Provide details" button never appeared. The data
    // knows how many there should be, so wait for exactly that many.
    const entities = 1 + data.strataSchemes.length;
    const claimsYes = this.page.locator('[id$="-RBFiveyearyes-input"]');
    await expect(
      claimsYes,
      `expected ${entities} Disclosure cards (the BMC plus ${data.strataSchemes.length} schemes)`,
    ).toHaveCount(entities, { timeout: 90_000 });

    const wantClaims = data.claimsLast5Years === 'Yes';
    const claimsSuffix = wantClaims ? 'RBFiveyearyes-input' : 'RBFiveyearNo-input';
    const hazardsSuffix = data.knownHazards === 'Yes' ? 'RadioButton7-input' : 'RadioButton8-input';

    await this.answerEveryDisclosureCard(claimsSuffix, hazardsSuffix, entities);

    if (wantClaims) {
      // With hazards answered No their "Provide details" buttons are not
      // rendered, so these are one-per-entity in card order.
      for (let i = 0; i < entities; i++) await this.fillClaimsPanel(i, data);
    }

    await clickButton(this.page, 'Continue');
    await this.capturePropertyId(120_000);
  }

  /**
   * Wait for the wizard to be handed a real property id, and keep it.
   *
   * The URL carries `PropertyId=0` from the moment the wizard opens, so a
   * pattern like `PropertyId=\d+` is already satisfied before anything has been
   * submitted — it returns instantly and captures the placeholder, which is why
   * runs reported "Created PropertyId 0". Requiring a non-zero leading digit is
   * what actually waits for the insert.
   */
  protected async capturePropertyId(timeout: number): Promise<void> {
    await this.page.waitForURL(/[?&]PropertyId=[1-9]\d*/, { timeout });

    const id = new URL(this.page.url()).searchParams.get('PropertyId');
    if (!id || id === '0') {
      throw new Error(`Expected a real PropertyId after submitting, got "${id}"`);
    }
    this.propertyId = id;
  }

  /**
   * Answer the claims and hazards question on every Disclosure card, and keep
   * sweeping until the answers stay put.
   *
   * One pass is not enough: answering a later card re-renders the whole list and
   * resets earlier ones, so the first card reliably came back unchecked by the
   * time the loop reached the end. Rather than guessing at the right order or
   * sleeping long enough, this fills in whatever is unanswered, waits for the
   * dust to settle, and looks again — repeating until a full check finds every
   * card answered.
   */
  protected async answerEveryDisclosureCard(
    claimsSuffix: string,
    hazardsSuffix: string,
    count: number,
  ): Promise<void> {
    const claims = this.page.locator(`[id$="-${claimsSuffix}"]`);
    const hazards = this.page.locator(`[id$="-${hazardsSuffix}"]`);
    const indexes = Array.from({ length: count }, (_, i) => i);

    for (let sweep = 1; sweep <= 8; sweep++) {
      for (const i of indexes) {
        if (!(await claims.nth(i).isChecked())) await clickUntilChecked(claims.nth(i));
      }
      for (const i of indexes) {
        if (!(await hazards.nth(i).isChecked())) await clickUntilChecked(hazards.nth(i));
      }

      // Let any re-render triggered by the last answer land before judging.
      await this.page.waitForTimeout(800);

      const claimsState = await Promise.all(indexes.map((i) => claims.nth(i).isChecked()));
      const hazardsState = await Promise.all(indexes.map((i) => hazards.nth(i).isChecked()));
      if (claimsState.every(Boolean) && hazardsState.every(Boolean)) return;
    }

    throw new Error(
      `Disclosure answers would not stay set across ${count} cards after 8 sweeps — ` +
        'the step keeps re-rendering and clearing them.',
    );
  }

  /** Opens one card's claims-history panel and adds every claim to it. */
  protected async fillClaimsPanel(index: number, data: BuildingCommitteeInput): Promise<void> {
    await this.page.getByRole('button', { name: /Provide details/i }).nth(index).click();

    const panel = openPanel(this.page);
    const few = byIdSuffix(this.page, 'RBFewClaimHistory-input', panel);
    await expect(few).toBeAttached({ timeout: 20_000 });
    // The other option swaps the table for a spreadsheet upload.
    await few.evaluate((el) => (el as HTMLInputElement).click());
    await expect(few).toBeChecked();

    for (const claim of data.claims) await this.addClaim(claim);

    await answerYesNo(this.page, 'unreported claims', data.unreportedClaims, {
      rootSelector: OPEN_PANEL,
    });
    await answerYesNo(this.page, 'ever been declined', data.everDeclined, {
      rootSelector: OPEN_PANEL,
    });

    await clickButton(this.page, 'Save', { scope: panel });
    // Count rather than match the first one: every card that has been filled
    // already shows the same "N claims added" text, so `.first()` would keep
    // passing on card 1's counter no matter what happened to this card.
    await expect(
      this.page.getByText(`${data.claims.length} claims added`, { exact: false }),
      `claims counter did not update on Disclosure card ${index + 1}`,
    ).toHaveCount(index + 1, { timeout: 30_000 });
  }

  /** "Add Claim" opens a further panel on top of the claims-history one. */
  protected async addClaim(claim: ClaimRecord): Promise<void> {
    await clickButton(this.page, 'Add Claim', { scope: openPanel(this.page) });

    const form = openPanel(this.page);
    const value = byIdSuffix(this.page, 'txtLClaimvalue', form);
    await expect(value).toBeVisible({ timeout: 20_000 });

    // Order matters. Everything that triggers a re-render goes first — the date
    // picker and the three dropdowns — and the free-text fields are typed last.
    // Typing first looks safer but is not: choosing a loss cause re-renders the
    // panel and blanks whatever was typed before it, so Save then fails
    // validation and quietly adds no row at all.
    await setDate(this.page, 'txtDamagedate', claim.dateOfLoss, form);
    await setSelect(this.page, 'ddlPrimaryLossId', claim.primaryLossCause, form);
    // Secondary cause is populated from the primary one, so it has to wait.
    const secondary = byIdSuffix(this.page, 'ddlSecondaryLoss', form);
    await expect(secondary.locator('option')).not.toHaveCount(1, { timeout: 20_000 });
    await setSelect(this.page, 'ddlSecondaryLoss', claim.secondaryLossCause, form);
    await setSelect(this.page, 'ddlStatus', claim.status, form);

    const notes = byIdSuffix(this.page, 'TextArea_AdditionalNotes', form);
    await setText(value, claim.claimValue);
    await setText(notes, claim.notes);

    // Confirm the panel is genuinely complete before saving. Without this a
    // blanked field shows up only as a row that never appears, several seconds
    // and one confusing assertion later.
    await expect(value, 'claim value was cleared before Save').not.toHaveValue('');
    await expect(notes, 'claim notes were cleared before Save').not.toHaveValue('');
    for (const suffix of ['ddlPrimaryLossId', 'ddlSecondaryLoss', 'ddlStatus']) {
      await expect(
        byIdSuffix(this.page, suffix, form),
        `${suffix} was cleared before Save`,
      ).not.toHaveValue('-1');
    }
    await expect(
      byIdSuffix(this.page, 'txtDamagedate', form),
      'claim date was cleared before Save',
    ).not.toHaveValue('');

    await clickButton(this.page, 'Save', { scope: form });
    // `visible=true` matters: the loss cause is also the text of an <option> in
    // the dropdown just above, which never becomes visible. Without the filter
    // this matches that option and reports "hidden" even though the row saved.
    await expect(
      this.page
        .getByText(claim.primaryLossCause, { exact: false })
        .locator('visible=true')
        .first(),
      `claim row "${claim.primaryLossCause}" did not appear in the table`,
    ).toBeVisible({ timeout: 30_000 });
  }

  // --- Step 4: Coverage ----------------------------------------------------

  async fillCoverageStep(data: CoverageData): Promise<void> {
    await expect(byIdSuffix(this.page, 'txtbulidingLimit')).toBeVisible({ timeout: 90_000 });

    for (const [key, suffix] of Object.entries(COVERAGE_FIELDS)) {
      const value = (data.coverage as Record<string, number>)[key];
      if (value !== undefined) await setTextBySuffix(this.page, suffix, value);
    }

    await answerYesNo(
      this.page,
      'Floating Floors',
      data.lotOwnersFloatingFloors,
      yesNoId(data.lotOwnersFloatingFloors, 1, 2),
    );
    await answerYesNo(
      this.page,
      'Paint Cover',
      data.lotOwnersPaintCover,
      yesNoId(data.lotOwnersPaintCover, 4, 5),
    );

    for (const line of data.excesses) {
      await setSelect(this.page, 'ddlStandardExcess', line.description);
      await setTextBySuffix(this.page, 'Input_AmountExcess', line.amount);
      await clickButton(this.page, 'Add');
      // `visible=true` matters: the description is also the text of an <option>
      // still sitting in the dropdown above, which never becomes visible.
      await expect(
        this.page
          .getByText(line.description, { exact: true })
          .locator('visible=true')
          .first(),
        `Excess line "${line.description}" did not appear in the table`,
      ).toBeVisible({ timeout: 30_000 });
    }

    if (data.otherCoverageNotes) {
      await setTextBySuffix(this.page, 'TextArea_OtherCoverage', data.otherCoverageNotes);
    }

    await clickButton(this.page, 'Continue');
  }

  // --- Step 4 (Building Committee variant) ---------------------------------

  /**
   * Coverage is a different screen on this title type — a matrix, not the
   * Strata Plan form. Entities are columns (the BMC as "Strata Main", each
   * linked scheme as "Ancillary") and coverages are rows. None of the Strata
   * Plan widget names exist here, so this cannot reuse `fillCoverageStep`.
   *
   * Property limits (building, contents, loss of rent, catastrophe, lot owner's
   * improvements) appear only in the BMC column. The eight liability limits
   * repeat per column, and each ancillary column has a "Linked Limits" switch
   * that inherits the BMC's and disables its own inputs.
   */
  async fillBuildingCommitteeCoverageStep(data: BuildingCommitteeInput): Promise<void> {
    const c: BmcCoverage = data.coverage;
    await expect(byIdSuffix(this.page, 'Input_BuildingCoverageLimit')).toBeVisible({
      timeout: 120_000,
    });

    // BMC column only.
    await setTextBySuffix(this.page, 'Input_BuildingCoverageLimit', c.buildingSumInsured);
    await setTextBySuffix(this.page, 'Input_CommonContent', c.commonContents);
    await setTextBySuffix(this.page, 'Input_LossOfRent', c.lossOfRent);
    await setTextBySuffix(this.page, 'Input_CatastropheCoverLimit', c.catastrophe);
    await setTextBySuffix(this.page, 'Input_LotOwnerImprovementLimit', c.lotOwnersImprovements);

    // Two Yes/No rows sit between the property and liability blocks. They carry
    // no usable label, so they go by widget name: Rb* then Rb*2.
    await this.clickRadio(data.lotOwnersFloatingFloors === 'Yes' ? 'RbTrue-input' : 'RbFalse-input');
    await this.clickRadio(data.lotOwnersPaintCover === 'Yes' ? 'RbTrue2-input' : 'RbFalse2-input');

    // Turn on Linked Limits first — it disables the ancillary inputs, so there
    // is nothing left to fill in those columns.
    if (data.linkSchemeLimitsToBmc) {
      const switches = this.page.locator('[id$="-Switch1"]');
      const n = await switches.count();
      for (let i = 0; i < n; i++) {
        const sw = switches.nth(i);
        if (await sw.isChecked()) continue;
        await sw.evaluate((el) => (el as HTMLInputElement).click());
        await this.confirmLinkedLimitsPopup();
      }
      await expect(this.page.locator('[id$="-Input_PublicLaibility"]').nth(1)).toBeDisabled({
        timeout: 20_000,
      });
    }

    // Liability limits — index 0 is the BMC column. (Widget names carry the
    // app's own typos: Laibility, Voluntray.)
    const liability: Array<[string, number]> = [
      ['Input_PublicLaibility', c.publicLiability],
      ['Input_OfficeBearer', c.officeBearersLiability],
      ['Input_Fidelity', c.fidelityGuarantee],
      ['Input_Voluntray', c.voluntaryWorkers],
      ['Input_GovtAudit', c.governmentAudit],
      ['Input_LegalExp', c.legalExpenses],
      ['Input_WHS', c.whsBreaches],
      ['Input_MachineryBreakdown', c.machineryBreakdown],
    ];
    for (const [suffix, value] of liability) {
      await setText(this.page.locator(`[id$="-${suffix}"]`).first(), value);
    }

    // Excess is optional here and is skipped: "Add another excess" opens a
    // panel whose Save did not commit a row in testing. Continue is accepted
    // with the excess table empty.
    await clickButton(this.page, 'Continue');
  }

  /** Click a radio by widget-name suffix, through the input itself. */
  protected async clickRadio(suffix: string): Promise<void> {
    await clickUntilChecked(byIdSuffix(this.page, suffix));
  }

  // --- Step 5: Review ------------------------------------------------------

  async submitReviewStep(data: ReviewData): Promise<void> {
    await expect(byIdSuffix(this.page, 'chkAuthorize')).toBeVisible({ timeout: 90_000 });

    await clickUntilChecked(
      byIdSuffix(
        this.page,
        data.currentlyManagedByFirm ? 'RBFirmManageYes-input' : 'RBCommitteAuthNo-input',
      ),
    );

    const authorize = byIdSuffix(this.page, 'chkAuthorize');
    if (!(await authorize.isChecked())) await clickUntilChecked(authorize);

    await clickButton(this.page, 'Add to Portfolio');

    // The confirmation differs by title type, so this step must tolerate both.
    // Strata Plan opens an in-page modal with a Confirm button. Building
    // Committee instead raises a native confirm() — "Are you sure to submit
    // property?" — which the fixture's dialog handler accepts, leaving no
    // button to click at all. Waiting for Confirm unconditionally sat here for
    // 30s while the property had, in fact, already been submitted.
    await this.page
      .getByRole('button', { name: 'Confirm', exact: true })
      .click({ timeout: 10_000 })
      .catch(() => undefined);

    // Submission fans out to quote requests, so it is slow by design.
    //
    // Accept any of the landing screens (see SUBMIT_LANDING). This used to wait
    // only for the portfolio dashboard, which a Building Committee no longer
    // returns to — so a run that had genuinely created the property blocked for
    // the full 180s and then reported a timeout, which also tripped
    // Playwright's "slow test file" warning.
    await this.page.waitForURL(SUBMIT_LANDING, { timeout: 180_000 });
  }

  // -------------------------------------------------------------------------

  /** The whole wizard for a Building Committee. Returns the new PropertyId. */
  async createBuildingCommittee(data: BuildingCommitteeInput): Promise<string> {
    await this.open();
    await this.fillBuildingCommitteeStep(data);
    await this.fillConstructionStep(data);
    await this.fillBuildingCommitteeDisclosureStep(data);
    await this.fillBuildingCommitteeCoverageStep(data);
    await this.submitReviewStep(data);
    if (!this.propertyId) throw new Error('Wizard finished without capturing a PropertyId');
    return this.propertyId;
  }

  /** The whole wizard, start to finish. Returns the new PropertyId. */
  async createProperty(data: PropertyInput): Promise<string> {
    await this.open();
    await this.fillPropertyStep(data);
    await this.fillConstructionStep(data);
    await this.fillDisclosureStep(data);
    await this.fillCoverageStep(data);
    await this.submitReviewStep(data);
    if (!this.propertyId) throw new Error('Wizard finished without capturing a PropertyId');
    return this.propertyId;
  }
}
