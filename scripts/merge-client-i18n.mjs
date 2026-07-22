/**
 * Merges client UI locale namespaces into shared/i18n/locales/*.json
 * and appends T key constants to keys.ts (before PLURALS).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

/** @type {Record<string, Record<string, unknown>>} */
const additions = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'client-i18n-additions.json'), 'utf8'),
);

function deepMerge(target, source) {
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      target[k] = target[k] && typeof target[k] === 'object' ? target[k] : {};
      deepMerge(target[k], v);
    } else {
      target[k] = v;
    }
  }
}

for (const locale of ['en', 'he']) {
  const file = path.join(root, 'shared/i18n/locales', `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  deepMerge(data, additions[locale]);
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`Updated ${locale}.json`);
}

const keysFile = path.join(root, 'shared/i18n/keys.ts');
let keysSrc = fs.readFileSync(keysFile, 'utf8');
const keysAddition = fs.readFileSync(path.join(__dirname, 'client-i18n-keys.ts.txt'), 'utf8');
if (!keysSrc.includes('ACCESSIBILITY:')) {
  keysSrc = keysSrc.replace(
    '\n  NAV: {',
    `\n${keysAddition}\n  NAV: {`,
  );
  fs.writeFileSync(keysFile, keysSrc, 'utf8');
  console.log('Updated keys.ts');
}

console.log('Done');
