// src/utils/whatsapp.ts

// ==========================================
// 1. הקפצת אופציה (Bump Option)
// ==========================================
export const sendBumpWhatsApp = async (clientPhone: string, clientName: string, eventDate: string, deadline: Date) => {
  const deadlineStr = deadline.toLocaleString('he-IL', { hour: '2-digit', minute: '2-digit' });
  const dateStr = new Date(eventDate).toLocaleDateString('he-IL');

  // בוואטסאפ אנחנו משתמשים בכוכבית (*) כדי להדגיש טקסט (Bold)
  const message = `שלום *${clientName}*,\n\n` +
    `אנו מודים לך שבחרת להתעניין בקיום האירוע שלך בגן האירועים *מייפל* 🍁.\n` +
    `התאריך ששמרת כאופציה (*${dateStr}*) הינו מבוקש מאוד, וכרגע יש לקוח נוסף שמעוניין לסגור אירוע במועד זה.\n\n` +
    `⏳ *החלטה דחופה נדרשת:*\n` +
    `על מנת להבטיח את התאריך שלך, אנא צור איתנו קשר עד השעה *${deadlineStr}*.\n` +
    `לאחר שעה זו, האופציה תשתחרר אוטומטית והתאריך יהיה פנוי ללקוח הבא.\n\n` +
    `נשמח לחגוג איתכם!\n` +
    `*צוות מייפל - גן אירועים בעיר*\n` +
    `טלפון: 03-6777772\n` +
    `--------------------------\n` +
    `🤖 _הודעה זו נשלחה אוטומטית מהמערכת._\n` +
    `_ניתן להשיב להודעה זו בכל שאלה ונציג יחזור אליכם._`;

  return simulateWhatsApp(clientPhone, message, 'אופציה');
};

// ==========================================
// 2. התראה על אי השלמת בחירות - נודניק לקוח
// ==========================================
export const sendSelectionReminderWhatsApp = async (clientPhone: string, clientName: string, missingItems: string[]) => {
  const message = `שלום *${clientName}*,\n\n` +
    `האירוע שלכם ב-*מייפל* הולך ומתקרב, ואנחנו מתרגשים יחד איתכם! 🎉\n` +
    `שמנו לב שטרם סיימתם לבחור את הפרטים הבאים למערכת:\n` +
    `*${missingItems.join(', ')}*\n\n` +
    `אנא היכנסו למערכת או צרו איתנו קשר בהקדם כדי שנוכל להיערך מראש ולהפיק לכם אירוע מושלם.\n\n` +
    `צוות מייפל 🍁\n` +
    `--------------------------\n` +
    `🤖 _הודעה זו נשלחה אוטומטית מהמערכת._\n` +
    `_ניתן להשיב להודעה זו בכל שאלה ונציג יחזור אליכם._`;

  return simulateWhatsApp(clientPhone, message, 'בחירות חסרות');
};

// ==========================================
// 3. התראה על חוסר בצ'ק ביטחון - נודניק לקוח
// ==========================================
export const sendSecurityCheckReminderWhatsApp = async (clientPhone: string, clientName: string) => {
  const message = `שלום *${clientName}*,\n\n` +
    `מזל טוב על סגירת האירוע בגן האירועים *מייפל*! 🍁\n` +
    `שמנו לב שעברו 24 שעות מחתימת החוזה וטרם התקבל צ'ק ביטחון כנדרש בחוזה.\n` +
    `נשמח לקבלו בהקדם כדי שנוכל להבטיח את שריון התאריך באופן סופי.\n\n` +
    `תודה,\nצוות מייפל\n` +
    `--------------------------\n` +
    `🤖 _הודעה זו נשלחה אוטומטית מהמערכת._\n` +
    `_ניתן להשיב להודעה זו בכל שאלה ונציג יחזור אליכם._`;

  return simulateWhatsApp(clientPhone, message, 'צ\'ק ביטחון - לקוח');
};

// ==========================================
// 4. התראות פיננסיות פנימיות - למנהל האולם
// ==========================================
export const sendManagerFinancialAlert = async (managerPhone: string, alertType: string, clientName: string, details: string) => {
  // התראות למנהל הן קצרות ופנימיות, לא צריך את הערת ה"הודעה אוטומטית"
  const message = `⚠️ *התראת מערכת - ניהול כספים* ⚠️\n\n` +
    `*לקוח:* ${clientName}\n` +
    `*סוג התראה:* ${alertType}\n` +
    `*פרטים:* ${details}\n\n` +
    `יש ליצור קשר עם הלקוח לטיפול מיידי.`;

  return simulateWhatsApp(managerPhone, message, 'התראת מנהל');
};

// ==========================================
// 5. בקשת משוב לאחר סיום אירוע (חדש!)
// ==========================================
export const sendFeedbackRequestWhatsApp = async (clientPhone: string, clientName: string | null, link: string) => {
  const name = clientName ? clientName.split(' ')[0] : 'יקרים שלנו';
  const message = `היי *${name}*, תודה שחגגתם איתנו! 🎉\n\n` +
    `היה לנו לעונג לארח אתכם בגן האירועים *מייפל* 🍁.\n` +
    `נשמח מאוד אם תוכלו להקדיש דקה קטנה מזמנכם כדי לשתף אותנו איך היה, ולעזור לנו להמשיך להשתפר:\n\n` +
    `${link}\n\n` +
    `_(שימו לב: הקישור אישי וניתן למילוי פעם אחת בלבד)_\n\n` +
    `צוות האולם ❤️\n` +
    `--------------------------\n` +
    `🤖 _הודעה זו נשלחה אוטומטית מהמערכת._`;

  return simulateWhatsApp(clientPhone, message, 'בקשת משוב');
};

// ==========================================
// פונקציית עזר להדפסת הלוגים (סימולציה של שליחה)
// ==========================================
const simulateWhatsApp = async (phone: string, message: string, type: string) => {
  try {
    // 💡 בעתיד, כאן תיכנס קריאת ה-API האמיתית לוואטסאפ
    console.log(`\n[WHATSAPP SIMULATION - ${type}] מכין שליחה לטלפון: ${phone}...`);
    console.log(`------------ תוכן ההודעה ------------\n${message}\n-------------------------------------`);
    console.log(`[WHATSAPP SIMULATION] ✅ הודעת הוואטסאפ נשלחה בהצלחה!`);
    return true;
  } catch (error) {
    console.error(`שגיאה בשליחת וואטסאפ (${type}):`, error);
    return false;
  }
};