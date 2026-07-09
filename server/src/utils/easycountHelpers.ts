import { getEasyCountMeta, type EasyCountIssueResult, type EasyCountMode } from '../Services/easycount.service';

export function formatEasyCountStatusLabel(status?: string | null): string {
  switch (status) {
    case 'SIMULATED':
      return 'סימולציה (לא מסמך אמיתי)';
    case 'ISSUED':
      return 'קבלה הופקה';
    case 'FAILED':
      return 'שגיאה בהפקה';
    case 'SKIPPED':
      return 'דולג';
    default:
      return 'טרם הופקה';
  }
}

export function formatEasyCountUserMessage(
  result: EasyCountIssueResult,
  mode?: EasyCountMode,
): string {
  const resolvedMode = mode ?? getEasyCountMeta().mode;

  switch (result.status) {
    case 'SIMULATED':
      return 'קבלת מקדמה נרשמה בסימולציה — לא הופק מסמך מס אמיתי.';
    case 'ISSUED':
      return resolvedMode === 'sandbox'
        ? 'קבלת בדיקה הופקה בהצלחה ב-EZCount Sandbox.'
        : 'קבלת המקדמה הופקה בהצלחה ב-EZCount.';
    case 'FAILED':
      return `שגיאה בהפקת קבלה ב-EZCount: ${result.error || 'נסי שוב או פני לתמיכה.'}`;
    case 'SKIPPED':
      return 'הפקת קבלה EZCount דולגה.';
    default:
      return '';
  }
}

export function canRetryEasyCountReceipt(booking: {
  advancePaid?: number | null;
  isOption?: boolean;
  easycountStatus?: string | null;
}): boolean {
  if (booking.isOption) return false;
  if (!booking.advancePaid || booking.advancePaid <= 0) return false;
  return !booking.easycountStatus || booking.easycountStatus === 'FAILED';
}

export function canIssueEasyCountReceipt(booking: {
  advancePaid?: number | null;
  isOption?: boolean;
  easycountStatus?: string | null;
}): boolean {
  if (booking.isOption) return false;
  if (!booking.advancePaid || booking.advancePaid <= 0) return false;
  return !booking.easycountStatus
    || booking.easycountStatus === 'FAILED'
    || booking.easycountStatus === 'SIMULATED';
}
