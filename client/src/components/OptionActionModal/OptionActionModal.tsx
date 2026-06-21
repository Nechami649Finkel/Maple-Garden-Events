import React, { useState } from 'react';
import styles from './OptionActionModal.module.css';
import { promptPrintAfterClose } from '../../utils/contractPrint';

interface Props {
  option: any;
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
  const [step, setStep] = useState<'choose' | 'finalize' | 'cancelReason'>('choose');
  
  const [advancePaid, setAdvancePaid] = useState('');
  const [hasMusic, setHasMusic] = useState(true);
  const [akumCode, setAkumCode] = useState('');
  
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const eventDateStr = option.eventDate?.date
    ? new Date(option.eventDate.date).toLocaleDateString('he-IL')
    : '';

  const handleConfirmCancel = async () => {
    if (!cancelReason) {
      alert('חובה לבחור סיבת ביטול עבור הסטטיסטיקה של המערכת.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const res = await fetch('http://localhost:5000/api/bookings/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          dateIds: [option.calendarDateId],
          cancelReason: cancelReason,
          clientName: option.clientAFullName
        }),
      });
      const result = await res.json();
      if (result.success) { alert('האופציה בוטלה והסטטיסטיקה עודכנה.'); onSuccess(); }
      else alert(result.message);
    } catch { alert('שגיאת תקשורת.'); }
    finally { setIsSubmitting(false); }
  };

  const handleFinalize = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('http://localhost:5000/api/bookings/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: option.id,
          advancePaid,
          hasMusic,
          akumApprovalCode: akumCode,
        }),
      });
      const result = await res.json();
      if (result.success) {
        const code = result.data?.eventCode;
        alert(code ? `האירוע נסגר בהצלחה!\nמספר הזמנה: ${code}` : 'האירוע נסגר בהצלחה.');
        if (option.id) {
          await promptPrintAfterClose(option.id);
        }
        onSuccess();
      }
      else alert(result.message || 'שגיאה בסגירת האירוע');
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
              <div className={styles.infoRow}><label>סה"כ לתשלום:</label><span style={{ fontWeight: 'bold' }}>₪{option.totalPrice?.toLocaleString()}</span></div>
              <div className={styles.infoRow}><label>טלפון:</label><span>{option.clientAPhone}</span></div>
            </div>
            <p className={styles.question}>בחר פעולה להמשך:</p>
            <div className={styles.actionButtons}>
              <button className={styles.finalizeBtn} onClick={() => setStep('finalize')}>
                הפוך להזמנה סגורה (אירוע סופי)
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

        {step === 'finalize' && (
          <form onSubmit={handleFinalize}>
            <div className={styles.body}>
              <div className={styles.infoBox}>
                <div className={styles.infoRow}><label>תאריך:</label><span style={{ fontWeight: 'bold' }}>{eventDateStr}</span></div>
                <div className={styles.infoRow}><label>לקוח:</label><span>{option.clientAFullName}</span></div>
                <div className={styles.infoRow}><label>לתשלום:</label><span style={{ fontWeight: 'bold', color: '#1e293b' }}>₪{option.totalPrice?.toLocaleString()}</span></div>
              </div>
              
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>מקדמה ששולמה (₪) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  className={styles.input}
                  value={advancePaid}
                  onChange={e => setAdvancePaid(e.target.value)}
                  placeholder="לדוגמה: 5000"
                />
              </div>

              <div className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  id="musicCheck"
                  checked={hasMusic}
                  onChange={e => setHasMusic(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                <label htmlFor="musicCheck" className={styles.inputLabel}>יש מוזיקה באירוע (דורש אישור אקו"ם)</label>
              </div>

              {/* קופסת אקו"ם עם עיצוב נקי המיובא מה-CSS */}
              {(hasMusic || option.eventType === 'חתונה') && (
                <div className={styles.akumAlertBox}>
                  <span className={styles.akumAlertTitle}>
                     הסדרת רישיון אקו"ם
                  </span>
                  <span className={styles.akumAlertText}>
                    {option.eventType === 'חתונה' 
                      ? 'חובה להסדיר רישיון השמעת מוזיקה מול אקו"ם עבור אירועי חתונה.' 
                      : 'מכיוון שציינת שיש מוזיקה באירוע, יש להסדיר רישיון מול אקו"ם.'}
                  </span>
                  <a 
                    href="https://apps.acum.org.il/licenses/family-event/register-payment?action=payFamilyEvent" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={styles.akumAlertLink}
                  >
                    לתשלום והפקת הרישיון לאקו"ם לחצו כאן
                  </a>
                </div>
              )}

              {hasMusic && (
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>קוד אישור אקו"ם</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={akumCode}
                    onChange={e => setAkumCode(e.target.value)}
                    placeholder="הזן מספר אישור שקיבלת לאחר התשלום"
                  />
                </div>
              )}
            </div>

            <div className={styles.footer}>
              <button type="button" className={styles.backBtn} onClick={() => setStep('choose')}>חזור</button>
              <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                {isSubmitting ? 'מעדכן...' : 'סגור אירוע סופית'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default OptionActionModal;