import { useEffect, useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { getSignatureDataUrl } from '../../../utils/signature';
import { openContractPdf } from '../../../utils/contractPrint';
import ContractTextViewer from './ContractTextViewer';
import modalStyles from './ContractModal.module.css';
import { useTranslation } from '../../../i18n/useTranslation';

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
  const { t, T } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState('');
  const signatureWrapRef = useRef<HTMLDivElement>(null);
  const [signatureSize, setSignatureSize] = useState({ width: 700, height: 200 });

  useEffect(() => {
    if (!isOpen) return;
    const el = signatureWrapRef.current;
    if (!el) return;

    const updateSize = () => {
      const width = Math.max(260, Math.min(700, Math.floor(el.clientWidth - 4)));
      const height = width < 400 ? 140 : 200;
      setSignatureSize({ width, height });
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    window.addEventListener('resize', updateSize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [isOpen]);

  if (!isOpen) return null;

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
            <div ref={signatureWrapRef} className={modalStyles.signatureBox}>
              <SignatureCanvas
                ref={sigCanvas}
                penColor="#0f172a"
                canvasProps={{
                  width: signatureSize.width,
                  height: signatureSize.height,
                  style: { cursor: 'crosshair', width: '100%', height: 'auto', display: 'block' },
                }}
              />
            </div>
          </div>

          <div className={modalStyles.actions}>
            <button type="button" onClick={() => sigCanvas.current?.clear()} className="maple-btn maple-btn-danger">
              {t(T.BOOKING.CONTRACT.CLEAR_SIGNATURE)}
            </button>

            <button
              type="button"
              onClick={() => {
                if (isEditing) {
                  alert(t(T.BOOKING.CONTRACT.SAVE_EDIT_BEFORE_SIGN));
                  return;
                }
                const dataUrl = getSignatureDataUrl(sigCanvas);
                if (!dataUrl) return alert(t(T.BOOKING.CONTRACT.SIGN_REQUIRED));
                onSignatureSaved?.(dataUrl);
                setContractSigned(true);
                onClose();
              }}
              className={`maple-btn maple-btn-primary ${modalStyles.signBtn}`}
            >
              {t(T.BOOKING.CONTRACT.CONFIRM_SIGN)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractModal;
