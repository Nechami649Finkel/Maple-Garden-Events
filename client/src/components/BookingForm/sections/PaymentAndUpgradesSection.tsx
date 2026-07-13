import React, { useState } from 'react';
import CheckCamera from '../../CheckCamera/CheckCamera';
import CheckDetailsForm from '../../CheckDetailsForm/CheckDetailsForm';
import type { DepositCheckDetails } from '../../../utils/checkOcr';
import { openContractPdf, printContract } from '../../../utils/contractPrint';
import type { PaymentTermsTemplate } from '../../../utils/paymentTerms';

interface PaymentAndUpgradesSectionProps {
  formData: any;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
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
  paymentTemplates: PaymentTermsTemplate[];
  paymentTemplateId: string;
  onPaymentTemplateChange: (templateId: string) => void;
  paymentTermsCustom: boolean;
  onPaymentTermsCustomChange: (custom: boolean) => void;
  paymentTermsText: string;
  onPaymentTermsTextChange: (text: string) => void;
  eventDate?: string | null;
  easycountMeta?: {
    mode?: string;
    label?: string;
    canIssueRealDocuments?: boolean;
  } | null;
}

const PaymentAndUpgradesSection = ({
  formData,
  handleChange,
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
  isEditMode,
  editId,
  errors,
  vatRate = 17,
  paymentTemplates,
  paymentTemplateId,
  onPaymentTemplateChange,
  paymentTermsCustom,
  onPaymentTermsCustomChange,
  paymentTermsText,
  onPaymentTermsTextChange,
  eventDate,
  easycountMeta,
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

  return (
    <div className="card mb-3">
      <div className="card-header maple-section-header">סיכום, פיקדון ותשלום</div>
      <div className="card-body">
          {!isOption && easycountMeta && (
            <div className={`alert ${easycountMeta.canIssueRealDocuments ? 'alert-success' : 'alert-warning'} mb-3`}>
              <strong>EZCount:</strong> {easycountMeta.label || 'סימולציה — לא מופקות קבלות אמיתיות'}
              {!easycountMeta.canIssueRealDocuments && (
                <span> · ניתן להזין מקדמה לתיעוד במערכת, בלי הפקת מסמך מס אמיתי.</span>
              )}
            </div>
          )}

          {!isOption && (
            <div className="mb-3">
              <label className="form-label fw-semibold">סכום מקדמה שנגבתה (₪)</label>
              <input
                type="number"
                name="advancePaid"
                value={formData.advancePaid ?? ''}
                onChange={handleChange}
                className="form-control"
                placeholder="0"
                min={0}
                step="any"
              />
              <div className="form-text">אם הוזן סכום — המערכת תייצר קבלה (בסימולציה עד חיבור EZCount).</div>
            </div>
          )}

          {isHallOnly && (
            <div className="p-3 mb-3 rounded border border-success bg-success-subtle">
              <label className="form-label fw-bold text-success">מחיר השכרת אולם (₪){!isOption ? ' *' : ''}</label>
              <input
                type="number"
                name="hallRentalPrice"
                value={formData.hallRentalPrice || ''}
                onChange={handleChange}
                className={`form-control form-control-lg fw-bold ${errors?.hallRentalPrice ? 'is-invalid' : ''}`}
                placeholder="הזן סכום לשכירות האולם (ללא אוכל)..."
                required={isHallOnly && !isOption}
                min={1}
                step="any"
              />
              {errors?.hallRentalPrice && (
                <div className="invalid-feedback">{errors.hallRentalPrice}</div>
              )}
            </div>
          )}

          <div className="row g-3 mb-3">
            <div className="col-md-4">
              <label className="form-label">הנחה כוללת (%)</label>
              <input type="number" name="discountPercent" value={formData.discountPercent} onChange={handleChange} className="form-control" placeholder="0" />
            </div>
            <div className="col-md-4">
              <label className="form-label">הנחה בשקלים (₪)</label>
              <input type="number" name="discountAmount" value={formData.discountAmount} onChange={handleChange} className="form-control" placeholder="0" />
            </div>
            <div className="col-md-4">
              <label className="form-label">הגדרת מע&quot;מ ({vatRate}%)</label>
              <div className="d-flex flex-wrap gap-3 mt-1">
                <div className="form-check">
                  <input type="radio" className="form-check-input" name="vatType" id="vat-not-included" value="not_included" checked={formData.vatType === 'not_included'} onChange={handleChange} />
                  <label className="form-check-label" htmlFor="vat-not-included">לא כולל מע&quot;מ</label>
                </div>
                <div className="form-check">
                  <input type="radio" className="form-check-input" name="vatType" id="vat-included" value="included" checked={formData.vatType === 'included'} onChange={handleChange} />
                  <label className="form-check-label" htmlFor="vat-included">כולל מע&quot;מ</label>
                </div>
              </div>
            </div>
          </div>

          <div className="d-flex flex-wrap gap-3 mb-3">
            <div className="form-check">
              <input type="radio" className="form-check-input" name="deposit" id="deposit-credit" value="credit_card" checked={depositMethod === 'credit_card'} onChange={(e) => setDepositMethod(e.target.value)} />
              <label className="form-check-label" htmlFor="deposit-credit">תשלום באשראי / מזומן</label>
            </div>
            <div className="form-check">
              <input type="radio" className="form-check-input" name="deposit" id="deposit-upload" value="check_upload" checked={depositMethod === 'check_upload'} onChange={(e) => setDepositMethod(e.target.value)} />
              <label className="form-check-label" htmlFor="deposit-upload">העלאת צילום צ&apos;ק פיקדון</label>
            </div>
            <div className="form-check">
              <input type="radio" className="form-check-input" name="deposit" id="deposit-capture" value="check_capture" checked={depositMethod === 'check_capture'} onChange={(e) => setDepositMethod(e.target.value)} />
              <label className="form-check-label fw-semibold" htmlFor="deposit-capture">📸 צילום צ&apos;ק כעת</label>
            </div>
          </div>

          {isCheckDeposit && (
            <div className="border rounded p-3 mb-3">
              <label className="form-label fw-semibold">תמונת צ&apos;ק פיקדון</label>

              {depositMethod === 'check_capture' && !hasCheckImage && (
                <CheckCamera
                  disabled={checkScanning}
                  onCapture={onCheckCapture}
                  onRetake={onDeleteCheck}
                />
              )}

              {(depositMethod === 'check_upload' || hasCheckImage) && (
                <div className={depositMethod === 'check_capture' && hasCheckImage ? 'mt-3' : ''}>
                  {depositMethod === 'check_upload' && !hasCheckImage && (
                    <input type="file" accept="image/*" onChange={onCheckFileUpload} className="form-control" />
                  )}
                  {hasCheckImage && (
                    <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
                      <span className="text-success fw-semibold">✓ צ&apos;ק צולם/צורף בהצלחה</span>
                      <button type="button" onClick={onDeleteCheck} className="btn btn-sm btn-outline-danger">
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
                />
              )}
            </div>
          )}

          <div className="mb-3">
            <label className="form-label fw-bold">תנאי תשלום לחוזה</label>
            <select
              className="form-select"
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

            <div className="d-flex align-items-center gap-2 flex-wrap mt-2">
              <span className="text-secondary">נוסח מותאם אישית לאירוע זה</span>
              <button
                type="button"
                onClick={openCustomEditor}
                title="עריכת נוסח מותאם לאירוע זה"
                aria-label="עריכת נוסח מותאם לאירוע זה"
                className={`btn btn-sm ${paymentTermsCustom ? 'btn-primary' : 'btn-outline-primary'}`}
              >
                ✏️
              </button>
              {paymentTermsCustom && (
                <span className="badge text-bg-success">נוסח מותאם שמור לאירוע זה</span>
              )}
            </div>

            {editingCustomPayment && (
              <div className="border border-primary rounded p-3 mt-2 bg-white">
                <label className="form-label fw-semibold">
                  הקלידי נוסח תשלום ייחודי — יישמר רק לאירוע זה
                </label>
                <textarea
                  className="form-control"
                  rows={4}
                  value={customDraft}
                  onChange={(e) => setCustomDraft(e.target.value)}
                  placeholder="לדוגמה: 70% עד שבוע לפני האירוע, 30% בצ'ק לאחר האירוע..."
                  autoFocus
                />
                <div className="d-flex gap-2 mt-2">
                  <button type="button" onClick={saveCustomPayment} className="btn btn-primary btn-sm">
                    שמירה לאירוע זה
                  </button>
                  <button type="button" onClick={cancelCustomEditor} className="btn btn-outline-secondary btn-sm">
                    ביטול
                  </button>
                </div>
              </div>
            )}

            <div className={`p-3 mt-2 rounded border ${paymentTermsCustom ? 'border-success bg-success-subtle text-success' : 'border-info bg-info-subtle text-info-emphasis'}`}>
              <strong className="d-block mb-1">
                {paymentTermsCustom ? 'נוסח שיופיע בחוזה (מותאם):' : 'תצוגה מקדימה — יופיע בחוזה:'}
              </strong>
              {paymentTermsText || 'בחרי תבנית או לחצי על העיפרון לנוסח מותאם'}
              {eventDate && !paymentTermsCustom && (
                <div className="small mt-1">מחושב לפי תאריך האירוע: {eventDate}</div>
              )}
            </div>
          </div>

          {isEditMode && editId && (
            <div className="d-flex gap-2 flex-wrap mb-3">
              <button type="button" onClick={() => void openContractPdf(editId)} className="btn btn-success">
                צפייה בחוזה
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await printContract(editId);
                  } catch (e) {
                    alert(e instanceof Error ? e.message : 'לא הצלחנו להדפיס את החוזה. ודאי שמדפסת מחוברת ונסי שוב.');
                  }
                }}
                className="btn btn-primary"
              >
                הדפסת חוזה
              </button>
            </div>
          )}

          <div className="maple-price-summary p-3">
            <h5 className="mb-3">סיכום תשלומים</h5>

            <div className="mb-3">
              <strong className="d-block mb-1">תשלום בסיסי (אירוע)</strong>
              <div className="d-flex flex-column gap-1 small">
                <span>ביניים: ₪{totals.mainBase.toLocaleString()}</span>
                {totals.discountVal > 0 && <span className="text-danger">הנחות: -₪{totals.discountVal.toLocaleString()}</span>}
                {totals.mainVat > 0 && <span>מע&quot;מ: ₪{totals.mainVat.toLocaleString()}</span>}
                <span className="fw-bold">₪{totals.baseTotal.toLocaleString()}</span>
              </div>
            </div>

            <div className="mb-3">
              <strong className="d-block mb-1">תשלום תוספות (לאולם)</strong>
              <div className="d-flex flex-column gap-1 small">
                <span>כשרות + קבלת פנים + מאבטח: ₪{totals.hallExtrasBase.toLocaleString()}</span>
                {totals.hallExtrasVat > 0 && <span>מע&quot;מ: ₪{totals.hallExtrasVat.toLocaleString()}</span>}
                <span className="fw-bold">₪{totals.hallExtrasTotal.toLocaleString()}</span>
              </div>
            </div>

            {totals.externalExtrasBase > 0 && (
              <div className="mb-3">
                <strong className="d-block mb-1">תשלום לספקים חיצוניים</strong>
                <div className="d-flex flex-column gap-1 small">
                  <span>שדרוגים: ₪{totals.externalExtrasBase.toLocaleString()}</span>
                  {totals.externalExtrasVat > 0 && <span>מע&quot;מ: ₪{totals.externalExtrasVat.toLocaleString()}</span>}
                  <span className="fw-bold">₪{totals.externalExtrasTotal.toLocaleString()}</span>
                  <span className="text-muted">תשלום ישיר לספק — לא כולל בצ&apos;ק לאולם</span>
                </div>
              </div>
            )}

            <p className="fs-5 fw-bold mb-1">סה&quot;כ הצעה: ₪ {totals.finalTotal.toLocaleString()}</p>
            {isFoodRelevant && formData.guestCount && (
              <p className="small text-muted mb-0">
                {formData.guestCount} מנות בתשלום
                {formData.optionalGuestCount ? ` + ${formData.optionalGuestCount} רזרבה (ללא חיוב)` : ''}
              </p>
            )}
          </div>
        </div>
      </div>
  );
};

export default PaymentAndUpgradesSection;
