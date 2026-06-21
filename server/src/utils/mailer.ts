import nodemailer from 'nodemailer';

// תשתית להתחברות ל-Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'fake-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'fake-password',
  },
});

function canSendRealMail(): boolean {
  return !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

async function deliverMail(
  mailOptions: nodemailer.SendMailOptions,
  simulationLabel: string
): Promise<boolean> {
  try {
    if (canSendRealMail()) {
      await transporter.sendMail(mailOptions);
      console.log(`✅ ${simulationLabel} → ${mailOptions.to}`);
    } else {
      console.log(`[MAILER SIMULATION] ${simulationLabel} → ${mailOptions.to}`);
    }
    return true;
  } catch (error) {
    console.error(`שגיאה בשליחת מייל (${simulationLabel}):`, error);
    return false;
  }
}

// ==========================================
// 1. הקפצת אופציה (Bump Option)
// ==========================================
export const sendBumpEmail = async (clientEmail: string, clientName: string, eventDate: string, deadline: Date) => {
  const deadlineStr = deadline.toLocaleString('he-IL', { hour: '2-digit', minute: '2-digit' });
  const dateStr = new Date(eventDate).toLocaleDateString('he-IL');

  const mailOptions = {
    from: '"גן אירועים מייפל" <maple.events.il@gmail.com>',
    to: clientEmail,
    subject: `עדכון חשוב לגבי התאריך שלך במייפל (${dateStr}) ⏳`,
    html: `
      <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-bottom: 3px solid #d97706;">
          <img src="cid:mapleLogo" alt="לוגו מייפל" style="max-width: 150px;" />
          <h2 style="color: #1f2937; margin: 15px 0 0 0;">החלטה דחופה נדרשת</h2>
        </div>
        <div style="padding: 25px;">
          <p style="font-size: 1.1rem;">שלום <strong>${clientName}</strong>,</p>
          <p style="font-size: 1.05rem; line-height: 1.5;">
            אנו מודים לך שבחרת להתעניין בקיום האירוע שלך בגן האירועים <strong>מייפל</strong>.<br/>
            התאריך ששמרת כאופציה (<strong>${dateStr}</strong>) הינו מבוקש מאוד, וכרגע יש לקוח נוסף שמעוניין לסגור אירוע במועד זה.
          </p>
          <div style="background-color: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; padding: 15px; margin: 25px 0; text-align: center;">
            <p style="color: #92400e; font-size: 1.1rem; margin: 0; font-weight: bold;">
              על מנת להבטיח את התאריך שלך, אנא צור איתנו קשר עד השעה ${deadlineStr}.
            </p>
            <p style="color: #d97706; font-size: 0.9rem; margin-top: 5px;">
              לאחר שעה זו, האופציה תשתחרר אוטומטית והתאריך יהיה פנוי ללקוח הבא.
            </p>
          </div>
          <p style="font-size: 1rem; margin-bottom: 30px;">
            נשמח לחגוג איתכם!<br/>
            <strong>צוות מייפל - גן אירועים בעיר</strong><br/>
            טלפון: 03-6777772
          </p>
        </div>
      </div>
    `,
    attachments: [{ filename: 'logo.png', path: './src/assets/logo.png', cid: 'mapleLogo' }]
  };

  try {
    console.log(`[MAILER SIMULATION] מכין שליחת מייל הקפצת אופציה ל: ${clientEmail}...`);
    // await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('שגיאה בשליחת המייל:', error);
    return false;
  }
};

// ==========================================
// 2. התראה ללקוח על פרטים שחסרים לאירוע (נודניק)
// ==========================================
export const sendSelectionReminderEmail = async (clientEmail: string, clientName: string, missingItems: string[]) => {
  const mailOptions = {
    from: '"גן אירועים מייפל" <maple.events.il@gmail.com>',
    to: clientEmail,
    subject: `תזכורת: השלמת פרטים לאירוע הקרוב שלכם במייפל 🍁`,
    html: `
      <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-bottom: 3px solid #6ee7b7;">
          <img src="cid:mapleLogo" alt="לוגו מייפל" style="max-width: 150px; margin-bottom: 10px;" />
          <h2 style="color: #1f2937; margin: 0;">מתכוננים לאירוע שלכם!</h2>
        </div>
        <div style="padding: 25px;">
          <p style="font-size: 1.1rem;">שלום <strong>${clientName}</strong>,</p>
          <p style="font-size: 1.05rem; line-height: 1.5;">
            האירוע שלכם ב<strong>מייפל</strong> הולך ומתקרב, ואנחנו מתרגשים יחד איתכם! 🎉<br/>
            שמנו לב שטרם סיימתם לבחור את הפרטים הבאים למערכת:
          </p>
          <ul style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 15px 35px; margin: 25px 0; color: #166534; font-size: 1.1rem; font-weight: bold;">
            ${missingItems.map(item => `<li>${item}</li>`).join('')}
          </ul>
          <p style="font-size: 1rem; margin-bottom: 30px;">
            אנא היכנסו למערכת או צרו איתנו קשר בהקדם כדי שנוכל להיערך מראש ולהפיק לכם אירוע מושלם.<br/><br/>
            <strong>צוות מייפל 🍁</strong><br/>
            טלפון: 03-6777772
          </p>
        </div>
        <div style="background-color: #f3f4f6; padding: 15px; text-align: center; color: #6b7280; font-size: 0.85rem;">
          🤖 הודעה זו נשלחה אוטומטית ממערכת מייפל.<br/>
          <strong>ניתן להשיב למייל זה בכל שאלה, ונציג יחזור אליכם בהקדם.</strong>
        </div>
      </div>
    `,
    attachments: [{ filename: 'logo.png', path: './src/assets/logo.png', cid: 'mapleLogo' }]
  };

  try {
    console.log(`[MAILER SIMULATION] שולח תזכורת בחירות למייל: ${clientEmail}...`);
    // await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('שגיאה בשליחת מייל תזכורת:', error);
    return false;
  }
};

// ==========================================
// 3. התראה ללקוח על צ'ק ביטחון חסר (נודניק)
// ==========================================
export const sendSecurityCheckReminderEmail = async (clientEmail: string, clientName: string) => {
  const mailOptions = {
    from: '"גן אירועים מייפל" <maple.events.il@gmail.com>',
    to: clientEmail,
    subject: `תזכורת: מסירת צ'ק ביטחון לאירוע שלכם במייפל 🍁`,
    html: `
      <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-bottom: 3px solid #fca5a5;">
          <img src="cid:mapleLogo" alt="לוגו מייפל" style="max-width: 150px; margin-bottom: 10px;" />
          <h2 style="color: #1f2937; margin: 0;">עדכון סטטוס הזמנה</h2>
        </div>
        <div style="padding: 25px;">
          <p style="font-size: 1.1rem;">שלום <strong>${clientName}</strong>,</p>
          <p style="font-size: 1.05rem; line-height: 1.5;">
            מזל טוב על סגירת האירוע בגן האירועים <strong>מייפל</strong>!<br/>
            שמנו לב שעברו 24 שעות מחתימת החוזה וטרם התקבל או הועלה למערכת צ'ק ביטחון.
          </p>
          <div style="background-color: #fef2f2; border: 1px solid #fca5a5; border-radius: 6px; padding: 15px; margin: 25px 0; text-align: center;">
            <p style="color: #991b1b; font-size: 1rem; margin: 0; font-weight: bold;">
              נשמח לקבלו בהקדם האפשרי על מנת להבטיח את שריון התאריך שלכם באופן סופי.
            </p>
          </div>
          <p style="font-size: 1rem; margin-bottom: 30px;">
            תודה רבה,<br/>
            <strong>צוות מייפל 🍁</strong>
          </p>
        </div>
        <div style="background-color: #f3f4f6; padding: 15px; text-align: center; color: #6b7280; font-size: 0.85rem;">
          🤖 הודעה זו נשלחה אוטומטית ממערכת מייפל.<br/>
          <strong>ניתן להשיב למייל זה בכל שאלה, ונציג יחזור אליכם בהקדם.</strong>
        </div>
      </div>
    `,
    attachments: [{ filename: 'logo.png', path: './src/assets/logo.png', cid: 'mapleLogo' }]
  };

  try {
    console.log(`[MAILER SIMULATION] שולח תזכורת צ'ק ביטחון למייל: ${clientEmail}...`);
    // await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('שגיאה בשליחת מייל:', error);
    return false;
  }
};

// ==========================================
// 4. התראה פנימית למנהל האולם
// ==========================================
export const sendManagerFinancialAlertEmail = async (managerEmail: string, alertType: string, clientName: string, details: string) => {
  const mailOptions = {
    from: '"מערכת התראות מייפל" <maple.events.il@gmail.com>',
    to: managerEmail,
    subject: `⚠️ התראת ניהול: ${alertType} - ${clientName}`,
    html: `
      <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ef4444; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #ef4444; padding: 15px; text-align: center;">
          <h2 style="color: #fff; margin: 0;">התראת כספים ⚠️</h2>
        </div>
        <div style="padding: 25px; background-color: #fff;">
          <p><strong>לקוח:</strong> ${clientName}</p>
          <p><strong>סוג התראה:</strong> ${alertType}</p>
          <p><strong>פרטים:</strong> ${details}</p>
          <br/>
          <p style="color: #ef4444; font-weight: bold;">נדרש טיפול מול הלקוח בהקדם.</p>
        </div>
      </div>
    `
  };

  try {
    console.log(`[MAILER SIMULATION] שולח התראת מנהל למייל: ${managerEmail}...`);
    // await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('שגיאה בשליחת מייל מנהל:', error);
    return false;
  }
};

// ==========================================
// 5. בקשת משוב לאחר סיום אירוע (חדש!)
// ==========================================
export const sendFeedbackRequestEmail = async (clientEmail: string, clientName: string | null, link: string) => {
  const name = clientName ? clientName.split(' ')[0] : 'לקוחות יקרים';
  
  const mailOptions = {
    from: '"גן אירועים מייפל" <maple.events.il@gmail.com>',
    to: clientEmail,
    subject: `איך היה האירוע שלכם? נשמח לשמוע! 🌟`,
    html: `
      <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-bottom: 3px solid #d8a051;">
          <img src="cid:mapleLogo" alt="לוגו מייפל" style="max-width: 150px; margin-bottom: 10px;" />
          <h2 style="color: #1f2937; margin: 0;">תודה שחגגתם איתנו! 🎉</h2>
        </div>
        <div style="padding: 25px;">
          <p style="font-size: 1.1rem;">שלום <strong>${name}</strong>,</p>
          <p style="font-size: 1.05rem; line-height: 1.5;">
            היה לנו לעונג עצום לארח אתכם ואת האורחים שלכם בגן האירועים <strong>מייפל</strong>.<br/>
            כדי שנוכל להמשיך לתת את השירות הטוב ביותר ולהשתפר, נשמח מאוד אם תקדישו דקה קטנה לדירוג החוויה שלכם בטופס הבא:
          </p>
          
          <div style="text-align: center; margin: 35px 0;">
            <a href="${link}" style="background-color: #d97706; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 1.1rem; display: inline-block;">למעבר לטופס המשוב (קצרצר)</a>
          </div>
          
          <p style="font-size: 0.9rem; color: #6b7280; text-align: center;">
            (שימו לב: מטעמי אבטחה, הקישור אישי וניתן למילוי פעם אחת בלבד)
          </p>
          
          <p style="font-size: 1rem; margin-top: 30px; margin-bottom: 10px;">
            בתודה מראש ובאהבה,<br/>
            <strong>צוות מייפל 🍁</strong>
          </p>
        </div>
        <div style="background-color: #f3f4f6; padding: 15px; text-align: center; color: #6b7280; font-size: 0.85rem;">
          🤖 הודעה זו נשלחה אוטומטית ממערכת מייפל.
        </div>
      </div>
    `,
    attachments: [{ filename: 'logo.png', path: './src/assets/logo.png', cid: 'mapleLogo' }]
  };

  try {
    return deliverMail(mailOptions, `מייל משוב ל-${clientEmail}`);
  } catch (error) {
    console.error('שגיאה בשליחת מייל משוב:', error);
    return false;
  }
};