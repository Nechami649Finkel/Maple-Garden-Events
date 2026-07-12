import React, { useState } from 'react';
import {
  UPGRADE_DISPLAY_ORDER,
  UPGRADE_LABELS,
  HALL_UPGRADE_KEYS,
  type UpgradeKey,
} from '../../../utils/pricing';
import { EXTERNAL_SUPPLIER_LINKS } from '../BookingForm';
import CheckCamera from '../../CheckCamera/CheckCamera';
import CheckDetailsForm from '../../CheckDetailsForm/CheckDetailsForm';
import type { DepositCheckDetails } from '../../../utils/checkOcr';
import { openContractPdf, printContract } from '../../../utils/contractPrint';

import type { PaymentTermsTemplate } from '../../../utils/paymentTerms';

interface PaymentAndUpgradesSectionProps {
  formData: any;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  upgrades: Record<string, boolean>;
  handleUpgradeChange: (key: string) => void;
  upgradesPricing: Record<string, number>;
  upgradeDisplayOrder?: readonly UpgradeKey[];
  isHallOnly: boolean;
  isOption?: boolean;
  depositMethod: string;
  setDepositMethod: (method: string) => void;
  checkScanning: boolean;
  onCheckCapture: (imageSrc: string) => void | Promise<void>;
  onCheckFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onDeleteCheck: () => void;
  onCheckDetailsChange: (details: DepositCheckDetails) => void;
  totals: {
    mainBase: number;
    hallExtrasBase: number;
    externalExtrasBase: number;
    discountVal: number;
    mainVat: number;
    hallExtrasVat: number;
    externalExtrasVat: number;
    baseTotal: number;
    hallExtrasTotal: number;
    externalExtrasTotal: number;
    hallTotal: number;
    finalTotal: number;
  };
  isFoodRelevant: boolean;
  kosherType: string;
  isEditMode: boolean;
  editId?: string;
  errors?: Record<string, string>;
  vatRate?: number;
  styles: Record<string, string>;
  paymentTemplates: PaymentTermsTemplate[];
  paymentTemplateId: string;
  onPaymentTemplateChange: (templateId: string) => void;
  paymentTermsCustom: boolean;
  onPaymentTermsCustomChange: (custom: boolean) => void;
  paymentTermsText: string;
  onPaymentTermsTextChange: (text: string) => void;
  eventDate?: string | null;
}

const externalLinkStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: '#1d4ed8',
  marginRight: '8px',
  textDecoration: 'underline',
};

