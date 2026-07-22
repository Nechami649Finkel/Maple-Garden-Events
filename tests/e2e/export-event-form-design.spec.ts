import { test, expect, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = path.join(__dirname, '..', '..', 'design-exports');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'event-form-production-desktop-1440.png');
const OUTPUT_PDF = path.join(OUTPUT_DIR, 'event-form-production-desktop-1440.pdf');
const DESIGN_PREVIEW_URL = '/__design__/event-form';

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
  .maple-form-container,
  .maple-form-body,
  .maple-form-board {
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

async function openEventForm(page: Page) {
  await page.goto(DESIGN_PREVIEW_URL);
  await expect(page.getByText('דוד כהן')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'שמירת טופס' })).toBeVisible();
}

async function captureForm(page: Page) {
  await page.addStyleTag({ content: EXPORT_STYLES });
  await page.evaluate(() => {
    const selectors = [
      '.app-layout',
      '.app-layout-main',
      'main',
      '.maple-bs-form',
      '.maple-form-container',
      '.maple-form-body',
      '.maple-form-board',
    ];
    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((node) => {
        const el = node as HTMLElement;
        el.style.overflow = 'visible';
        el.style.height = 'auto';
        el.style.maxHeight = 'none';
        el.style.minHeight = '0';
        el.style.flex = 'none';
      });
    }

    const formContainer = document.querySelector('.maple-form-container') as HTMLElement | null;
    const formBody = document.querySelector('.maple-form-body') as HTMLElement | null;
    if (formContainer && formBody) {
      const header = formContainer.querySelector('.card-header') as HTMLElement | null;
      const footer = formContainer.querySelector('.card-footer') as HTMLElement | null;
      const headerHeight = header?.getBoundingClientRect().height ?? 0;
      const bodyHeight = formBody.scrollHeight;
      const footerHeight = footer?.getBoundingClientRect().height ?? 0;
      formContainer.style.height = `${Math.ceil(headerHeight + bodyHeight + footerHeight + 16)}px`;
    }
  });
  await page.waitForTimeout(1000);

  const formContainer = page.locator('.maple-form-container').first();
  await expect(formContainer).toBeVisible();
  await expect(page.getByRole('button', { name: 'שמירת טופס' })).toBeVisible();
  await expect(page.getByRole('heading', { name: "פרטי הצ'ק" })).toBeVisible();

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const clip = await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelectorAll<HTMLElement>('*').forEach((node) => {
      if (node.scrollTop > 0) node.scrollTop = 0;
    });

    const formContainer = document.querySelector('.maple-form-container') as HTMLElement | null;
    const saveBtn = Array.from(document.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('שמירת טופס'),
    ) as HTMLElement | undefined;

    if (!formContainer || !saveBtn) {
      throw new Error('Could not locate event form elements for export');
    }

    const containerRect = formContainer.getBoundingClientRect();
    const saveRect = saveBtn.getBoundingClientRect();

    return {
      x: Math.max(0, containerRect.x - 8),
      y: Math.max(0, containerRect.y - 8),
      width: containerRect.width + 16,
      height: Math.ceil(saveRect.bottom - containerRect.y + 32),
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

test.describe('Event form design export', () => {
  test.use({
    viewport: { width: 1440, height: 3200 },
    deviceScaleFactor: 2,
    locale: 'he-IL',
  });

  test('export event production form as desktop PNG and PDF', async ({ page }) => {
    test.setTimeout(90_000);

    await openEventForm(page);
    const clip = await captureForm(page);
    await captureFormAsPdf(page, clip);

    expect(fs.existsSync(OUTPUT_FILE)).toBeTruthy();
    expect(fs.existsSync(OUTPUT_PDF)).toBeTruthy();
  });
});
