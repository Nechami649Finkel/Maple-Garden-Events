import { SLOT_HOURS, sortSlotsForDisplay, type TimeSlot } from '../../../utils/timeSlot';
import { type OptionDateItem } from '../../../utils/optionDateApi';
import { DEFAULT_SERVING_STYLE } from '../bookingFormConstants';
import type { BookingFormChangeHandler, BookingFormData } from '../bookingFormTypes';
import { useTranslation } from '../../../i18n/useTranslation';
import { formatDate, formatNumber } from '@shared/i18n/formatters';
import {
  HALL_ONLY_EVENT_TYPE,
  KOSHER_TYPE_KEYS,
  KOSHER_TYPE_EXTRAS,
  SERVING_STYLE_KEYS,
  TIME_SLOT_KEYS,
} from '@shared/i18n/bookingLookups';

interface EventSettingsSectionProps {
  formData: BookingFormData;
  handleChange: BookingFormChangeHandler;
  isOption: boolean;
  availableSlots: TimeSlot[];
  takenSlots: TimeSlot[];
  isEditMode: boolean;
  servingStyle: string;
  setServingStyle: (style: string) => void;
  kosherType: string;
  setKosherType: (type: string) => void;
  isFoodRelevant: boolean;
  selectedDatesDisplay: OptionDateItem[];
  setIsMenuViewOpen: (open: boolean) => void;
}

