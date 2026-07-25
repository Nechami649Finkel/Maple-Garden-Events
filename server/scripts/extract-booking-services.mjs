/**
 * One-shot extractor: splits controllers/booking.ts into domain services
 * that return { status, body } instead of writing to Express res.
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..');
const src = fs.readFileSync(path.join(root, 'src/controllers/booking.ts'), 'utf8');

const HANDLER_MAP = {
  createBooking: 'lifecycle',
  updateBooking: 'lifecycle',
  finalizeBooking: 'lifecycle',
  addEventAddition: 'lifecycle',
  getBookingById: 'query',
  getAllBookings: 'query',
  getNextEventCode: 'query',
  getCancellationStats: 'query',
  getRelatedOptionBookings: 'options',
  releaseOptions: 'options',
  bumpOption: 'options',
  notifyOptionInterest: 'options',
  addBookingUpgrade: 'contract',
  getContractTemplate: 'contract',
  signAndSendContract: 'contract',
  reissueEasyCountReceipt: 'payment',
  getBookingPayments: 'payment',
  createBookingPayment: 'payment',
};

const HELPER_NAMES = [
  'canEditBookingDate',
  'isPastCalendarDate',
  'releaseOptionDateInTx',
  'hasOptionBookings',
  'syncEventDateWithOptionBookings',
  'syncDesyncedOptionDates',
  'slotConflictMessage',
  'validateHallRentalPriceInput',
];

function extractBetween(source, startIdx, endIdx) {
  return source.slice(startIdx, endIdx);
}

// Find helper block: from first function canEditBookingDate to export const createBooking
const helpersStart = src.indexOf('function canEditBookingDate');
const firstExport = src.indexOf('export const createBooking');
const helpersBlock = src.slice(helpersStart, firstExport).trim();

// Extract each export const NAME = catchAsync(async (...) => { ... });
const exportRe = /export const (\w+) = catchAsync\(async \(([^)]*)\) => \{/g;
const handlers = [];
let match;
while ((match = exportRe.exec(src))) {
  const name = match[1];
  const params = match[2];
  const bodyStart = match.index + match[0].length;
  // find matching closing }); for catchAsync
  let depth = 1;
  let i = bodyStart;
  let inStr = null;
  let escaped = false;
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === inStr) inStr = null;
    } else {
      if (ch === '"' || ch === "'" || ch === '`') inStr = ch;
      else if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }
    i++;
  }
  // i points after closing }; of the async function body
  // expect `);` after
  let end = i;
  while (end < src.length && /[\s;)]/.test(src[end])) end++;
  const body = src.slice(bodyStart, i - 1); // inside the async function
  handlers.push({ name, params, body, domain: HANDLER_MAP[name] || 'lifecycle' });
}

// Also handle addEventAddition which is NOT catchAsync
const addAddMatch = src.match(/export const addEventAddition = async \(([^)]*)\) => \{/);
if (addAddMatch) {
  const start = src.indexOf(addAddMatch[0]) + addAddMatch[0].length;
  let depth = 1;
  let i = start;
  let inStr = null;
  let escaped = false;
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === inStr) inStr = null;
    } else {
      if (ch === '"' || ch === "'" || ch === '`') inStr = ch;
      else if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }
    i++;
  }
  const body = src.slice(start, i - 1);
  // replace existing if parser also got it - addEventAddition won't be in catchAsync list
  handlers.push({
    name: 'addEventAddition',
    params: addAddMatch[1],
    body,
    domain: 'lifecycle',
  });
}

function transformBody(body) {
  let out = body;
  // return res.status(N).json(X) / res.status(N).json(X)
  out = out.replace(
    /return\s+res\.status\((\d+)\)\.json\(([\s\S]*?)\);/g,
    'return { status: $1, body: $2 };',
  );
  out = out.replace(
    /(?<!return\s)res\.status\((\d+)\)\.json\(([\s\S]*?)\);/g,
    'return { status: $1, body: $2 };',
  );
  // res.json(X) without status
  out = out.replace(
    /return\s+res\.json\(([\s\S]*?)\);/g,
    'return { status: 200, body: $1 };',
  );
  out = out.replace(
    /(?<!return\s)res\.json\(([\s\S]*?)\);/g,
    'return { status: 200, body: $1 };',
  );
  return out;
}

function buildServiceFn(h) {
  // Normalize params: AuthRequest/Request -> typed context
  const usesReq = /\breq\b/.test(h.body) || /\breq\b/.test(h.params);
  const usesRes = false; // we remove res
  let body = transformBody(h.body);

  // Tenant guard stays but returns HttpResult
  body = body.replace(
    /if\s*\(\s*!tenantId\s*\)\s*return\s*res\.status\(403\)\.json\(\{\s*error:\s*'Tenant context is missing\.'\s*\}\);/g,
    "if (!tenantId) return { status: 403, body: { error: 'Tenant context is missing.' } };",
  );
  // Already transformed by general replace if it was return res.status...

  // Fix remaining res. references that might have been missed for 403 patterns with (req as any)
  body = body.replace(
    /return\s+res\.status\(403\)\.json\(\{\s*error:\s*'Tenant context is missing\.'\s*\}\);/g,
    "return { status: 403, body: { error: 'Tenant context is missing.' } };",
  );

  return `
export async function ${h.name}(req: AuthRequest | Request): Promise<HttpResult> {
${body}
}
`.trim();
}

const outDir = path.join(root, 'src/Services/booking');
fs.mkdirSync(outDir, { recursive: true });

const httpTypes = `export type HttpResult = {
  status: number;
  body: unknown;
};

export function isHttpResult(value: unknown): value is HttpResult {
  return !!value && typeof value === 'object' && 'status' in value && 'body' in value;
}
`;
fs.writeFileSync(path.join(outDir, 'httpResult.ts'), httpTypes);

// Collect imports from original file (lines before helpers)
const importBlock = src.slice(0, helpersStart);

const helpersFile = `${importBlock}
import type { HttpResult } from './httpResult';

${helpersBlock}

export {
  ${HELPER_NAMES.join(',\n  ')},
};
`;
fs.writeFileSync(path.join(outDir, 'helpers.ts'), helpersFile);

const byDomain = {};
for (const h of handlers) {
  if (!byDomain[h.domain]) byDomain[h.domain] = [];
  // dedupe by name
  if (!byDomain[h.domain].some((x) => x.name === h.name)) {
    byDomain[h.domain].push(h);
  }
}

const domainFiles = {
  lifecycle: 'bookingLifecycle.service.ts',
  query: 'bookingQuery.service.ts',
  options: 'bookingOptions.service.ts',
  contract: 'bookingContract.service.ts',
  payment: 'bookingPaymentOrchestration.service.ts',
};

for (const [domain, list] of Object.entries(byDomain)) {
  const filename = domainFiles[domain];
  const fns = list.map(buildServiceFn).join('\n\n');
  const content = `${importBlock}
import type { HttpResult } from './httpResult';
import {
  canEditBookingDate,
  isPastCalendarDate,
  releaseOptionDateInTx,
  hasOptionBookings,
  syncEventDateWithOptionBookings,
  syncDesyncedOptionDates,
  slotConflictMessage,
  validateHallRentalPriceInput,
} from './helpers';

${fns}
`;
  fs.writeFileSync(path.join(outDir, filename), content);
}

const index = `export type { HttpResult } from './httpResult';
export * from './bookingLifecycle.service';
export * from './bookingQuery.service';
export * from './bookingOptions.service';
export * from './bookingContract.service';
export * from './bookingPaymentOrchestration.service';
export {
  canEditBookingDate,
  syncEventDateWithOptionBookings,
} from './helpers';
`;
fs.writeFileSync(path.join(outDir, 'index.ts'), index);

console.log('Extracted handlers:', handlers.map((h) => h.name).join(', '));
console.log('Domains:', Object.keys(byDomain));