const PaymentAndUpgradesSection = ({
  formData,
  handleChange,
  upgrades,
  handleUpgradeChange,
  upgradesPricing,
  upgradeDisplayOrder = UPGRADE_DISPLAY_ORDER,
  isHallOnly,
  isOption = false,
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
  vatRate = 17,
  styles,
  paymentTemplates,
  paymentTemplateId,
  onPaymentTemplateChange,
  paymentTermsCustom,
  onPaymentTermsCustomChange,
  paymentTermsText,
  onPaymentTermsTextChange,
  eventDate,
}: PaymentAndUpgradesSectionProps) => {
  const [editingCustomPayment, setEditingCustomPayment] = useState(false);
  const [customDraft, setCustomDraft] = useState('');

  const openCustomEditor = () => {
    setCustomDraft(paymentTermsCustom ? paymentTermsText : '');
    setEditingCustomPayment(true);
  };

  const saveCustomPayment = () => {
    const text = customDraft.trim();
    if (!text) {
      alert('יש להזין נוסח תשלום');
      return;
    }
    onPaymentTermsCustomChange(true);
    onPaymentTermsTextChange(text);
    setEditingCustomPayment(false);
  };

  const cancelCustomEditor = () => {
    setEditingCustomPayment(false);
    setCustomDraft('');
  };

  const isCheckDeposit = depositMethod === 'check_upload' || depositMethod === 'check_capture';
  const hasCheckImage = !!formData.depositCheckUrl;
  const isHallUpgrade = (key: string) => (HALL_UPGRADE_KEYS as readonly string[]).includes(key);

  const renderUpgrade = (key: UpgradeKey) => {
    const disabled = key === 'baseDesign' && isHallOnly;
    const checked = disabled ? false : upgrades[key];
    const isExternal = !isHallUpgrade(key);

    return (
      <label key={key} className={`${styles.upgradeLabel} ${disabled ? styles.upgradeLabelDisabled : ''}`}>
        <input
          type="checkbox"
          checked={checked}
          readOnly={key === 'baseDesign'}
          disabled={disabled}
          onChange={() => !disabled && handleUpgradeChange(key)}
        />
        <span>
          {UPGRADE_LABELS[key]}
          {key === 'baseDesign' && !isHallOnly ? ' (חובה)' : ''}
          {' - '}{(upgradesPricing[key] ?? 0).toLocaleString()} ₪
        </span>
        {isExternal && checked && !disabled && (
          <a
            href={EXTERNAL_SUPPLIER_LINKS[key]}
            target="_blank"
            rel="noopener noreferrer"
            style={externalLinkStyle}
            onClick={(e) => e.stopPropagation()}
          >
            תשלום לספק ↗
          </a>
        )}
      </label>
    );
  };

  return (
    <>
      <div className={styles.sectionCard}>
        <h3 className={styles.sectionHeader}>חבילת תוספות ושדרוגים</h3>
        <div className={styles.upgradesGrid}>
          {upgradeDisplayOrder.map(renderUpgrade)}
        </div>
      </div>

      <div className={styles.sectionCard}>
        <h3 className={styles.sectionHeader}>סיכום, פיקדון ותשלום</h3>

        {isHallOnly && (
          <div className={styles.inputGroup} style={{ backgroundColor: '#f0fdf4', padding: '15px', borderRadius: '8px', border: '1px solid #bbf7d0', marginBottom: '20px' }}>
            <label style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#166534' }}>מחיר השכרת אולם (₪){!isOption ? ' *' : ''}</label>
            <input
              type="number"
              name="hallRentalPrice"
              value={formData.hallRentalPrice || ''}
              onChange={handleChange}
              className={`${styles.input} ${errors?.hallRentalPrice ? styles.inputError : ''}`}
              placeholder="הזן סכום לשכירות האולם (ללא אוכל)..."
              required={isHallOnly && !isOption}
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
            <label>הגדרת מע"מ ({vatRate}%)</label>
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

        <div className={styles.inputGroup} style={{ marginTop: '16px' }}>
          <label style={{ fontWeight: 700 }}>תנאי תשלום לחוזה</label>
          <select
            className={styles.input}
            value={paymentTemplateId}
            onChange={(e) => {
              onPaymentTermsCustomChange(false);
              setEditingCustomPayment(false);
              onPaymentTemplateChange(e.target.value);
            }}
          >
            {paymentTemplates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginTop: '10px',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: '0.95rem', color: '#334155' }}>
              נוסח מותאם אישית לאירוע זה
            </span>
            <button
              type="button"
              onClick={openCustomEditor}
              title="עריכת נוסח מותאם לאירוע זה"
              aria-label="עריכת נוסח מותאם לאירוע זה"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                background: paymentTermsCustom ? '#dbeafe' : '#eff6ff',
                color: '#1d4ed8',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              ✏️
            </button>
            {paymentTermsCustom && (
              <span style={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>
                נוסח מותאם שמור לאירוע זה
              </span>
            )}
          </div>

          {editingCustomPayment && (
            <div
              style={{
                marginTop: '10px',
                padding: '12px',
                border: '2px solid #2563eb',
                borderRadius: '8px',
                background: '#fff',
              }}
            >
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>
                הקלידי נוסח תשלום ייחודי — יישמר רק לאירוע זה
              </label>
              <textarea
                className={styles.input}
                rows={4}
                value={customDraft}
                onChange={(e) => setCustomDraft(e.target.value)}
                placeholder="לדוגמה: 70% עד שבוע לפני האירוע, 30% בצ'ק לאחר האירוע..."
                autoFocus
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={saveCustomPayment}
                  style={{
                    background: '#059669',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  שמירה לאירוע זה
                </button>
                <button
                  type="button"
                  onClick={cancelCustomEditor}
                  style={{
                    background: '#fff',
                    color: '#64748b',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    cursor: 'pointer',
                  }}
                >
                  ביטול
                </button>
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: '10px',
              padding: '12px 14px',
              background: paymentTermsCustom ? '#ecfdf5' : '#f0f9ff',
              border: paymentTermsCustom ? '1px solid #86efac' : '1px solid #bae6fd',
              borderRadius: '8px',
              fontSize: '0.95rem',
              lineHeight: 1.7,
              color: paymentTermsCustom ? '#065f46' : '#0c4a6e',
            }}
          >
            <strong style={{ display: 'block', marginBottom: '6px' }}>
              {paymentTermsCustom ? 'נוסח שיופיע בחוזה (מותאם):' : 'תצוגה מקדימה — יופיע בחוזה:'}
            </strong>
            {paymentTermsText || 'בחרי תבנית או לחצי על העיפרון לנוסח מותאם'}
            {eventDate && !paymentTermsCustom && (
              <div style={{ fontSize: '12px', color: '#0369a1', marginTop: '6px' }}>
                מחושב לפי תאריך האירוע: {eventDate}
              </div>
            )}
          </div>
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
          <h4 className={styles.totalsTitle}>סיכום תשלומים</h4>

          <div className={styles.totalsBreakdown} style={{ marginBottom: '12px' }}>
            <strong>תשלום בסיסי (אירוע)</strong>
            <span>ביניים: ₪{totals.mainBase.toLocaleString()}</span>
            {totals.discountVal > 0 && <span className={styles.discountLine}>הנחות: -₪{totals.discountVal.toLocaleString()}</span>}
            {totals.mainVat > 0 && <span>מע"מ: ₪{totals.mainVat.toLocaleString()}</span>}
            <span style={{ fontWeight: 700 }}>₪{totals.baseTotal.toLocaleString()}</span>
          </div>

          <div className={styles.totalsBreakdown} style={{ marginBottom: '12px' }}>
            <strong>תשלום תוספות (לאולם)</strong>
            <span>כשרות + קבלת פנים + מאבטח: ₪{totals.hallExtrasBase.toLocaleString()}</span>
            {totals.hallExtrasVat > 0 && <span>מע"מ: ₪{totals.hallExtrasVat.toLocaleString()}</span>}
            <span style={{ fontWeight: 700 }}>₪{totals.hallExtrasTotal.toLocaleString()}</span>
          </div>

          {totals.externalExtrasBase > 0 && (
            <div className={styles.totalsBreakdown} style={{ marginBottom: '12px', opacity: 0.92 }}>
              <strong>ספקים חיצוניים — לידיעה בלבד</strong>
              <span>שדרוגים: ₪{totals.externalExtrasBase.toLocaleString()}</span>
              {totals.externalExtrasVat > 0 && <span>מע"מ: ₪{totals.externalExtrasVat.toLocaleString()}</span>}
              <span style={{ fontWeight: 700 }}>₪{totals.externalExtrasTotal.toLocaleString()}</span>
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                תשלום ישיר לספק — לא נכלל בחשבון האולם / Easy Count
              </span>
            </div>
          )}

          <p className={styles.totalsFinal}>סה&quot;כ לתשלום לאולם: ₪ {totals.hallTotal.toLocaleString()}</p>
          {isFoodRelevant && formData.guestCount && (
            <p className={styles.totalsNote}>
              {formData.guestCount} מנות בתשלום
              {formData.optionalGuestCount ? ` + ${formData.optionalGuestCount} רזרבה (ללא חיוב)` : ''}
            </p>
          )}
        </div>
      </div>
    </>
  );
};

export default PaymentAndUpgradesSection;
