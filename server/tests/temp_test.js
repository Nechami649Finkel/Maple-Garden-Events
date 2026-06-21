const { getDayStaticStatus, EventStatus } = require('./src/Services/calendar.service');

function runCenturyTest() {
  const start = new Date(2026, 0, 1);
  const end = new Date(2126, 0, 1);
  let current = new Date(start);
  let errors = 0;

  console.log("🚀 מתחיל טסט ל-100 שנה...");

  while (current <= end) {
    try {
      const status = getDayStaticStatus(current);

      if (current.getDay() === 6 && status.type !== 'FORBIDDEN') {
        console.error(`❌ שגיאה בשבת בתאריך: ${current.toDateString()}`);
        errors++;
      }

      if (status.type !== 'AVAILABLE' && !status.reason) {
        console.error(`❌ חסרה סיבה בתאריך: ${current.toDateString()}`);
        errors++;
      }
    } catch (e) {
      console.error(`💥 קריסה בתאריך: ${current.toDateString()}`, e);
      errors++;
    }
    current.setDate(current.getDate() + 1);
  }
  console.log(`✅ הטסט הסתיים. סך הכל שגיאות שנמצאו: ${errors}`);
}

runCenturyTest();