import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../services/api';
import { API_URL } from '../../config/api';
import styles from './OptionActionModal.module.css';
import { type BookingApi } from '../../utils/bookingApi';

interface Props {
  option: BookingApi;
  onClose: () => void;
  onSuccess: () => void;
}

const cancelReasonsList = [
  'יקר מדי',
  'תאריך לא הסתדר',
  'סגרו באולם אחר',
  'ביטול האירוע לחלוטין',
  'חוסר הסכמה על תנאים',
  'אחר'
];

const OptionActionModal = ({ option, onClose, onSuccess }: Props) => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'choose' | 'cancelReason'>('choose');
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const eventDateStr = option.eventDate?.date
    ? new Date(option.eventDate.date).toLocaleDateString('he-IL')
    : '';

  const handleConvertToBooking = () => {
    onClose();
    navigate(`/booking/close-option/${option.id}`);
  };

  const handleConfirmCancel = async () => {
    if (!cancelReason) {
      alert('חובה לבחור סיבת ביטול עבור הסטטיסטיקה של המערכת.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`${API_URL}/bookings/release`, {
        method: 'POST',
        body: JSON.stringify({
          dateIds: [option.calendarDateId],
          cancelReason: cancelReason,
          clientName: option.clientAFullName,
        }),
      });
      const result = await res.json();
      if (result.success) { alert('האופציה בוטלה והסטטיסטיקה עודכנה.'); onSuccess(); }
      else alert(result.message);
    } catch { alert('שגיאת תקשורת.'); }
    finally { setIsSubmitting(false); }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span>{step === 'choose' ? 'ניהול אופציה' : 'פעולה על אופציה'} - {option.clientAFullName}</span>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        {step === 'choose' && (
          <div className={styles.body}>
            <div className={styles.infoBox}>
              <div className={styles.infoRow}><label>תאריך:</label><span>{eventDateStr}</span></div>
              <div className={styles.infoRow}><label>סוג אירוע:</label><span>{option.eventType}</span></div>
              <div className={styles.infoRow}><label>זמן:</label><span>{option.timeOfDay}</span></div>
              <div className={styles.infoRow}><label>מוזמנים:</label><span>{option.guestCount}</span></div>
              <div className={styles.infoRow}><label>תשלום בסיסי:</label><span>₪{(option.basePrice ?? option.totalPrice)?.toLocaleString()}</span></div>
              {(option.extrasPrice ?? 0) > 0 && (
                <div className={styles.infoRow}><label>תוספות לאולם:</label><span>₪{option.extrasPrice?.toLocaleString()}</span></div>
              )}
              {(option.externalExtrasPrice ?? 0) > 0 && (
                <div className={styles.infoRow}><label>ספקים חיצוניים (לידיעה):</label><span>₪{option.externalExtrasPrice?.toLocaleString()}</span></div>
              )}
              <div className={styles.infoRow}><label>סה&quot;כ לאולם:</label><span style={{ fontWeight: 'bold' }}>₪{option.totalPrice?.toLocaleString()}</span></div>
              <div className={styles.infoRow}><label>טלפון:</label><span>{option.clientAPhone}</span></div>
            </div>
            <p className={styles.question}>בחר פעולה להמשך:</p>
            <div className={styles.actionButtons}>
              <button className={styles.finalizeBtn} onClick={handleConvertToBooking}>
                הפוך להזמנה סגורה (סגירת אירוע)
              </button>
              <button className={styles.cancelOptionBtn} onClick={() => setStep('cancelReason')}>
                בטל אופציה ושחרר תאריך
              </button>
            </div>
          </div>
        )}

        {step === 'cancelReason' && (
          <div className={styles.body}>
            <p className={styles.question} style={{ color: '#dc2626' }}>שימו לב: ביטול האופציה ישחרר את התאריך באופן מיידי.</p>
            <div className={styles.inputGroup} style={{ marginTop: '10px' }}>
              <label className={styles.inputLabel}>לצורך סטטיסטיקה, מדוע האופציה בוטלה?</label>
              <select 
                className={styles.input} 
                value={cancelReason} 
                onChange={(e) => setCancelReason(e.target.value)}
                style={{ cursor: 'pointer' }}
              >
                <option value="">בחרו סיבת ביטול מרכזית...</option>
                {cancelReasonsList.map(reason => (
                  <option key={reason} value={reason}>{reason}</option>
                ))}
              </select>
            </div>
            
            <div className={styles.footer} style={{ marginTop: '20px', padding: '0', border: 'none' }}>
              <button type="button" className={styles.backBtn} onClick={() => setStep('choose')}>חזור</button>
              <button 
                type="button" 
                className={styles.submitBtn} 
                style={{ background: '#dc2626' }}
                disabled={isSubmitting || !cancelReason}
                onClick={handleConfirmCancel}
              >
                {isSubmitting ? 'מבטל...' : 'אשר ביטול מוחלט'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OptionActionModal;
