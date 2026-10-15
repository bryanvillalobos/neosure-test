/**
 * Helpers for driving OutSystems Reactive screens.
 *
 * Why suffix selectors: every widget id on an ODC screen is prefixed with the
 * block id that happens to render it (`b17-txtInsuredName`, `b24-Input_Suburb`).
 * That prefix changes whenever the screen is restructured and republished, but
 * the developer-chosen tail does not. So everything here matches on
 * `[id$="-<name>"]` rather than on the full id.
 *
 * Where a widget has no meaningful name (the generic `RadioButton7` style ids
 * OutSystems hands out), we resolve it from the question text instead — see
 * `answerYesNo`.
 */
import { expect, Locator, Page } from '@playwright/test';

/**
 * The slide-in panels ("Add Committee Member", "Add Strata Scheme") are OSUI
 * sidebars. Closed ones stay in the DOM parked off-screen with a real bounding
 * box, so `:visible` does not tell them apart — the open class does. Panels can
 * nest (a committee panel opens on top of a scheme panel), and the inner one is
 * a DOM descendant of the outer, so `.last()` is the innermost.
 */
export const OPEN_PANEL = 'aside.osui-sidebar.osui-sidebar--is-open';

export function openPanel(page: Page): Locator {
  return page.locator(OPEN_PANEL).last();
}

/**
 * A widget matched by the developer-chosen tail of its OutSystems id.
 *
 * Pass `scope` whenever the same widget name exists more than once on screen —
 * the Building Committee step has two committee-member forms live at once
 * (one for the committee itself, one inside each strata scheme panel), and an
 * unscoped match silently picks the wrong one.
 */
export function byIdSuffix(page: Page, suffix: string, scope?: Locator): Locator {
  return (scope ?? page).locator(`[id$="-${suffix}"]`).first();
}

/**
 * Click a radio or checkbox until it actually registers.
 *
 * Two things conspire here. These controls are visually replaced, so the real
 * input is often zero-sized and has to be clicked through the element itself.
 * And answering one question re-renders the card around it — the Disclosure
 * cards grow an "N claims added" block the moment the claims question is
 * answered — which swaps out the neighbouring nodes. A click on a node that has
 * just been replaced silently does nothing, and the assertion that follows then
 * fails against the *new* node.
 *
 * So: re-resolve the locator on every attempt, click, and confirm it took.
 */
export async function clickUntilChecked(
  target: Locator,
  { attempts = 4 }: { attempts?: number } = {},
): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await target.waitFor({ state: 'attached' });
    await target.scrollIntoViewIfNeeded().catch(() => undefined);
    await target.evaluate((el) => (el as HTMLInputElement).click());

    await target.page().waitForTimeout(250);
    if (await target.isChecked()) return;

    await target.page().waitForTimeout(400 * attempt);
  }
  throw new Error(
    `Control never became checked after ${attempts} attempts (${target}). The card ` +
      'around it is probably re-rendering and replacing the node mid-click.',
  );
}

/** Compare what we typed with what stuck, ignoring mask formatting. */
function sameValue(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/[\s,$]/g, '');
  return norm(a) === norm(b);
}

/** Read a masked money field ("$5,000.00", "5000.00", "5 000") as a number. */
function moneyValue(s: string): number {
  const cleaned = s.replace(/[^\d.-]/g, '');
  return cleaned === '' ? NaN : Number(cleaned);
}

export interface SetTextOptions {
  attempts?: number;
  /**
   * The input carries a cents-style currency mask: every key is a digit that
   * pushes in from the right, so typing "5000" lands as 50.00. Pass the value
   * in dollars; it is typed as cents (5000 -> "500000") and read back as a
   * number, so "5,000.00" and "5000" count as the same thing.
   */
  money?: boolean;
}

/**
 * Type into a text/number input the way a person would, then make sure it
 * stuck.
 *
 * Two problems this solves. `.fill()` is not enough, because several of these
 * inputs carry a currency mask or an OutSystems OnChange handler that only
 * fires on real key events — a programmatic set of `500000` can leave `50`
 * behind.
 *
 * And more awkwardly: a field can be visible before the block around it has
 * finished rendering. When the data action behind it completes, OutSystems
 * rewrites the model-bound value and silently wipes whatever was typed in the
 * meantime. A person is too slow to hit that window; Playwright is not. So the
 * value is read back and retyped if it vanished.
 */
