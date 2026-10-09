/**
 * The one file to edit when you want the script to create a different property.
 *
 * Every value here maps to a field the wizard actually asks for; nothing is
 * derived. Option strings must match the dropdown text on screen exactly.
 */

export interface CommitteeMember {
  /** Chairperson | Committee Member | Secretary | Strata Manager | Treasurer */
  position: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  primaryContact: boolean;
}

export interface ExcessLine {
  /** e.g. Standard, Fire Damage, Flood, Water Damage / Burst Pipe */
  description: string;
  amount: number;
}

export interface PropertyInput {
  /** Strata Plan | Building Committee | Community Association | Company Title | Torrens Title | Other */
  buildingTitleType: string;

  // --- Insured details -----------------------------------------------------
  /** New Policy | Renewal */
  policyType: string;
  insuredName: string;
  buildingName: string;
  /**
   * Free text for the address autocomplete. The script types this, waits for
   * the lookup, and takes the suggestion matching `addressPick`.
   */
  addressSearch: string;
  /** Substring of the suggestion to accept, e.g. "12 GEORGE ST". */
  addressPick: string;
  /** Visible text of the insurer in the searchable dropdown. */
  currentInsurer: string;
  /** YYYY-MM-DD */
  policyStartDate: string;
  /** YYYY-MM-DD */
  policyExpiryDate: string;
  policyNumber: string;
  premiumPaid: number;

  // --- Property details ----------------------------------------------------
  /** Residential | Commercial | Mixed */
  primaryUse: string;
  yearBuilt: number;
  heritageListed: 'Yes' | 'No' | 'Not Sure';
  floorsAboveGround: number;
  basementLevels: number;
  residentialApartments: number;
  onsiteBuildingManager: 'Yes' | 'No';
  committee: CommitteeMember[];

  // --- Construction --------------------------------------------------------
  wallsMadeOf: string;
  floorsMadeOf: string;
  roofMadeOf: string;
  solarPanels: 'Yes' | 'No';
  renovated: 'Yes' | 'No';
  asbestos: 'Yes' | 'No';
  dangerousMaterials: 'Yes' | 'No';
  combustibleACP: 'Yes' | 'No';
  /** Exact label text of each fire-protection checkbox to tick. */
  fireProtection: string[];
  /**
   * Required *only* when 'Automatic Sprinklers' is ticked — the checkbox
   * reveals a "Sprinkler System Used" question, and leaving it unanswered
   * blocks Continue with nothing but a toast that disappears.
   */
  sprinklerSystem?: 'Full' | 'Partial';
  /** Counts keyed by the widget name; omit anything you want left blank. */
  facilities: Partial<{
    liftsElevators: number;
    carStackers: number;
    swimmingPools: number;
    spaOrSauna: number;
    gym: number;
    playground: number;
    waterFeatures: number;
    jettyWharf: number;
    evChargers: number;
  }>;
  otherRecreationFacilities: 'Yes' | 'No';

  // --- Disclosure ----------------------------------------------------------
  claimsLast5Years: 'Yes' | 'No';
  unreportedClaims: 'Yes' | 'No';
  everDeclined: 'Yes' | 'No';
  knownHazards: 'Yes' | 'No';
  contractWorksOver250k: 'Yes' | 'No';
  otherMattersToDisclose: 'Yes' | 'No';

  // --- Coverage ------------------------------------------------------------
  coverage: {
    building: number;
    commonContents: number;
    lossOfRent: number;
    catastropheCover: number;
    machineryBreakdown: number;
    publicLiability: number;
    officeBearersLiability: number;
    fidelityGuarantee: number;
    voluntaryWorkers: number;
    governmentAuditCosts: number;
    legalExpenses: number;
    whsBreaches: number;
    lotOwnersImprovements: number;
  };
  lotOwnersFloatingFloors: 'Yes' | 'No';
  lotOwnersPaintCover: 'Yes' | 'No';
  excesses: ExcessLine[];
  otherCoverageNotes?: string;

  // --- Review --------------------------------------------------------------
  /** true = "Yes, we currently manage this property". */
  currentlyManagedByFirm: boolean;
}

/**
 * How far in the future the policy expires.
 *
 * Renewal only becomes available once a policy is near its expiry, so the
 * created properties have to land inside that window to be any use for testing
 * it. Hard-coded dates would also go stale — a fixed 2027 expiry stops being
 * "soon" as time passes — so both defaults are derived from today instead.
 */
export const DAYS_UNTIL_EXPIRY = 30;

/** Length of a policy term, used to place the start date before the expiry. */
const POLICY_TERM_DAYS = 365;

