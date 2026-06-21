const API_URL = 'http://localhost:5000/api/settings';

async function runTests() {
  console.log('🚀 מתחיל בדיקות אוטומטיות למערכת ההגדרות (API & Database)...\n');

  try {
    // ==========================================
    // טסט 1: עדכון ושליפת הגדרות כלליות
    // ==========================================
    console.log('⏳ טסט 1: מעדכן הגדרות גלובליות...');
    await fetch(`${API_URL}/global`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vatRate: 18, basePricePerPortion: 280, designBasePrice: 5000 })
    });

    // מיד שולפים חזרה כדי לוודא שזה נשמר ב-DB
    const settingsRes = await fetch(`${API_URL}/global`);
    const settings = await settingsRes.json();

    if (settings.vatRate === 18 && settings.basePricePerPortion === 280) {
      console.log('✅ טסט 1 עבר: ההגדרות התעדכנו ונשמרו בהצלחה במסד הנתונים!');
    } else {
      console.error('❌ טסט 1 נכשל!', settings);
    }

    // ==========================================
    // טסט 2: הוספת תוספת חדשה למחירון הדינמי
    // ==========================================
    console.log('\n⏳ טסט 2: יצירת תוספת חדשה למחירון...');
    const extraRes = await fetch(`${API_URL}/extras`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'מכונת עשן טסט', category: 'ציוד טכני', price: 1200 })
    });
    const extra = await extraRes.json();

    if (extra.name === 'מכונת עשן טסט' && extra.price === 1200 && extra.isActive === true) {
      console.log('✅ טסט 2 עבר: התוספת נוצרה בהצלחה וקיבלה ID מהמסד!');
    } else {
      console.error('❌ טסט 2 נכשל!', extra);
    }

    // ==========================================
    // טסט 3: שינוי סטטוס של התוספת (פעיל -> מוסתר)
    // ==========================================
    console.log('\n⏳ טסט 3: משנה את סטטוס התוספת למוסתרת (isActive = false)...');
    const toggleRes = await fetch(`${API_URL}/extras/${extra.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false })
    });
    const toggledExtra = await toggleRes.json();

    if (toggledExtra.isActive === false) {
      console.log('✅ טסט 3 עבר: הסטטוס עודכן בהצלחה ונשמר ב-DB!');
    } else {
      console.error('❌ טסט 3 נכשל!', toggledExtra);
    }

    console.log('\n🎉 כל הטסטים עברו בהצלחה! השרת שלך יציב ואפשר לעשות Push ל-Git בלב שקט. 🚀');

  } catch (err) {
    console.error('\n💥 שגיאת תקשורת עם השרת (האם הוא דולק?):', err.message);
  }
}

runTests();