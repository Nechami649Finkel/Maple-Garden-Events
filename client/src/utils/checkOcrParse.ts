/**
 * פרסור צ'קי ביטחון ישראליים (ריקים) — תקן בנק ישראל:
 * מספר_שיק + בנק(2) + סניף(3+2) + חשבון(6-9)
 */

export interface DepositCheckDetails {
  payee?: string;
  amount?: string;
  amountInWords?: string;
  date?: string;
  checkNumber?: string;
  bank?: string;
  bankCode?: string;
  branch?: string;
  account?: string;
  rawText?: string;
  scannedAt?: string;
  scanConfidence?: 'high' | 'low' | 'none';
}

export const ISRAELI_BANKS: Record<string, string> = {
  '04': 'בנק יהב',
  '09': 'בנק הדואר',
  '10': 'בנק לאומי',
  '11': 'בנק דיסקונט',
  '12': 'בנק הפועלים',
  '13': 'בנק אגוד',
  '14': 'בנק אוצר החייל',
  '17': 'בנק מרכנתיל',
  '18': 'ONE ZERO',
  '20': 'בנק מזרחי טפחות',
  '22': 'סיטי בנק',
  '23': 'HSBC',
  '26': 'יובנק',
  '31': 'בנק הבינלאומי',
  '46': 'בנק מסד',
  '52': 'בנק פועלי אגודת ישראל',
  '54': 'בנק ירושלים',
};

export const BANK_CODES = Object.keys(ISRAELI_BANKS);

const BANK_NAME_HINTS: [RegExp, string][] = [
  [/מסד|massad/i, '46'],
  [/הפועלים|poalim|bank\s*hapoalim/i, '12'],
  [/לאומי|leumi|bank\s*leumi/i, '10'],
  [/דיסקונט|discount/i, '11'],
  [/מזרחי|mizrahi|tefahot/i, '20'],
  [/מרכנתיל|mercantile/i, '17'],
  [/אגוד(?!\s*ישראל)/i, '13'],
  [/יהב|yahav/i, '04'],
  [/ירושלים|jerusalem/i, '54'],
  [/דואר\s*ישראל|בנק\s*הדואר|hadoar|israel\s*post|post\s*bank/i, '09'],
  [/הבינלאומי|fibi|first\s*international/i, '31'],
  [/אוצר\s*החייל/i, '14'],
  [/פועלי\s*אגודת/i, '52'],
  [/סיטי\s*בנק|citibank/i, '22'],
  [/יובנק|ubank/i, '26'],
  [/one\s*zero/i, '18'],
  [/hsbc/i, '23'],
];

export type ScanCandidate = DepositCheckDetails & {
  score: number;
  source: 'row' | 'labels' | 'consensus';
};

const MIN_ACCEPT_SCORE = 50;
export const HIGH_CONFIDENCE_SCORE = 75;

export function trimLeadingZeros(value: string): string {
  const trimmed = value.replace(/^0+/, '');
  return trimmed || value;
}

