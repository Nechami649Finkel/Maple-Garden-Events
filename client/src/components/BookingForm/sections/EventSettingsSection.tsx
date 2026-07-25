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
import { VENUE_MINIMUM_PORTIONS } from '@shared/contract';
import styles from './EventSettingsSection.module.css';

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

  const formatGregorianDate = (isoDate: string) => {
    if (!isoDate) return '';
    const parts = isoDate.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoDate;
  };

  const dateStr = selectedDatesDisplay.map((d) => formatGregorianDate(d.date)).join(', ');
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
      <div className={`card-body ${styles.settingsBody}`}>
        <div className={styles.stack}>
          {!isOption && (
            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>{t(T.BOOKING.EVENT.FINAL_DATE_GREGORIAN)}</label>
                <div className={styles.control}>
                  <input
                    type="text"
                    name="calendarDateId"
                    value={dateStr}
                    readOnly
                    className="form-control bg-light"
                  />
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>{t(T.BOOKING.EVENT.FINAL_DATE_HEBREW)}</label>
                <div className={styles.control}>
                  <input type="text" value={hebrewDateDisplay} readOnly className="form-control bg-light" />
                </div>
              </div>
            </div>
          )}

          <div>
            <div className={styles.rowAlignEnd}>
              <div className={styles.field}>
                <label className={styles.label}>
                  {isOption ? t(T.BOOKING.EVENT.TIME_OF_DAY_OPTIONAL) : t(T.BOOKING.EVENT.TIME_OF_DAY)}
                </label>
                <div className={styles.control}>
                  <select
                    name="timeOfDay"
                    required={!isOption}
                    value={formData.timeOfDay}
                    onChange={handleChange}
                    className="form-select"
                  >
                    {isOption && <option value="">{t(T.BOOKING.EVENT.TIME_NOT_SELECTED)}</option>}
                    {sortSlotsForDisplay(availableSlots).map((slot: TimeSlot) => (
                      <option key={slot} value={slot}>
                        {slotLabel(slot)} ({SLOT_HOURS[slot].start} - {SLOT_HOURS[slot].end})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>{t(T.BOOKING.EVENT.START_TIME)}</label>
                <div className={styles.control}>
                  <input
                    type="time"
                    name="startTime"
                    value={formData.startTime}
                    onChange={handleChange}
                    className="form-control"
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>{t(T.BOOKING.EVENT.END_TIME)}</label>
                <div className={styles.control}>
                  <input
                    type="time"
                    name="endTime"
                    value={formData.endTime}
                    onChange={handleChange}
                    className="form-control"
                  />
                </div>
              </div>
            </div>
            {!isEditMode && takenSlots.length > 0 && availableSlots.length > 0 && (
              <div className={`form-text maple-hint ${styles.hint}`}>
                {t(T.BOOKING.EVENT.AVAILABLE_SLOTS, {
                  slots: availableSlots.map((s: TimeSlot) => slotLabel(s)).join(', '),
                })}
              </div>
            )}
          </div>

          <p className={`maple-time-note ${styles.note}`}>{t(T.BOOKING.EVENT.OVERTIME_NOTE)}</p>

          {formData.eventType !== HALL_ONLY_EVENT_TYPE && (
            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>{t(T.BOOKING.EVENT.SERVING_STYLE)}</label>
                <div className={styles.control}>
                  <select
                    value={servingStyle || DEFAULT_SERVING_STYLE}
                    onChange={(e) => setServingStyle(e.target.value)}
                    className="form-select"
                  >
                    {Object.entries(SERVING_STYLE_KEYS).map(([value, key]) => (
                      <option key={value} value={value}>{t(key)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {isFoodRelevant ? (
                <div className={styles.field}>
                  <label className={styles.label}>
                    {isOption ? t(T.BOOKING.EVENT.GUEST_COUNT_OPTIONAL) : t(T.BOOKING.EVENT.GUEST_COUNT)}
                  </label>
                  <div className={styles.control}>
                    <input
                      type="number"
                      name="guestCount"
                      required={!isOption}
                      value={formData.guestCount}
                      onChange={handleChange}
                      className="form-control"
                    />
                  </div>
                </div>
              ) : (
                <div className={styles.field} aria-hidden="true" />
              )}
            </div>
          )}

          {isFoodRelevant && (
            <>
              {formData.eventType === HALL_ONLY_EVENT_TYPE && (
                <div className={styles.row2}>
                  <div className={styles.field}>
                    <label className={styles.label}>
                      {isOption ? t(T.BOOKING.EVENT.GUEST_COUNT_OPTIONAL) : t(T.BOOKING.EVENT.GUEST_COUNT)}
                    </label>
                    <div className={styles.control}>
                      <input
                        type="number"
                        name="guestCount"
                        required={!isOption}
                        value={formData.guestCount}
                        onChange={handleChange}
                        className="form-control"
                      />
                    </div>
                  </div>
                  <div className={styles.field} aria-hidden="true" />
                </div>
              )}

              <div className={styles.row2}>
                <div className={styles.field}>
                  <label className={styles.label}>{t(T.BOOKING.EVENT.MINIMUM_GUEST_COUNT)}</label>
                  <div className={styles.control}>
                    <input
                      type="number"
                      name="minimumGuestCount"
                      min="0"
                      value={formData.minimumGuestCount}
                      readOnly
                      className="form-control bg-light"
                    />
                  </div>
                  {Number(formData.minimumGuestCount || formData.guestCount) > 0 &&
                    Number(formData.minimumGuestCount || formData.guestCount) < VENUE_MINIMUM_PORTIONS && (
                    <div className={`form-text text-warning fw-semibold ${styles.hint}`} role="status">
                      {t(T.BOOKING.EVENT.MANAGER_APPROVAL_REQUIRED)}
                    </div>
                  )}
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>{t(T.BOOKING.EVENT.OPTIONAL_GUEST_COUNT)}</label>
                  <div className={styles.control}>
                    <input
                      type="number"
                      name="optionalGuestCount"
                      min="0"
                      value={formData.optionalGuestCount}
                      onChange={handleChange}
                      className="form-control"
                    />
                  </div>
                  <div className={`form-text maple-hint ${styles.hint}`}>
                    {t(T.BOOKING.EVENT.OPTIONAL_GUEST_HINT)}
                  </div>
                </div>
              </div>

              <div className={styles.row2}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    {isOption ? t(T.BOOKING.EVENT.PORTION_PRICE_OPTIONAL) : t(T.BOOKING.EVENT.PORTION_PRICE_REQUIRED)}
                  </label>
                  <div className={styles.control}>
                    <input
                      type="number"
                      name="finalPricePortion"
                      value={formData.finalPricePortion}
                      required={!isOption}
                      onChange={handleChange}
                      className="form-control"
                    />
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>{t(T.BOOKING.EVENT.KOSHER_TYPE)}</label>
                  <div className={styles.control}>
                    <select
                      value={kosherType}
                      onChange={(e) => setKosherType(e.target.value)}
                      className="form-select"
                    >
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
                </div>
              </div>

              <div className={styles.full}>
                <label className={styles.label}>{t(T.BOOKING.EVENT.VIEW_MENU)}</label>
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
