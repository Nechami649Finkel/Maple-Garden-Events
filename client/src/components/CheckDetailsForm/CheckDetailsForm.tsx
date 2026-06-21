import React from 'react';
import type { DepositCheckDetails } from '../../utils/checkOcr';

interface CheckDetailsFormProps {
  details: DepositCheckDetails;
  imageUrl?: string;
  scanning?: boolean;
  onChange: (details: DepositCheckDetails) => void;
  styles?: Record<string, string>;
}

const FIELDS: { key: keyof DepositCheckDetails; label: string; type?: string }[] = [
  { key: 'checkNumber', label: "מספר צ'ק" },
  { key: 'bank', label: 'בנק' },
  { key: 'bankCode', label: 'קוד בנק' },
  { key: 'branch', label: 'סניף' },
  { key: 'account', label: 'מספר חשבון' },
  { key: 'payee', label: 'לפקודת' },
  { key: 'amount', label: 'סכום (₪)', type: 'number' },
  { key: 'amountInWords', label: 'סכום במילים' },
  { key: 'date', label: 'תאריך על הגבי' },
];

const CheckDetailsForm: React.FC<CheckDetailsFormProps> = ({
  details,
  imageUrl,
  scanning,
  onChange,
  styles = {},
}) => {
  const update = (key: keyof DepositCheckDetails, value: string) => {
    onChange({ ...details, [key]: value || undefined });
  };

  return (
    <div style={{ marginTop: '16px', padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
      <h5 style={{ margin: '0 0 12px 0', color: '#1e293b' }}>פרטי הצ&apos;ק {scanning ? '(סורק...)' : ''}</h5>
      <p style={{ margin: '0 0 12px 0', color: '#64748b', fontSize: '13px' }}>
        סריקה לצ&apos;ק ביטחון ריק — מזהה בנק, סניף, חשבון ומספר שיק מכל הבנקים בישראל.
        שדות לפקודת/סכום/תאריך יישארו ריקים.
      </p>

      {scanning && (
        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '12px' }}>
          סורק את הצ&apos;ק (עד דקה) — מזהה בנק, סניף, חשבון ומספר שיק...
        </p>
      )}

      {!scanning && details.scanConfidence === 'high' && details.bankCode && (
        <p style={{ color: '#15803d', fontSize: '13px', marginBottom: '12px', background: '#f0fdf4', padding: '10px', borderRadius: '6px', border: '1px solid #86efac' }}>
          פרטי הצ&apos;ק זוהו בהצלחה — אנא ודאי לפני שמירה.
        </p>
      )}

      {!scanning && details.scanConfidence === 'none' && (
        <p style={{ color: '#b45309', fontSize: '13px', marginBottom: '12px', background: '#fffbeb', padding: '10px', borderRadius: '6px', border: '1px solid #fcd34d' }}>
          לא זוהו פרטי בנק — נסי לצלם שוב עם תאורה טובה וצ&apos;ק שטוח, או מלאי ידנית.
        </p>
      )}

      {!scanning && details.scanConfidence === 'low' && (
        <p style={{ color: '#b45309', fontSize: '13px', marginBottom: '12px', background: '#fffbeb', padding: '10px', borderRadius: '6px', border: '1px solid #fcd34d' }}>
          זוהו פרטים חלקיים — אנא בדקי ותקני לפני שמירה.
        </p>
      )}

      {imageUrl && (
        <img
          src={imageUrl}
          alt="תמונת צ'ק"
          style={{ width: '100%', maxWidth: '320px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '14px' }}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        {FIELDS.map(({ key, label, type }) => (
          <div key={key}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#475569' }}>{label}</label>
            <input
              type={type || 'text'}
              value={details[key] ?? ''}
              onChange={e => update(key, e.target.value)}
              className={styles.input}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
              disabled={scanning}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default CheckDetailsForm;