const EventSettingsSection = ({
  formData, handleChange, isOption, availableSlots, takenSlots, isEditMode,
  servingStyle, setServingStyle, kosherType, setKosherType, isFoodRelevant,
  selectedDatesDisplay, setIsMenuViewOpen,
}: EventSettingsSectionProps) => {
  const { t, T, locale } = useTranslation();

  const formatWeekdayLabel = (dateString: string) => {
    if (!dateString) return '';
    const formatted = formatDate(dateString + 'T12:00:00', locale, { weekday: 'long' });
    return locale === 'he' ? formatted : `${t(T.BOOKING.OPTION_DATES.DAY_PREFIX)}${formatted}`;
  };

  const getHebrewDateString = (dateObj: Date | null) => {
    if (!dateObj) return '';
    try {
      return formatDate(dateObj, locale, { calendar: 'hebrew', day: 'numeric', month: 'long' });
    } catch {
      return '';
    }
  };

  const slotLabel = (slot: TimeSlot) => t(TIME_SLOT_KEYS[slot]);

  const dateStr = selectedDatesDisplay.map((d) => d.date).join(', ');
  const hebrewDateDisplay = selectedDatesDisplay.map((d) => {
    if (d.hebrewDate) {
      return `${d.hebrewDate} (${formatWeekdayLabel(d.date)})`;
    }
    const hebDate = getHebrewDateString(new Date(d.date));
    return `${hebDate} (${formatWeekdayLabel(d.date)})`;
  }).filter(Boolean).join(' | ');

  return (
    <div className="card mb-3">
      <div className="card-header maple-section-header">{t(T.BOOKING.EVENT.SECTION_TITLE)}</div>
      <div className="card-body">
        <div className="row g-3">
          {!isOption && (
            <>
              <div className="col-md-6">
                <label className="form-label">{t(T.BOOKING.EVENT.FINAL_DATE_GREGORIAN)}</label>
                <input
                  type="text"
                  name="calendarDateId"
                  value={dateStr}
                  readOnly
                  dir="ltr"
                  className="form-control bg-light"
                  style={{ unicodeBidi: 'isolate', textAlign: 'left' }}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">{t(T.BOOKING.EVENT.FINAL_DATE_HEBREW)}</label>
                <input type="text" value={hebrewDateDisplay} readOnly className="form-control bg-light" />
              </div>
            </>
          )}

          <div className="col-md-6">
            <label className="form-label">
              {isOption ? t(T.BOOKING.EVENT.TIME_OF_DAY_OPTIONAL) : t(T.BOOKING.EVENT.TIME_OF_DAY)}
            </label>
            <select name="timeOfDay" required={!isOption} value={formData.timeOfDay} onChange={handleChange} className="form-select">
              {isOption && <option value="">{t(T.BOOKING.EVENT.TIME_NOT_SELECTED)}</option>}
              {sortSlotsForDisplay(availableSlots).map((slot: TimeSlot) => (
                <option key={slot} value={slot}>
                  {slotLabel(slot)} ({SLOT_HOURS[slot].start} - {SLOT_HOURS[slot].end})
                </option>
              ))}
            </select>
            {!isEditMode && takenSlots.length > 0 && availableSlots.length > 0 && (
              <div className="form-text maple-hint">
                {t(T.BOOKING.EVENT.AVAILABLE_SLOTS, {
                  slots: availableSlots.map((s: TimeSlot) => slotLabel(s)).join(', '),
                })}
              </div>
            )}
          </div>

          <div className="col-md-3">
            <label className="form-label">{t(T.BOOKING.EVENT.START_TIME)}</label>
            <input type="time" name="startTime" value={formData.startTime} onChange={handleChange} className="form-control" />
          </div>
          <div className="col-md-3">
            <label className="form-label">{t(T.BOOKING.EVENT.END_TIME)}</label>
            <input type="time" name="endTime" value={formData.endTime} onChange={handleChange} className="form-control" />
          </div>
          <div className="col-12">
            <p className="maple-time-note">{t(T.BOOKING.EVENT.OVERTIME_NOTE)}</p>
          </div>

          {formData.eventType !== HALL_ONLY_EVENT_TYPE && (
            <div className="col-md-6">
              <label className="form-label">{t(T.BOOKING.EVENT.SERVING_STYLE)}</label>
              <select value={servingStyle || DEFAULT_SERVING_STYLE} onChange={(e) => setServingStyle(e.target.value)} className="form-select">
                {Object.entries(SERVING_STYLE_KEYS).map(([value, key]) => (
                  <option key={value} value={value}>{t(key)}</option>
                ))}
              </select>
            </div>
          )}

          {isFoodRelevant && (
            <>
              <div className="col-md-4">
                <label className="form-label">
                  {isOption ? t(T.BOOKING.EVENT.GUEST_COUNT_OPTIONAL) : t(T.BOOKING.EVENT.GUEST_COUNT)}
                </label>
                <input type="number" name="guestCount" required={!isOption} value={formData.guestCount} onChange={handleChange} className="form-control" />
              </div>
              <div className="col-md-4">
                <label className="form-label">{t(T.BOOKING.EVENT.MINIMUM_GUEST_COUNT)}</label>
                <input type="number" name="minimumGuestCount" min="0" value={formData.minimumGuestCount} readOnly className="form-control bg-light" />
                <div className="form-text maple-hint">{t(T.BOOKING.EVENT.MINIMUM_AUTO_HINT)}</div>
                {Number(formData.minimumGuestCount || formData.guestCount) > 0 &&
                  Number(formData.minimumGuestCount || formData.guestCount) < 300 && (
                  <div className="form-text text-warning fw-semibold" role="status">
                    {t(T.BOOKING.EVENT.MANAGER_APPROVAL_REQUIRED)}
                  </div>
                )}
              </div>
              <div className="col-md-4">
                <label className="form-label">{t(T.BOOKING.EVENT.OPTIONAL_GUEST_COUNT)}</label>
                <input type="number" name="optionalGuestCount" min="0" value={formData.optionalGuestCount} onChange={handleChange} className="form-control" />
                <div className="form-text maple-hint">{t(T.BOOKING.EVENT.OPTIONAL_GUEST_HINT)}</div>
              </div>

              <div className="col-md-6">
                <label className="form-label">
                  {isOption ? t(T.BOOKING.EVENT.PORTION_PRICE_OPTIONAL) : t(T.BOOKING.EVENT.PORTION_PRICE_REQUIRED)}
                </label>
                <input type="number" name="finalPricePortion" value={formData.finalPricePortion} required={!isOption} onChange={handleChange} className="form-control" />
              </div>

              <div className="col-md-6">
                <label className="form-label">{t(T.BOOKING.EVENT.KOSHER_TYPE)}</label>
                <select value={kosherType} onChange={(e) => setKosherType(e.target.value)} className="form-select">
                  {(Object.keys(KOSHER_TYPE_KEYS) as Array<keyof typeof KOSHER_TYPE_KEYS>).map((key) => {
                    const extra = KOSHER_TYPE_EXTRAS[key];
                    return (
                      <option key={key} value={key}>
                        {t(KOSHER_TYPE_KEYS[key])}
                        {extra > 0 ? ` ${t(T.BOOKING.EVENT.KOSHER_EXTRA, { extra: formatNumber(extra, locale) })}` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="col-12">
                <label className="form-label">{t(T.BOOKING.EVENT.VIEW_MENU)}</label>
                <div
                  onClick={() => setIsMenuViewOpen(true)}
                  onKeyDown={(e) => e.key === 'Enter' && setIsMenuViewOpen(true)}
                  className="maple-menu-link-btn"
                  role="button"
                  tabIndex={0}
                >
                  {t(T.BOOKING.EVENT.OPEN_MENU)}
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
