import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const htmlPath = path.join(rootDir, 'TECH-SPEC.html');
const pdfPath = path.join(rootDir, 'TECH-SPEC.pdf');

const puppeteer = await import('puppeteer');

const browser = await puppeteer.default.launch({ headless: true });
const page = await browser.newPage();

await page.goto(pathToFileURL(htmlPath).href, {
  waitUntil: 'networkidle0',
  timeout: 60_000,
});

await page.pdf({
  path: pdfPath,
  format: 'A4',
  printBackground: true,
  margin: { top: '18mm', right: '14mm', bottom: '18mm', left: '14mm' },
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: `
    <div style="width:100%;font-size:9px;text-align:center;color:#718096;font-family:Segoe UI,sans-serif;padding:0 14mm;">
      מיפל — מסמך אפיון טכני v1.0 · עמוד <span class="pageNumber"></span> מתוך <span class="totalPages"></span>
    </div>
  `,
});

await browser.close();
console.log('PDF created:', pdfPath);
