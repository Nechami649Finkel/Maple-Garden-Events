const hebcal = require('hebcal');

function check(jsDate, label) {
  const hDate = new hebcal.HDate(jsDate);
  const holidays = hDate.holidays(true) || [];
  const flags = holidays.map(e => ({ desc: e.desc, flags: Object.keys(e).filter(k => e[k] === true) }));
  console.log(`\n${label} | ${jsDate.toDateString()} | jsDay=${jsDate.getDay()} | עברי: ${hDate.getDate()}/${hDate.getMonth()}/${hDate.getFullYear()}`);
  if (flags.length) console.log('  חגים:', JSON.stringify(flags));
  else console.log('  אין חגים');
}

console.log('=== פורים ===');
check(new Date(2027, 2, 22), 'פורים דפרזות תשפ"ז (י"ד אדר ב)');
check(new Date(2027, 2, 23), 'פורים דמוקפין תשפ"ז (ט"ו אדר ב)');
check(new Date(2026, 2, 12), 'פורים תשפ"ו (י"ד אדר)');
check(new Date(2026, 2, 13), 'שושן פורים תשפ"ו (ט"ו אדר)');

console.log('\n=== פסח 2027 ===');
for (let d = 20; d <= 30; d++) check(new Date(2027, 3, d), `אפריל ${d}`);

console.log('\n=== ספירת העומר 2027 ===');
check(new Date(2027, 4, 2),  'ב אייר');
check(new Date(2027, 4, 18), 'י"ח אייר - ל"ג בעומר');
check(new Date(2027, 4, 19), 'י"ט אייר');

console.log('\n=== עשרת ימי תשובה 2027 ===');
for (let d = 4; d <= 12; d++) check(new Date(2027, 8, d), `ספטמבר ${d}`);

console.log('\n=== חול המועד סוכות 2027 ===');
for (let d = 17; d <= 24; d++) check(new Date(2027, 8, d), `ספטמבר ${d}`);

console.log('\n=== תשעה באב 2026 ===');
check(new Date(2026, 7, 1), 'ח באב');
check(new Date(2026, 7, 2), 'ט באב');
check(new Date(2026, 7, 3), 'י באב');

console.log('\n=== עשרה בטבת 2027 ===');
check(new Date(2027, 0, 7), 'ינואר 7');

console.log('\n=== תענית אסתר 2027 ===');
check(new Date(2027, 2, 2), 'מרץ 2');
check(new Date(2027, 2, 20), 'מרץ 20');
check(new Date(2027, 2, 21), 'מרץ 21');
check(new Date(2027, 2, 22), 'מרץ 22');