function looksLikeDateDigits(value: string): boolean {
  if (!/^\d{8,9}$/.test(value)) return false;
  const y = Number(value.slice(0, 4));
  const m = Number(value.slice(4, 6));
  const d = Number(value.slice(6, 8));
  return y >= 2000 && y <= 2035 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

export function isValidBranch(branch: string): boolean {
  return /^\d{3}$/.test(branch) && branch !== '000';
}

export function isValidCheckNumber(checkNumber: string): boolean {
  if (!/^\d{1,9}$/.test(checkNumber)) return false;
  if (looksLikeDateDigits(checkNumber)) return false;
  if (checkNumber.length === 9 && Number(checkNumber) > 100000000) return false;
  return true;
}

export function branchFromField(field: string): string | undefined {
  const digits = field.replace(/\D/g, '');
  if (digits.length >= 5) {
    const b = digits.slice(0, 3);
    return isValidBranch(b) ? b : undefined;
  }
  if (digits.length === 3 && isValidBranch(digits)) return digits;
  return undefined;
}

function isIsraeliPhone(value: string): boolean {
  return /^0[2-9]\d{7,8}$/.test(value);
}

/** חשבון בצ'ק ביטחון: 6–9 ספרות (לא טלפון / ח.פ.) */
export function isValidSecurityAccount(account: string): boolean {
  if (!/^\d{6,9}$/.test(account)) return false;
  if (/^0+$/.test(account)) return false;
  if (Number(account) < 1000) return false;
  if (isIsraeliPhone(account)) return false;
  return true;
}

export function detectBankName(text: string): string | undefined {
  for (const [pattern, code] of BANK_NAME_HINTS) {
    if (pattern.test(text)) return code;
  }
  return undefined;
}

export function extractBankCodeFromLabels(text: string): string | undefined {
  const compact = text.replace(/\s+/g, ' ');

  const numeric =
    compact.match(/בנק\s+הדואר\s+(\d{2})/i)?.[1] ||
    compact.match(/בנק[^0-9\n]{0,25}(\d{2})(?:\s*,|\s+ס)/i)?.[1] ||
    compact.match(/מס'?\s*בנק[:\s]*(\d{2})/i)?.[1] ||
    compact.match(/(\d{2})\s*,\s*סנ/i)?.[1];
  if (numeric && ISRAELI_BANKS[numeric]) return numeric;

  return detectBankName(text);
}

export function extractBranchFromLabels(text: string): string | undefined {
  const compact = text.replace(/\s+/g, ' ');

  const slash = compact.match(/(\d{2})\s*\/\s*(\d{3,5})/);
  if (slash) {
    const b = branchFromField(slash[2]);
    if (b) return b;
  }

  const direct =
    compact.match(/(?:סניף|סנוף)[:\s]+(\d{3})\b/i)?.[1] ||
    compact.match(/branch\s*no\.?[:\s]*(\d{3})/i)?.[1];
  if (direct && isValidBranch(direct)) return direct;

  return undefined;
}

function scoreCandidate(
  c: Partial<DepositCheckDetails>,
  source: ScanCandidate['source'],
  bankHint?: string
): number {
  if (!c.bankCode || !ISRAELI_BANKS[c.bankCode]) return 0;
  if (!c.branch || !isValidBranch(c.branch)) return 0;
  if (!c.account || !isValidSecurityAccount(c.account)) return 0;

  let score = source === 'row' ? 80 : source === 'consensus' ? 90 : 60;
  if (c.checkNumber && isValidCheckNumber(c.checkNumber)) score += 10;
  if (bankHint && c.bankCode === bankHint) score += 15;
  if (c.account.length === 6 || c.account.length === 7) score += 3;
  if (c.account.length >= 10) score -= 30;
  return score;
}

function candidateFromParts(
  checkNumber: string | undefined,
  bankCode: string,
  branch: string,
  account: string,
  source: ScanCandidate['source'],
  bankHint?: string
): ScanCandidate | null {
  if (!ISRAELI_BANKS[bankCode] || !isValidBranch(branch) || !isValidSecurityAccount(account)) return null;

  const c: DepositCheckDetails = {
    checkNumber: checkNumber && isValidCheckNumber(checkNumber) ? checkNumber : undefined,
    bankCode,
    bank: ISRAELI_BANKS[bankCode],
    branch,
    account,
  };
  const score = scoreCandidate(c, source, bankHint);
  if (score < MIN_ACCEPT_SCORE) return null;
  return { ...c, score, source };
}

/** שורה שנראית כמו שורת מספרים של צ'ק (לא טקסט עברי עם ח.פ.) */
export function isNumberRowLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 60) return false;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 14 || digits.length > 22) return false;
  const nonSpace = trimmed.replace(/\s/g, '');
  return digits.length / nonSpace.length > 0.8;
}

