import { calendarKeyFromDbDate } from '../../../utils/dateLocal';
import { useTranslation } from '../../../i18n/useTranslation';
import { formatDate } from '@shared/i18n/formatters';

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

const FinalizeOptionDatesBar = ({ relatedOptions, selectedBookingId, onSelect }: FinalizeOptionDatesBarProps) => {
  const { t, T, locale } = useTranslation();

  if (relatedOptions.length <= 1) return null;

  const getHebrewDateLabel = (dateStr: string): string => {
    try {
      return formatDate(dateStr + 'T12:00:00', locale, { calendar: 'hebrew', day: 'numeric', month: 'long' });
    } catch {
      return '';
    }
  };

  return (
    <div className="alert alert-info mb-3">
      <div className="mb-2">
        <strong>{t(T.BOOKING.FINALIZE.TITLE)}</strong>
        <div className="small text-muted">
          {t(T.BOOKING.FINALIZE.DESCRIPTION, { dateCount: relatedOptions.length })}
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
