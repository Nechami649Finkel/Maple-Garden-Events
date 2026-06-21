const hebcal = require('hebcal');

function toNoon(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0); }

function getDayStatus(jsDate) {
  const jsDay = jsDate.getDay();
  const noon  = toNoon(jsDate);
  const hDate = new hebcal.HDate(noon);
  const hMonth = hDate.getMonth();
  const hDay   = hDate.getDate();
  const holidays = hDate.holidays(true) || [];

  const descHe = (e) => e.desc[2] || e.desc[0] || '';
  const isCHM  = (e) => e.desc[0]?.includes('CH"M') || e.desc[0]?.includes("CH\\\"M");

  if (jsDay === 6) return { status: 'BLOCKED', reason: 'שבת' };

  const chmEvent = holidays.find(e => isCHM(e) && !e.CHUL_ONLY);
  if (chmEvent) return { status: 'FORBIDDEN', reason: descHe(chmEvent) };

  const yomTovEvent = holidays.find(e => (e.LIGHT_CANDLES_TZEIS || e.YOM_TOV_ENDS) && !e.CHUL_ONLY);
  if (yomTovEvent) return { status: 'BLOCKED', reason: descHe(yomTovEvent) };

  if (hMonth === 7 && hDay === 10) return { status: 'BLOCKED',   reason: 'יום כיפור' };
  if (hMonth === 7 && hDay === 9)  return { status: 'FORBIDDEN', reason: 'ערב יום כיפור' };
  if (hMonth === 7 && hDay >= 2 && hDay <= 8) {
    const reason = (hDay === 3 || (hDay === 4 && jsDay === 0)) ? 'צום גדליה' : 'עשרת ימי תשובה';
    return { status: 'FORBIDDEN', reason };
  }

  if (jsDay === 5) return { status: 'FORBIDDEN', reason: 'יום שישי' };
  const erevEvent = holidays.find(e => e.LIGHT_CANDLES && !e.CHUL_ONLY);
  if (erevEvent) return { status: 'FORBIDDEN', reason: descHe(erevEvent) };

  if (hMonth === 4 && (hDay > 17 || (hDay === 17 && jsDay !== 0) || (hDay === 18 && jsDay === 0)))
    return { status: 'BLOCKED', reason: 'בין המצרים' };
  if (hMonth === 5 && hDay < 9)  return { status: 'BLOCKED', reason: 'בין המצרים' };
  if (hMonth === 5 && (hDay === 9 || (hDay === 10 && jsDay === 0)))
    return { status: 'BLOCKED', reason: 'תשעה באב' };

  if (hMonth === 1 && hDay >= 22) return { status: 'FORBIDDEN', reason: 'ספירת העומר' };
  if (hMonth === 2 && hDay !== 18) return { status: 'FORBIDDEN', reason: 'ספירת העומר' };
  if (hMonth === 3 && hDay <= 5)  return { status: 'FORBIDDEN', reason: 'ספירת העומר' };

  if (hMonth === 10 && hDay === 10) return { status: 'FORBIDDEN', reason: 'צום עשרה בטבת' };

  const taanit = holidays.find(e => e.desc[0]?.includes("Ta'anit Esther"));
  if (taanit) return { status: 'FORBIDDEN', reason: 'תענית אסתר' };

  return { status: 'AVAILABLE', reason: null };
}

function toKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

const KNOWN_DATES = [
  // פסח 2026
  { date: '2026-04-02', expect: 'BLOCKED',   desc: 'פסח א (ט"ו ניסן תשפ"ו)' },
  { date: '2026-04-03', expect: 'FORBIDDEN', desc: 'חול המועד פסח (ט"ז ניסן)' },
  { date: '2026-04-07', expect: 'FORBIDDEN', desc: 'חול המועד פסח (כ ניסן)' },
  { date: '2026-04-08', expect: 'BLOCKED',   desc: 'פסח ז (כ"א ניסן)' },
  { date: '2026-04-09', expect: 'FORBIDDEN', desc: 'ספירת העומר (כ"ב ניסן)' },
  // פסח 2027
  { date: '2027-04-22', expect: 'BLOCKED',   desc: 'פסח א תשפ"ז' },
  { date: '2027-04-23', expect: 'FORBIDDEN', desc: 'חול המועד פסח ט"ז ניסן תשפ"ז (שישי)' },
  { date: '2027-04-25', expect: 'FORBIDDEN', desc: 'חול המועד פסח י"ח ניסן תשפ"ז' },
  { date: '2027-04-28', expect: 'BLOCKED',   desc: 'פסח ז תשפ"ז' },
  // ל"ג בעומר
  { date: '2026-05-05', expect: 'AVAILABLE', desc: 'ל"ג בעומר תשפ"ו (י"ח אייר)' },
  { date: '2027-05-25', expect: 'AVAILABLE', desc: 'ל"ג בעומר תשפ"ז (י"ח אייר)' },
  // שבועות
  { date: '2026-05-22', expect: 'BLOCKED',   desc: 'שבועות תשפ"ו' },
  // בין המצרים
  { date: '2026-07-12', expect: 'BLOCKED',   desc: 'י"ז תמוז תשפ"ו' },
  { date: '2026-07-23', expect: 'BLOCKED',   desc: 'תשעה באב תשפ"ו (ט אב)' },
  // תשרי 2026
  { date: '2026-09-12', expect: 'BLOCKED',   desc: 'ראש השנה א תשפ"ז' },
  { date: '2026-09-13', expect: 'BLOCKED',   desc: 'ראש השנה ב תשפ"ז' },
  { date: '2026-09-14', expect: 'FORBIDDEN', desc: 'עשרת ימי תשובה (ג תשרי)' },
  { date: '2026-09-16', expect: 'FORBIDDEN', desc: 'עשרת ימי תשובה (ה תשרי)' },
  { date: '2026-09-21', expect: 'BLOCKED',   desc: 'יום כיפור תשפ"ז' },
  { date: '2026-09-26', expect: 'BLOCKED',   desc: 'סוכות א תשפ"ז' },
  { date: '2026-09-27', expect: 'FORBIDDEN', desc: 'חול המועד סוכות י"ז תשרי תשפ"ז' },
  { date: '2026-10-03', expect: 'BLOCKED',   desc: 'שמיני עצרת תשפ"ז' },
  // תשרי 2027
  { date: '2027-10-04', expect: 'FORBIDDEN', desc: 'ג תשרי תשפ"ח' },
  { date: '2027-09-17', expect: 'FORBIDDEN', desc: 'חול המועד סוכות י"ז תשרי תשפ"ח' },
  // צומות
  { date: '2026-12-20', expect: 'FORBIDDEN', desc: 'צום עשרה בטבת תשפ"ז' },
  { date: '2027-03-22', expect: 'FORBIDDEN', desc: 'תענית אסתר תשפ"ז (שנה מעוברת)' },
  // פורים
  { date: '2026-03-12', expect: 'AVAILABLE', desc: 'פורים תשפ"ו (י"ד אדר)' },
  { date: '2027-03-23', expect: 'AVAILABLE', desc: 'פורים תשפ"ז (י"ד אדר ב)' },
];

