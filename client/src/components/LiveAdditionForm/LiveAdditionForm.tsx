import React, { useState, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import './LiveAdditionForm.css';

interface LiveAdditionFormProps {
  bookingId: string;
  onSuccess: () => void;
}

const LiveAdditionForm: React.FC<LiveAdditionFormProps> = ({ bookingId, onSuccess }) => {
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
      alert('חובה לסמן את תיבת ההסכמה לתשלום.');
      return;
    }

    if (sigCanvas.current?.isEmpty()) {
      alert('חובה להוסיף חתימת לקוח.');
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
      agreedToTerms: agreed
    };

    try {
      const response = await fetch(`http://localhost:5000/api/bookings/${bookingId}/additions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        onSuccess(); // הקריאה לפונקציה שסוגרת את החלון ומקפיצה התראה כבר מוגדרת בקומפוננטת האב
      } else {
        alert('שגיאה בשמירת התוספת');
      }
    } catch (error) {
      console.error('Error saving addition:', error);
      alert('שגיאת תקשורת');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="addition-form-container">
      <h2 className="addition-form-title">אישור תוספות בזמן אירוע</h2>
      
      <form onSubmit={handleSubmit} className="addition-form">
        
        {/* כאן בוצע השינוי: הפכנו את ה-input ל-textarea */}
        <div className="form-group">
          <label className="form-label">מה התוספת?</label>
          <textarea 
            required
            placeholder="פירוט התוספות (למשל:&#10;1- תוספת 2 שולחנות נשים&#10;2- הארכת הבר בשעה)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="form-input"
            rows={4} /* קובע את גובה התיבה ל-4 שורות מראש */
            style={{ resize: 'vertical' }} /* מאפשר לגרור ולהגדיל את התיבה במידת הצורך */
          />
        </div>

        <div className="form-group">
          <label className="form-label">עלות התוספת הכוללת (₪)</label>
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
          <label className="form-label">שם איש הצוות (אחראי אירוע)</label>
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
            אני בעל השמחה מאשר בזאת את קבלת התוספות הנ"ל, וידוע לי כי עלות זו תתווסף לחשבון הסופי של האירוע ושאדרש לשלם אותה.
          </label>
        </div>

        <div className="signature-section">
          <label className="form-label">חתימת בעל השמחה:</label>
          <div className="signature-canvas-container">
            <SignatureCanvas 
              ref={sigCanvas}
              canvasProps={{ 
                width: 350, 
                height: 150, 
                className: 'sigCanvas' 
              }}
            />
          </div>
          <button 
            type="button" 
            onClick={clearSignature}
            className="clear-signature-btn"
          >
            נקה חתימה
          </button>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="submit-btn"
        >
          {loading ? 'שומר...' : 'שמור ואשר תוספת'}
        </button>
      </form>
    </div>
  );
};

export default LiveAdditionForm;