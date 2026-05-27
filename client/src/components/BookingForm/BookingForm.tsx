import React, { useState } from 'react';
import styles from './BookingForm.module.css';

const BookingForm = ({ initialDate = '', onSaved }: { initialDate?: string, onSaved?: () => void }) => {
  const [formData, setFormData] = useState({
    clientAFullName: '', clientAIdNumber: '', clientAPhone: '', clientAPhone2: '', clientAEmail: '', clientACity: '', clientAAddress: '',
    clientBFullName: '', clientBIdNumber: '', clientBPhone: '', clientBPhone2: '', clientBEmail: '', clientBCity: '', clientBAddress: '',
    calendarDateId: initialDate, eventType: '', timeOfDay: '', guestCount: '', finalPricePortion: '', managerComments: '', clientComments: ''
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{text: string, ok: boolean} | null>(null);

  const handleSubmit = async () => {
    if (!formData.calendarDateId || !formData.eventType || !formData.clientAFullName || !formData.clientAPhone) {
      setMessage({ text: 'נא למלא תאריך, סוג אירוע, שם וטלפון', ok: false });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('http://localhost:5000/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          guestCount: Number(formData.guestCount),
          finalPricePortion: Number(formData.finalPricePortion),
        })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: 'האירוע נשמר בהצלחה!', ok: true });
        setTimeout(() => onSaved?.(), 1000);
      } else {
        setMessage({ text: data.message || 'שגיאה בשמירה', ok: false });
      }
    } catch {
      setMessage({ text: 'שגיאת תקשורת עם השרת', ok: false });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // משתנה חכם שבודק אם בחרנו חתונה
  const isWedding = formData.eventType === 'חתונה';

  // רשימת סוגי האירועים המלאה
  const eventTypesList = [
    'חתונה', 'אירוסין', 'בר מצווה', 'בת מצווה', 'ברית', 'בריתה', 'חינה', 'הרמת כוסית', 'כנס מקצועי', 'אירוע חברה/עסקי'
  ];

  return (
    <div className={styles.container}>
      <div className={styles.formCard}>
        
        <div className={styles.header}>
          <h2 className={styles.title}>
            יצירת אירוע חדש <span className={styles.titleAccent}>| מייפל</span>
          </h2>
          <p className={styles.subtitle}>הזנת נתונים למערכת - מחובר ישירות ליומן האירועים המרכזי</p>
        </div>

        <form className={styles.formBody}>
          
          {/* אזור פרטי האירוע (הקפצתי אותו למעלה כדי שהמערכת תדע מיד אם זו חתונה או לא) */}
          <div className={styles.eventDetailsSection}>
            <h3 className={styles.sectionTitle}>הגדרות אירוע בסיסיות</h3>
            <div className={styles.eventDetailsGrid}>
              
              <div className={styles.inputGroup}>
                <label className={styles.label}>סוג אירוע</label>
                <select name="eventType" onChange={handleChange} className={styles.input}>
                  <option value="">בחרי מסוגי האירועים...</option>
                  {eventTypesList.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>מועד האירוע</label>
                <select name="timeOfDay" onChange={handleChange} className={styles.input}>
                  <option value="">בחירת שעה ביום...</option>
                  <option value="בוקר">בוקר (אירוע יום)</option>
                  <option value="צהריים">צהריים</option>
                  <option value="ערב">ערב</option>
                </select>
              </div>

              {/* השדה הזה נעול ומיועד לקבל את התאריך מהיומן של מרימי */}
              <div className={styles.inputGroup}>
                <label className={styles.label}>תאריך האירוע (נבחר ביומן)</label>
                <input 
                  type="date" 
                  name="calendarDateId" 
                  value={formData.calendarDateId} 
                  readOnly 
                  className={styles.input} 
                  style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed', color: '#6b7280' }} 
                  title="התאריך נבחר דרך מסך היומן"
                />
              </div>

              <div className={styles.inputRow}>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>כמות מוזמנים</label>
                  <input type="number" name="guestCount" onChange={handleChange} className={styles.input} />
                  
                  {/* לוגיקה חכמה: מציג אזהרה רק אם הוקלד מספר והוא קטן מ-350 */}
                  {formData.guestCount && Number(formData.guestCount) < 350 && (
                    <span style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.3rem', fontWeight: '500' }}>
                      * אירוע קטן מתחת הסטנדרט
                    </span>
                  )}
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>מחיר מנה (₪)</label>
                  <input type="number" name="finalPricePortion" onChange={handleChange} className={styles.input} />
                </div>
              </div>

            </div>
          </div>

          {/* אזור פרטי הלקוחות (משתנה דינמית!) */}
          <div className={isWedding ? styles.clientsSectionWedding : styles.clientsSectionSingle}>
            
            {/* --- צד א' (חתן / בעל שמחה) --- */}
            <div className={styles.clientBlock}>
              <h3 className={`${styles.sectionTitle} ${styles.sectionTitlePrimary}`}>
                {isWedding ? "פרטי צד החתן" : "פרטי בעל השמחה"}
              </h3>
              
              <div className={styles.inputRow}>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>שם מלא</label>
                  <input type="text" name="clientAFullName" onChange={handleChange} className={styles.input} />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>תעודת זהות</label>
                  <input type="text" name="clientAIdNumber" onChange={handleChange} className={styles.input} />
                </div>
              </div>
              
              <div className={styles.inputRow}>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>טלפון ראשי</label>
                  <input type="tel" name="clientAPhone" onChange={handleChange} className={styles.input} />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>טלפון חלופי (אופציונלי)</label>
                  <input type="tel" name="clientAPhone2" onChange={handleChange} className={styles.input} />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>כתובת דוא"ל</label>
                <input type="email" name="clientAEmail" onChange={handleChange} className={styles.input} />
              </div>

              <div className={styles.inputRow}>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>עיר</label>
                  <input type="text" name="clientACity" onChange={handleChange} className={styles.input} />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>רחוב ומספר בית</label>
                  <input type="text" name="clientAAddress" onChange={handleChange} className={styles.input} />
                </div>
              </div>
            </div>

            {/* --- צד ב' (מוצג אך ורק אם נבחרה חתונה!) --- */}
            {isWedding && (
              <div className={styles.clientBlock}>
                <h3 className={`${styles.sectionTitle} ${styles.sectionTitleSecondary}`}>
                  פרטי צד הכלה
                </h3>
                
                <div className={styles.inputRow}>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>שם מלא</label>
                    <input type="text" name="clientBFullName" onChange={handleChange} className={styles.input} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>תעודת זהות</label>
                    <input type="text" name="clientBIdNumber" onChange={handleChange} className={styles.input} />
                  </div>
                </div>
                
                <div className={styles.inputRow}>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>טלפון ראשי</label>
                    <input type="tel" name="clientBPhone" onChange={handleChange} className={styles.input} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>טלפון חלופי (אופציונלי)</label>
                    <input type="tel" name="clientBPhone2" onChange={handleChange} className={styles.input} />
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.label}>כתובת דוא"ל</label>
                  <input type="email" name="clientBEmail" onChange={handleChange} className={styles.input} />
                </div>

                <div className={styles.inputRow}>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>עיר</label>
                    <input type="text" name="clientBCity" onChange={handleChange} className={styles.input} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>רחוב ומספר בית</label>
                    <input type="text" name="clientBAddress" onChange={handleChange} className={styles.input} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className={styles.actions}>
            {message && (
              <div style={{ padding: '10px', marginBottom: '10px', borderRadius: '6px', textAlign: 'center', fontWeight: 'bold',
                backgroundColor: message.ok ? '#dcfce7' : '#fee2e2',
                color: message.ok ? '#166534' : '#991b1b' }}>
                {message.text}
              </div>
            )}
            <button type="button" onClick={handleSubmit} disabled={saving} className={styles.submitBtn}>
              {saving ? 'שומר...' : 'שמירת נתוני אירוע והפקת חוזה'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default BookingForm;