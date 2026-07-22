import { test, expect, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = path.join(__dirname, '..', '..', 'design-exports');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'booking-form-close-desktop-1440.png');
const OUTPUT_PDF = path.join(OUTPUT_DIR, 'booking-form-close-desktop-1440.pdf');
const DESIGN_PREVIEW_URL = '/__design__/booking-form';

const EXPORT_STYLES = `
  .app-sidebar,
  .app-header,
  .skip-link,
  .accessibility-widget,
  [class*="AccessibilityWidget"],
  [class*="accessibility"],
  .a11y-widget,
  .a11y-widget-toggle {
    display: none !important;
  }

  .maple-email-suggestions,
  [class*="emailSuggestions"] {
    display: none !important;
  }

  .app-layout,
  .app-layout-main,
  .app-layout-main-fill,
  .app-layout-viewport-fill {
    display: block !important;
    height: auto !important;
    overflow: visible !important;
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    min-height: 0 !important;
  }

  main,
  main > * {
    overflow: visible !important;
    height: auto !important;
    max-height: none !important;
    flex: none !important;
    min-height: auto !important;
  }

  .maple-bs-form,
  .maple-form-card,
  form.card-body {
    overflow: visible !important;
    height: auto !important;
    max-height: none !important;
    flex: none !important;
    display: block !important;
  }

  .maple-form-footer,
  .card-footer {
    position: static !important;
    box-shadow: none !important;
  }

  body {
    overflow: visible !important;
    background: #f4f5f7 !important;
  }
`;

async function openBookingForm(page: Page) {
  await page.goto(DESIGN_PREVIEW_URL);
  await expect(page.getByRole('heading', { name: 'סגירת הזמנת אירוע' })).toBeVisible({ timeout: 30_000 });
}

async function fillDemoData(page: Page) {
  const createdBy = page.locator('select[name="createdBy"]');
  await createdBy.waitFor({ state: 'visible', timeout: 15_000 });
  const options = await createdBy.locator('option:not([disabled])').all();
  if (options.length > 1) {
    const value = await options[1].getAttribute('value');
    if (value) await createdBy.selectOption(value);
  }

  await page.locator('select[name="eventType"]').selectOption('חתונה');

  await page.locator('input[name="clientAFullName"]').fill('דוד כהן');
  await page.locator('input[name="clientAIdNumber"]').fill('123456782');
  await page.locator('input[name="clientAPhone"]').fill('050-1234567');
  await page.locator('input[name="clientAPhone2"]').fill('052-7654321');
  await page.locator('input[name="clientAEmail"]').fill('david.cohen@gmail.com');
  await page.locator('input[name="clientACity"]').fill('ירושלים');
  await page.locator('input[name="clientAAddress"]').fill('רחוב הרצל 12');

  await page.locator('input[name="clientBFullName"]').fill('שרה לוי');
  await page.locator('input[name="clientBIdNumber"]').fill('987654321');
  await page.locator('input[name="clientBPhone"]').fill('054-1112233');
  await page.locator('input[name="clientBEmail"]').fill('sara.levi@gmail.com');
  await page.getByRole('heading', { name: 'סגירת הזמנת אירוע' }).click();
  await page.locator('input[name="clientBCity"]').fill('בני ברק');
  await page.locator('input[name="clientBAddress"]').fill('רחוב רבי עקיבא 5');

  await page.locator('select[name="timeOfDay"]').selectOption({ index: 1 }).catch(async () => {
    await page.locator('select[name="timeOfDay"]').selectOption('evening');
  });
  await page.locator('input[name="startTime"]').fill('18:00');
  await page.locator('input[name="endTime"]').fill('23:30');
  await page.locator('input[name="guestCount"]').fill('300');

  await page.locator('input[name="discountPercent"]').fill('5').catch(() => {});
  await page.locator('input[name="advancePaid"]').fill('15000').catch(() => {});

  const menuNote = page.getByPlaceholder('לדוגמה: אלרגיות...');
  if (await menuNote.isVisible().catch(() => false)) {
    await menuNote.fill('ללא גלוטן ל-5 מנות');
  }

  const internalNote = page.getByPlaceholder('הוסף הערה פנימית...');
  if (await internalNote.isVisible().catch(() => false)) {
    await internalNote.fill('הלקוח ביקש לבדוק תאורה נוספת');
  }

  const akumCode = page.locator('input[name="akumApprovalCode"]');
  if (await akumCode.isVisible().catch(() => false)) {
    await akumCode.fill('ACUM-12345');
  }
}