let passed = 0, failed = 0;
console.log('=== בדיקות תאריכים ידועים ===\n');
for (const { date, expect, desc } of KNOWN_DATES) {
  const [y, m, d] = date.split('-').map(Number);
  const result = getDayStatus(new Date(y, m - 1, d));
  const ok = result.status === expect;
  if (ok) { passed++; console.log(`✅ ${date} | ${desc}`); }
  else    { failed++; console.log(`❌ ${date} | ${desc}\n   ציפינו: ${expect} | קיבלנו: ${result.status} (${result.reason})`); }
}

// סריקת 100 שנה
console.log('\n=== סריקת 100 שנה (2025–2125) ===\n');
const issues = [];
const cur = new Date(2025, 0, 1);
const end = new Date(2125, 0, 1);
while (cur < end) {
  try {
    const r = getDayStatus(new Date(cur));
    const hDate = new hebcal.HDate(toNoon(cur));
    const hMonth = hDate.getMonth(), hDay = hDate.getDate(), jsDay = cur.getDay();

    if (jsDay === 6 && r.status !== 'BLOCKED') issues.push(`שבת לא BLOCKED: ${toKey(cur)}`);
    if (jsDay === 5 && r.status === 'AVAILABLE') issues.push(`שישי AVAILABLE: ${toKey(cur)}`);
    if (hMonth === 1 && hDay === 15 && r.status !== 'BLOCKED') issues.push(`פסח א לא BLOCKED: ${toKey(cur)}`);
    if (hMonth === 1 && hDay === 21 && jsDay !== 6 && r.status !== 'BLOCKED') issues.push(`פסח ז לא BLOCKED: ${toKey(cur)}`);
    if (hMonth === 3 && hDay === 6 && jsDay !== 6 && r.status !== 'BLOCKED') issues.push(`שבועות לא BLOCKED: ${toKey(cur)}`);
    if (hMonth === 7 && hDay === 15 && jsDay !== 6 && r.status !== 'BLOCKED') issues.push(`סוכות א לא BLOCKED: ${toKey(cur)}`);
    if (hMonth === 7 && hDay === 22 && jsDay !== 6 && r.status !== 'BLOCKED') issues.push(`שמיני עצרת לא BLOCKED: ${toKey(cur)}`);
    if (hMonth === 7 && hDay === 10 && jsDay !== 6 && r.status !== 'BLOCKED') issues.push(`יום כיפור לא BLOCKED: ${toKey(cur)}`);
    if (hMonth === 7 && hDay === 1  && jsDay !== 6 && r.status !== 'BLOCKED') issues.push(`ראש השנה א לא BLOCKED: ${toKey(cur)}`);
    if (hMonth === 7 && hDay === 2  && jsDay !== 6 && r.status !== 'BLOCKED') issues.push(`ראש השנה ב לא BLOCKED: ${toKey(cur)}`);
    if (hMonth === 2 && hDay === 18 && jsDay !== 5 && jsDay !== 6 && r.status !== 'AVAILABLE') issues.push(`ל"ג בעומר לא AVAILABLE: ${toKey(cur)} (${r.reason})`);
    if (hMonth === 5 && (hDay === 9 || (hDay === 10 && jsDay === 0)) && jsDay !== 6 && r.status !== 'BLOCKED') issues.push(`תשעה באב לא BLOCKED: ${toKey(cur)}`);
    if (hMonth === 7 && hDay >= 2 && hDay <= 8 && jsDay !== 5 && jsDay !== 6 && r.status === 'AVAILABLE') issues.push(`עשרת ימי תשובה AVAILABLE: ${toKey(cur)}`);
  } catch(e) { issues.push(`שגיאה: ${toKey(cur)}: ${e.message}`); }
  cur.setDate(cur.getDate() + 1);
}

if (issues.length === 0) console.log('✅ אין בעיות לוגיות ב-100 שנה!');
else { console.log(`❌ נמצאו ${issues.length} בעיות:`); issues.forEach(i => console.log('  •', i)); }

console.log(`\n=== סיכום ===`);
console.log(`תאריכים ידועים: ${passed} עברו, ${failed} נכשלו`);
console.log(`בעיות לוגיות בסריקה: ${issues.length}`);
