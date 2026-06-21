import { HDate } from '@hebcal/core';

function check(y, m, d, label) {
  const noon = new Date(y, m-1, d, 12, 0, 0);
  const hd = new HDate(noon);
  console.log(`${label}: ${hd.getDate()}/${hd.getMonth()}/${hd.getFullYear()}`);
}

check(2026, 5, 6,  'ל"ג בעומר תשפ"ו (צריך 18/2)');
check(2027, 5, 18, 'ל"ג בעומר תשפ"ז (צריך 18/2)');
check(2026, 8, 2,  'תשעה באב תשפ"ו נדחה (צריך 9/5 או 10/5)');
check(2027, 9, 5,  'ג תשרי תשפ"ח (צריך 3/7)');
check(2027, 1, 7,  'עשרה בטבת תשפ"ז (צריך 10/10)');
check(2026, 9, 12, 'ראש השנה א תשפ"ז (צריך 1/7)');
