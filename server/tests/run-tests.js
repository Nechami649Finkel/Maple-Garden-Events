// --- סקריפט בדיקה אוטומטי למערכת האופציות והסגירה של מייפל ---

// הכתובת של השרת שלנו (חובה שהשרת ירוץ ברקע בזמן הטסט)
const API_URL = 'http://localhost:5000/api';

async function runTest() {
  console.log('🚀 מתחיל בדיקת אוטומציה למערכת האופציות של מייפל...\n');

  // נגדיר שני תאריכים דמיוניים לטסט בחודש דצמבר (כדי לא לגעת בתאריכים אמיתיים)
// נגדיר שני תאריכים דמיוניים לטסט בחודש דצמבר (ימי שני ושלישי רגילים)
  const testDate1 = '2026-12-14';
  const testDate2 = '2026-12-15';
  const phone = '050-1234567-TEST';

  try {
    // ---------------------------------------------------------
    // שלב 1: יצירת אופציה ל-2 תאריכים
    // ---------------------------------------------------------
    console.log('⏳ שלב 1: מדמה לקוח ששומר אופציה ל-2 תאריכים...');
    const createRes = await fetch(`${API_URL}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientAFullName: 'לקוח טסט אוטומטי',
        clientAIdNumber: '123456789',
        clientAPhone: phone,
        eventType: 'חתונה',
        guestCount: 400,
        finalPricePortion: 350,
        allSelectedDates: [testDate1, testDate2],
        isOption: true
      })
    });
    
    const createData = await createRes.json();
    if (!createData.success) throw new Error('השרת סירב לשמור את האופציות.');
    console.log('✅ שלב 1 עבר: 2 האופציות נשמרו במסד הנתונים.\n');

    // ---------------------------------------------------------
    // שלב ביניים: מציאת ה-ID של התאריך שנתפס (כדי שנוכל לסגור אותו)
    // ---------------------------------------------------------
    const datesRes = await fetch(`${API_URL}/calendar/dates?start=2026-12-01&end=2026-12-31`);
    const datesData = await datesRes.json();
    
    const d1 = datesData.find(d => d.date === testDate1);
    const d2 = datesData.find(d => d.date === testDate2);

    if (d1.status !== 'OPTION' || d2.status !== 'OPTION') {
      throw new Error('התאריכים לא נצבעו כ-OPTION בלוח!');
    }

    // ---------------------------------------------------------
    // שלב 2: סגירה סופית של תאריך אחד (10 בדצמבר)
    // ---------------------------------------------------------
    console.log(`⏳ שלב 2: סוגר סופית את תאריך ${testDate1} ומצפה ש-${testDate2} ישוחרר...`);
    const finalizeRes = await fetch(`${API_URL}/bookings/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateId: d1.id,
        advancePaid: 5000,
        hasMusic: true,
        akumApprovalCode: 'TEST-1234'
      })
    });
    
    const finalizeData = await finalizeRes.json();
    if (!finalizeData.success) throw new Error('השרת נכשל בפעולת הסגירה הסופית.');
    console.log('✅ שלב 2 עבר: השרת אישר את הסגירה.\n');

    // ---------------------------------------------------------
    // שלב 3: וידוא סופי בלוח השנה
    // ---------------------------------------------------------
    console.log('⏳ שלב 3: בודק שכל הנתונים התעדכנו נכון בלוח האמיתי...');
    const finalDatesRes = await fetch(`${API_URL}/calendar/dates?start=2026-12-01&end=2026-12-31`);
    const finalDatesData = await finalDatesRes.json();

    const finalD1 = finalDatesData.find(d => d.date === testDate1);
    const finalD2 = finalDatesData.find(d => d.date === testDate2);

    if (finalD1.status === 'BOOKED' && finalD2.status === 'AVAILABLE') {
      console.log('🎉🎉🎉 הצלחה מסחררת! המערכת עובדת מושלם!');
      console.log(`👉 תאריך ${testDate1} הפך ל: ${finalD1.status} (סגור)`);
      console.log(`👉 תאריך ${testDate2} הפך ל: ${finalD2.status} (פנוי ללקוחות אחרים)\n`);
    } else {
      throw new Error(`באג במערכת! הסטטוסים הסופיים שגויים: \nתאריך 1: ${finalD1.status} \nתאריך 2: ${finalD2.status}`);
    }

  } catch (error) {
    console.error('\n❌ הטסט נכשל:', error.message);
  }
}

// הפעלת הטסט
runTest();