import { getBrandConfig } from '../../../shared/brand/index';

export function buildDefaultOptionInterestMessage(
  clientName: string,
  eventDateStr: string,
): string {
  const dateDisplay = eventDateStr.includes('-')
    ? eventDateStr.split('-').reverse().join('/')
    : new Date(eventDateStr).toLocaleDateString('he-IL');
  const brand = getBrandConfig();
  return `שלום ${clientName}, מתענינים בתאריך שלך (${dateDisplay}) בגן האירועים ${brand.shortName}. נשמח לשמוע ממך בהקדם.`;
}
