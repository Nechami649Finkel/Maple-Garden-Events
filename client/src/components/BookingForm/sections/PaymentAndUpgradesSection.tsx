import React from 'react';
import { KOSHER_PRICING } from '../BookingForm';
import CheckCamera from '../../CheckCamera/CheckCamera';
import CheckDetailsForm from '../../CheckDetailsForm/CheckDetailsForm';
import type { DepositCheckDetails } from '../../../utils/checkOcr';
import { openContractPdf, printContract } from '../../../utils/contractPrint';

interface PaymentAndUpgradesSectionProps {
  formData: any;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  upgrades: Record<string, boolean>;
  handleUpgradeChange: (key: string) => void;
  isHallOnly: boolean;
  depositMethod: string;
  setDepositMethod: (method: string) => void;
  checkScanning: boolean;
  onCheckCapture: (imageSrc: string) => void | Promise<void>;
  onCheckFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onDeleteCheck: () => void;
  onCheckDetailsChange: (details: DepositCheckDetails) => void;
  totals: { base: number; discountVal: number; vatAmount: number; finalTotal: number };
  isFoodRelevant: boolean;
  kosherType: string;
  isEditMode: boolean;
  editId?: string;
  errors?: Record<string, string>;
  styles: Record<string, string>;
}

const PaymentAndUpgradesSection = ({
  formData,
  handleChange,
  upgrades,
  handleUpgradeChange,
  isHallOnly,
  depositMethod,
  setDepositMethod,
  checkScanning,
  onCheckCapture,
  onCheckFileUpload,
  onDeleteCheck,
  onCheckDetailsChange,
  totals,
  isFoodRelevant,
  kosherType,
  isEditMode,
  editId,
  errors,
  styles,
}: PaymentAndUpgradesSectionProps) => {
  const isCheckDeposit = depositMethod === 'check_upload' || depositMethod === 'check_capture';
  const hasCheckImage = !!formData.depositCheckUrl;

  return (
    <>
      <div className={styles.sectionCard}>
        <h3 className={styles.sectionHeader}>חבילת תוספות ושדרוגים</h3>
        <div className={styles.upgradesGrid}>
          <label className={`${styles.upgradeLabel} ${isHallOnly ? styles.upgradeLabelDisabled : ''}`}>
            <input type="checkbox" checked={isHallOnly ? false : upgrades.baseDesign} readOnly disabled={isHallOnly} />
            <span>עיצוב בסיסי {isHallOnly ? '(לא רלוונטי)' : '(חובה) - 4,500 ₪'}</span>
          </label>
          <label className={styles.upgradeLabel}>
            <input type="checkbox" checked={upgrades.amplification} onChange={() => handleUpgradeChange('amplification')} />
            <span>הגברה - 1,400 ₪</span>
          </label>
          <label className={styles.upgradeLabel}>
            <input type="checkbox" checked={upgrades.lighting} onChange={() => handleUpgradeChange('lighting')} />
            <span>תאורה - 1,800 ₪</span>
          </label>
          <label className={styles.upgradeLabel}>
            <input type="checkbox" checked={upgrades.screens} onChange={() => handleUpgradeChange('screens')} />
            <span>מסכים - 800 ₪</span>
          </label>
          <label className={styles.upgradeLabel}>
            <input type="checkbox" checked={upgrades.reception} onChange={() => handleUpgradeChange('reception')} />
            <span>קבלת פנים - 2,000 ₪</span>
          </label>
          <label className={styles.upgradeLabel}>
            <input type="checkbox" checked={upgrades.separateReception} onChange={() => handleUpgradeChange('separateReception')} />
            <span>קבלת פנים נפרדת - 3,000 ₪</span>
          </label>
          <label className={styles.upgradeLabel}>
            <input type="checkbox" checked={upgrades.extraSecurity} onChange={() => handleUpgradeChange('extraSecurity')} />
            <span>מאבטח פיצול כניסה - 650 ₪</span>
          </label>
          <label className={styles.upgradeLabel}>
            <input type="checkbox" checked={upgrades.fireworks} onChange={() => handleUpgradeChange('fireworks')} />
            <span>זיקוקים - 700 ₪</span>
          </label>
        </div>
      </div>

      <div className={styles.sectionCard}>
        <h3 className={styles.sectionHeader}>סיכום, פיקדון ותשלום</h3>

        {isHallOnly && (
          <div className={styles.inputGroup} style={{ backgroundColor: '#f0fdf4', padding: '15px', borderRadius: '8px', border: '1px solid #bbf7d0', marginBottom: '20px' }}>
            <label style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#166534' }}>מחיר השכרת אולם (₪) *</label>
            <input
              type="number"
              name="hallRentalPrice"
              value={formData.hallRentalPrice || ''}
              onChange={handleChange}
              className={`${styles.input} ${errors?.hallRentalPrice ? styles.inputError : ''}`}
              placeholder="הזן סכום לשכירות האולם (ללא אוכל)..."
              required={isHallOnly}
              min={1}
              step="any"
              style={{ fontSize: '1.1rem', fontWeight: 'bold' }}
            />
            {errors?.hallRentalPrice && (
              <span className={styles.errorMsg}>{errors.hallRentalPrice}</span>
            )}
          </div>
        )}

        <div className={styles.paymentGrid}>
          <div className={styles.inputGroup}>
            <label>הנחה כוללת (%)</label>
            <input type="number" name="discountPercent" value={formData.discountPercent} onChange={handleChange} className={styles.input} placeholder="0" />
          </div>
          <div className={styles.inputGroup}>
            <label>הנחה בשקלים (₪)</label>
            <input type="number" name="discountAmount" value={formData.discountAmount} onChange={handleChange} className={styles.input} placeholder="0" />
          </div>
          <div className={`${styles.inputGroup} ${styles.vatRow}`}>
            <label>הגדרת מע"מ (18%)</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input type="radio" name="vatType" value="not_included" checked={formData.vatType === 'not_included'} onChange={handleChange} />
                לא כולל מע"מ
              </label>
              <label className={styles.radioLabel}>
                <input type="radio" name="vatType" value="included" checked={formData.vatType === 'included'} onChange={handleChange} />
                כולל מע"מ
              </label>
            </div>
          </div>
        </div>

        <div className={styles.depositOptions}>
          <label className={styles.radioLabel}>
            <input type="radio" name="deposit" value="credit_card" checked={depositMethod === 'credit_card'} onChange={(e) => setDepositMethod(e.target.value)} />
            <span>תשלום באשראי / מזומן</span>
          </label>
          <label className={styles.radioLabel}>
            <input type="radio" name="deposit" value="check_upload" checked={depositMethod === 'check_upload'} onChange={(e) => setDepositMethod(e.target.value)} />
            <span>העלאת צילום צ'ק פיקדון</span>
          </label>
          <label className={`${styles.radioLabel} ${styles.depositHighlight}`}>
            <input type="radio" name="deposit" value="check_capture" checked={depositMethod === 'check_capture'} onChange={(e) => setDepositMethod(e.target.value)} />
            <span>📸 צילום צ'ק כעת</span>
          </label>
        </div>

        {isCheckDeposit && (
          <div className={styles.fileUploadBox} style={{ marginTop: '16px' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '10px' }}>תמונת צ'ק פיקדון</label>

            {depositMethod === 'check_capture' && !hasCheckImage && (
              <CheckCamera
                disabled={checkScanning}
                onCapture={onCheckCapture}
                onRetake={onDeleteCheck}
              />
            )}

            {(depositMethod === 'check_upload' || hasCheckImage) && (
              <div style={{ marginTop: depositMethod === 'check_capture' && hasCheckImage ? '12px' : 0 }}>
                {depositMethod === 'check_upload' && !hasCheckImage && (
                  <input type="file" accept="image/*" onChange={onCheckFileUpload} className={styles.input} />
                )}
                {hasCheckImage && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ צ'ק צולם/צורף בהצלחה</span>
                    <button type="button" onClick={onDeleteCheck} style={{ padding: '6px 12px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer' }}>
                      🗑️ מחק
                    </button>
                  </div>
                )}
              </div>
            )}

            {(hasCheckImage || formData.depositCheckDetails) && (
              <CheckDetailsForm
                details={formData.depositCheckDetails || {}}
                imageUrl={formData.depositCheckUrl || undefined}
                scanning={checkScanning}
                onChange={onCheckDetailsChange}
                styles={styles}
              />
            )}
          </div>
        )}

        <div className={styles.inputGroup}>
          <label>תנאי תשלום והסדרים מול הלקוח</label>
          <textarea name="paymentTerms" value={formData.paymentTerms} onChange={handleChange} className={styles.input} rows={2} placeholder="פירוט תנאי התשלום שסוכמו..."></textarea>
        </div>

        {isEditMode && formData.clientSignatureUrl && editId && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '15px' }}>
            <button
              type="button"
              onClick={() => openContractPdf(editId)}
              className={styles.viewContractBtn}
              style={{ backgroundColor: '#059669', color: 'white', padding: '10px 14px', borderRadius: '5px', border: 'none', cursor: 'pointer' }}
            >
              צפייה בחוזה החתום
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await printContract(editId);
                } catch {
                  alert('לא הצלחנו להדפיס את החוזה. ודאי שמדפסת מחוברת ונסי שוב.');
                }
              }}
              className={styles.viewContractBtn}
              style={{ backgroundColor: '#1d4ed8', color: 'white', padding: '10px 14px', borderRadius: '5px', border: 'none', cursor: 'pointer' }}
            >
              הדפסת חוזה
            </button>
          </div>
        )}

        <div className={styles.totalsBox}>
          <h4 className={styles.totalsTitle}>סה"כ הצעה / לתשלום</h4>
          <div className={styles.totalsBreakdown}>
            <span>סה"כ ביניים: ₪{totals.base.toLocaleString()}</span>
            {totals.discountVal > 0 && <span className={styles.discountLine}>הנחות: -₪{totals.discountVal.toLocaleString()}</span>}
            {totals.vatAmount > 0 && <span>תוספת מע"מ: ₪{totals.vatAmount.toLocaleString()}</span>}
          </div>
          <p className={styles.totalsFinal}>₪ {totals.finalTotal.toLocaleString()}</p>
          {isFoodRelevant && formData.guestCount && (
            <p className={styles.totalsNote}>
              כולל {formData.guestCount} מנות בתשלום
              {formData.optionalGuestCount ? ` + ${formData.optionalGuestCount} רזרבה (ללא חיוב)` : ''}, שדרוגים וכשרות {KOSHER_PRICING[kosherType].label}
            </p>
          )}
        </div>
      </div>
    </>
  );
};

export default PaymentAndUpgradesSection;
