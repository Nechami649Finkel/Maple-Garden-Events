import { useEffect, useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { useTranslation } from '../../i18n/useTranslation';
import styles from './LiveEvent.module.css';

export interface ReserveTableRow {
  number: number;
  value: string;
}

export interface CheckInFormData {
  familiesLabel: string;
  orderedPortions: number | '';
  entertainerPortions: number | '';
  reservePortions: number | '';
  reserveTables: ReserveTableRow[];
  specialAdditionLine1: string;
  specialAdditionLine2: string;
  customerSignature: string | null;
}

interface EventCheckInBoardProps {
  dateDisplay: string;
  initialData: CheckInFormData;
  readOnly?: boolean;
  onSave: (data: CheckInFormData) => Promise<void>;
  onCancel: () => void;
}

const EventCheckInBoardInner: React.FC<EventCheckInBoardProps> = ({
  dateDisplay,
  initialData,
  readOnly = false,
  onSave,
  onCancel,
}) => {
  const { t, T } = useTranslation();
  const [form, setForm] = useState<CheckInFormData>(initialData);
  const [saving, setSaving] = useState(false);
  const sigCanvas = useRef<SignatureCanvas>(null);
  const sigLoaded = useRef(false);

  useEffect(() => {
    if (initialData.customerSignature && sigCanvas.current && !sigLoaded.current) {
      sigCanvas.current.fromDataURL(initialData.customerSignature);
      sigLoaded.current = true;
    }
  }, [initialData.customerSignature]);

  const handleReserveChange = (num: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      reserveTables: prev.reserveTables.map((row) =>
        row.number === num ? { ...row, value } : row,
      ),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;

    const signature = sigCanvas.current?.isEmpty()
      ? form.customerSignature
      : sigCanvas.current?.getCanvas().toDataURL('image/png') ?? null;

    if (!signature?.trim()) {
      alert(t(T.LIVE_EVENT.SIGNATURE_REQUIRED));
      return;
    }

    setSaving(true);
    try {
      await onSave({ ...form, customerSignature: signature });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={styles.checkInBoard} onSubmit={handleSubmit}>
      <p className={styles.checkInBsd}>{t(T.LIVE_EVENT.BSD)}</p>

      <div className={styles.checkInHeader}>
        <img src="/logo.png" alt={t(T.UI.BRAND_ALT)} className={styles.checkInLogo} />
        <p className={styles.checkInBrand}>{t(T.UI.BRAND_NAME)}</p>
        <p className={styles.checkInSubtitle}>{t(T.UI.VENUE_TAGLINE)}</p>
      </div>

      <div className={styles.checkInInlineRow}>
        <span className={styles.checkInInlineLabel}>{t(T.LIVE_EVENT.LABEL_FAMILIES)}:</span>
        <input
          type="text"
          className={styles.checkInInlineInput}
          value={form.familiesLabel}
          readOnly={readOnly}
          onChange={(e) => setForm((p) => ({ ...p, familiesLabel: e.target.value }))}
        />
      </div>

      <div className={styles.checkInInlineRow}>
        <span className={styles.checkInInlineLabel}>{t(T.LIVE_EVENT.LABEL_DATE)}:</span>
        <input type="text" className={styles.checkInInlineInput} value={dateDisplay} readOnly />
      </div>

      <p className={styles.checkInConfirmText}>{t(T.LIVE_EVENT.ACCEPTANCE_TEXT)}</p>

      <div className={styles.checkInInlineRow}>
        <span className={styles.checkInInlineLabel}>{t(T.LIVE_EVENT.LABEL_ORDERED_PORTIONS)}:</span>
        <input
          type="number"
          min="0"
          className={styles.checkInInlineInput}
          value={form.orderedPortions}
          readOnly={readOnly}
          onChange={(e) =>
            setForm((p) => ({
              ...p,
              orderedPortions: e.target.value === '' ? '' : Number(e.target.value),
            }))
          }
        />
      </div>

      <div className={styles.checkInInlineRow}>
        <span className={styles.checkInInlineLabel}>{t(T.LIVE_EVENT.LABEL_ENTERTAINER_PORTIONS)}:</span>
        <input
          type="number"
          min="0"
          className={styles.checkInInlineInput}
          value={form.entertainerPortions}
          readOnly={readOnly}
          onChange={(e) =>
            setForm((p) => ({
              ...p,
              entertainerPortions: e.target.value === '' ? '' : Number(e.target.value),
            }))
          }
        />
      </div>

      <div className={styles.checkInReserveSection}>
        {form.reserveTables.map((row) => (
          <div key={row.number} className={styles.checkInInlineRow}>
            <span className={styles.checkInInlineLabel}>
              {t(T.LIVE_EVENT.RESERVE_TABLE_TEXT)} {row.number}:
            </span>
            <input
              type="text"
              className={styles.checkInInlineInput}
              value={row.value}
              readOnly={readOnly}
              onChange={(e) => handleReserveChange(row.number, e.target.value)}
            />
          </div>
        ))}
      </div>

      <div className={styles.checkInSpecialSection}>
        <p className={styles.checkInInlineLabel}>{t(T.LIVE_EVENT.LABEL_SPECIAL_ADDITIONS)}:</p>
        <input
          type="text"
          className={styles.checkInLineInput}
          value={form.specialAdditionLine1}
          readOnly={readOnly}
          onChange={(e) => setForm((p) => ({ ...p, specialAdditionLine1: e.target.value }))}
        />
        <input
          type="text"
          className={styles.checkInLineInput}
          value={form.specialAdditionLine2}
          readOnly={readOnly}
          onChange={(e) => setForm((p) => ({ ...p, specialAdditionLine2: e.target.value }))}
        />
      </div>

      <div className={`${styles.checkInField} ${styles.signatureSection}`}>
        <p className={styles.checkInInlineLabel}>{t(T.LIVE_EVENT.LABEL_SIGNATURE)}:</p>
        {readOnly && form.customerSignature ? (
          <img
            src={form.customerSignature}
            alt={t(T.LIVE_EVENT.SIGNATURE_ALT)}
            className={styles.signaturePreview}
          />
        ) : readOnly ? (
          <p className={styles.checkInConfirmText}>{t(T.LIVE_EVENT.NOT_SIGNED)}</p>
        ) : (
          <>
            <div className={styles.signatureCanvasWrap}>
              <SignatureCanvas
                ref={sigCanvas}
                canvasProps={{ width: 400, height: 120, className: 'sigCanvas' }}
              />
            </div>
            <button
              type="button"
              className={styles.clearSigBtn}
              onClick={() => sigCanvas.current?.clear()}
            >
              {t(T.LIVE_EVENT.CLEAR_SIGNATURE)}
            </button>
          </>
        )}
      </div>

      <div className={styles.checkInActions}>
        <button type="button" className={styles.checkInCancelBtn} onClick={onCancel}>
          {t(T.LIVE_EVENT.CLOSE)}
        </button>
        {!readOnly && (
          <button type="submit" className={styles.checkInSaveBtn} disabled={saving}>
            {saving ? t(T.LIVE_EVENT.SAVING) : t(T.LIVE_EVENT.SAVE)}
          </button>
        )}
      </div>
    </form>
  );
};

const EventCheckInBoard: React.FC<EventCheckInBoardProps> = (props) => (
  <EventCheckInBoardInner
    key={JSON.stringify(props.initialData)}
    {...props}
  />
);

export default EventCheckInBoard;
