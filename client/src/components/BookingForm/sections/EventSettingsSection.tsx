import React from 'react';
import { SLOT_LABELS, SLOT_HOURS, sortSlotsForDisplay } from '../../../utils/timeSlot';
import { KOSHER_PRICING, SERVING_STYLES, DEFAULT_SERVING_STYLE } from '../BookingForm';

// פונקציות עזר קטנות לתצוגת התאריך
const HEBREW_NUMERALS: Record<number, string> = {
  1:'א',2:'ב',3:'ג',4:'ד',5:'ה',6:'ו',7:'ז',8:'ח',9:'ט',10:'י',
  11:'יא',12:'יב',13:'יג',14:'יד',15:'טו',16:'טז',17:'יז',18:'יח',19:'יט',20:'כ',
  21:'כא',22:'כב',23:'כג',24:'כד',25:'כה',26:'כו',27:'כז',28:'כח',29:'כט',30:'ל'
};

const getHebrewDateString = (dateObj: Date | null) => {
  if (!dateObj) return '';
  try {
    const formatter = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric', month: 'long' });
    const fullString = formatter.format(dateObj);
    const parts = formatter.formatToParts(dateObj);
    const dayPart = parts.find(p => p.type === 'day')?.value;
    if (dayPart) {
      const hebLetter = HEBREW_NUMERALS[parseInt(dayPart, 10)];
      if (hebLetter) return fullString.replace(dayPart, hebLetter);
    }
    return fullString;
  } catch (e) {
    return '';
  }
};

const getDayOfWeek = (dateString: string) => {
  if (!dateString) return '';
  const days = ['א\'', 'ב\'', 'ג\'', 'ד\'', 'ה\'', 'ו\'', 'שבת'];
  const date = new Date(dateString);
  return `יום ${days[date.getDay()]}`;
};

const EventSettingsSection = ({ formData, handleChange, isOption, availableSlots, takenSlots, isEditMode, servingStyle, setServingStyle, kosherType, setKosherType, isFoodRelevant, selectedDatesDisplay, setIsMenuViewOpen, styles }: any) => {
  
  const dateStr = selectedDatesDisplay.map((d: any) => typeof d === 'object' ? d.date : d).join(', ');
  const hebrewDateDisplay = selectedDatesDisplay.map((d: any) => {
    if (typeof d === 'object' && d.hebrewDate) {
      return `${d.hebrewDate} (${getDayOfWeek(d.date)})`;
    } else if (typeof d === 'string') {
      const hebDate = getHebrewDateString(new Date(d));
      return `${hebDate} (${getDayOfWeek(d)})`;
    }
    return '';
  }).filter(Boolean).join(' | ');

  return (
    <div className={styles.sectionCard}>
      <h3 className={styles.sectionHeader}>הגדרות אירוע, זמנים ותפריט</h3>
      <div className={styles.eventDetailsGrid}>
        {!isOption && (
          <>
            <div className={styles.inputGroup}>
              <label>תאריך אירוע סופי (לועזי)</label>
              <input type="text" name="calendarDateId" value={dateStr} readOnly className={`${styles.input} ${styles.inputReadonly}`} />
            </div>

            <div className={styles.inputGroup}>
              <label>תאריך אירוע סופי (עברי)</label>
              <input type="text" value={hebrewDateDisplay} readOnly className={`${styles.input} ${styles.dateReadonly}`} />
            </div>
          </>
        )}

        <div className={styles.inputGroup}>
          <label>זמן ביום{isOption ? ' (אופציונלי)' : ''}</label>
          <select name="timeOfDay" required={!isOption} value={formData.timeOfDay} onChange={handleChange} className={styles.input}>
            {isOption && <option value="">לא נבחר</option>}
            {sortSlotsForDisplay(availableSlots).map((slot: any) => (
              <option key={slot} value={slot}>
                {SLOT_LABELS[slot as keyof typeof SLOT_LABELS]} ({SLOT_HOURS[slot as keyof typeof SLOT_HOURS].start} - {SLOT_HOURS[slot as keyof typeof SLOT_HOURS].end})
              </option>
            ))}
          </select>
          {!isEditMode && takenSlots.length > 0 && availableSlots.length > 0 && (
            <span className={styles.slotHint}>
              פנוי: {availableSlots.map((s: any) => SLOT_LABELS[s as keyof typeof SLOT_LABELS]).join(', ')}
            </span>
          )}
        </div>

        <div className={`${styles.inputGroup} ${styles.splitRow}`}>
          <div className={styles.inputGroup}>
            <label>משעה מדוייקת</label>
            <input type="time" name="startTime" value={formData.startTime} onChange={handleChange} className={styles.input} />
          </div>
          <div className={styles.inputGroup}>
            <label>עד שעה מדוייקת</label>
            <input type="time" name="endTime" value={formData.endTime} onChange={handleChange} className={styles.input} />
          </div>
        </div>
        <p className={styles.timeNote}> לאחר סיום שעות האירוע המוגדרות תיתכן תוספת תשלום על כל שעה נוספת.</p>

        {/* השינוי כאן: מסתירים את צורת ההגשה אם נבחר "השכרת אולם בלי אוכל" */}
        {formData.eventType !== 'השכרת אולם בלי אוכל' && (
          <div className={styles.inputGroup}>
            <label>צורת הגשה (תפריט)</label>
            <select value={servingStyle || DEFAULT_SERVING_STYLE} onChange={(e) => setServingStyle(e.target.value)} className={styles.input}>
              {Object.entries(SERVING_STYLES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        )}

        {isFoodRelevant && (
          <>
            <div className={styles.splitRow}>
              <div className={styles.inputGroup}>
                <label>כמות מנות (בפועל){isOption ? ' (אופציונלי)' : ''}</label>
                <input type="number" name="guestCount" required={!isOption} value={formData.guestCount} onChange={handleChange} className={styles.input} />
              </div>
              <div className={styles.inputGroup}>
                <label>מנות אופציה (רזרבה)</label>
                <input type="number" name="optionalGuestCount" min="0" value={formData.optionalGuestCount} onChange={handleChange} className={styles.input} />
                <span className={styles.slotHint}>מתמלא אוטומטית 10% מכמות המנות · ללא חיוב</span>
              </div>
            </div>
            
            <div className={styles.inputGroup}>
              <label>מחיר מנה בסיסי (₪){isOption ? ' (אופציונלי)' : ' *'}</label>
              <input type="number" name="finalPricePortion" value={formData.finalPricePortion} required={!isOption} onChange={handleChange} className={styles.input} />
            </div>

            <div className={styles.inputGroup}>
              <label>סוג כשרות</label>
              <select value={kosherType} onChange={(e) => setKosherType(e.target.value)} className={styles.input}>
                {Object.keys(KOSHER_PRICING).map((key) => (
                  <option key={key} value={key}>
                    {KOSHER_PRICING[key].label} {KOSHER_PRICING[key].extra > 0 ? `(+${KOSHER_PRICING[key].extra} ₪ למנה)` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.inputGroup}>
              <label>צפייה בתפריט הקיים</label>
              <div
                onClick={() => setIsMenuViewOpen(true)}
                onKeyDown={(e) => e.key === 'Enter' && setIsMenuViewOpen(true)}
                className={styles.menuLinkBtn}
                role="button"
                tabIndex={0}
              >
                📄 פתיחה וצפייה בתפריט
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EventSettingsSection;