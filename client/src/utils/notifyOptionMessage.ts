export function buildDefaultOptionInterestMessage(
  clientName: string,
  eventDateStr: string,
): string {
  const dateDisplay = eventDateStr.includes('-')
    ? eventDateStr.split('-').reverse().join('/')
    : new Date(eventDateStr).toLocaleDateString('he-IL');
  return `שלום ${clientName}, מתענינים בתאריך שלך (${dateDisplay}) בגן האירועים מייפל. נשמח לשמוע ממך בהקדם.`;
}
