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

export function canRetryEasyCountReceipt(booking: {
  advancePaid?: number | null;
  isOption?: boolean;
  easycountStatus?: string | null;
}): boolean {
  if (booking.isOption) return false;
  if (!booking.advancePaid || booking.advancePaid <= 0) return false;
  return !booking.easycountStatus || booking.easycountStatus === 'FAILED';
}

export function canForceReissueEasyCountReceipt(booking: {
  advancePaid?: number | null;
  isOption?: boolean;
  easycountStatus?: string | null;
}): boolean {
  if (booking.isOption) return false;
  if (!booking.advancePaid || booking.advancePaid <= 0) return false;
  return booking.easycountStatus === 'SIMULATED' || booking.easycountStatus === 'ISSUED';
}