export async function setText(
  target: Locator,
  value: string | number,
  { attempts = 3, money = false }: SetTextOptions = {},
): Promise<void> {
  const want = String(value);
  const dollars = Number(value);
  if (money && !Number.isFinite(dollars)) {
    throw new Error(`setText({ money: true }) needs a number, got "${want}"`);
  }
  // What actually gets typed: cents digits for a money mask, the value otherwise.
  const keys = money ? String(Math.round(dollars * 100)) : want;
  const matches = (actual: string) =>
    money ? Math.abs(moneyValue(actual) - dollars) < 0.005 : sameValue(actual, want);

  for (let attempt = 1; attempt <= attempts; attempt++) {
    await target.waitFor({ state: 'visible' });
    await target.click();
    await target.press('ControlOrMeta+a');
    await target.pressSequentially(keys, { delay: 10 });
    await target.blur();

    await target.page().waitForTimeout(300);
    const actual = await target.inputValue();
    if (matches(actual)) return;

    if (attempt === attempts) {
      // A value that is there but scaled by 100 is a currency mask, not a
      // re-render — say so instead of sending the reader down the wrong path.
      const scaled = moneyValue(actual);
      const looksMasked =
        !money &&
        Number.isFinite(scaled) &&
        Number.isFinite(dollars) &&
        dollars !== 0 &&
        Math.abs(scaled * 100 - dollars) < 0.005;
      throw new Error(
        `Field kept losing its value: wanted "${want}", found "${actual}" after ` +
          `${attempts} attempts. ` +
          (looksMasked
            ? 'This input has a cents-style currency mask — pass { money: true }.'
            : 'The block is probably still re-rendering — wait for something later ' +
              'in it to appear before typing.'),
      );
    }
    // Give the late render time to land before trying again.
    await target.page().waitForTimeout(400 * attempt);
  }
}

export async function setTextBySuffix(
  page: Page,
  suffix: string,
  value: string | number,
  scope?: Locator,
  options?: SetTextOptions,
): Promise<void> {
  await setText(byIdSuffix(page, suffix, scope), value, options);
}

/** Pick an option in a native OutSystems dropdown by its visible text. */
export async function setSelect(
  page: Page,
  suffix: string,
  label: string,
  scope?: Locator,
): Promise<void> {
  const select = byIdSuffix(page, suffix, scope);
  await select.waitFor({ state: 'visible' });
  await select.selectOption({ label });
}

/**
 * Date pickers on this screen are flatpickr instances wrapping a hidden native
 * input — the visible box is readonly, so typing into it does nothing. Driving
 * the instance directly with `triggerChange` fires the same OnChange the
 * calendar would, which is what OutSystems is listening for.
 *
 * @param iso date as YYYY-MM-DD
 */
export async function setDate(
  page: Page,
  suffix: string,
  iso: string,
  scope?: Locator,
): Promise<void> {
  // `scope` matters and used to be silently dropped: AddPropertyWizard passes
  // the open claim panel here, but the old signature took only three
  // arguments, so the call fell back to a bare document.querySelector and set
  // the FIRST date input on the page. With one claim panel open that happened
  // to be the right one; with a claims panel open on top of a scheme panel it
  // is not. Resolving through the locator keeps the scope.
  const target = (scope ?? page).locator(`[id$="-${suffix}"]`).first();
  await target.waitFor({ state: 'attached' });
  await target.evaluate((el, value) => {
    const picker = (el as HTMLInputElement & { _flatpickr?: any })._flatpickr;
    if (!picker) throw new Error(`No flatpickr instance on ${(el as HTMLElement).id}`);
    picker.setDate(value, true);
    picker.close();
  }, iso);
}

/** The icon tiles used for "Building title/type" and "primary use". */
export async function clickSymbolCard(page: Page, title: string, scope?: Locator): Promise<void> {
  const card = (scope ?? page).locator('.symbol-card').filter({ hasText: title }).first();
  await card.scrollIntoViewIfNeeded();
  await card.click();
}

/**
 * Answer a Yes/No question by its wording rather than by widget id.
 *
 * The markup is a question `<label>`, then two option boxes each holding an
 * `<input type=radio>` with its own `<label for>` reading "Yes" or "No". We
 * walk up from the question until we reach the ancestor containing both
 * radios, then hand the id back so Playwright can do a real click on it.
 *
 * Pass a short distinctive fragment, not the whole sentence — matching is
 * substring-based on purpose, because the screen contains at least one typo
 * ("Is this buliding heritage listed?") that will be fixed one day.
 *
 * `fallbackIdSuffix` covers the handful of questions OutSystems left as
 * `RadioButton7`/`RadioButton8`: if the wording ever stops matching, the
 * widget id still will.
 */