/**
 * A date `days` from today as YYYY-MM-DD. Negative values go into the past.
 *
 * Built from local date parts rather than `toISOString()`, which converts to
 * UTC first and would hand back yesterday's date when run late in the evening
 * anywhere east of Greenwich.
 */
export function daysFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A short run token so repeated runs do not create identical-looking rows. */
export function runTag(): string {
  return new Date().toISOString().slice(5, 16).replace(/[-:T]/g, '');
}

export const defaultProperty: PropertyInput = {
  buildingTitleType: 'Strata Plan',

  policyType: 'New Policy',
  insuredName: `SP ${runTag()}`,
  buildingName: 'Neosure Test Building',
  addressSearch: '12 George Street Sydney',
  addressPick: '12 GEORGE ST',
  currentInsurer: 'Hutch Insurance',
  // Expires 30 days out, so the property is inside the renewal window; the
  // start date sits a full term before that, so it reads as a normal policy.
  policyStartDate: daysFromToday(DAYS_UNTIL_EXPIRY - POLICY_TERM_DAYS),
  policyExpiryDate: daysFromToday(DAYS_UNTIL_EXPIRY),
  policyNumber: `POL-TEST-${runTag()}`,
  premiumPaid: 5000,

  primaryUse: 'Residential',
  yearBuilt: 2005,
  heritageListed: 'No',
  floorsAboveGround: 5,
  basementLevels: 1,
  residentialApartments: 24,
  onsiteBuildingManager: 'No',
  committee: [
    {
      position: 'Chairperson',
      firstName: 'John',
      lastName: 'Smith',
      email: 'john.smith@example.com',
      phone: '0412345678',
      primaryContact: true,
    },
  ],

  wallsMadeOf: 'Brick',
  floorsMadeOf: 'Concrete',
  roofMadeOf: 'Metal Sheet',
  solarPanels: 'No',
  renovated: 'No',
  asbestos: 'No',
  dangerousMaterials: 'No',
  combustibleACP: 'No',
  fireProtection: ['Smoke detectors', 'Fire Extinguishers'],
  facilities: { liftsElevators: 1 },
  otherRecreationFacilities: 'No',

  claimsLast5Years: 'No',
  unreportedClaims: 'No',
  everDeclined: 'No',
  knownHazards: 'No',
  contractWorksOver250k: 'No',
  otherMattersToDisclose: 'No',

  coverage: {
    building: 15_000_000,
    commonContents: 250_000,
    lossOfRent: 1_500_000,
    catastropheCover: 2_000_000,
    machineryBreakdown: 100_000,
    publicLiability: 20_000_000,
    officeBearersLiability: 5_000_000,
    fidelityGuarantee: 250_000,
    voluntaryWorkers: 1_000_000,
    governmentAuditCosts: 50_000,
    legalExpenses: 100_000,
    whsBreaches: 100_000,
    lotOwnersImprovements: 250_000,
  },
  lotOwnersFloatingFloors: 'Yes',
  lotOwnersPaintCover: 'Yes',
  excesses: [{ description: 'Standard', amount: 1000 }],

  currentlyManagedByFirm: true,
};

// ---------------------------------------------------------------------------
// Building Committee
// ---------------------------------------------------------------------------

/**
 * Steps 2-5 are the same screens whichever building title you pick, so both
 * flows share these slices rather than redeclaring them.
 */
export type ConstructionData = Pick<
  PropertyInput,
  | 'wallsMadeOf'
  | 'floorsMadeOf'
  | 'roofMadeOf'
  | 'solarPanels'
  | 'renovated'
  | 'asbestos'
  | 'dangerousMaterials'
  | 'combustibleACP'
  | 'fireProtection'
  | 'sprinklerSystem'
  | 'facilities'
  | 'otherRecreationFacilities'
>;

export type DisclosureData = Pick<
  PropertyInput,
  | 'claimsLast5Years'
  | 'unreportedClaims'
  | 'everDeclined'
  | 'knownHazards'
  | 'contractWorksOver250k'
  | 'otherMattersToDisclose'
>;

export type CoverageData = Pick<
  PropertyInput,
  'coverage' | 'lotOwnersFloatingFloors' | 'lotOwnersPaintCover' | 'excesses' | 'otherCoverageNotes'
>;

export type ReviewData = Pick<PropertyInput, 'currentlyManagedByFirm'>;

/** One row of a claims-history list. */
export interface ClaimRecord {
  /** YYYY-MM-DD */
  dateOfLoss: string;
  claimValue: number;
  /** e.g. 'Storm, flood and weather', 'Fire and smoke', 'Public Liability' */
  primaryLossCause: string;
  /** Options depend on the primary cause — it cascades. */
  secondaryLossCause: string;
  status: 'Outstanding' | 'Closed';
  notes: string;
}

