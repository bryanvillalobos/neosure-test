/**
 * Page object for PolicyAndClaimsManagement -> Lodge Claim (AddClaim).
 *
 * Five steps: Setup, Details, Evidence, Contacts, Finalise. The claim row is
 * written as a DRAFT the moment step 1 is continued (the URL's ClaimId turns
 * non-zero), and only becomes a lodged claim on "Lodge Claim" in step 5 — so a
 * run that dies part-way leaves a draft behind, exactly like Add Property.
 *
 * Widget suffixes below were read off the live screen on 11 Oct 2026.
 */
import { expect, Locator, Page } from '@playwright/test';
import { BASE_URL, DASHBOARD_PATH } from './config';
import { loginWithEnvCredentials } from './login';
import { ClaimInput, ClaimItem } from './claim-data';
import {
  answerYesNo,
  byIdSuffix,
  clickButton,
  clickUntilChecked,
  openPanel,
  setDate,
  setText,
  setTextBySuffix,
} from './os';

/**
 * OutSystems keeps the session id it threads through cross-module URLs here.
 * Opening a PolicyAndClaimsManagement page WITHOUT `ActiveSessionId` in the
 * query string signs the user out (reproduced repeatedly in manual testing),
 * so every navigation into that module must carry it.
 */
const SESSION_KEYS = [
  '$OS_Users$PortfolioManagement$ClientVars$ActiveSessionId',
  '$OS_Users$PolicyAndClaimsManagement$ClientVars$ActiveSessionId',
];

/** A 1x1 PNG, so attachments need no fixture files on disk. */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

export interface LodgedClaim {
  claimId: string;
  /** e.g. CLM-202610-01225, read from the success dialog. */
  reference: string | null;
}

export class LodgeClaimWizard {
  constructor(private readonly page: Page) {}

  claimId: string | null = null;

  // -------------------------------------------------------------------------

  /** Land on the dashboard signed in, recovering with env credentials if set. */
  private async ensureSignedIn(): Promise<void> {
    await this.page.goto(`${BASE_URL}${DASHBOARD_PATH}`, { waitUntil: 'domcontentloaded' });
    const marker = this.page.getByRole('button', { name: 'Add Property' });
    const signedIn = await marker
      .waitFor({ state: 'visible', timeout: 45_000 })
      .then(() => true)
      .catch(() => false);
    if (signedIn) return;

    if (!(await loginWithEnvCredentials(this.page))) {
      throw new Error(
        'Not signed in. Run `npm run auth:strata`, or set NEOSURE_EMAIL / NEOSURE_PASSWORD.',
      );
    }
  }

  private async activeSessionId(): Promise<string> {
    const id = await this.page.evaluate((keys) => {
      for (const k of keys) {
        const v = localStorage.getItem(k);
        if (v) return v.replace(/"/g, '');
      }
      return null;
    }, SESSION_KEYS);
    if (!id) {
      throw new Error(
        'No ActiveSessionId in localStorage. Opening the claims module without it ' +
          'signs the user out, so the run stops here. Is the profile signed in?',
      );
    }
    return id;
  }

  /** Open the Lodge Claim wizard for an existing property. */
  async open(propertyId: string | number): Promise<void> {
    await this.ensureSignedIn();
    const sid = await this.activeSessionId();

    const url =
      `${BASE_URL}/PolicyAndClaimsManagement/AddClaim` +
      `?ActiveSessionId=${encodeURIComponent(sid)}&ClaimId=0&PropertyId=${propertyId}`;
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });

    if (/\/Login/i.test(this.page.url())) {
      throw new Error('Opening AddClaim bounced to Login. The session id was rejected.');
    }

