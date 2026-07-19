import { useState, useEffect } from 'react';
import { useKashrutQuery } from '../../hooks/queries';
import { useTranslation } from '../../i18n/useTranslation';
import { translateByValue, KASHRUT_KEY_BY_VALUE } from '@shared/i18n/bookingLookups';
import './KashrutSelector.css';

interface Props {
  value?: string;
  onChange: (val: string) => void;
}

const KASHRUT_LIST = [
  'רובין',
  'מחפוד',
  'לנדא',
  'בדץ קהילות',
  'הרב גרוס',
  'בדץ ע"ח',
];

export default function KashrutSelector({ value, onChange }: Props) {
  const { t, T } = useTranslation();
  const { data: kashruts = [] } = useKashrutQuery();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  const certImage = kashruts.length > 0 ? kashruts[0].imageUrl ?? null : null;
  const formatKashrut = (kName: string) => translateByValue(t, KASHRUT_KEY_BY_VALUE, kName);

  useEffect(() => {
    setImageError(false);
  }, [certImage]);

  return (
    <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginTop: '10px' }}>
      <div style={{ flex: 1 }}>
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer' }}
        >
          <option value="">{t(T.EVENT_FORM.SELECT_KASHRUT)}</option>
          {KASHRUT_LIST.map((kName, idx) => (
            <option key={idx} value={kName}>{formatKashrut(kName)}</option>
          ))}
        </select>
      </div>

      {certImage && !imageError ? (
        <div
          onClick={() => setIsModalOpen(true)}
          style={{
            cursor: 'pointer', border: '2px solid #e2e8f0', borderRadius: '6px',
            overflow: 'hidden', width: '50px', height: '50px',
          }}
          title={t(T.EVENT_FORM.ENLARGE_CERT)}
        >
          <img
            src={certImage}
            alt={t(T.EVENT_FORM.KASHRUT_ALT)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => setImageError(true)}
          />
        </div>
      ) : (
        <div style={{ width: '50px', height: '50px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#999', textAlign: 'center' }}>
          {t(T.UI.NO_IMAGE)}
        </div>
      )}

      {isModalOpen && certImage && (
        <div
          onClick={() => setIsModalOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            alignItems: 'center', zIndex: 9999, padding: '20px',
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <img
              src={certImage}
              alt={t(T.EVENT_FORM.ENLARGED_CERT_ALT)}
              style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '4px', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}
            />
            <button
              onClick={() => setIsModalOpen(false)}
              style={{ display: 'block', margin: '20px auto 0', padding: '10px 30px', borderRadius: '6px', border: 'none', background: 'white', fontWeight: 'bold', cursor: 'pointer' }}
            >
              {t(T.UI.CLOSE)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
