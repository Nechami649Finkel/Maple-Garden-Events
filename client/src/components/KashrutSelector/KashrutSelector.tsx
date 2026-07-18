import { useState } from 'react';
import { useKashrutQuery } from '../../hooks/queries';
import './KashrutSelector.css';

export const DEFAULT_EVENT_KASHRUT = 'הרב מחפוד';

/** אפשרויות כשרות לטופס הפקה — עם תארים מלאים + בד"ץ כפי שהיה */
export const EVENT_KASHRUT_OPTIONS = [
  'הרב מחפוד',
  'הרב רובין',
  'הרב גרוס',
  'הרב לנדא',
  'בדץ קהילות',
  'בד"ץ העדה החרדית',
] as const;

/** מיפוי ערכים ישנים מהמערכת → תווית מעודכנת */
const LEGACY_KASHRUT_MAP: Record<string, string> = {
  מחפוד: 'הרב מחפוד',
  רובין: 'הרב רובין',
  לנדא: 'הרב לנדא',
  'בדץ ע"ח': 'בד"ץ העדה החרדית',
  'בדץ העדה החרדית': 'בד"ץ העדה החרדית',
};

export function normalizeKashrutValue(value?: string | null): string {
  const trimmed = (value || '').trim();
  if (!trimmed) return DEFAULT_EVENT_KASHRUT;
  return LEGACY_KASHRUT_MAP[trimmed] || trimmed;
}

interface Props {
  value?: string;
  onChange: (val: string) => void;
  id?: string;
  className?: string;
  'aria-label'?: string;
}

export default function KashrutSelector({
  value,
  onChange,
  id = 'event-kashrut',
  className = 'form-select',
  'aria-label': ariaLabel = 'בחירת סוג כשרות',
}: Props) {
  const { data: kashruts = [] } = useKashrutQuery();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);

  const selected = normalizeKashrutValue(value);
  const certImage = kashruts.length > 0 ? kashruts[0].imageUrl ?? null : null;
  const imageError = certImage != null && failedImageUrl === certImage;

  return (
    <div className="kashrut-selector">
      <div className="kashrut-selector__field">
        <select
          id={id}
          className={className}
          value={selected}
          aria-label={ariaLabel}
          onChange={(e) => onChange(e.target.value)}
        >
          {EVENT_KASHRUT_OPTIONS.map((kName) => (
            <option key={kName} value={kName}>
              {kName}
            </option>
          ))}
        </select>
      </div>

      {certImage && !imageError ? (
        <button
          type="button"
          className="kashrut-selector__thumb"
          onClick={() => setIsModalOpen(true)}
          title="לחץ להגדלת תעודת הכשר"
          aria-label="הגדלת תעודת כשרות"
        >
          <img
            src={certImage}
            alt="תעודת הכשר"
            onError={() => certImage && setFailedImageUrl(certImage)}
          />
        </button>
      ) : (
        <div className="kashrut-selector__thumb-empty" aria-hidden="true">
          —
        </div>
      )}

      {isModalOpen && certImage && (
        <div
          className="kashrut-selector__modal"
          onClick={() => setIsModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="תעודת כשרות מוגדלת"
        >
          <div onClick={(e) => e.stopPropagation()} className="kashrut-selector__modal-content">
            <img src={certImage} alt="תעודת הכשר מוגדלת" />
            <button type="button" onClick={() => setIsModalOpen(false)}>
              סגור
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