/** One row of the Linked Strata Schemes list, with its own committee list. */
export interface StrataScheme {
  strataPlanNo: string;
  developmentName: string;
  /** Drives the "SHARE BMC LIMITS" column on the row. */
  useSameCoverageAsBMC: boolean;
  /** "Is this property managed by a different strata management firm?" */
  managedByDifferentFirm: 'Yes' | 'No';
  /** Residential | Commercial | Mixed — picking one reveals the fields below. */
  primaryUse: string;
  yearBuilt: number;
  heritageListed: 'Yes' | 'No' | 'Not Sure';
  floorsAboveGround: number;
  basementLevels: number;
  residentialApartments: number;
  /**
   * 'No' only, for now: answering Yes reveals required building-manager detail
   * fields that have not been mapped, and the panel will not save without them.
   */
  onsiteBuildingManager: 'Yes' | 'No';
  /** Nested list — a committee per scheme, separate from the BMC's own. */
  committee: CommitteeMember[];
}

/**
 * Step 1 for "Building Committee" is a different block from "Strata Plan":
 * no Policy Type, no property-details section (that moves into each scheme),
 * a plain dropdown for the insurer instead of the searchable one, and an extra
 * Linked Strata Schemes list.
 */
/**
 * Coverage limits as the Building Committee step asks for them. The screen is a
 * matrix, not the Strata Plan form: entities are columns (the BMC, policy type
 * "Strata Main", plus one "Ancillary" column per linked scheme) and coverages
 * are rows. The property limits exist only in the BMC column; the liability
 * limits repeat per column.
 */
export interface BmcCoverage {
  buildingSumInsured: number;
  commonContents: number;
  /** Row reads "Temporary Accommodation / Loss Of Rent". */
  lossOfRent: number;
  catastrophe: number;
  lotOwnersImprovements: number;
  publicLiability: number;
  officeBearersLiability: number;
  fidelityGuarantee: number;
  voluntaryWorkers: number;
  governmentAudit: number;
  legalExpenses: number;
  whsBreaches: number;
  machineryBreakdown: number;
}

export interface BuildingCommitteeInput
  extends ConstructionData,
    DisclosureData,
    ReviewData {
  insuredName: string;
  buildingName: string;
  addressSearch: string;
  addressPick: string;
  /** Visible text in the plain Current Insurer dropdown. */
  currentInsurer: string;
  policyStartDate: string;
  policyExpiryDate: string;
  policyNumber: string;
  premiumPaid: number;
  onsiteBuildingManager: 'Yes' | 'No';
  committee: CommitteeMember[];
  strataSchemes: StrataScheme[];
  /**
   * Claims added to every entity that answers "Yes" to the 5-year claims
   * question. On this title type the Disclosure step repeats per entity — the
   * BMC itself plus one card per linked strata scheme.
   */
  claims: ClaimRecord[];

  coverage: BmcCoverage;
  lotOwnersFloatingFloors: 'Yes' | 'No';
  lotOwnersPaintCover: 'Yes' | 'No';
  /**
   * true turns on "Linked Limits" for every ancillary column, which inherits
   * the BMC's liability limits and disables those inputs.
   */
  linkSchemeLimitsToBmc: boolean;
}

