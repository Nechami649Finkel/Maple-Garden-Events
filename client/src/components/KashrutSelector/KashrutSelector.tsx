import React, { useState, useEffect } from 'react';
import './KashrutSelector.css';

interface Props {
  value?: string;
  onChange: (val: string) => void;
}

// הרשימה הקבועה שביקשת (הורדתי את "רובין" הכפול)
const KASHRUT_LIST = [
  "רובין",
  "מחפוד",
  "לנדא",
  "בדץ קהילות",
  "הרב גרוס",
  'בדץ ע"ח'
];

export default function KashrutSelector({ value, onChange }: Props) {
  const [certImage, setCertImage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    // משיכת התעודה (התעודה הראשונה שמוגדרת בהגדרות תהיה תקפה לכולם)
    fetch('http://localhost:5000/api/kashrut')
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0 && data[0].imageUrl) {
          setCertImage(data[0].imageUrl);
        }
      })
      .catch(err => console.error("שגיאה בטעינת תעודה:", err));
  }, []);

  useEffect(() => {
    setImageError(false);
  }, [certImage]);

  return (
    <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginTop: '10px' }}>
      <div style={{ flex: 1 }}>
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer' }}
        >
          <option value="">בחר כשרות...</option>
          {KASHRUT_LIST.map((kName, idx) => (
            <option key={idx} value={kName}>{kName}</option>
          ))}
        </select>
      </div>

      {/* תצוגת התעודה הכללית */}
      {certImage && !imageError ? (
        <div
          onClick={() => setIsModalOpen(true)}
          style={{
            cursor: 'pointer', border: '2px solid #e2e8f0', borderRadius: '6px',
            overflow: 'hidden', width: '50px', height: '50px'
          }}
          title="לחץ להגדלה"
        >
          <img
            src={certImage}
            alt="תעודת הכשר"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => setImageError(true)}
          />
        </div>
      ) : (
        <div style={{ width: '50px', height: '50px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#999', textAlign: 'center' }}>
          אין תמונה
        </div>
      )}

      {/* מודאל הגדלת תמונה */}
      {isModalOpen && certImage && (
        <div
          onClick={() => setIsModalOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            alignItems: 'center', zIndex: 9999, padding: '20px'
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <img
              src={certImage}
              alt="תעודת הכשר מוגדלת"
              style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '4px', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}
            />
            <button
              onClick={() => setIsModalOpen(false)}
              style={{ display: 'block', margin: '20px auto 0', padding: '10px 30px', borderRadius: '6px', border: 'none', background: 'white', fontWeight: 'bold', cursor: 'pointer' }}
            >
              סגור
            </button>
          </div>
        </div>
      )}
    </div>
  );
}