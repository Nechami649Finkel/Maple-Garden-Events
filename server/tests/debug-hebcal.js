const hebcal = require('hebcal');
// כ"ב ניסן תשפ"ו (9 אפריל 2026) - האם הספרייה מחזירה YOM_TOV_ENDS?
const d1 = new hebcal.HDate(new Date(2026, 3, 9));
console.log('כ"ב ניסן:', JSON.stringify(d1.holidays(true).map(e => ({ desc: e.desc, flags: Object.keys(e).filter(k => e[k] === true) }))));

// ל"ג בעומר - י"ח אייר תשפ"ו (6 מאי 2026)
const d2 = new hebcal.HDate(new Date(2026, 4, 6));
console.log('י"ח אייר:', JSON.stringify(d2.holidays(true).map(e => ({ desc: e.desc, flags: Object.keys(e).filter(k => e[k] === true) }))));

// בדיקת leap year API
console.log('isLeapYear keys:', Object.keys(hebcal.HDate).filter(k => k.toLowerCase().includes('leap')));
console.log('HDate prototype keys:', Object.getOwnPropertyNames(hebcal.HDate.prototype).filter(k => k.toLowerCase().includes('leap')));

// שנה מעוברת - תשפ"ד (2023-2024)
const d3 = new hebcal.HDate(new Date(2024, 2, 1));
console.log('isLeapYear via instance:', d3.isLeapYear ? d3.isLeapYear() : 'no method');
console.log('leap via static?', typeof hebcal.HDate.isLeapYear);
