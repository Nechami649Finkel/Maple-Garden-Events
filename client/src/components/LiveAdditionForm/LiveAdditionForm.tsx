import { useState, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { useTranslation } from '../../i18n/useTranslation';
import { secureFetch } from '../../services/api';
import { API_URL } from '../../config/api';
import './LiveAdditionForm.css';

interface LiveAdditionFormProps {
  bookingId: string;
  onSuccess: () => void;
}

const LiveAdditionForm: React.FC<LiveAdditionFormProps> = ({ bookingId, onSuccess }) => {
  const { t, T } = useTranslation();
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState<number | ''>('');
  const [staffName, setStaffName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const sigCanvas = useRef<SignatureCanvas>(null);

  const clearSignature = () => {
    sigCanvas.current?.clear();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agreed) {
      alert(t(T.LIVE_EVENT.ADDITION_CONSENT_REQUIRED));
      return;
    }

    if (sigCanvas.current?.isEmpty()) {
      alert(t(T.LIVE_EVENT.ADDITION_SIGNATURE_REQUIRED));
      return;
    }

    setLoading(true);

    const signatureData = sigCanvas.current?.getCanvas().toDataURL('image/png');
    const payload = {
      bookingId,
      description,
      cost: Number(cost),
      staffName,
      signature: signatureData,
      agreedToTerms: agreed,
    };

    try {
      const response = await secureFetch(`${API_URL}/bookings/${bookingId}/additions`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        onSuccess();
      } else {
        alert(t(T.LIVE_EVENT.ADDITION_SAVE_ERROR));
      }
    } catch (error) {
      console.error('Error saving addition:', error);
      alert(t(T.LIVE_EVENT.ADDITION_NETWORK_ERROR));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="addition-form-container">
      <h2 className="addition-form-title">{t(T.LIVE_EVENT.ADDITION_TITLE)}</h2>

      <form onSubmit={handleSubmit} className="addition-form">
        <div className="form-group">
          <label className="form-label">{t(T.LIVE_EVENT.ADDITION_DESCRIPTION_LABEL)}</label>
          <textarea
            required
            placeholder={t(T.LIVE_EVENT.ADDITION_DESCRIPTION_PLACEHOLDER)}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="form-input"
            rows={4}
            style={{ resize: 'vertical' }}
          />
        </div>

        <div className="form-group">
          <label className="form-label">{t(T.LIVE_EVENT.ADDITION_COST_LABEL)}</label>
          <input
            type="number"
            required
            min="0"
            value={cost}
            onChange={(e) => setCost(e.target.value === '' ? '' : Number(e.target.value))}
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label className="form-label">{t(T.LIVE_EVENT.ADDITION_STAFF_LABEL)}</label>
          <input
            type="text"
            required
            value={staffName}
            onChange={(e) => setStaffName(e.target.value)}
            className="form-input"
          />
        </div>

        <div className="agreement-box">
          <input
            type="checkbox"
            id="agreement-check"
            required
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="agreement-checkbox"
          />
          <label htmlFor="agreement-check" className="agreement-text">
            {t(T.LIVE_EVENT.ADDITION_CONSENT_TEXT)}
          </label>
        </div>

        <div className="signature-section">
          <label className="form-label">{t(T.LIVE_EVENT.ADDITION_SIGNATURE_LABEL)}:</label>
          <div className="signature-canvas-container">
            <SignatureCanvas
              ref={sigCanvas}
              canvasProps={{
                width: 350,
                height: 150,
                className: 'sigCanvas',
              }}
            />
          </div>
          <button type="button" onClick={clearSignature} className="clear-signature-btn">
            {t(T.LIVE_EVENT.CLEAR_SIGNATURE)}
          </button>
        </div>

        <button type="submit" disabled={loading} className="submit-btn">
          {loading ? t(T.LIVE_EVENT.SAVING) : t(T.LIVE_EVENT.ADDITION_SUBMIT)}
        </button>
      </form>
    </div>
  );
};

export default LiveAdditionForm;
