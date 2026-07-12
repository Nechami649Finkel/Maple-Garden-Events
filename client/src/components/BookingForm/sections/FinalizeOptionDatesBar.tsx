import React from 'react';
import styles from '../BookingForm.module.css';
import { calendarKeyFromDbDate } from '../../utils/dateLocal';

interface RelatedOption {
  id: string;
  calendarDateId: string;
  eventDate?: { date: string; hebrewDate?: string };
}

interface FinalizeOptionDatesBarProps {
  relatedOptions: RelatedOption[];
  selectedBookingId: string;
  onSelect: (bookingId: string) => void;
}

function formatDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function getHebrewDateLabel(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric', month: 'long' }).format(
      new Date(dateStr + 'T12:00:00')
    );
  } catch {
    return '';
  }
}

const FinalizeOptionDatesBar = ({ relatedOptions, selectedBookingId, onSelect }: FinalizeOptionDatesBarProps) => {
  if (relatedOptions.length <= 1) return null;

  return (
    <div className={styles.optionDatesBar}>
      <div className={styles.optionDatesBarHead}>
        <strong>בחירת תאריך סופי לאירוע</strong>
        <span className={styles.optionDatesBarHint}>
          באופציה נשמרו {relatedOptions.length} תאריכים — יש לבחור תאריך אחד. שאר התאריכים ישוחררו אוטומטית.
        </span>
      </div>
      <div className={styles.finalizeDateChoices}>
        {relatedOptions.map((opt) => {
          const dateStr = opt.eventDate?.date
            ? calendarKeyFromDbDate(new Date(opt.eventDate.date))
            : '';
          const hebrew = opt.eventDate?.hebrewDate || (dateStr ? getHebrewDateLabel(dateStr) : '');
          const isSelected = opt.id === selectedBookingId;

          return (
            <label
              key={opt.id}
              className={`${styles.finalizeDateChoice} ${isSelected ? styles.finalizeDateChoiceSelected : ''}`}
            >
              <input
                type="radio"
                name="finalizeOptionDate"
                value={opt.id}
                checked={isSelected}
                onChange={() => onSelect(opt.id)}
              />
              <span className={styles.finalizeDateChoiceText}>
                <strong>{formatDisplay(dateStr)}</strong>
                {hebrew && <span className={styles.optionDateChipHeb}>{hebrew}</span>}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
};

export default FinalizeOptionDatesBar;
