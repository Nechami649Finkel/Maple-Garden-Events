import cron from 'node-cron';
import prisma from '../config/prisma';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';
import { 
  sendSelectionReminderWhatsApp, 
  sendSecurityCheckReminderWhatsApp, 
  sendManagerFinancialAlert,
  sendFeedbackRequestWhatsApp // <-- ייבוא פונקציית הוואטסאפ החדשה
} from './whatsapp';
import {
  sendSelectionReminderEmail,
  sendSecurityCheckReminderEmail,
  sendManagerFinancialAlertEmail,
  sendFeedbackRequestEmail // <-- ייבוא פונקציית המייל החדשה
} from './mailer';
import { buildFeedbackSides, primaryPhone } from './feedbackHelpers';
import { runDatabaseBackup } from './databaseBackup';

export const startCronJobs = () => {
  logger.info('Cron jobs service started');

  if (process.env.BACKUP_ENABLED === 'true') {
    const schedule = process.env.BACKUP_CRON || '0 3 * * *';
    cron.schedule(schedule, async () => {
      logger.info('Starting scheduled database backup');
      await runDatabaseBackup();
    });
    logger.info(`Database backup scheduled: ${schedule}`);
  }
  
  // הגדרות למנהל
  const MANAGER_PHONE = '0501234567'; 
  const MANAGER_EMAIL = 'maple.events.il@gmail.com'; 

  // ==========================================
  // אופציות שפג תוקפן — נשארות על הלוח עד סגירת אירוע אמיתי (BOOKED)
  // שחרור ידני: POST /api/bookings/release
  // ==========================================

  // ==========================================
  // טיימר 2: התראות "נודניק" חכמות (כל בוקר ב-09:00)
  // ==========================================
  cron.schedule('0 9 * * *', async () => {
    logger.info('--- מתחיל סריקת בוקר להתראות "נודניק" לאירועים סגורים ---');
    const now = new Date();
    const todayDayOfWeek = now.getDay(); // 0 = יום ראשון, 1 = שני...

    try {
      const activeBookings = await prisma.booking.findMany({
        where: { eventDate: { status: 'BOOKED' } },
        include: { eventDate: true, eventForm: true }
      });

      for (const booking of activeBookings) {
        const clientPhone = booking.clientAPhone?.split(' | ')[0].trim() || null;
        const clientEmail = booking.clientAEmail || null;
        const clientName = booking.clientAFullName;

        // --- חישוב זמן ---
        const msSinceCreation = now.getTime() - booking.createdAt.getTime();
        const hoursSinceCreation = msSinceCreation / (1000 * 60 * 60);
        
        let daysUntilEvent = 999;
        if (booking.eventDate) {
          const msUntilEvent = booking.eventDate.date.getTime() - now.getTime();
          daysUntilEvent = Math.ceil(msUntilEvent / (1000 * 60 * 60 * 24));
        }

        // ---------------------------------------------------------
        // 1. כספים: צ'ק ביטחון חסר (רץ תמיד, כל יום, אחרי 24 שעות!)
        // ---------------------------------------------------------
        if (booking.securityCheckStatus === 'PENDING' && hoursSinceCreation > 24) {
          if (clientPhone) await sendSecurityCheckReminderWhatsApp(clientPhone, clientName);
          if (clientEmail) await sendSecurityCheckReminderEmail(clientEmail, clientName);
          
          const details = `האירוע נסגר בתאריך ${booking.createdAt.toLocaleDateString('he-IL')} וטרם התקבל צ'ק.`;
          await sendManagerFinancialAlert(MANAGER_PHONE, "חסר צ'ק ביטחון", clientName, details);
          await sendManagerFinancialAlertEmail(MANAGER_EMAIL, "חסר צ'ק ביטחון", clientName, details);
        }

        // ---------------------------------------------------------
        // 2. כספים: תשלום סופי חסר (פחות מ-30 יום לאירוע - התראה למנהל כל יום)
        // ---------------------------------------------------------
        const amountDue = booking.totalPrice - (booking.totalPaid || 0);
        if (daysUntilEvent <= 30 && daysUntilEvent > 0 && amountDue > 0) {
          const details = `האירוע מתקיים ב-${booking.eventDate!.date.toLocaleDateString('he-IL')}, נותר לתשלום: ₪${amountDue}`;
          await sendManagerFinancialAlert(MANAGER_PHONE, "חוב פתוח לאירוע קרוב", clientName, details);
          await sendManagerFinancialAlertEmail(MANAGER_EMAIL, "חוב פתוח לאירוע קרוב", clientName, details);
        }

        // ---------------------------------------------------------
        // 3. תפעול: אי השלמת טופס ופרטים לאירוע
        // ---------------------------------------------------------
        // אם אנחנו בטווח של חודש מהאירוע
        if (daysUntilEvent <= 30 && daysUntilEvent > 0) {
          const missingItems: string[] = [];
          const f = booking.eventForm;
          
          if (!f) {
            missingItems.push('עיצוב שולחנות ואולם', 'תפריט קייטרינג', 'שעות ויעד מוזמנים סופי');
          } else {
            if (!f.tableclothId || !f.napkinId) missingItems.push('בחירת צבעי מפות ומפיות');
            if (!f.finalGuestCount) missingItems.push('כמות מוזמנים סופית');
            if (!f.kashrut) missingItems.push('סוג כשרות מבוקשת');
          }

          if (missingItems.length > 0) {
            const isCriticalPeriod = daysUntilEvent <= 10; // שבוע וחצי (10 ימים) ומטה
            const isWeeklyReminderDay = (todayDayOfWeek === 0); // יום ראשון

            if (isCriticalPeriod || isWeeklyReminderDay) {
              if (clientPhone) await sendSelectionReminderWhatsApp(clientPhone, clientName, missingItems);
              if (clientEmail) await sendSelectionReminderEmail(clientEmail, clientName, missingItems);
            }
          }
        }
      }

      logger.info('✅ סריקת בוקר (נודניק כפול וחכם) הסתיימה בהצלחה.');

    } catch (error) {
      logger.error('שגיאה בהרצת התראות נודניק:', error);
    }
  });

  // ==========================================
  // טיימר 3: בקשת משוב לאחר אירוע (רץ כל בוקר ב-10:00)
  // ==========================================
  cron.schedule('0 10 * * *', async () => {
    logger.info('--- מתחיל תהליך איתור אירועים מאתמול לשליחת משוב ---');
    
    // הגדרת טווח הזמנים של "אתמול"
    const now = new Date();
    const startOfYesterday = new Date(now);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    startOfYesterday.setHours(0, 0, 0, 0);

    const endOfYesterday = new Date(now);
    endOfYesterday.setDate(endOfYesterday.getDate() - 1);
    endOfYesterday.setHours(23, 59, 59, 999);

    try {
      // שליפת הזמנות של אירועים שהיו אתמול ובסטטוס "סגור"
      const finishedBookings = await prisma.booking.findMany({
        where: {
          eventDate: {
            date: {
              gte: startOfYesterday,
              lte: endOfYesterday
            },
            status: 'BOOKED'
          }
        },
        include: {
          feedbacks: true // נביא את הפידבקים כדי לוודא שטרם יצרנו
        }
      });

      if (finishedBookings.length === 0) {
        logger.info('לא נמצאו אירועים מאתמול.');
        return;
      }

      for (const booking of finishedBookings) {
        // בודקים אם כבר הופק משוב לאירוע הזה (למנוע כפילויות)
        if (booking.feedbacks && booking.feedbacks.length > 0) {
          continue; 
        }

        const sides = buildFeedbackSides(booking);
        const feedbacksToCreate = sides.map((side) => ({
          bookingId: booking.id,
          clientSide: side.side,
          clientName: side.name,
          token: uuidv4(),
        }));

        // אם יש לנו צדדים רלוונטיים, נשמור במסד ונייצר להם קישור
        if (feedbacksToCreate.length > 0) {
          await prisma.feedback.createMany({
            data: feedbacksToCreate
          });

          for (let i = 0; i < feedbacksToCreate.length; i++) {
            const fb = feedbacksToCreate[i];
            const sideInfo = sides[i];
            const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
            const feedbackLink = `${baseUrl}/feedback/${fb.token}`;

            const phoneToSend = primaryPhone(sideInfo.phone);
            const emailToSend = sideInfo.email?.trim() || null;

            if (phoneToSend) {
              await sendFeedbackRequestWhatsApp(phoneToSend, fb.clientName, feedbackLink);
              logger.info(`✅ נשלח וואטסאפ משוב ללקוח ${fb.clientName} (צד ${fb.clientSide})`);
            }

            if (emailToSend) {
              await sendFeedbackRequestEmail(emailToSend, fb.clientName, feedbackLink);
              logger.info(`✅ נשלח מייל משוב ללקוח ${fb.clientName} (צד ${fb.clientSide})`);
            }
          }
        }
      }

      logger.info('✅ תהליך שליחת משובים הסתיים בהצלחה.');

    } catch (error) {
      logger.error('שגיאה בתהליך שליחת המשובים:', error);
    }
  });

  // ==========================================
  // טיימר 4: התראת תוקף תעודות כשרות (רץ כל בוקר ב-08:00)
  // ==========================================
  cron.schedule('0 8 * * *', async () => {
    logger.info('--- בודק תוקף תעודות כשרות ---');
    const now = new Date();
    const warningDate = new Date();
    warningDate.setDate(now.getDate() + 14); // התראה שבועיים מראש

    try {
      const expiringCerts = await prisma.kashrutCertificate.findMany({
        where: { 
          validUntil: { lte: warningDate } 
        }
      });

      for (const cert of expiringCerts) {
        // בודקים אם עבר התוקף או שרק מתקרב
        const isExpired = cert.validUntil && cert.validUntil < now;
        const statusText = isExpired ? 'פג תוקף!' : 'עומד לפוג בקרוב.';
        const dateStr = cert.validUntil ? cert.validUntil.toLocaleDateString('he-IL') : 'לא ידוע';
        
        const details = `תעודת הכשרות של "${cert.displayName}" ${statusText} (תאריך פקיעה: ${dateStr}). נא להיכנס למערכת, לעדכן תאריך חדש ולהעלות צילום תעודה מעודכן.`;
        
        // שליחת התראה גם למייל וגם לוואטסאפ של המנהל
        await sendManagerFinancialAlert(MANAGER_PHONE, "תוקף תעודת כשרות", cert.displayName, details);
        await sendManagerFinancialAlertEmail(MANAGER_EMAIL, "תוקף תעודת כשרות", cert.displayName, details);
        
        logger.info(`✅ נשלחה התראת כשרות למנהל עבור: ${cert.displayName}`);
      }
    } catch (error) {
      logger.error('שגיאה בסריקת תעודות כשרות:', error);
    }
  });

};