import React, { useRef, useState, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { getSignatureDataUrl } from '../../../utils/signature';
import { openContractPdf } from '../../../utils/contractPrint';
import ContractTextViewer from './ContractTextViewer';
import modalStyles from './ContractModal.module.css';
import { useTranslation } from '../../../i18n/useTranslation';
import { secureFetch } from '../../../services/api';
import { API_URL } from '../../../config/api';

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
  savedSignature?: string | null;
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
  savedSignature,
}: ContractModalProps) => {
  const { t, T } = useTranslation();
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

  useEffect(() => {
    if (isOpen && savedSignature && sigCanvas.current) {
      // Small timeout to ensure canvas is fully mounted
      setTimeout(() => {
        sigCanvas.current?.fromDataURL(savedSignature);
        latestSignatureRef.current = { gen: padGeneration, data: savedSignature };
      }, 50);
    }
  }, [isOpen, savedSignature, sigCanvas, padGeneration]);

  const [isSigning, setIsSigning] = useState(false);

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

  const handleConfirmSignature = async () => {
    if (isEditing) {
      alert(t(T.BOOKING.CONTRACT.SAVE_EDIT_BEFORE_SIGN));
      return;
    }
    const dataUrl = captureFromPad();
    if (!dataUrl) {
      alert(t(T.BOOKING.CONTRACT.SIGN_REQUIRED));
      return;
    }

    if (bookingId) {
      setIsSigning(true);
      try {
        const response = await secureFetch(`${API_URL}/bookings/${bookingId}/sign-and-send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientSignature: dataUrl }),
        });
        const resData = await response.json().catch(() => ({}));
        if (response.ok && resData.success) {
          alert('החוזה נחתם בהצלחה ונשלח למייל (ולוואטסאפ אם מוגדר) של בעל האירוע.');
        } else {
          console.error(resData);
          alert(
            'החתימה נשמרה אך אירעה שגיאה בשליחת המסמך: '
              + (resData.message || `HTTP ${response.status}`),
          );
        }
      } catch (err) {
        console.error(err);
        alert('שגיאה בתקשורת עם השרת בזמן שמירת החתימה.');
      } finally {
        setIsSigning(false);
      }
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
          <h3>{isOption ? t(T.BOOKING.CONTRACT.TITLE_OPTION) : t(T.BOOKING.CONTRACT.TITLE_BOOKING)}</h3>
          <button type="button" onClick={onClose} className={`maple-close-btn ${modalStyles.headerClose}`} aria-label={t(T.BOOKING.CONTRACT.CLOSE)}>✕</button>
        </div>

        <div className={modalStyles.body}>
          <div className={modalStyles.contentWrap}>
            {isOption && !isEditing && (
              <div className={modalStyles.draftWatermark}>{t(T.BOOKING.CONTRACT.DRAFT_WATERMARK)}</div>
            )}

            <div className={modalStyles.toolbar}>
              <span className={modalStyles.toolbarTitle}>{t(T.BOOKING.CONTRACT.TEXT_TITLE)}</span>
              <div className={modalStyles.toolbarActions}>
                {bookingId && !isEditing && (
                  <button
                    type="button"
                    className="maple-btn maple-btn-secondary"
                    onClick={() => void openContractPdf(bookingId, t)}
                  >
                    {t(T.BOOKING.CONTRACT.VIEW_PDF)}
                  </button>
                )}
                {!isEditing ? (
                  <button type="button" onClick={startEditing} className={modalStyles.editBtn}>
                    {t(T.BOOKING.CONTRACT.EDIT_TEXT)}
                  </button>
                ) : (
                  <div className={modalStyles.editActions}>
                    <button type="button" onClick={saveEditing} className="maple-btn maple-btn-primary">
                      {t(T.COMMON.ACTIONS.SAVE)}
                    </button>
                    <button type="button" onClick={cancelEditing} className="maple-btn maple-btn-secondary">
                      {t(T.COMMON.ACTIONS.CANCEL)}
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
                    {t(T.BOOKING.CONTRACT.EMPTY)}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className={modalStyles.disclaimer}>
            <p>{t(T.BOOKING.CONTRACT.DISCLAIMER)}</p>
          </div>

          <div className={modalStyles.signatureSection}>
            <h4>{t(T.BOOKING.CONTRACT.SIGNATURE_TITLE)}</h4>
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
              {t(T.BOOKING.CONTRACT.CLEAR_SIGNATURE)}
            </button>

            <button
              type="button"
              onClick={handleConfirmSignature}
              disabled={isSigning}
              className={`maple-btn maple-btn-primary ${modalStyles.signBtn}`}
            >
              {isSigning ? 'שומר חתימה ושולח...' : t(T.BOOKING.CONTRACT.CONFIRM_SIGN)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractModal;