/** פרסור שורת מספרים — רק מטקסט שורה (OCR ספרות) */
export function parseNumberRowLine(line: string, bankHint?: string): ScanCandidate[] {
  if (!isNumberRowLine(line) && !/^\d[\d\s/]+$/.test(line.trim())) {
    return [];
  }

  const found: ScanCandidate[] = [];
  const normalized = line.replace(/\s+/g, ' ').trim();

  const spacedPatterns = [
    /(\d{4,9})\s+(\d{2})(\d{5})\s+(\d{6,9})/g,
    /(\d{4,9})\s+(\d{2})\s+(\d{3,5})\s+(\d{6,9})/g,
    /(\d{4,9})\s+(\d{2})\s*\/\s*(\d{3,5})\s+(\d{6,9})/g,
    /(\d{4,9})\s+(\d{2})\s+(\d{3})\s+(\d{6,9})/g,
  ];

  for (const pattern of spacedPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(normalized)) !== null) {
      const bankCode = match[2];
      const branch = branchFromField(match[3]);
      const account = match[4];
      const check = trimLeadingZeros(match[1]);
      const c = candidateFromParts(check, bankCode, branch ?? '', account, 'row', bankHint);
      if (c) found.push(c);
    }
  }

  if (found.length > 0) return found.sort((a, b) => b.score - a.score);

  const digits = line.replace(/\D/g, '');
  if (digits.length >= 14 && digits.length <= 22) {
    for (const bankCode of BANK_CODES) {
      const compactPatterns = [
        new RegExp(`^(\\d{4,9})${bankCode}(\\d{5})(\\d{6,9})$`),
        new RegExp(`^(\\d{4,9})${bankCode}(\\d{3})(\\d{6,9})$`),
      ];
      for (const pattern of compactPatterns) {
        const match = digits.match(pattern);
        if (!match) continue;
        const branch = branchFromField(match[2]) ?? (isValidBranch(match[2]) ? match[2] : undefined);
        if (!branch) continue;
        const c = candidateFromParts(trimLeadingZeros(match[1]), bankCode, branch, match[3], 'row', bankHint);
        if (c) found.push(c);
      }
    }
  }

  return found.sort((a, b) => b.score - a.score);
}

/** פרסור כל שורות המספרים מפלט OCR ספרות */
export function parseNumberOcrText(ocrText: string, bankHint?: string): ScanCandidate[] {
  const found: ScanCandidate[] = [];
  for (const line of ocrText.split('\n')) {
    found.push(...parseNumberRowLine(line, bankHint));
  }
  if (found.length === 0) {
    found.push(...parseNumberRowLine(ocrText.replace(/\n/g, ' '), bankHint));
  }
  return found;
}

/** הרכבה מתוויות עברית — רק כשיש בנק+סניף+שורת מספרים */
export function assembleFromLabels(
  labelText: string,
  numberCandidates: ScanCandidate[]
): ScanCandidate | null {
  const bankCode = extractBankCodeFromLabels(labelText);
  const branchLabel = extractBranchFromLabels(labelText);

  if (!bankCode) return null;

  const matching = numberCandidates.filter(c => c.bankCode === bankCode);
  if (matching.length > 0) {
    const best = matching[0];
    if (branchLabel && best.branch !== branchLabel) {
      const branchMatch = matching.find(c => c.branch === branchLabel);
      if (branchMatch) return { ...branchMatch, score: branchMatch.score + 10, source: 'labels' };
    }
    return { ...best, score: best.score + 8, source: 'labels' };
  }

  if (branchLabel && numberCandidates.length === 1) {
    const n = numberCandidates[0];
    if (n.bankCode === bankCode) {
      return { ...n, branch: branchLabel, score: n.score + 5, source: 'labels' };
    }
  }

  return null;
}

export function selectSecurityCheckResult(
  candidates: ScanCandidate[],
  bankHintText: string
): ScanCandidate | null {
  if (candidates.length === 0) return null;

  const bankHint = extractBankCodeFromLabels(bankHintText);

  let pool = candidates.filter(c => c.score >= MIN_ACCEPT_SCORE);
  if (pool.length === 0) return null;

  if (bankHint) {
    const hinted = pool.filter(c => c.bankCode === bankHint);
    if (hinted.length > 0) pool = hinted;
    else return null;
  }

  const buckets = new Map<string, { votes: number; items: ScanCandidate[] }>();
  for (const c of pool) {
    const key = `${c.bankCode}|${c.branch}|${c.account}`;
    const bucket = buckets.get(key) ?? { votes: 0, items: [] };
    bucket.votes += 1;
    bucket.items.push(c);
    buckets.set(key, bucket);
  }

  const ranked = [...buckets.values()].sort((a, b) => {
    if (b.votes !== a.votes) return b.votes - a.votes;
    return Math.max(...b.items.map(i => i.score)) - Math.max(...a.items.map(i => i.score));
  });

  const best = ranked[0];
  if (!best) return null;

  if (best.votes < 2 && best.items[0].score < HIGH_CONFIDENCE_SCORE) {
    return null;
  }

  const top = best.items.sort((a, b) => b.score - a.score)[0];
  const checkNumber = best.items.find(i => i.checkNumber)?.checkNumber ?? top.checkNumber;
  const voteBonus = best.votes >= 3 ? 15 : best.votes >= 2 ? 10 : 0;

  return {
    ...top,
    checkNumber,
    score: top.score + voteBonus,
    source: best.votes >= 2 ? 'consensus' : top.source,
  };
}

