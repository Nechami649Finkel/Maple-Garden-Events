import { calendarKeyFromDbDate } from '../../../utils/dateLocal';
import type { RelatedBookingOption } from '../bookingFormTypes';

interface FinalizeOptionDatesBarProps {
  relatedOptions: RelatedBookingOption[];
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
    <div className="alert alert-info mb-3">
      <div className="mb-2">
        <strong>בחירת תאריך סופי לאירוע</strong>
        <div className="small text-muted">
          באופציה נשמרו {relatedOptions.length} תאריכים — יש לבחור תאריך אחד. שאר התאריכים ישוחררו אוטומטית.
        </div>
      </div>
      <div className="d-flex flex-wrap gap-2">
        {relatedOptions.map((opt) => {
          const dateStr = opt.eventDate?.date
            ? calendarKeyFromDbDate(new Date(opt.eventDate.date))
            : '';
          const hebrew = opt.eventDate?.hebrewDate || (dateStr ? getHebrewDateLabel(dateStr) : '');
          const isSelected = opt.id === selectedBookingId;

          return (
            <label
              key={opt.id}
              className={`btn ${isSelected ? 'btn-primary' : 'btn-outline-primary'}`}
            >
              <input
                type="radio"
                name="finalizeOptionDate"
                value={opt.id}
                checked={isSelected}
                onChange={() => onSelect(opt.id)}
                className="d-none"
              />
              <strong>{formatDisplay(dateStr)}</strong>
              {hebrew && <span className="small d-block">{hebrew}</span>}
            </label>
          );
        })}
      </div>
    </div>
  );
};

export default FinalizeOptionDatesBar;
