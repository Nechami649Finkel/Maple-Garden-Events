import { HDate } from '@hebcal/core';

function check(y, m, d, label) {
  const hd = new HDate(new Date(y, m-1, d));
  console.log(`${label}: ${hd.getDate()}/${hd.getMonth()}/${hd.getFullYear()} (${hd.monthName()})`);
}

check(2026, 5, 6,  'ל"ג בעומר תשפ"ו (צריך י"ח אייר)');
check(2027, 5, 18, 'ל"ג בעומר תשפ"ז (צריך י"ח אייר)');
check(2026, 8, 2,  'תשעה באב תשפ"ו נדחה (צריך י"ט אב)');
check(2027, 9, 5,  'ג תשרי תשפ"ח (צריך ג תשרי)');
check(2027, 1, 7,  'עשרה בטבת תשפ"ז (צריך י טבת)');
check(2026, 9, 12, 'ראש השנה א תשפ"ז (צריך א תשרי)');
