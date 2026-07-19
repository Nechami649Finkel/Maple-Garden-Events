import { useMemo } from 'react';
import type { DepositCheckDetails } from '../../utils/checkOcr';
import { useTranslation } from '../../i18n/useTranslation';

interface CheckDetailsFormProps {
  details: DepositCheckDetails;
  imageUrl?: string;
  scanning?: boolean;
  onChange: (details: DepositCheckDetails) => void;
}

const CheckDetailsForm: React.FC<CheckDetailsFormProps> = ({
  details,
  imageUrl,
  scanning,
  onChange,
}) => {
  const { t, T } = useTranslation();

  const fields = useMemo(
    () => [
      { key: 'checkNumber' as const, label: t(T.CHECK.FIELD_NUMBER) },
      { key: 'bank' as const, label: t(T.CHECK.FIELD_BANK) },
      { key: 'bankCode' as const, label: t(T.CHECK.FIELD_BANK_CODE) },
      { key: 'branch' as const, label: t(T.CHECK.FIELD_BRANCH) },
      { key: 'account' as const, label: t(T.CHECK.FIELD_ACCOUNT) },
      { key: 'payee' as const, label: t(T.CHECK.FIELD_PAYEE) },
      { key: 'amount' as const, label: t(T.CHECK.FIELD_AMOUNT), type: 'number' },
      { key: 'amountInWords' as const, label: t(T.CHECK.FIELD_AMOUNT_WORDS) },
      { key: 'date' as const, label: t(T.CHECK.FIELD_DATE) },
    ],
    [t, T],
  );

  const update = (key: keyof DepositCheckDetails, value: string) => {
    onChange({ ...details, [key]: value || undefined });
  };

  return (
    <div className="border rounded p-3 mt-3 bg-light">
      <h5 className="mb-2">
        {t(T.CHECK.TITLE)}
        {scanning ? ` ${t(T.CHECK.SCANNING)}` : ''}
      </h5>
      <p style={{ margin: '0 0 12px 0', color: '#64748b', fontSize: '13px' }}>
        {t(T.CHECK.SCAN_HELP)}
      </p>

      {scanning && (
        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '12px' }}>
          {t(T.CHECK.SCAN_PROGRESS)}
        </p>
      )}

      {!scanning && details.scanConfidence === 'high' && details.bankCode && (
        <p style={{ color: '#15803d', fontSize: '13px', marginBottom: '12px', background: '#f0fdf4', padding: '10px', borderRadius: '6px', border: '1px solid #86efac' }}>
          {t(T.CHECK.SCAN_SUCCESS)}
        </p>
      )}

      {!scanning && details.scanConfidence === 'none' && (
        <p style={{ color: '#b45309', fontSize: '13px', marginBottom: '12px', background: '#fffbeb', padding: '10px', borderRadius: '6px', border: '1px solid #fcd34d' }}>
          {t(T.CHECK.SCAN_NONE)}
        </p>
      )}

      {!scanning && details.scanConfidence === 'low' && (
        <p style={{ color: '#b45309', fontSize: '13px', marginBottom: '12px', background: '#fffbeb', padding: '10px', borderRadius: '6px', border: '1px solid #fcd34d' }}>
          {t(T.CHECK.SCAN_PARTIAL)}
        </p>
      )}

      {imageUrl && (
        <img
          src={imageUrl}
          alt={t(T.CHECK.IMAGE_ALT)}
          style={{ width: '100%', maxWidth: '320px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '14px' }}
        />
      )}

      <div className="row g-3">
        {fields.map(({ key, label, type }) => (
          <div key={key} className="col-md-6 col-lg-4">
            <label className="form-label">{label}</label>
            <input
              type={type || 'text'}
              value={details[key] ?? ''}
              onChange={(e) => update(key, e.target.value)}
              className="form-control"
              disabled={scanning}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default CheckDetailsForm;
