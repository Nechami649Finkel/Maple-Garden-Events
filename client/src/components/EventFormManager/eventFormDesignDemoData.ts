import type { DepositCheckDetails } from '../../utils/checkOcr';

const DEMO_CHECK_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="200" viewBox="0 0 420 200">
  <rect width="420" height="200" fill="#f8fafc" stroke="#94a3b8" stroke-width="2" rx="6"/>
  <text x="24" y="36" font-family="Arial,sans-serif" font-size="14" fill="#64748b">דוגמה — צ'ק פיקדון (לא אמיתי)</text>
  <text x="24" y="72" font-family="Arial,sans-serif" font-size="18" font-weight="bold" fill="#1e293b">בנק לאומי</text>
  <text x="24" y="100" font-family="Arial,sans-serif" font-size="13" fill="#334155">סניף: 800 · חשבון: 123456/78</text>
  <text x="24" y="128" font-family="Arial,sans-serif" font-size="13" fill="#334155">מספר צ'ק: 0045219</text>
  <text x="24" y="156" font-family="Arial,sans-serif" font-size="13" fill="#334155">לפקודת: גן אירועים מייפל בע"מ</text>
  <text x="280" y="156" font-family="Arial,sans-serif" font-size="16" font-weight="bold" fill="#0f766e">₪ 15,000</text>
  <line x1="24" y1="170" x2="396" y2="170" stroke="#cbd5e1" stroke-width="1"/>
  <text x="24" y="188" font-family="Arial,sans-serif" font-size="11" fill="#94a3b8">תאריך על הגבי: 15.09.2026</text>
</svg>`;

/** SVG דמה של צ'ק פיקדון — לייצוא עיצוב בלבד */
export const DEMO_CHECK_IMAGE = `data:image/svg+xml,${encodeURIComponent(DEMO_CHECK_SVG)}`;

export const DEMO_CHECK_DETAILS: DepositCheckDetails = {
  checkNumber: '0045219',
  bank: 'בנק לאומי',
  bankCode: '10',
  branch: '800',
  account: '123456/78',
  payee: 'גן אירועים מייפל בע"מ',
  amount: '15000',
  amountInWords: 'חמש עשרה אלף שקלים',
  date: '15.09.2026',
  scanConfidence: 'high',
};

export const DEMO_BOOKING = {
  id: 'design-demo-booking',
  clientAFullName: 'דוד כהן',
  clientAIdNumber: '123456782',
  clientBFullName: 'שרה לוי',
  clientBIdNumber: '987654321',
  clientAEmail: 'david.cohen@gmail.com',
  clientBEmail: 'sara.levi@gmail.com',
  eventDate: { date: '2026-09-15T00:00:00.000Z', status: 'BOOKED' },
  guestCount: 300,
  eventType: 'חתונה',
  timeOfDay: 'evening|18:00-23:30',
  akumApprovalCode: 'ACUM-12345',
};

export const DEMO_FORM_DATA = {
  eventTime: '18:30',
  receptionType: 'separate',
  finalGuestCount: 280,
  seatingType: 'separate',
  menCount: 140,
  womenCount: 140,
  menPercent: 50,
  womenPercent: 50,
  honorTableCount: 12,
  tableclothId: 'קרם מבריק',
  napkinId: 'זהב',
  centerpiece: 'ורדים לבנים',
  bridgeChair: 'כסא מעוצב לבן',
  hasLighting: true,
  hasSoundSystem: true,
  hasScreens: true,
  hasFireworks: false,
  entertainersBar: 8,
  entertainersSitting: undefined,
  entertainersMen: 5,
  entertainersWomen: 3,
  depositCheckUrl: DEMO_CHECK_IMAGE,
  depositCheckStatus: true,
  depositCheckDetails: DEMO_CHECK_DETAILS,
  akumPaid: true,
  akumCode: 'ACUM-12345',
  kashrut: 'מחפוד',
};

export const DEMO_MENU: Record<string, string[]> = {
  'מנות ראשונות': ['סלט ירקות עלים', 'חצילים בטחינה'],
  'מנות עיקריות': ['סטייק פרגית במרינדה', 'אסאדו בקר'],
  'קינוחים': ['מוס שוקולד', 'פירות העונה'],
};

export const DEMO_NOTES = [
  'הלקוח ביקש תאורה נוספת בכניסה',
  'יש 3 מנות ללא גלוטן — לסמן בשולחן 12',
];
