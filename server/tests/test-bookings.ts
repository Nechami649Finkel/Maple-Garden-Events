import { calendarService } from '../src/Services/calendar.service';
import prisma from '../src/config/prisma';

async function runBookingLimitsTest() {
    console.log("🛡️ מתחיל טסט כפילויות עומס אירועים (בוקר/צהריים/ערב)...");
    
    // ניצור תאריך פיקטיבי בבסיס הנתונים רק לצורך הטסט
    const testDate = new Date('2099-01-01T00:00:00.000Z');
    
    let dateRecord = await prisma.eventDate.findUnique({ where: { date: testDate } });
    if (!dateRecord) {
        dateRecord = await prisma.eventDate.create({
            data: { date: testDate, status: 'AVAILABLE' }
        });
    }
    const dateId = dateRecord.id;

    // מנקים שאריות אם היו טסטים קודמים
    await prisma.booking.deleteMany({ where: { calendarDateId: dateId } });

    // אלו כל נתוני החובה שהגדרנו ב-Prisma (שם, ת"ז, טלפון, מוזמנים, מחירים ומי יצר)
    const baseClientData = {
        clientAFullName: 'ישראל ישראלי',
        clientAIdNumber: '123456789',
        clientAPhone: '0500000000',
        clientBFullName: 'ישראלה ישראלי',
        clientBIdNumber: '987654321',
        clientBPhone: '0511111111',
        guestCount: 200,             // חובה לפי הסכמה
        finalPricePortion: 250,      // חובה לפי הסכמה
        totalPrice: 50000,           // חובה לפי הסכמה
        createdBy: 'מערכת הטסטים'    // חובה לפי הסכמה
    };

    try {
        console.log("1️⃣ מנסה לקבוע אירוע בוקר...");
        await calendarService.bookEventFinal(dateId, { timeOfDay: 'בוקר', eventType: 'ברית', ...baseClientData });
        console.log("✅ בוקר נקבע בהצלחה.");

        console.log("2️⃣ מנסה לקבוע אירוע צהריים...");
        await calendarService.bookEventFinal(dateId, { timeOfDay: 'צהריים', eventType: 'ברית', ...baseClientData });
        console.log("✅ צהריים נקבע בהצלחה.");

        console.log("3️⃣ מנסה לקבוע אירוע ערב...");
        await calendarService.bookEventFinal(dateId, { timeOfDay: 'ערב', eventType: 'חתונה', ...baseClientData });
        console.log("✅ ערב נקבע בהצלחה.");

        console.log("4️⃣ מנסה לקבוע אירוע בוקר נוסף (אמור להיכשל!)...");
        let expectedError = false;
        try {
            await calendarService.bookEventFinal(dateId, { timeOfDay: 'בוקר', eventType: 'ברית', ...baseClientData });
        } catch (e: any) {
            expectedError = true;
            console.log("✅ נחסם בהצלחה! הודעת השגיאה מהמערכת: ", e.message);
        }

        if (!expectedError) {
            console.error("❌ שגיאה חמורה: המערכת אפשרה לקבוע 2 אירועי בוקר!");
        } else {
            console.log("🎉 טסט כפילויות עבר בהצלחה מושלמת! המערכת מוגנת.");
        }

    } catch (e) {
        console.error("❌ הטסט נכשל באמצע עקב שגיאה לא צפויה:", e);
    } finally {
        // ניקיון בסיס הנתונים בסוף הטסט וסגירה חלקה
        await prisma.booking.deleteMany({ where: { calendarDateId: dateId } });
        await prisma.eventDate.delete({ where: { id: dateId } });
        await prisma.$disconnect();
        process.exit(0);
    }
}

runBookingLimitsTest();