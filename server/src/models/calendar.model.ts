// server/src/models/calendar.model.ts
import { EventStatus } from '../Services/calendar.service';
export interface ICalendarDate {
  id?: string;
  date: Date; // התאריך הלועזי
  hebrewDate: string; // התאריך העברי בפורמט "כ״ח באייר תשפ״ד"
  
  // --- סטטוס האירוע ---
  status: EventStatus;
  
  // --- ניהול אופציות בזמן אמת ---
  lockDetails?: {
    lockedBy: string;      // איזה עובד בודק כרגע
    lockedAt: Date;        // מתי ננעל
    expiresAt: Date;       // מתי האופציה פוקעת
  };

  // --- הגדרות חכמות ל-200 שנה ---
  constraints: {
    isProblematic: boolean; // יום "דפוק" (למשל בין הזמנים)
    problemReason?: string; // למה הוא דפוק
  };

  // --- קישור להזמנה של מרים ---
  // ברגע שזה BOOKED, השדה הזה יכיל את ה-ID של ההזמנה
  bookingId?: string; 
  
  // --- לוגים (בדיוק כמו אצל מרים) ---
  audit: {
    createdAt: Date;
    updatedAt: Date;
    lastUpdatedBy: string;
  };
}