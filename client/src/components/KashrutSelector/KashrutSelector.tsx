import { useState } from 'react';
import { useKashrutQuery } from '../../hooks/queries';
import { useTranslation } from '../../i18n/useTranslation';
import { translateByValue, KASHRUT_KEY_BY_VALUE } from '@shared/i18n/bookingLookups';
import {
  EVENT_KASHRUT_OPTIONS,
  normalizeKashrutValue,
} from './kashrutOptions';
import './KashrutSelector.css';

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
  const { t, T } = useTranslation();
  const { data: kashruts = [] } = useKashrutQuery();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);

  const selected = normalizeKashrutValue(value);
  const certImage = kashruts.length > 0 ? kashruts[0].imageUrl ?? null : null;
  const imageError = certImage != null && failedImageUrl === certImage;
  const formatKashrut = (kName: string) => translateByValue(t, KASHRUT_KEY_BY_VALUE, kName);

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
              {formatKashrut(kName)}
            </option>
          ))}
        </select>
      </div>

      {certImage && !imageError ? (
        <button
          type="button"
          className="kashrut-selector__thumb"
          onClick={() => setIsModalOpen(true)}
          title={t(T.EVENT_FORM.ENLARGE_CERT)}
          aria-label={t(T.EVENT_FORM.ENLARGE_CERT)}
        >
          <img
            src={certImage}
            alt={t(T.EVENT_FORM.KASHRUT_ALT)}
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
          aria-label={t(T.EVENT_FORM.ENLARGED_CERT_ALT)}
        >
          <div onClick={(e) => e.stopPropagation()} className="kashrut-selector__modal-content">
            <img src={certImage} alt={t(T.EVENT_FORM.ENLARGED_CERT_ALT)} />
            <button type="button" onClick={() => setIsModalOpen(false)}>
              {t(T.UI.CLOSE)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
