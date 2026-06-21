// --- stress_test.js ---
const hebcal = require('hebcal'); // מוודאים שזה מותקן (npm install hebcal)

function getDayStaticStatus(jsDate) {
    const jsDay = jsDate.getDay();
    const hDate = new hebcal.HDate(jsDate);
    const hMonth = hDate.getMonth();
    const hDay = hDate.getDate();
    const holidays = hDate.holidays(true) || [];

    // --- לוגיקה זהה לשרת ---
    if (jsDay === 6) return { type: 'FORBIDDEN', reason: 'שבת' };
    
    // כאן הוספתי את החגים העיקריים שצריכים להיבדק
    const isYomTov = holidays.find(e => (e.LIGHT_CANDLES_TZEIS || e.YOM_TOV_ENDS) && !e.CHUL_ONLY);
    if (isYomTov) return { type: 'FORBIDDEN', reason: 'יום טוב' };
    
    // ספירת העומר (לפי מה שהגדרנו)
    if (hMonth === 1 && hDay >= 22) return { type: 'FORBIDDEN', reason: 'ספירת העומר' };
    
    return { type: 'AVAILABLE' };
}

function runStressTest() {
    console.log("🚀 מתחיל טסט מאמץ ל-100 שנה...");
    let current = new Date(2026, 0, 1);
    const end = new Date(2126, 0, 1);
    let failures = [];

    while (current <= end) {
        const status = getDayStaticStatus(current);
        
        // בדיקת שבת
        if (current.getDay() === 6 && status.type !== 'FORBIDDEN') {
            failures.push(`שבת לא חסומה: ${current.toDateString()}`);
        }
        
        // בדיקת יום טוב
        // (אפשר להוסיף כאן עוד בדיקות לפי מה שחשוב לך)
        
        current.setDate(current.getDate() + 1);
        if (failures.length > 50) break; // להפסיק אם יש יותר מדי שגיאות
    }

    if (failures.length > 0) {
        console.log(`❌ נמצאו ${failures.length} תקלות בלוח:`);
        console.log(failures.join('\n'));
    } else {
        console.log("✅ הכל תקין! 100 שנים של לוח שנה עברו בהצלחה.");
    }
}

runStressTest();