export async function answerYesNo(
  page: Page,
  question: string,
  answer: 'Yes' | 'No' | 'Not Sure',
  // A bare string is the common case (just a fallback widget id); the object
  // form is for the panels, where the same question exists more than once.
  opts: string | { fallbackIdSuffix?: string; scope?: Locator; rootSelector?: string } = {},
): Promise<void> {
  const { fallbackIdSuffix, scope, rootSelector } =
    typeof opts === 'string' ? { fallbackIdSuffix: opts, scope: undefined, rootSelector: undefined } : opts;

  const id = await page.evaluate(
    ([q, a, rootSel]) => {
      const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
      const target = norm(q);
      // Scope matters: the same question ("Do you have an onsite building
      // manager?") appears both on the Building Committee form and inside each
      // strata scheme panel.
      const roots = rootSel ? Array.from(document.querySelectorAll(rootSel)) : [];
      const root: ParentNode = roots.length ? roots[roots.length - 1] : document;
      const labels = Array.from(root.querySelectorAll('label')).filter((l) =>
        norm(l.textContent ?? '').includes(target),
      );

      for (const label of labels) {
        let node: HTMLElement | null = label.parentElement;
        for (let i = 0; i < 8 && node; i++) {
          const radios = Array.from(node.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
          if (radios.length >= 2) {
            const match = radios.find((r) => {
              const own = r.id ? document.querySelector(`label[for="${CSS.escape(r.id)}"]`) : null;
              return norm(own?.textContent ?? '') === norm(a);
            });
            if (match) return match.id;
          }
          node = node.parentElement;
        }
      }
      return null;
    },
    [question, answer, rootSelector ?? ''] as const,
  );

  const radio = id
    ? page.locator(`[id="${id}"]`)
    : fallbackIdSuffix
      ? byIdSuffix(page, fallbackIdSuffix, scope)
      : null;

  if (!radio) throw new Error(`Could not find a "${answer}" radio for question: ${question}`);
  await clickUntilChecked(radio);
}

/**
 * Tick (or untick) a checkbox.
 *
 * `suffix` (the developer-chosen tail of the widget id) is tried first because
 * it is what these checkboxes reliably have; the visible text is the fallback,
 * matched against the checkbox's own `<label for>` or its nearest short-text
 * ancestor.
 */
export async function setCheckbox(
  page: Page,
  { suffix, labelText }: { suffix?: string; labelText?: string },
  checked: boolean,
  scope?: Locator,
): Promise<void> {
  let box: Locator | null = null;

  if (suffix && (await (scope ?? page).locator(`[id$="-${suffix}"]`).count())) {
    box = byIdSuffix(page, suffix, scope);
  } else if (labelText) {
    const id = await page.evaluate((text) => {
      const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
      const want = norm(text);
      const boxes = Array.from(
        document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
      );
      for (const input of boxes) {
        const own = input.id
          ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`)
          : null;
        if (own && norm(own.textContent ?? '') === want) return input.id;

        let node: HTMLElement | null = input.parentElement;
        for (let i = 0; i < 4 && node; i++) {
          const text = norm(node.textContent ?? '');
          if (text === want) return input.id;
          if (text.length > 80) break;
          node = node.parentElement;
        }
      }
      return null;
    }, labelText);
    if (id) box = page.locator(`[id="${id}"]`);
  }

  if (!box) throw new Error(`No checkbox found for ${suffix ?? labelText}`);
  await box.scrollIntoViewIfNeeded();
  if (checked) {
    if (!(await box.isChecked())) await clickUntilChecked(box);
  } else if (await box.isChecked()) {
    await box.evaluate((el) => (el as HTMLInputElement).click());
  }
  await expect(box).toBeChecked({ checked });
}

/**
 * Click a button by its exact visible text.
 *
 * Defaults to `.last()` because the wizard footer sits after everything else;
 * pass `scope` (usually `openPanel(page)`) when a panel has its own Save, or
 * `first: true` for a button that appears before its duplicates in the DOM.
 */
export async function clickButton(
  page: Page,
  name: string,
  { scope, first = false }: { scope?: Locator; first?: boolean } = {},
): Promise<void> {
  const matches = (scope ?? page).getByRole('button', { name, exact: true });
  const button = first ? matches.first() : matches.last();
  await button.scrollIntoViewIfNeeded();
  await button.click();
}

/** Block until the named wizard step has actually painted. */
export async function waitForStep(page: Page, heading: string): Promise<void> {
  await expect(page.getByText(heading, { exact: false }).first()).toBeVisible({ timeout: 60_000 });
}
