import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function merge(target, source) {
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      target[k] = target[k] && typeof target[k] === 'object' ? target[k] : {};
      merge(target[k], v);
    } else {
      target[k] = v;
    }
  }
}

const addEn = JSON.parse(fs.readFileSync(path.join(__dirname, 'client-locales-en.json'), 'utf8'));
const addHe = JSON.parse(fs.readFileSync(path.join(__dirname, 'client-locales-he.json'), 'utf8'));

for (const [locale, add] of [['en', addEn], ['he', addHe]]) {
  const file = path.join(root, 'shared/i18n/locales', `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  merge(data, add);
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`Updated ${locale}.json`);
}
