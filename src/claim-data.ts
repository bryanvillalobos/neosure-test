/**
 * The one file to edit when you want the claim scripts to lodge a different
 * claim. Mirrors property-data.ts: every value maps to a field the Lodge Claim
 * wizard asks for, and option strings must match the text on screen exactly.
 */
import { daysFromToday, runTag } from './property-data';

export interface ClaimItem {
  name: string;
  description: string;
  /**
   * Whole dollars only. The Estimated value mask currently DROPS the decimal
   * point (12100.50 is saved as 1,210,050), so never put cents here until
   * that defect is fixed.
   */
  estimatedValue: number;
  /** How many generated PNG attachments to upload against the item (0 = none). */
  attachments: number;
}

export interface ClaimInput {
  // --- Step 1: Setup -------------------------------------------------------
  /** "Do you have an ABN?" is now required. 'No' skips the ABN box. */
  hasAbn: 'Yes' | 'No';
  abn?: string;

  // --- Step 2: Incident details ---------------------------------------------
  /** YYYY-MM-DD. Future dates are rejected by the date picker. */
  dateOfDamage: string;
  /** HH:mm, 24-hour. */
  timeOfDamage: string;
  estimatedTime: 'Yes' | 'No';
  whoFoundDamage: string;
  /**
   * Exact label of the primary loss cause tile: Water Damage | Storm, flood and
   * weather | Fire and smoke | Impact, accidental and glass | Theft and
   * malicious damage | Machinery breakdown | Public liability | Office Bearers'
   * Liability | Voluntary workers | Fidelity / theft of funds | Legal defence
   * expenses | Other
   */
  primaryLossCause: string;
  whatHappened: string;
  whereItHappened: string;
  thirdPartyInvolved: 'Yes' | 'No';
  witnesses: 'Yes' | 'No';
  repairsArranged: 'Yes' | 'No';
  soleOwner: 'Yes' | 'No';
  otherInsurances: 'Yes' | 'No';

  // --- Step 3: Evidence -----------------------------------------------------
  items: ClaimItem[];

  // --- Step 4: Contacts -----------------------------------------------------
  /** Text typed into the primary-contact search. */
  primaryContactSearch: string;
  /**
   * Optional but recommended: the list holds several people with the same
   * name and shows no email, so the script tries each match until the details
   * card shows this email.
   */
  primaryContactEmail?: string;
  siteInspectionContact: 'No';
  additionalClaimContact: 'No';
  accountName: string;
  /** Bank name auto-fills from the BSB. There is no account-number field yet. */
  bsb: string;
}

export const defaultClaim: ClaimInput = {
  hasAbn: 'No',

  // A few days ago, so it is always in the past and inside the policy period.
  dateOfDamage: daysFromToday(-3),
  timeOfDamage: '06:30',
  estimatedTime: 'Yes',
  whoFoundDamage: 'Building Manager',
  primaryLossCause: 'Water Damage',
  whatHappened: `QA AUTOMATION ${runTag()} - flexible hose on the hot water riser failed; water tracked into Unit 15 bathroom.`,
  whereItHappened: 'Riser cupboard level 4 and Unit 15 bathroom',
  thirdPartyInvolved: 'No',
  witnesses: 'No',
  repairsArranged: 'Yes',
  soleOwner: 'No',
  otherInsurances: 'No',

  items: [
    {
      name: 'Unit 15 bathroom make-good',
      description: 'Vanity, flooring and wall linings water damaged',
      estimatedValue: 12100,
      attachments: 1,
    },
  ],

  primaryContactSearch: 'Bryan Villalobos',
  primaryContactEmail: undefined,
  siteInspectionContact: 'No',
  additionalClaimContact: 'No',
  accountName: 'The Owners - QA Test',
  bsb: '062000',
};
