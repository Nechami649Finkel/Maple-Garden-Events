import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { getSignatureDataUrl } from '../../../utils/signature';
import { openContractPdf } from '../../../utils/contractPrint';
import ContractTextViewer from './ContractTextViewer';
import modalStyles from './ContractModal.module.css';

interface ContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  isOption: boolean;
  sigCanvas: React.RefObject<SignatureCanvas | null>;
  setContractSigned: (signed: boolean) => void;
  onSignatureSaved?: (dataUrl: string) => void;
  contractText: string;
  onContractTextChange: (text: string) => void;
  bookingId?: string;
  styles?: Record<string, string>;
}

/** Locked bitmap size — avoids ResizeObserver remounts that wipe strokes. */
const SIGNATURE_SIZE = { width: 700, height: 200 };

const ContractModal = ({
  isOpen,
  onClose,
  isOption,
  sigCanvas,
  setContractSigned,
  onSignatureSaved,
  contractText,
  onContractTextChange,
  bookingId,
}: ContractModalProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [padGeneration, setPadGeneration] = useState(0);
  const [wasOpen, setWasOpen] = useState(isOpen);
  const latestSignatureRef = useRef<{ gen: number; data: string } | null>(null);

  // Reset pad session when the modal opens (render-time adjust — no effect setState).
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setIsEditing(false);
      setDraftText('');
      setPadGeneration((g) => g + 1);
    }
  }

  if (!isOpen) return null;

  const captureFromPad = (): string | null => {
    const fromPad = getSignatureDataUrl(sigCanvas);
    if (fromPad) {
      latestSignatureRef.current = { gen: padGeneration, data: fromPad };
      return fromPad;
    }
    const cached = latestSignatureRef.current;
    if (cached && cached.gen === padGeneration) return cached.data;
    return null;
  };

  const handleConfirmSignature = () => {
    if (isEditing) {
      alert('יש לשמור או לבטל את עריכת מלל החוזה לפני החתימה.');
      return;
    }
    const dataUrl = captureFromPad();
    if (!dataUrl) {
      alert('נא לחתום לפני האישור');
      return;
    }
    onSignatureSaved?.(dataUrl);
    setContractSigned(true);
    onClose();
  };

  const startEditing = () => {
    setDraftText(contractText);
    setIsEditing(true);
  };

  const saveEditing = () => {
    onContractTextChange(draftText);
    setIsEditing(false);
  };

  const cancelEditing = () => {
    setDraftText(contractText);
    setIsEditing(false);
  };

  return (
    <div className={modalStyles.overlay}>
      <div className={modalStyles.modal}>
        <div className={modalStyles.header}>
          <h3>{isOption ? 'הצעת מחיר וחוזה (אופציה)' : 'חוזה התקשרות לאירוע'}</h3>
          <button type="button" onClick={onClose} className={`maple-close-btn ${modalStyles.headerClose}`} aria-label="סגור">✕</button>
        </div>

        <div className={modalStyles.body}>
          <div className={modalStyles.contentWrap}>
            {isOption && !isEditing && (
              <div className={modalStyles.draftWatermark}>טיוטה - דוגמא</div>
            )}

            <div className={modalStyles.toolbar}>
              <span className={modalStyles.toolbarTitle}>מלל החוזה לאירוע זה</span>
              <div className={modalStyles.toolbarActions}>
                {bookingId && !isEditing && (
                  <button
                    type="button"
                    className="maple-btn maple-btn-secondary"
                    onClick={() => void openContractPdf(bookingId)}
                  >
                    צפייה ב-PDF החוזה
                  </button>
                )}
                {!isEditing ? (
                  <button type="button" onClick={startEditing} className={modalStyles.editBtn}>
                    ✏️ עריכת מלל החוזה
                  </button>
                ) : (
                  <div className={modalStyles.editActions}>
                    <button type="button" onClick={saveEditing} className="maple-btn maple-btn-primary">
                      שמירה
                    </button>
                    <button type="button" onClick={cancelEditing} className="maple-btn maple-btn-secondary">
                      ביטול
                    </button>
                  </div>
                )}
              </div>
            </div>

            {isEditing ? (
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                className={modalStyles.textarea}
              />
            ) : (
              <div className={modalStyles.textPanel}>
                {contractText ? (
                  <ContractTextViewer text={contractText} />
                ) : (
                  <span className={modalStyles.emptyMsg}>
                    לא ניתן לטעון את מלל החוזה — ודאי שהשרת פועל (פורט 5000)
                  </span>
                )}
              </div>
            )}
          </div>

          <div className={modalStyles.disclaimer}>
            <p>
              בחתימתי אני מאשר/ת את נכונות הפרטים המופיעים בטופס הפקת אירוע זה. כמו כן, אני מצהיר/ה כי קראתי והבנתי את תנאי ההתקשרות והתקנון של גן אירועים מייפל, ואני מסכים/ה להם במלואם.
            </p>
          </div>

          <div className={modalStyles.signatureSection}>
            <h4>חתימת הלקוח:</h4>
            <div className={modalStyles.signatureBox}>
              <SignatureCanvas
                key={padGeneration}
                ref={sigCanvas}
                penColor="#0f172a"
                onEnd={() => {
                  const snap = getSignatureDataUrl(sigCanvas);
                  if (snap) latestSignatureRef.current = { gen: padGeneration, data: snap };
                }}
                canvasProps={{
                  width: SIGNATURE_SIZE.width,
                  height: SIGNATURE_SIZE.height,
                  style: { cursor: 'crosshair', width: '100%', height: 'auto', display: 'block', touchAction: 'none' },
                }}
              />
            </div>
          </div>

          <div className={modalStyles.actions}>
            <button
              type="button"
              onClick={() => {
                sigCanvas.current?.clear();
                latestSignatureRef.current = null;
              }}
              className="maple-btn maple-btn-danger"
            >
              נקה חתימה 🗑️
            </button>

            <button
              type="button"
              onClick={handleConfirmSignature}
              className={`maple-btn maple-btn-primary ${modalStyles.signBtn}`}
            >
              אני מאשר/ת וחותם/ת ✓
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractModal;