export function buildScanResult(
  best: ScanCandidate | null,
  rawTexts: string[]
): DepositCheckDetails {
  const scannedAt = new Date().toISOString();
  const rawText = rawTexts.filter(Boolean).join('\n---\n');

  if (!best) {
    return { scannedAt, scanConfidence: 'none', rawText };
  }

  return {
    bankCode: best.bankCode,
    bank: best.bank,
    branch: best.branch,
    account: best.account,
    checkNumber: best.checkNumber,
    scannedAt,
    scanConfidence: best.score >= HIGH_CONFIDENCE_SCORE ? 'high' : 'low',
    rawText,
  };
}

export const CHECK_PARSE_FIXTURES: { name: string; text: string; expect: Partial<DepositCheckDetails> }[] = [
  { name: 'בנק הדואר', text: '55791586 0900100 03141716', expect: { bankCode: '09', branch: '001', account: '03141716', checkNumber: '55791586' } },
  { name: 'בנק מסד', text: '0052676 46 51900 105009134', expect: { bankCode: '46', branch: '519', account: '105009134', checkNumber: '52676' } },
  { name: 'הפועלים', text: '0016096 12 44600 061816', expect: { bankCode: '12', branch: '446', account: '061816', checkNumber: '16096' } },
  { name: 'דיסקונט', text: '9876543 11 19000 12345678', expect: { bankCode: '11', branch: '190', account: '12345678', checkNumber: '9876543' } },
  { name: 'לאומי', text: '8765432 10 80000 112233445', expect: { bankCode: '10', branch: '800', account: '112233445', checkNumber: '8765432' } },
  { name: 'מזרחי', text: '4567890 20 45600 334455667', expect: { bankCode: '20', branch: '456', account: '334455667', checkNumber: '4567890' } },
  { name: 'מסד עם לוכסן', text: '0052676 46/51900 105009134', expect: { bankCode: '46', branch: '519', account: '105009134', checkNumber: '52676' } },
];

export function runParseFixtures(): { passed: number; failed: string[] } {
  const failed: string[] = [];
  let passed = 0;

  for (const fx of CHECK_PARSE_FIXTURES) {
    const candidates = parseNumberOcrText(fx.text);
    const hint = fx.name.includes('דואר') ? 'בנק הדואר' : fx.name.includes('מסד') ? 'מסד' : fx.name.includes('הפועלים') ? 'הפועלים' : fx.name;
    const result = selectSecurityCheckResult(candidates, hint) ?? candidates[0];
    if (!result) {
      failed.push(`${fx.name}: no result`);
      continue;
    }
    const ok =
      result.bankCode === fx.expect.bankCode &&
      result.branch === fx.expect.branch &&
      result.account === fx.expect.account &&
      (!fx.expect.checkNumber || result.checkNumber === fx.expect.checkNumber);
    if (ok) passed++;
    else failed.push(`${fx.name}: got ${JSON.stringify(result)}`);
  }

  const garbage = parseNumberOcrText('514637354 026308888 137318210 8885000160');
  const garbagePick = selectSecurityCheckResult(garbage, 'הפועלים');
  if (garbagePick !== null) {
    failed.push(`garbage: should be null, got ${JSON.stringify(garbagePick)}`);
  } else {
    passed++;
  }

  return { passed, failed };
}
