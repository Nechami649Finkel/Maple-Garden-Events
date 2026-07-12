import { SLOT_LABELS, SLOT_HOURS, sortSlotsForDisplay } from '../../../utils/timeSlot';
import { KOSHER_PRICING, SERVING_STYLES, DEFAULT_SERVING_STYLE } from '../BookingForm';

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
  } catch {
    return '';
  }
};

const getDayOfWeek = (dateString: string) => {
  if (!dateString) return '';
  const days = ['א\'', 'ב\'', 'ג\'', 'ד\'', 'ה\'', 'ו\'', 'שבת'];
  const date = new Date(dateString);
  return `יום ${days[date.getDay()]}`;
};

const EventSettingsSection = ({
  formData, handleChange, isOption, availableSlots, takenSlots, isEditMode,
  servingStyle, setServingStyle, kosherType, setKosherType, isFoodRelevant,
  selectedDatesDisplay, setIsMenuViewOpen,
}: any) => {
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
    <div className="card mb-3">
      <div className="card-header maple-section-header">הגדרות אירוע, זמנים ותפריט</div>
      <div className="card-body">
        <div className="row g-3">
          {!isOption && (
            <>
              <div className="col-md-6">
                <label className="form-label">תאריך אירוע סופי (לועזי)</label>
                <input type="text" name="calendarDateId" value={dateStr} readOnly className="form-control bg-light" />
              </div>
              <div className="col-md-6">
                <label className="form-label">תאריך אירוע סופי (עברי)</label>
                <input type="text" value={hebrewDateDisplay} readOnly className="form-control bg-light" />
              </div>
            </>
          )}

          <div className="col-md-6">
            <label className="form-label">זמן ביום{isOption ? ' (אופציונלי)' : ''}</label>
            <select name="timeOfDay" required={!isOption} value={formData.timeOfDay} onChange={handleChange} className="form-select">
              {isOption && <option value="">לא נבחר</option>}
              {sortSlotsForDisplay(availableSlots).map((slot: any) => (
                <option key={slot} value={slot}>
                  {SLOT_LABELS[slot as keyof typeof SLOT_LABELS]} ({SLOT_HOURS[slot as keyof typeof SLOT_HOURS].start} - {SLOT_HOURS[slot as keyof typeof SLOT_HOURS].end})
                </option>
              ))}
            </select>
            {!isEditMode && takenSlots.length > 0 && availableSlots.length > 0 && (
              <div className="form-text maple-hint">
                פנוי: {availableSlots.map((s: any) => SLOT_LABELS[s as keyof typeof SLOT_LABELS]).join(', ')}
              </div>
            )}
          </div>

          <div className="col-md-3">
            <label className="form-label">משעה מדוייקת</label>
            <input type="time" name="startTime" value={formData.startTime} onChange={handleChange} className="form-control" />
          </div>
          <div className="col-md-3">
            <label className="form-label">עד שעה מדוייקת</label>
            <input type="time" name="endTime" value={formData.endTime} onChange={handleChange} className="form-control" />
          </div>
          <div className="col-12">
            <p className="maple-time-note">לאחר סיום שעות האירוע המוגדרות תיתכן תוספת תשלום על כל שעה נוספת.</p>
          </div>

          {formData.eventType !== 'השכרת אולם בלי אוכל' && (
            <div className="col-md-6">
              <label className="form-label">צורת הגשה (תפריט)</label>
              <select value={servingStyle || DEFAULT_SERVING_STYLE} onChange={(e) => setServingStyle(e.target.value)} className="form-select">
                {Object.entries(SERVING_STYLES).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          )}

          {isFoodRelevant && (
            <>
              <div className="col-md-4">
                <label className="form-label">כמות מנות (בפועל){isOption ? ' (אופציונלי)' : ''}</label>
                <input type="number" name="guestCount" required={!isOption} value={formData.guestCount} onChange={handleChange} className="form-control" />
              </div>
              <div className="col-md-4">
                <label className="form-label">מינימום מנות</label>
                <input type="number" name="minimumGuestCount" min="0" value={formData.minimumGuestCount} readOnly className="form-control bg-light" />
                <div className="form-text maple-hint">מתמלא אוטומטית לפי כמות המנות</div>
              </div>
              <div className="col-md-4">
                <label className="form-label">מנות אופציה (רזרבה)</label>
                <input type="number" name="optionalGuestCount" min="0" value={formData.optionalGuestCount} onChange={handleChange} className="form-control" />
                <div className="form-text maple-hint">10% מכמות המנות · ללא חיוב</div>
              </div>

              <div className="col-md-6">
                <label className="form-label">מחיר מנה בסיסי (₪){isOption ? ' (אופציונלי)' : ' *'}</label>
                <input type="number" name="finalPricePortion" value={formData.finalPricePortion} required={!isOption} onChange={handleChange} className="form-control" />
              </div>

              <div className="col-md-6">
                <label className="form-label">סוג כשרות</label>
                <select value={kosherType} onChange={(e) => setKosherType(e.target.value)} className="form-select">
                  {Object.keys(KOSHER_PRICING).map((key) => (
                    <option key={key} value={key}>
                      {KOSHER_PRICING[key].label} {KOSHER_PRICING[key].extra > 0 ? `(+${KOSHER_PRICING[key].extra} ₪ למנה)` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-12">
                <label className="form-label">צפייה בתפריט הקיים</label>
                <div
                  onClick={() => setIsMenuViewOpen(true)}
                  onKeyDown={(e) => e.key === 'Enter' && setIsMenuViewOpen(true)}
                  className="maple-menu-link-btn"
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
    </div>
  );
};

export default EventSettingsSection;
