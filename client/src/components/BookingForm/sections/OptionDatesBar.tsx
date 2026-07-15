import { useCallback, useEffect, useState } from 'react';
import styles from '../BookingForm.module.css';
import { type TimeSlot, SLOT_LABELS, normalizeTimeSlot } from '../../../utils/timeSlot';
import { validateOptionDateSelection } from '../../../utils/optionDateValidation';
import {
  type CalendarDayApi,
  type OptionDateItem,
  fetchCalendarDays,
  normalizeOptionDate,
  resolveOptionDate,
} from '../../../utils/optionDateApi';
import { REALTIME_DATE_UPDATED_EVENT } from '../../../services/realtimeSync';

const MAX_OPTION_DATES = 3;
const MONTH_NAMES = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const COL_HEADERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

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

function getDayOfWeek(dateStr: string): string {
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  return days[new Date(dateStr + 'T12:00:00').getDay()];
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
  const [current, setCurrent] = useState(() => new Date());
  const [days, setDays] = useState<CalendarDayApi[]>([]);
  const [fetchedKey, setFetchedKey] = useState<string | null>(null);
  const [manualDate, setManualDate] = useState('');
  const [manualError, setManualError] = useState('');
  const [manualAdding, setManualAdding] = useState(false);
  const [selectingDate, setSelectingDate] = useState<string | null>(null);
  const [pickerError, setPickerError] = useState('');

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
    const validationError = timeSlot
      ? validateOptionDateSelection(date, srv, timeSlot, excludeDates)
      : 'יש לבחור זמן ביום לפני בחירת תאריך.';
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
    const result = await resolveOptionDate(manualDate, eventType, excludeDates, timeSlot);
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
    const result = await resolveOptionDate(cell.date, eventType, excludeDates, timeSlot);
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
          <h4>בחירת תאריך לאופציה</h4>
          <button type="button" className={styles.optionPickerClose} onClick={onClose}>✕</button>
        </div>

        <div className={styles.optionPickerManual}>
          <label className={styles.optionPickerManualLabel}>הזנה ידנית</label>
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
              {manualAdding ? 'בודק...' : 'הוסף'}
            </button>
          </div>
          {manualError && <p className={styles.optionManualError}>{manualError}</p>}
        </div>

        <p className={styles.optionPickerOr}>או בחרי מהלוח</p>

        <div className={styles.optionPickerNav}>
          <button type="button" onClick={() => setCurrent(new Date(year, month + 1, 1))}>‹</button>
          <span>{MONTH_NAMES[month]} {year}</span>
          <button type="button" onClick={() => setCurrent(new Date(year, month - 1, 1))}>›</button>
        </div>
        {loading ? (
          <p className={styles.optionPickerLoading}>טוען...</p>
        ) : (
          <>
            {pickerError && <p className={styles.optionManualError}>{pickerError}</p>}
            <div className={styles.optionPickerWeekdays}>
              {COL_HEADERS.map(d => <span key={d}>{d}</span>)}
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
  const resolvedSlot = normalizeTimeSlot(timeSlotProp as string);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [manualDate, setManualDate] = useState('');
  const [manualError, setManualError] = useState('');
  const [manualAdding, setManualAdding] = useState(false);
  const normalized = selectedDates.map(normalizeOptionDate);
  const canAdd = normalized.length < MAX_OPTION_DATES && !!resolvedSlot;
  const todayStr = formatDateLocal(new Date());
  const slotLabel = resolvedSlot ? SLOT_LABELS[resolvedSlot] : '';

  const removeDate = (date: string) => {
    if (normalized.length <= 1) {
      alert('חייב להישאר לפחות תאריך אחד באופציה.');
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
      resolvedSlot
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
          <strong>תאריכי האופציה ({normalized.length}/{MAX_OPTION_DATES})</strong>
          <span className={styles.optionDatesBarHint}>
            {resolvedSlot
              ? `ניתן לשמור עד 3 תאריכים · משבצת ${slotLabel}`
              : 'יש לבחור זמן ביום (בוקר / צהריים / ערב) לפני הוספת תאריכים'}
          </span>
        </div>

        <div className={styles.optionDatesChips}>
          {normalized.map((d, i) => (
            <div key={d.date} className={styles.optionDateChip}>
              <span className={styles.optionDateChipMain}>
                <span className={styles.optionDateChipIndex}>תאריך {i + 1}</span>
                <span className={styles.optionDateChipGreg}>{formatDisplay(d.date)}</span>
                <span className={styles.optionDateChipDow}>יום {getDayOfWeek(d.date)}</span>
                {d.hebrewDate && <span className={styles.optionDateChipHeb}>{d.hebrewDate}</span>}
              </span>
              {normalized.length > 1 && (
                <button type="button" className={styles.optionDateChipRemove} onClick={() => removeDate(d.date)} aria-label="הסר תאריך">
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
                + בחירה מלוח שנה
              </button>
              <span className={styles.optionDatesOr}>או</span>
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
                {manualAdding ? 'בודק...' : 'הוסף ידנית'}
              </button>
            </div>
            {manualError && <p className={styles.optionManualError}>{manualError}</p>}
          </div>
        ) : normalized.length >= MAX_OPTION_DATES ? (
          <p className={styles.optionDatesMaxMsg}>נבחרו 3 תאריכים — מקסימום לאופציה.</p>
        ) : (
          <p className={styles.optionDatesMaxMsg}>בחרי משבצת זמן ביום לפני הוספת תאריך.</p>
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
