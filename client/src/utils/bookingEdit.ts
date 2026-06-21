export function canEditBooking(eventDateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDay = new Date(eventDateStr + (eventDateStr.includes('T') ? '' : 'T12:00:00'));
  eventDay.setHours(0, 0, 0, 0);
  return today < eventDay;
}