async function captureForm(page: Page) {
  await page.addStyleTag({ content: EXPORT_STYLES });
  await page.evaluate(() => {
    const selectors = [
      '.app-layout',
      '.app-layout-main',
      'main',
      '.maple-bs-form',
      '.maple-form-card',
      'form',
    ];
    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((node) => {
        const el = node as HTMLElement;
        el.style.overflow = 'visible';
        el.style.height = 'auto';
        el.style.maxHeight = 'none';
        el.style.minHeight = '0';
        el.style.flex = 'none';
        el.style.display = selector.includes('maple-form-card') || selector === '.maple-bs-form' ? 'block' : el.style.display;
      });
    }

    const form = document.querySelector('form') as HTMLElement | null;
    const formCard = document.querySelector('.maple-form-card') as HTMLElement | null;
    if (form) {
      const totalChildHeight = Array.from(form.children).reduce(
        (sum, child) => sum + (child as HTMLElement).getBoundingClientRect().height,
        0,
      );
      form.style.height = `${Math.ceil(totalChildHeight + 24)}px`;
      form.style.overflow = 'visible';
    }
    if (formCard && form) {
      const header = formCard.querySelector('.card-header') as HTMLElement | null;
      const headerHeight = header?.getBoundingClientRect().height ?? 0;
      formCard.style.height = `${Math.ceil(headerHeight + form.getBoundingClientRect().height)}px`;
    }
  });
  await page.waitForTimeout(800);

  const formCard = page.locator('.maple-bs-form .card').first();
  await expect(formCard).toBeVisible();
  await expect(page.getByRole('button', { name: 'שמירת וסגירת אירוע' })).toBeVisible();

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const submitButton = page.getByRole('button', { name: 'שמירת וסגירת אירוע' });
  await expect(submitButton).toBeVisible();

  const clip = await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelectorAll<HTMLElement>('*').forEach((node) => {
      if (node.scrollTop > 0) node.scrollTop = 0;
    });

    const formCard = document.querySelector('.maple-form-card') as HTMLElement | null;
    const submit = Array.from(document.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('שמירת וסגירת אירוע'),
    ) as HTMLElement | undefined;

    if (!formCard || !submit) {
      throw new Error('Could not locate booking form elements for export');
    }

    const cardRect = formCard.getBoundingClientRect();
    const submitRect = submit.getBoundingClientRect();

    return {
      x: Math.max(0, cardRect.x - 8),
      y: Math.max(0, cardRect.y - 8),
      width: cardRect.width + 16,
      height: Math.ceil(submitRect.bottom - cardRect.y + 24),
    };
  });

  await page.screenshot({
    path: OUTPUT_FILE,
    animations: 'disabled',
    caret: 'hide',
    clip,
  });

  console.log(`\n✅ התמונה נשמרה: ${OUTPUT_FILE}\n`);

  return clip;
}

async function captureFormAsPdf(page: Page, clip: { x: number; y: number; width: number; height: number }) {
  await page.emulateMedia({ media: 'screen' });

  await page.pdf({
    path: OUTPUT_PDF,
    width: `${Math.ceil(clip.width)}px`,
    height: `${Math.ceil(clip.height)}px`,
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    preferCSSPageSize: false,
  });

  console.log(`\n✅ ה-PDF נשמר: ${OUTPUT_PDF}\n`);
}

test.describe('Design export', () => {
  test.use({
    viewport: { width: 1440, height: 2400 },
    deviceScaleFactor: 2,
    locale: 'he-IL',
  });

  test('export booking form as desktop PNG and PDF', async ({ page }) => {
    test.setTimeout(60_000);

    await openBookingForm(page);
    await fillDemoData(page);
    const clip = await captureForm(page);
    await captureFormAsPdf(page, clip);

    expect(fs.existsSync(OUTPUT_FILE)).toBeTruthy();
    expect(fs.existsSync(OUTPUT_PDF)).toBeTruthy();
  });
});
