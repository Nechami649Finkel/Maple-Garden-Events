import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from '../BookingForm.module.css';
import { type TimeSlot, normalizeTimeSlot } from '../../../utils/timeSlot';
import { validateOptionDateSelection, formatValidationError } from '../../../utils/optionDateValidation';
import {
  type CalendarDayApi,
  type OptionDateItem,
  fetchCalendarDays,
  normalizeOptionDate,
  resolveOptionDate,
} from '../../../utils/optionDateApi';
import { REALTIME_DATE_UPDATED_EVENT } from '../../../services/realtimeSync';
import { useTranslation } from '../../../i18n/useTranslation';
import { formatDate } from '@shared/i18n/formatters';
import { TIME_SLOT_KEYS } from '@shared/i18n/bookingLookups';

const MAX_OPTION_DATES = 3;

function formatDateLocal(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

interface OptionDatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: OptionDateItem) => void;
  excludeDates: string[];
  eventType: string;
  timeSlot?: TimeSlot;
}

export const OptionDatePickerModal = ({
  isOpen,
  onClose,
  onSelect,
  excludeDates,
  eventType,
  timeSlot,
}: OptionDatePickerModalProps) => {
  const { t, T } = useTranslation();
  const [current, setCurrent] = useState(() => new Date());
  const [days, setDays] = useState<CalendarDayApi[]>([]);
  const [fetchedKey, setFetchedKey] = useState<string | null>(null);
  const [manualDate, setManualDate] = useState('');
  const [manualError, setManualError] = useState('');
  const [manualAdding, setManualAdding] = useState(false);
  const [selectingDate, setSelectingDate] = useState<string | null>(null);
  const [pickerError, setPickerError] = useState('');

  const monthKeys = useMemo(() => [
    T.BOOKING.OPTION_DATES.MONTH_JAN,
    T.BOOKING.OPTION_DATES.MONTH_FEB,
    T.BOOKING.OPTION_DATES.MONTH_MAR,
    T.BOOKING.OPTION_DATES.MONTH_APR,
    T.BOOKING.OPTION_DATES.MONTH_MAY,
    T.BOOKING.OPTION_DATES.MONTH_JUN,
    T.BOOKING.OPTION_DATES.MONTH_JUL,
    T.BOOKING.OPTION_DATES.MONTH_AUG,
    T.BOOKING.OPTION_DATES.MONTH_SEP,
    T.BOOKING.OPTION_DATES.MONTH_OCT,
    T.BOOKING.OPTION_DATES.MONTH_NOV,
    T.BOOKING.OPTION_DATES.MONTH_DEC,
  ], [T]);

  const weekdayKeys = useMemo(() => [
    T.BOOKING.OPTION_DATES.WEEKDAY_SUN,
    T.BOOKING.OPTION_DATES.WEEKDAY_MON,
    T.BOOKING.OPTION_DATES.WEEKDAY_TUE,
    T.BOOKING.OPTION_DATES.WEEKDAY_WED,
    T.BOOKING.OPTION_DATES.WEEKDAY_THU,
    T.BOOKING.OPTION_DATES.WEEKDAY_FRI,
    T.BOOKING.OPTION_DATES.WEEKDAY_SAT,
  ], [T]);

  const todayStr = formatDateLocal(new Date());
  const year = current.getFullYear();
  const month = current.getMonth();
  const monthKey = `${year}-${month}-${eventType}`;
  const loading = isOpen && fetchedKey !== monthKey;

  const reloadMonth = useCallback(async () => {
    const y = current.getFullYear();
    const m = current.getMonth();
    const key = `${y}-${m}-${eventType}`;
    const start = formatDateLocal(new Date(y, m, 1));
    const end = formatDateLocal(new Date(y, m + 1, 0));
    try {
      const data = await fetchCalendarDays(start, end, eventType);
      setDays(data);
      setFetchedKey(key);
    } catch {
      setDays([]);
      setFetchedKey(key);
    }
  }, [current, eventType]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const key = monthKey;
    const start = formatDateLocal(new Date(year, month, 1));
    const end = formatDateLocal(new Date(year, month + 1, 0));
    (async () => {
      try {
        const data = await fetchCalendarDays(start, end, eventType);
        if (!cancelled) {
          setDays(data);
          setFetchedKey(key);
        }
      } catch {
        if (!cancelled) {
          setDays([]);
          setFetchedKey(key);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, monthKey, year, month, eventType]);

  useEffect(() => {
    if (!isOpen) return;
    const refresh = () => { void reloadMonth(); };
    window.addEventListener(REALTIME_DATE_UPDATED_EVENT, refresh);
    return () => { window.removeEventListener(REALTIME_DATE_UPDATED_EVENT, refresh); };
  }, [isOpen, reloadMonth]);

  if (!isOpen) return null;

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const serverMap = new Map(days.map((d) => [d.date, d]));

  const cells: (null | { date: string; hebrewDate: string; disabled: boolean; reason?: string })[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const date = formatDateLocal(new Date(year, month, day));
    const srv = serverMap.get(date);
    const validationResult = timeSlot
      ? validateOptionDateSelection(date, srv, timeSlot, excludeDates)
      : null;
    const validationError = validationResult
      ? formatValidationError(t, validationResult)
      : t(T.BOOKING.OPTION_DATES.SELECT_SLOT_BEFORE_DATE);
    const disabled = !!validationError;
    cells.push({
      date,
      hebrewDate: srv?.hebrewDate ?? '',
      disabled,
      reason: validationError || undefined,
    });
  }

  const handleManualAdd = async () => {
    setManualError('');
    setManualAdding(true);
    const result = await resolveOptionDate(manualDate, eventType, excludeDates, timeSlot, t);
    setManualAdding(false);
    if (!result.ok) {
      setManualError(result.error);
      void reloadMonth();
      return;
    }
    onSelect(result.item);
    onClose();
  };

  const handleCalendarSelect = async (cell: { date: string; hebrewDate: string }) => {
    if (selectingDate) return;
    setPickerError('');
    setSelectingDate(cell.date);
    const result = await resolveOptionDate(cell.date, eventType, excludeDates, timeSlot, t);
    setSelectingDate(null);
    if (!result.ok) {
      setPickerError(result.error);
      void reloadMonth();
      return;
    }
    onSelect(result.item);
    onClose();
  };

  return (
    <div className={styles.optionPickerOverlay} onClick={onClose}>
      <div className={styles.optionPickerModal} onClick={e => e.stopPropagation()}>
        <div className={styles.optionPickerHeader}>
          <h4>{t(T.BOOKING.OPTION_DATES.PICKER_TITLE)}</h4>
          <button type="button" className={styles.optionPickerClose} onClick={onClose}>✕</button>
        </div>

        <div className={styles.optionPickerManual}>
          <label className={styles.optionPickerManualLabel}>{t(T.BOOKING.OPTION_DATES.MANUAL_ENTRY)}</label>
          <div className={styles.optionDatesAddRow}>
            <input
              type="date"
              className={styles.optionManualInput}
              value={manualDate}
              min={todayStr}
              onChange={e => {
                setManualDate(e.target.value);
                setManualError('');
              }}
            />
            <button
              type="button"
              className={styles.optionManualAddBtn}
              onClick={handleManualAdd}
              disabled={!manualDate || manualAdding}
            >
              {manualAdding ? t(T.BOOKING.OPTION_DATES.CHECKING) : t(T.BOOKING.OPTION_DATES.ADD)}
            </button>
          </div>
          {manualError && <p className={styles.optionManualError}>{manualError}</p>}
        </div>

        <p className={styles.optionPickerOr}>{t(T.BOOKING.OPTION_DATES.OR_FROM_CALENDAR)}</p>

        <div className={styles.optionPickerNav}>
          <button type="button" onClick={() => setCurrent(new Date(year, month + 1, 1))}>‹</button>
          <span>{t(monthKeys[month])} {year}</span>
          <button type="button" onClick={() => setCurrent(new Date(year, month - 1, 1))}>›</button>
        </div>
        {loading ? (
          <p className={styles.optionPickerLoading}>{t(T.BOOKING.OPTION_DATES.LOADING)}</p>
        ) : (
          <>
            {pickerError && <p className={styles.optionManualError}>{pickerError}</p>}
            <div className={styles.optionPickerWeekdays}>
              {weekdayKeys.map(d => <span key={d}>{t(d)}</span>)}
            </div>
            <div className={styles.optionPickerGrid}>
              {cells.map((cell, idx) =>
                cell ? (
                  <button
                    key={cell.date}
                    type="button"
                    disabled={cell.disabled || selectingDate === cell.date}
                    title={cell.reason}
                    className={`${styles.optionPickerDay} ${cell.disabled ? styles.optionPickerDayDisabled : ''}`}
                    onClick={() => handleCalendarSelect(cell)}
                  >
                    <span className={styles.optionPickerDayNum}>
                      {selectingDate === cell.date ? '…' : new Date(cell.date + 'T12:00:00').getDate()}
                    </span>
                    {cell.hebrewDate && <span className={styles.optionPickerDayHeb}>{cell.hebrewDate}</span>}
                  </button>
                ) : (
                  <span key={`empty-${idx}`} className={styles.optionPickerDayEmpty} />
                )
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

interface OptionDatesBarProps {
  selectedDates: OptionDateItem[];
  onChange: (dates: OptionDateItem[]) => void;
  eventType: string;
  timeSlot?: TimeSlot | string;
  slotWarning?: string;
}

const OptionDatesBar = ({ selectedDates, onChange, eventType, timeSlot: timeSlotProp, slotWarning }: OptionDatesBarProps) => {
  const { t, T, locale } = useTranslation();
  const resolvedSlot = normalizeTimeSlot(timeSlotProp as string);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [manualDate, setManualDate] = useState('');
  const [manualError, setManualError] = useState('');
  const [manualAdding, setManualAdding] = useState(false);
  const normalized = selectedDates.map(normalizeOptionDate);
  const canAdd = normalized.length < MAX_OPTION_DATES && !!resolvedSlot;
  const todayStr = formatDateLocal(new Date());
  const slotLabel = resolvedSlot ? t(TIME_SLOT_KEYS[resolvedSlot]) : '';

  const formatWeekdayLabel = (dateString: string) => {
    const formatted = formatDate(dateString + 'T12:00:00', locale, { weekday: 'long' });
    return locale === 'he' ? formatted : `${t(T.BOOKING.OPTION_DATES.DAY_PREFIX)}${formatted}`;
  };

  const removeDate = (date: string) => {
    if (normalized.length <= 1) {
      alert(t(T.BOOKING.OPTION_DATES.MIN_ONE_DATE));
      return;
    }
    onChange(normalized.filter(d => d.date !== date));
  };

  const addDate = (item: OptionDateItem) => {
    if (normalized.some(d => d.date === item.date)) return;
    onChange([...normalized, item]);
    setManualDate('');
    setManualError('');
  };

  const handleManualAdd = async () => {
    setManualError('');
    setManualAdding(true);
    const result = await resolveOptionDate(
      manualDate,
      eventType,
      normalized.map(d => d.date),
      resolvedSlot,
      t,
    );
    setManualAdding(false);
    if (!result.ok) {
      setManualError(result.error);
      return;
    }
    addDate(result.item);
  };

  return (
    <>
      <div className={styles.optionDatesBar}>
        <div className={styles.optionDatesBarHead}>
          <strong>
            {t(T.BOOKING.OPTION_DATES.DATE_COUNT, { dateCount: normalized.length, maxDates: MAX_OPTION_DATES })}
          </strong>
          <span className={styles.optionDatesBarHint}>
            {resolvedSlot
              ? t(T.BOOKING.OPTION_DATES.HINT_WITH_SLOT, { maxDates: MAX_OPTION_DATES, slot: slotLabel })
              : t(T.BOOKING.OPTION_DATES.HINT_SELECT_SLOT)}
          </span>
        </div>

        <div className={styles.optionDatesChips}>
          {normalized.map((d, i) => (
            <div key={d.date} className={styles.optionDateChip}>
              <span className={styles.optionDateChipMain}>
                <span className={styles.optionDateChipIndex}>
                  {t(T.BOOKING.OPTION_DATES.DATE_INDEX, { dateIndex: i + 1 })}
                </span>
                <span className={styles.optionDateChipGreg}>{formatDisplay(d.date)}</span>
                <span className={styles.optionDateChipDow}>{formatWeekdayLabel(d.date)}</span>
                {d.hebrewDate && <span className={styles.optionDateChipHeb}>{d.hebrewDate}</span>}
              </span>
              {normalized.length > 1 && (
                <button type="button" className={styles.optionDateChipRemove} onClick={() => removeDate(d.date)} aria-label={t(T.BOOKING.OPTION_DATES.REMOVE_DATE_ARIA)}>
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        {slotWarning && <p className={styles.optionManualError}>{slotWarning}</p>}

        {canAdd ? (
          <div className={styles.optionDatesAddSection}>
            <div className={styles.optionDatesAddRow}>
              <button
                type="button"
                className={styles.optionAddDateBtn}
                onClick={() => {
                  setManualDate('');
                  setManualError('');
                  setPickerOpen(true);
                }}
              >
                {t(T.BOOKING.OPTION_DATES.ADD_FROM_CALENDAR)}
              </button>
              <span className={styles.optionDatesOr}>{t(T.BOOKING.OPTION_DATES.OR)}</span>
              <input
                type="date"
                className={styles.optionManualInput}
                value={manualDate}
                min={todayStr}
                onChange={e => {
                  setManualDate(e.target.value);
                  setManualError('');
                }}
              />
              <button
                type="button"
                className={styles.optionManualAddBtn}
                onClick={handleManualAdd}
                disabled={!manualDate || manualAdding}
              >
                {manualAdding ? t(T.BOOKING.OPTION_DATES.CHECKING) : t(T.BOOKING.OPTION_DATES.ADD_MANUALLY)}
              </button>
            </div>
            {manualError && <p className={styles.optionManualError}>{manualError}</p>}
          </div>
        ) : normalized.length >= MAX_OPTION_DATES ? (
          <p className={styles.optionDatesMaxMsg}>
            {t(T.BOOKING.OPTION_DATES.MAX_DATES_REACHED, { maxDates: MAX_OPTION_DATES })}
          </p>
        ) : (
          <p className={styles.optionDatesMaxMsg}>{t(T.BOOKING.OPTION_DATES.SELECT_SLOT_FIRST)}</p>
        )}
      </div>

      <OptionDatePickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={addDate}
        excludeDates={normalized.map(d => d.date)}
        eventType={eventType}
        timeSlot={resolvedSlot ?? undefined}
      />
    </>
  );
};

export default OptionDatesBar;
