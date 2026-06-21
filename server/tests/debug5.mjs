import { HDate } from '@hebcal/core';

// בדיקה הפוכה - מה התאריך הגרגוריאני של י"ח אייר תשפ"ו?
const lag26 = new HDate(18, 2, 5786); // י"ח אייר תשפ"ו
console.log('י"ח אייר תשפ"ו =', lag26.greg().toDateString());

const lag27 = new HDate(18, 2, 5787);
console.log('י"ח אייר תשפ"ז =', lag27.greg().toDateString());

const av9_26 = new HDate(9, 5, 5786);
console.log('ט אב תשפ"ו =', av9_26.greg().toDateString());

const tevet10_27 = new HDate(10, 10, 5787);
console.log('י טבת תשפ"ז =', tevet10_27.greg().toDateString());

const tishri3_88 = new HDate(3, 7, 5788);
console.log('ג תשרי תשפ"ח =', tishri3_88.greg().toDateString());
