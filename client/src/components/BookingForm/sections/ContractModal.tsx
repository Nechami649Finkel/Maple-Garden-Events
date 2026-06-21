import React, { useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { getSignatureDataUrl } from '../../../utils/signature';

interface ContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  isOption: boolean;
  sigCanvas: React.RefObject<SignatureCanvas | null>;
  setContractSigned: (signed: boolean) => void;
  onSignatureSaved?: (dataUrl: string) => void;
  contractText: string;
  onContractTextChange: (text: string) => void;
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
  styles,
}: ContractModalProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState('');

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
    <div className={styles?.menuOverlay || ''} style={{ 
      backgroundColor: 'rgba(0, 0, 0, 0.6)', 
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 10000 
    }}>
      <div style={{ 
        maxWidth: '850px', 
        width: '95%', 
        backgroundColor: '#fff', 
        borderRadius: '16px', 
        overflow: 'hidden', 
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        
        <div style={{ backgroundColor: '#f1f5f9', padding: '20px 30px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.5rem', fontWeight: 'bold' }}>{isOption ? 'הצעת מחיר וחוזה (אופציה)' : 'חוזה התקשרות לאירוע'}</h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.8rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
        </div>

        <div style={{ padding: '30px', direction: 'rtl', textAlign: 'right', overflowY: 'auto', flex: 1 }}>
          
          <div style={{ position: 'relative' }}>
            
            {isOption && !isEditing && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%) rotate(-45deg)',
                fontSize: '8rem',
                color: 'rgba(200, 200, 200, 0.25)',
                fontWeight: '900',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                zIndex: 10,
                userSelect: 'none'
              }}>
                טיוטה - דוגמא
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '1rem' }}>מלל החוזה לאירוע זה</span>
              {!isEditing ? (
                <button
                  type="button"
                  onClick={startEditing}
                  style={{
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    border: '1px solid #bfdbfe',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.9rem',
                  }}
                >
                  ✏️ עריכת מלל החוזה
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={saveEditing}
                    style={{
                      background: '#059669',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '600',
                    }}
                  >
                    שמירה
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    style={{
                      background: '#fff',
                      color: '#64748b',
                      border: '1px solid #cbd5e1',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '600',
                    }}
                  >
                    ביטול
                  </button>
                </div>
              )}
            </div>

            {isEditing ? (
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                style={{
                  width: '100%',
                  height: '400px',
                  padding: '20px',
                  marginBottom: '25px',
                  border: '2px solid #2563eb',
                  borderRadius: '12px',
                  color: '#334155',
                  lineHeight: '1.8',
                  fontSize: '1rem',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  direction: 'rtl',
                }}
              />
            ) : (
              <div style={{ 
                height: '400px', 
                overflowY: 'auto', 
                background: '#ffffff', 
                padding: '30px', 
                marginBottom: '25px', 
                border: '1px solid #cbd5e1', 
                borderRadius: '12px', 
                color: '#334155', 
                lineHeight: '1.8', 
                fontSize: '1rem',
                position: 'relative',
                zIndex: 1,
                whiteSpace: 'pre-wrap'
              }}>
                {contractText || 'טוען מלל חוזה...'}
              </div>
            )}
          </div>

          <div style={{ backgroundColor: '#f0f9ff', padding: '20px', borderRadius: '10px', marginBottom: '25px', border: '1px solid #bae6fd' }}>
            <p style={{ fontSize: '0.95rem', color: '#0369a1', margin: 0, fontWeight: '600' }}>
              בחתימתי אני מאשר/ת את נכונות הפרטים המופיעים בטופס הפקת אירוע זה. כמו כן, אני מצהיר/ה כי קראתי והבנתי את תנאי ההתקשרות והתקנון של גן אירועים מייפל, ואני מסכים/ה להם במלואם.
            </p>
          </div>
          
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <h4 style={{ marginBottom: '15px', color: '#1e293b', fontSize: '1.1rem' }}>חתימת הלקוח:</h4>
            <div style={{ 
              border: '2px solid #94a3b8', 
              background: '#f8fafc', 
              borderRadius: '12px', 
              display: 'inline-block',
              padding: '5px' 
            }}>
              <SignatureCanvas ref={sigCanvas} penColor="#0f172a" canvasProps={{ width: 700, height: 200, style: { cursor: 'crosshair' } }} />
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '30px', paddingBottom: '20px' }}>
            <button type="button" onClick={() => sigCanvas.current?.clear()} style={{ 
              background: '#fff', color: '#ef4444', border: '2px solid #ef4444', 
              padding: '12px 30px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' 
            }}>נקה חתימה 🗑️</button>
            
            <button type="button" onClick={() => {
                if (isEditing) {
                  alert('יש לשמור או לבטל את עריכת מלל החוזה לפני החתימה.');
                  return;
                }
                const dataUrl = getSignatureDataUrl(sigCanvas);
                if (!dataUrl) return alert('נא לחתום לפני האישור');
                onSignatureSaved?.(dataUrl);
                setContractSigned(true);
                onClose();
              }} 
              style={{ backgroundColor: '#059669', color: 'white', padding: '12px 40px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem' }}>
              אני מאשר/ת וחותם/ת ✓
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractModal;
