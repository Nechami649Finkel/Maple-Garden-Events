const hebcal = require('hebcal');
function toNoon(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0); }
function check(y, m, d, label) {
  const jsDate = new Date(y, m-1, d);
  const hDate = new hebcal.HDate(toNoon(jsDate));
  const holidays = hDate.holidays(true) || [];
  console.log(`\n${label} | jsDay=${jsDate.getDay()} | עברי: ${hDate.getDate()}/${hDate.getMonth()}/${hDate.getFullYear()}`);
  console.log('  חגים:', JSON.stringify(holidays.map(e => ({ desc: e.desc, flags: Object.keys(e).filter(k => e[k] === true) }))));
}

check(2026, 5, 6,  'ל"ג בעומר תשפ"ו');
check(2027, 5, 18, 'ל"ג בעומר תשפ"ז');
check(2026, 8, 2,  'תשעה באב תשפ"ו (נדחה)');
check(2027, 9, 5,  'ג תשרי תשפ"ח');
check(2027, 1, 7,  'עשרה בטבת תשפ"ז');