export const defaultBuildingCommittee: BuildingCommitteeInput = {
  insuredName: `BMC ${runTag()}`,
  buildingName: 'Harbour Precinct BMC',
  addressSearch: '1 Macquarie Street Sydney',
  addressPick: '1 MACQUARIE ST',
  // NB: this dropdown has a different option list from the Strata Plan one.
  currentInsurer: 'Hutch Insurance',
  // Same as the Strata Plan default: expiring in 30 days puts this inside the
  // renewal window. Change DAYS_UNTIL_EXPIRY to move both.
  policyStartDate: daysFromToday(DAYS_UNTIL_EXPIRY - POLICY_TERM_DAYS),
  policyExpiryDate: daysFromToday(DAYS_UNTIL_EXPIRY),
  policyNumber: `POL-BMC-${runTag()}`,
  premiumPaid: 12500,
  onsiteBuildingManager: 'No',

  committee: [
    {
      position: 'Chairperson',
      firstName: 'Alan',
      lastName: 'Wu',
      email: 'alan.wu@example.com',
      phone: '0455667788',
      primaryContact: true,
    },
  ],

  // Three ancillary schemes. Everything downstream is driven by how many are
  // here: the Disclosure step renders one card per entity plus one for the BMC
  // (so four), and the Coverage matrix renders one column each.
  strataSchemes: [
    {
      strataPlanNo: `SP ${runTag()}-A`,
      developmentName: 'Harbour View Tower',
      useSameCoverageAsBMC: false,
      managedByDifferentFirm: 'No',
      primaryUse: 'Residential',
      yearBuilt: 2012,
      heritageListed: 'No',
      floorsAboveGround: 8,
      basementLevels: 2,
      residentialApartments: 40,
      onsiteBuildingManager: 'No',
      committee: [
        {
          position: 'Secretary',
          firstName: 'Priya',
          lastName: 'Nair',
          email: 'priya.nair@example.com',
          phone: '0433221100',
          primaryContact: true,
        },
      ],
    },
    {
      strataPlanNo: `SP ${runTag()}-B`,
      developmentName: 'Quay Residences',
      useSameCoverageAsBMC: false,
      managedByDifferentFirm: 'No',
      primaryUse: 'Residential',
      yearBuilt: 2016,
      heritageListed: 'No',
      floorsAboveGround: 12,
      basementLevels: 1,
      residentialApartments: 62,
      // 'Yes' reveals building-manager detail fields that are required and are
      // not mapped yet — see the guard in AddPropertyWizard.
      onsiteBuildingManager: 'No',
      committee: [
        {
          position: 'Treasurer',
          firstName: 'Marcus',
          lastName: 'Chen',
          email: 'marcus.chen@example.com',
          phone: '0421334455',
          primaryContact: true,
        },
      ],
    },
    {
      strataPlanNo: `SP ${runTag()}-C`,
      developmentName: 'Circular Court',
      useSameCoverageAsBMC: false,
      managedByDifferentFirm: 'No',
      // All three are Residential on purpose: picking Commercial or Mixed
      // swaps the fields inside the scheme panel, and that branch is unmapped.
      primaryUse: 'Residential',
      yearBuilt: 2008,
      heritageListed: 'No',
      floorsAboveGround: 5,
      basementLevels: 3,
      residentialApartments: 18,
      onsiteBuildingManager: 'No',
      committee: [
        {
          position: 'Committee Member',
          firstName: 'Hannah',
          lastName: 'Okafor',
          email: 'hannah.okafor@example.com',
          phone: '0466778899',
          primaryContact: true,
        },
      ],
    },
  ],

  wallsMadeOf: 'Concrete',
  floorsMadeOf: 'Concrete',
  roofMadeOf: 'Tile',
  solarPanels: 'No',
  renovated: 'No',
  asbestos: 'No',
  dangerousMaterials: 'No',
  combustibleACP: 'No',
  // 'Automatic Sprinklers' is deliberately left off: ticking it reveals a
  // "Sprinkler System Used" question that silently blocks Continue. The suite
  // can handle it — add it back here along with `sprinklerSystem: 'Full'`
  // when you want that path covered.
  fireProtection: ['Smoke detectors', 'Fire Hydrants'],
  facilities: { liftsElevators: 2, swimmingPools: 1 },
  otherRecreationFacilities: 'No',

  // Claims are OFF by default. 'Yes' opens the claims-history list, which is
  // the most intricate thing in the wizard — a panel inside a panel inside a
  // card that repeats per entity — and it is still not saving reliably. Turn it
  // back on once that is sorted; the code for it is intact and unchanged.
  claimsLast5Years: 'No',
  claims: [
    {
      dateOfLoss: '2025-03-15',
      claimValue: 25_000,
      primaryLossCause: 'Storm, flood and weather',
      secondaryLossCause: 'Storm or wind',
      status: 'Closed',
      notes: 'Storm damage to roof and common area ceilings after severe weather.',
    },
  ],
  unreportedClaims: 'No',
  everDeclined: 'No',
  // Deliberately No — see README, the risks & hazards "Add" is broken today.
  knownHazards: 'No',
  contractWorksOver250k: 'No',
  otherMattersToDisclose: 'No',

  coverage: {
    buildingSumInsured: 42_000_000,
    commonContents: 500_000,
    lossOfRent: 3_000_000,
    catastrophe: 5_000_000,
    lotOwnersImprovements: 400_000,
    publicLiability: 20_000_000,
    officeBearersLiability: 5_000_000,
    fidelityGuarantee: 500_000,
    voluntaryWorkers: 1_000_000,
    governmentAudit: 50_000,
    legalExpenses: 150_000,
    whsBreaches: 150_000,
    machineryBreakdown: 250_000,
  },
  lotOwnersFloatingFloors: 'No',
  lotOwnersPaintCover: 'Yes',
  linkSchemeLimitsToBmc: true,

  currentlyManagedByFirm: true,
};