    await expect(this.page.getByText('CLAIM SETUP', { exact: false }).first()).toBeVisible({
      timeout: 60_000,
    });
    // The property card fills from a data action after the step paints; wait
    // for its content, not just the heading, or the ABN click is re-rendered away.
    await expect(this.page.getByText('Insured Name (Plan Number)').first()).toBeVisible({
      timeout: 60_000,
    });
  }

  // --- Step 1: Setup --------------------------------------------------------

  async fillSetupStep(data: ClaimInput): Promise<void> {
    await answerYesNo(this.page, 'Do you have an ABN', data.hasAbn, {
      fallbackIdSuffix: data.hasAbn === 'Yes' ? 'RBFiveyearyes-input' : 'RBFiveyearNo-input',
    });
    if (data.hasAbn === 'Yes') {
      if (!data.abn) throw new Error('hasAbn is Yes but no abn was given');
      const abn = byIdSuffix(this.page, 'ABN');
      if (await abn.isEnabled()) await setText(abn, data.abn);
    }

    await clickButton(this.page, 'Continue');
    await this.captureClaimId();
  }

  /** ClaimId=0 until step 1 is saved; wait for a real one, like PropertyId. */
  private async captureClaimId(): Promise<void> {
    await this.page.waitForURL(/[?&]ClaimId=[1-9]\d*/, { timeout: 90_000 });
    this.claimId = new URL(this.page.url()).searchParams.get('ClaimId');
  }

  // --- Step 2: Incident details ---------------------------------------------

  async fillDetailsStep(data: ClaimInput): Promise<void> {
    const location = byIdSuffix(this.page, 'TextArea_LocationDescription');
    await expect(byIdSuffix(this.page, 'Input_WhoFoundDamageFirst')).toBeVisible({ timeout: 60_000 });
    await expect(location).toBeAttached({ timeout: 30_000 });

    // Re-render triggers first (date, radios), free text last — the same rule
    // as the Add Property claim panel: picking a tile re-renders the block and
    // can blank text typed before it.
    await setDate(this.page, 'Input_DateDamageOccurred', data.dateOfDamage);
    await byIdSuffix(this.page, 'Input_TimeDamageOccurred').fill(data.timeOfDamage);
    await expect(byIdSuffix(this.page, 'Input_TimeDamageOccurred')).toHaveValue(data.timeOfDamage);

    await this.pickRadioByLabel(data.primaryLossCause);

    // Generic fallback ids: estimated time 2, third party 4, witnesses 5,
    // repairs 6, sole owner 7, other insurance 8.
    const yn = (q: string, a: 'Yes' | 'No', n: number) =>
      answerYesNo(this.page, q, a, a === 'Yes' ? `RBFiveyearyes${n}-input` : `RBFiveyearNo${n}-input`);
    await yn('estimated time', data.estimatedTime, 2);
    await yn('Third Party Involved', data.thirdPartyInvolved, 4);
    await yn('any witnesses', data.witnesses, 5);
    await yn('repairs been arranged', data.repairsArranged, 6);
    await yn('sole owner', data.soleOwner, 7);
    await yn('other insurances', data.otherInsurances, 8);

    await setTextBySuffix(this.page, 'Input_WhoFoundDamageFirst', data.whoFoundDamage);
    await setTextBySuffix(this.page, 'TextArea_WhatHappen', data.whatHappened);
    await setText(location, data.whereItHappened);

    await clickButton(this.page, 'Continue');
    await expect(this.page.getByText('YOUR EVIDENCE', { exact: false }).first()).toBeVisible({
      timeout: 60_000,
    });
  }

  /**
   * Loss-cause tiles are radios whose ids do not match their labels
   * (`StormDamage-input` is "Fire and smoke"), so match on the visible label.
   */
  private async pickRadioByLabel(label: string, scope?: Locator): Promise<void> {
    const id = await (scope ?? this.page.locator('body')).evaluate((root, want) => {
      const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
      for (const r of Array.from(root.querySelectorAll<HTMLInputElement>('input[type="radio"]'))) {
        const own = r.id ? document.querySelector(`label[for="${CSS.escape(r.id)}"]`) : null;
        const text = norm(own?.textContent ?? r.closest('label')?.textContent ?? '');
        if (text === norm(want)) return r.id;
      }
      return null;
    }, label);
    if (!id) throw new Error(`No radio labelled "${label}"`);
    await clickUntilChecked(this.page.locator(`[id="${id}"]`));
  }

  // --- Step 3: Evidence -----------------------------------------------------

  async fillEvidenceStep(data: ClaimInput): Promise<void> {
    if (!data.items.length) throw new Error('At least one claim item is required by the app');
    for (const item of data.items) await this.addItem(item);

    await clickButton(this.page, 'Continue');
    await expect(this.page.getByText('CONTACT INFORMATION', { exact: false }).first()).toBeVisible({
      timeout: 60_000,
    });
  }

  private async addItem(item: ClaimItem): Promise<void> {
    if (!Number.isInteger(item.estimatedValue)) {
      throw new Error(
        `Estimated value ${item.estimatedValue} has cents — the mask drops the decimal ` +
          'point and would save it 100x too large. Use whole dollars.',
      );
    }
    await clickButton(this.page, 'Add Claim Item');
    const panel = openPanel(this.page);
    const name = byIdSuffix(this.page, 'Input_ItemName', panel);
    await expect(name).toBeVisible({ timeout: 20_000 });

    await setText(name, item.name);
    await setTextBySuffix(this.page, 'TextArea_DamageDescription', item.description, panel);
    await setTextBySuffix(this.page, 'Input_EstimatedValue', item.estimatedValue, panel);

    for (let i = 1; i <= item.attachments; i++) {
      await this.uploadOne(panel, `qa-evidence-${i}.png`);
    }

    await clickButton(this.page, 'Save', { scope: panel });
    await expect(
      this.page.getByText(item.name, { exact: false }).locator('visible=true').first(),
      `claim item "${item.name}" did not appear in Claimable Items`,
    ).toBeVisible({ timeout: 30_000 });
  }

  /**
   * FilePond upload. The first upload frequently times out server-side
   * (OS-CLRT-60900, 10 s), so press FilePond's retry until the file lands.
   */
  private async uploadOne(panel: Locator, fileName: string): Promise<void> {
    await panel
      .locator('input[type="file"]')
      .first()
      .setInputFiles({ name: fileName, mimeType: 'image/png', buffer: TINY_PNG });

    const row = panel.getByText(fileName, { exact: false }).locator('visible=true');
    for (let attempt = 1; attempt <= 4; attempt++) {
      const landed = await expect(row.first())
        .toBeVisible({ timeout: 15_000 })
        .then(() => true)
        .catch(() => false);
      // FilePond shows the name in its own item while uploading too, so also
      // require that no error item is left behind.
      const failed = panel.locator('.filepond--item[data-filepond-item-state*="error"]');
      if (landed && (await failed.count()) === 0) return;

      const retry = panel.locator('.filepond--action-retry-item-processing').first();
      if (await retry.isVisible().catch(() => false)) {
        console.log(`  [upload] ${fileName} failed, retrying (${attempt})`);
        await retry.click();
      }
    }
    throw new Error(`Attachment ${fileName} would not upload after 4 attempts`);
  }

  // --- Step 4: Contacts -----------------------------------------------------

  async fillContactsStep(data: ClaimInput): Promise<void> {
    await expect(byIdSuffix(this.page, 'Input_PayeeName')).toBeVisible({ timeout: 60_000 });

    await this.pickPrimaryContact(data.primaryContactSearch, data.primaryContactEmail);

    // Clicking the option box does not select these; the input itself does.
    await answerYesNo(this.page, 'site inspection contact', data.siteInspectionContact, 'SiteInspectionContactNo-input');
    await answerYesNo(this.page, 'additional claim contact', data.additionalClaimContact, 'additionalclaimcontactNo-input');

    await setTextBySuffix(this.page, 'Input_PayeeName', data.accountName);
    await setTextBySuffix(this.page, 'Input_PayeeBankAccount', data.bsb);
    // Bank name is looked up from the BSB.
    await expect(byIdSuffix(this.page, 'Input_PaymentBank')).not.toHaveValue('', { timeout: 20_000 });

    await clickButton(this.page, 'Continue');
    await expect(this.page.getByText('FINALISE CLAIM', { exact: false }).first()).toBeVisible({
      timeout: 60_000,
    });
  }

  /**
   * Virtual-select with a search box. The list contains several people with
   * identical names and no email, so when an email is given each match is tried
   * until the details card under the dropdown shows it.
   */
  private async pickPrimaryContact(search: string, email?: string): Promise<void> {
    const dropdown = this.page.locator('.vscomp-ele-wrapper').first();
    const tries = email ? 10 : 1;

    for (let i = 0; i < tries; i++) {
      await dropdown.scrollIntoViewIfNeeded();
      await dropdown.click();
      const box = this.page.locator('.vscomp-search-input:visible').first();
      await box.waitFor({ state: 'visible' });
      await box.fill('');
      await box.pressSequentially(search, { delay: 20 });

      const options = this.page.locator('.vscomp-option:visible').filter({ hasText: search });
      await expect(options.first(), `no contact matching "${search}"`).toBeVisible({ timeout: 15_000 });
      if (i >= (await options.count())) break;
      await options.nth(i).click();

      await expect(dropdown).toContainText(search.slice(0, 6), { timeout: 10_000 });
      if (!email) return;
      const card = this.page.getByText(email, { exact: false }).locator('visible=true');
      if (await card.first().isVisible({ timeout: 5_000 }).catch(() => false)) return;
    }
    throw new Error(`No "${search}" in the contact list shows the email ${email}`);
  }

  // --- Step 5: Finalise -----------------------------------------------------

  async lodge(): Promise<LodgedClaim> {
    // All three are mandatory today, including the "representative" one.
    for (const fragment of ['I declare that', 'I consent to Neosure', 'Where I have completed']) {
      await this.tickDeclaration(fragment);
    }

    await clickButton(this.page, 'Lodge Claim');
    const success = this.page.getByText('Claim lodged successfully', { exact: false });
    await expect(success.first()).toBeVisible({ timeout: 120_000 });

    const text = (await this.page.locator('body').innerText()) ?? '';
    const reference = text.match(/CLM-\d{6}-\d+/)?.[0] ?? null;
    if (!this.claimId) throw new Error('Lodged without capturing a ClaimId');
    return { claimId: this.claimId, reference };
  }

  private async tickDeclaration(fragment: string): Promise<void> {
    const id = await this.page.evaluate((frag) => {
      const want = frag.toLowerCase();
      for (const box of Array.from(document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))) {
        let node: HTMLElement | null = box.parentElement;
        for (let i = 0; i < 5 && node; i++) {
          const t = (node.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
          if (t.includes(want) && t.length < 400) return box.id;
          node = node.parentElement;
        }
      }
      return null;
    }, fragment);
    if (!id) throw new Error(`Declaration checkbox "${fragment}…" not found`);
    const box = this.page.locator(`[id="${id}"]`);
    if (!(await box.isChecked())) await clickUntilChecked(box);
  }

  // -------------------------------------------------------------------------

  /** The whole wizard for an existing property. */
  async lodgeClaim(propertyId: string | number, data: ClaimInput): Promise<LodgedClaim> {
    await this.open(propertyId);
    await this.fillSetupStep(data);
    await this.fillDetailsStep(data);
    await this.fillEvidenceStep(data);
    await this.fillContactsStep(data);
    return this.lodge();
  }
}
