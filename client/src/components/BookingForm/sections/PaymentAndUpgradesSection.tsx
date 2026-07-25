import { useState } from 'react';

import CheckCamera from '../../CheckCamera/CheckCamera';

import CheckDetailsForm from '../../CheckDetailsForm/CheckDetailsForm';

import type { DepositCheckDetails } from '../../../utils/checkOcr';

import { openContractPdf, printContract } from '../../../utils/contractPrint';

import type { PaymentTermsTemplate } from '../../../utils/paymentTerms';
import type { BookingFormData } from '../bookingFormTypes';

import { useTranslation } from '../../../i18n/useTranslation';

import { formatNumber } from '@shared/i18n/formatters';



interface PaymentAndUpgradesSectionProps {
  formData: BookingFormData;

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

  const { t, T, locale } = useTranslation();

  const [editingCustomPayment, setEditingCustomPayment] = useState(false);

  const [customDraft, setCustomDraft] = useState('');



  const fmt = (value: number) => formatNumber(value, locale);



  const openCustomEditor = () => {

    setCustomDraft(paymentTermsCustom ? paymentTermsText : '');

    setEditingCustomPayment(true);

  };



  const saveCustomPayment = () => {

    const text = customDraft.trim();

    if (!text) {

      alert(t(T.BOOKING.VALIDATION.CUSTOM_PAYMENT_REQUIRED));

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

      <div className="card-header maple-section-header">{t(T.BOOKING.PAYMENT.SECTION_TITLE)}</div>

      <div className="card-body">

          {!isOption && easycountMeta && (

            <div className={`alert ${easycountMeta.canIssueRealDocuments ? 'alert-success' : 'alert-warning'} mb-3`}>

              <strong>EZCount:</strong> {easycountMeta.label || t(T.BOOKING.PAYMENT.EZCOUNT_SIMULATION)}

              {!easycountMeta.canIssueRealDocuments && (

                <span>{t(T.BOOKING.PAYMENT.EZCOUNT_SIMULATION_NOTE)}</span>

              )}

            </div>

          )}



          {!isOption && (

            <div className="mb-3">

              <label className="form-label fw-semibold">{t(T.BOOKING.PAYMENT.ADVANCE_AMOUNT)}</label>

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

              <div className="form-text">{t(T.BOOKING.PAYMENT.ADVANCE_RECEIPT_HINT)}</div>

            </div>

          )}



          {isHallOnly && (

            <div className="p-3 mb-3 rounded border border-success bg-success-subtle">

              <label className="form-label fw-bold text-success">

                {isOption ? t(T.BOOKING.PAYMENT.HALL_RENTAL_PRICE) : t(T.BOOKING.PAYMENT.HALL_RENTAL_PRICE_REQUIRED)}

              </label>

              <input

                type="number"

                name="hallRentalPrice"

                value={formData.hallRentalPrice || ''}

                onChange={handleChange}

                className={`form-control form-control-lg fw-bold ${errors?.hallRentalPrice ? 'is-invalid' : ''}`}

                placeholder={t(T.BOOKING.PAYMENT.HALL_RENTAL_PLACEHOLDER)}

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

              <label className="form-label">{t(T.BOOKING.PAYMENT.DISCOUNT_PERCENT)}</label>

              <input type="number" name="discountPercent" value={formData.discountPercent} onChange={handleChange} className="form-control" placeholder="0" />

            </div>

            <div className="col-md-4">

              <label className="form-label">{t(T.BOOKING.PAYMENT.DISCOUNT_AMOUNT)}</label>

              <input type="number" name="discountAmount" value={formData.discountAmount} onChange={handleChange} className="form-control" placeholder="0" />

            </div>

            <div className="col-md-4">

              <label className="form-label">{t(T.BOOKING.PAYMENT.VAT_SETTING, { vatRate })}</label>

              <div className="d-flex flex-wrap gap-3 mt-1">

                <div className="form-check">

                  <input type="radio" className="form-check-input" name="vatType" id="vat-not-included" value="not_included" checked={formData.vatType === 'not_included'} onChange={handleChange} />

                  <label className="form-check-label" htmlFor="vat-not-included">{t(T.BOOKING.PAYMENT.VAT_NOT_INCLUDED)}</label>

                </div>

                <div className="form-check">

                  <input type="radio" className="form-check-input" name="vatType" id="vat-included" value="included" checked={formData.vatType === 'included'} onChange={handleChange} />

                  <label className="form-check-label" htmlFor="vat-included">{t(T.BOOKING.PAYMENT.VAT_INCLUDED)}</label>

                </div>

              </div>

            </div>

          </div>



          <div className="d-flex flex-wrap gap-3 mb-3">

            <div className="form-check">

              <input type="radio" className="form-check-input" name="deposit" id="deposit-credit" value="credit_card" checked={depositMethod === 'credit_card'} onChange={(e) => setDepositMethod(e.target.value)} />

              <label className="form-check-label" htmlFor="deposit-credit">{t(T.BOOKING.PAYMENT.DEPOSIT_CREDIT)}</label>

            </div>

            <div className="form-check">

              <input type="radio" className="form-check-input" name="deposit" id="deposit-upload" value="check_upload" checked={depositMethod === 'check_upload'} onChange={(e) => setDepositMethod(e.target.value)} />

              <label className="form-check-label" htmlFor="deposit-upload">{t(T.BOOKING.PAYMENT.DEPOSIT_CHECK_UPLOAD)}</label>

            </div>

            <div className="form-check">

              <input type="radio" className="form-check-input" name="deposit" id="deposit-capture" value="check_capture" checked={depositMethod === 'check_capture'} onChange={(e) => setDepositMethod(e.target.value)} />

              <label className="form-check-label fw-semibold" htmlFor="deposit-capture">{t(T.BOOKING.PAYMENT.DEPOSIT_CHECK_CAPTURE)}</label>

            </div>

          </div>



          {isCheckDeposit && (

            <div className="border rounded p-3 mb-3">

              <label className="form-label fw-semibold">{t(T.BOOKING.PAYMENT.CHECK_IMAGE)}</label>



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

                      <span className="text-success fw-semibold">{t(T.BOOKING.PAYMENT.CHECK_SUCCESS)}</span>

                      <button type="button" onClick={onDeleteCheck} className="btn btn-sm btn-outline-danger">

                        {t(T.BOOKING.PAYMENT.CHECK_DELETE)}

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

            <label className="form-label fw-bold">{t(T.BOOKING.PAYMENT.PAYMENT_TERMS)}</label>

            <select

              className="form-select"

              value={paymentTemplateId}

              onChange={(e) => {

                onPaymentTermsCustomChange(false);

                setEditingCustomPayment(false);

                onPaymentTemplateChange(e.target.value);

              }}

            >

              {paymentTemplates.map((template) => (

                <option key={template.id} value={template.id}>{template.name}</option>

              ))}

            </select>



            <div className="d-flex align-items-center gap-2 flex-wrap mt-2">

              <span className="text-dark fw-medium">{t(T.BOOKING.PAYMENT.CUSTOM_TERMS_LABEL)}</span>

              <button

                type="button"

                onClick={openCustomEditor}

                title={t(T.BOOKING.PAYMENT.CUSTOM_TERMS_EDIT_ARIA)}

                aria-label={t(T.BOOKING.PAYMENT.CUSTOM_TERMS_EDIT_ARIA)}

                className={`btn btn-sm ${paymentTermsCustom ? 'btn-primary' : 'btn-outline-primary'}`}

              >

                ✏️

              </button>

              {paymentTermsCustom && (

                <span className="badge text-bg-success">{t(T.BOOKING.PAYMENT.CUSTOM_TERMS_SAVED_BADGE)}</span>

              )}

            </div>



            {editingCustomPayment && (

              <div className="border border-primary rounded p-3 mt-2 bg-white">

                <label className="form-label fw-semibold">

                  {t(T.BOOKING.PAYMENT.CUSTOM_TERMS_EDITOR_LABEL)}

                </label>

                <textarea

                  className="form-control"

                  rows={4}

                  value={customDraft}

                  onChange={(e) => setCustomDraft(e.target.value)}

                  placeholder={t(T.BOOKING.PAYMENT.CUSTOM_TERMS_PLACEHOLDER)}

                  autoFocus

                />

                <div className="d-flex gap-2 mt-2">

                  <button type="button" onClick={saveCustomPayment} className="btn btn-primary btn-sm">

                    {t(T.BOOKING.PAYMENT.CUSTOM_TERMS_SAVE)}

                  </button>

                  <button type="button" onClick={cancelCustomEditor} className="btn btn-outline-secondary btn-sm">

                    {t(T.BOOKING.PAYMENT.CUSTOM_TERMS_CANCEL)}

                  </button>

                </div>

              </div>

            )}



            <div className={`p-3 mt-2 rounded border ${paymentTermsCustom ? 'border-success bg-success-subtle text-success' : 'border-info bg-info-subtle text-info-emphasis'}`}>

              <strong className="d-block mb-1">

                {paymentTermsCustom ? t(T.BOOKING.PAYMENT.PREVIEW_CUSTOM) : t(T.BOOKING.PAYMENT.PREVIEW_TEMPLATE)}

              </strong>

              {paymentTermsText || t(T.BOOKING.PAYMENT.PREVIEW_EMPTY)}

              {eventDate && !paymentTermsCustom && (

                <div className="small mt-1">{t(T.BOOKING.PAYMENT.PREVIEW_EVENT_DATE, { eventDate })}</div>

              )}

            </div>

          </div>



          {isEditMode && editId && (

            <div className="d-flex gap-2 flex-wrap mb-3">

              <button type="button" onClick={() => void openContractPdf(editId, t)} className="btn btn-success">

                {t(T.BOOKING.PAYMENT.VIEW_CONTRACT)}

              </button>

              <button

                type="button"

                onClick={async () => {

                  try {

                    await printContract(editId, t);

                  } catch (e) {

                    alert(e instanceof Error ? e.message : t(T.BOOKING.PAYMENT.PRINT_FAILED));

                  }

                }}

                className="btn btn-primary"

              >

                {t(T.BOOKING.PAYMENT.PRINT_CONTRACT)}

              </button>

            </div>

          )}



          <div className="maple-price-summary p-3">

            <h5 className="mb-3">{t(T.BOOKING.PAYMENT.SUMMARY_TITLE)}</h5>



            <div className="mb-3">

              <strong className="d-block mb-1">{t(T.BOOKING.PAYMENT.BASE_PAYMENT)}</strong>

              <div className="d-flex flex-column gap-1 small">

                <span>{t(T.BOOKING.PAYMENT.SUBTOTAL, { amount: fmt(totals.mainBase) })}</span>

                {totals.discountVal > 0 && <span className="text-danger">{t(T.BOOKING.PAYMENT.DISCOUNTS, { amount: fmt(totals.discountVal) })}</span>}

                {totals.mainVat > 0 && <span>{t(T.BOOKING.PAYMENT.VAT, { amount: fmt(totals.mainVat) })}</span>}

                <span className="fw-bold">₪{fmt(totals.baseTotal)}</span>

              </div>

            </div>



            <div className="mb-3">

              <strong className="d-block mb-1">{t(T.BOOKING.PAYMENT.HALL_EXTRAS)}</strong>

              <div className="d-flex flex-column gap-1 small">

                <span>{t(T.BOOKING.PAYMENT.HALL_EXTRAS_LINE, { amount: fmt(totals.hallExtrasBase) })}</span>

                {totals.hallExtrasVat > 0 && <span>{t(T.BOOKING.PAYMENT.VAT, { amount: fmt(totals.hallExtrasVat) })}</span>}

                <span className="fw-bold">₪{fmt(totals.hallExtrasTotal)}</span>

              </div>

            </div>



            {totals.externalExtrasBase > 0 && (

              <div className="mb-3">

                <strong className="d-block mb-1">{t(T.BOOKING.PAYMENT.EXTERNAL_PAYMENT)}</strong>

                <div className="d-flex flex-column gap-1 small">

                  <span>{t(T.BOOKING.PAYMENT.UPGRADES_LINE, { amount: fmt(totals.externalExtrasBase) })}</span>

                  {totals.externalExtrasVat > 0 && <span>{t(T.BOOKING.PAYMENT.VAT, { amount: fmt(totals.externalExtrasVat) })}</span>}

                  <span className="fw-bold">₪{fmt(totals.externalExtrasTotal)}</span>

                  <span className="text-muted">{t(T.BOOKING.PAYMENT.EXTERNAL_NOTE)}</span>

                </div>

              </div>

            )}



            <p className="fs-5 fw-bold mb-1">{t(T.BOOKING.PAYMENT.TOTAL_OFFER, { amount: fmt(totals.finalTotal) })}</p>

            {isFoodRelevant && formData.guestCount && (

              <p className="small text-muted mb-0">

                {formData.optionalGuestCount

                  ? t(T.BOOKING.PAYMENT.PORTIONS_SUMMARY_WITH_RESERVE, {

                      count: formData.guestCount,

                      extra: formData.optionalGuestCount,

                    })

                  : t(T.BOOKING.PAYMENT.PORTIONS_SUMMARY, { count: formData.guestCount })}

              </p>

            )}

          </div>

        </div>

      </div>

  );

};



export default PaymentAndUpgradesSection;


