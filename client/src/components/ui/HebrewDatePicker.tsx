import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { getHebrewDateLabel, getHebrewDayShort } from '../../utils/optionDateApi';
import { toCalendarDateKey } from '../../utils/dateLocal';
import styles from './HebrewDatePicker.module.css';

export interface HebrewDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
}

function padDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseValue(value: string): Date | null {
  if (!value) return null;
  try {
    const key = toCalendarDateKey(value);
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  } catch {
    return null;
  }
}

function formatDisplay(value: string, locale: string): string {
  const d = parseValue(value);
  if (!d) return '';
  const gregorian = d.toLocaleDateString(locale === 'en' ? 'en-GB' : 'he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const hebrew = getHebrewDateLabel(toCalendarDateKey(d));
  return hebrew ? `${gregorian} · ${hebrew}` : gregorian;
}

export function HebrewDatePicker({
  value,
  onChange,
  onBlur,
  disabled,
  id,
  'aria-label': ariaLabel,
}: HebrewDatePickerProps) {
  const { t, T, locale } = useTranslation();
  const autoId = useId();
  const inputId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const selected = parseValue(value);
  const today = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 12, 0, 0, 0);
  }, []);

  const [viewYear, setViewYear] = useState(() => (selected ?? today).getFullYear());
  const [viewMonth, setViewMonth] = useState(() => (selected ?? today).getMonth());

  useEffect(() => {
    if (!open || !selected) return;
    setViewYear(selected.getFullYear());
    setViewMonth(selected.getMonth());
  }, [open, selected]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        onBlur?.();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        onBlur?.();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onBlur]);

  const monthKeys = useMemo(
    () => [
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
    ],
    [T],
  );

  const weekdayKeys = useMemo(
    () => [
      T.BOOKING.OPTION_DATES.WEEKDAY_SUN,
      T.BOOKING.OPTION_DATES.WEEKDAY_MON,
      T.BOOKING.OPTION_DATES.WEEKDAY_TUE,
      T.BOOKING.OPTION_DATES.WEEKDAY_WED,
      T.BOOKING.OPTION_DATES.WEEKDAY_THU,
      T.BOOKING.OPTION_DATES.WEEKDAY_FRI,
      T.BOOKING.OPTION_DATES.WEEKDAY_SAT,
    ],
    [T],
  );

  const cells = useMemo(() => {
    const startOffset = new Date(viewYear, viewMonth, 1).getDay();
    const list: { dateStr: string; day: number; inMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(viewYear, viewMonth, 1 - startOffset + i);
      list.push({
        dateStr: padDate(d.getFullYear(), d.getMonth(), d.getDate()),
        day: d.getDate(),
        inMonth: d.getMonth() === viewMonth,
      });
    }
    return list;
  }, [viewYear, viewMonth]);

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const selectDate = (dateStr: string) => {
    onChange(dateStr);
    setOpen(false);
    onBlur?.();
  };

  const todayStr = padDate(today.getFullYear(), today.getMonth(), today.getDate());
  const selectedStr = selected ? toCalendarDateKey(selected) : '';

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        id={inputId}
        className={styles.trigger}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => !disabled && setOpen((v) => !v)}
      >
        <span className={value ? styles.triggerValue : styles.triggerPlaceholder}>
          {value ? formatDisplay(value, locale) : '—'}
        </span>
        <svg className={styles.triggerIcon} viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M7 2v2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7zm12 8H5v8h14v-8z"
          />
        </svg>
      </button>

      {open && (
        <div className={styles.popover} role="dialog" aria-modal="false">
          <div className={styles.header}>
            <button
              type="button"
              className={styles.navBtn}
              aria-label={t(T.CALENDAR.PREV_MONTH)}
              onClick={() => shiftMonth(-1)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
              </svg>
            </button>
            <p className={styles.monthLabel}>
              {t(monthKeys[viewMonth])} {viewYear}
            </p>
            <button
              type="button"
              className={styles.navBtn}
              aria-label={t(T.CALENDAR.NEXT_MONTH)}
              onClick={() => shiftMonth(1)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
              </svg>
            </button>
          </div>

          <div className={styles.weekdays} role="row">
            {weekdayKeys.map((key) => (
              <span key={key} className={styles.weekday}>
                {t(key)}
              </span>
            ))}
          </div>

          <div className={styles.grid} role="grid">
            {cells.map((cell) => {
              const isSelected = cell.dateStr === selectedStr;
              const isToday = cell.dateStr === todayStr;
              const hebrewShort = getHebrewDayShort(cell.dateStr);
              const hebrewFull = getHebrewDateLabel(cell.dateStr);
              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  role="gridcell"
                  className={[
                    styles.day,
                    cell.inMonth ? '' : styles.outMonth,
                    isSelected ? styles.selected : '',
                    isToday ? styles.today : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  title={hebrewFull}
                  aria-label={`${cell.day}${hebrewFull ? ` · ${hebrewFull}` : ''}`}
                  aria-selected={isSelected}
                  onClick={() => selectDate(cell.dateStr)}
                >
                  <span className={styles.dayGregorian}>{cell.day}</span>
                  {hebrewShort ? <span className={styles.dayHebrew}>{hebrewShort}</span> : null}
                </button>
              );
            })}
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.footerBtn} onClick={() => selectDate(todayStr)}>
              {t(T.CALENDAR.TODAY)}
            </button>
            <button
              type="button"
              className={styles.footerBtn}
              onClick={() => {
                onChange('');
                setOpen(false);
                onBlur?.();
              }}
            >
              {t(T.COMMON.ACTIONS.CLEAR)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
