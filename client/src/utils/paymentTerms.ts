import { T, type TranslationKey } from '@shared/i18n/keys';

export type PaymentDueType = 'WEEK_BEFORE_EVENT' | 'HOURS_24_AFTER_EVENT';

export interface PaymentInstallment {
  percent: number;
  dueType: PaymentDueType;
}

export interface PaymentTermsTemplate {
  id: string;
  name: string;
  bodyTemplate: string;
  installments: PaymentInstallment[];
}

export const LEGACY_PAYMENT_SENTENCE =
  'תשלום עבור האירוע יתבצע לא יאוחר מ-24 שעות לאחר האירוע.';

export const PAYMENT_TERMS_PLACEHOLDER = '{{PAYMENT_TERMS}}';

export const DEFAULT_PAYMENT_TEMPLATE_ID = '50-50';

export const PAYMENT_TEMPLATE_I18N_KEYS: Record<
  string,
  { name: TranslationKey; body: TranslationKey }
> = {
  'full-before-week': {
    name: T.PAYMENT_TERMS.FULL_BEFORE_WEEK_NAME,
    body: T.PAYMENT_TERMS.FULL_BEFORE_WEEK_BODY,
  },
  '50-50': {
    name: T.PAYMENT_TERMS.SPLIT_50_50_NAME,
    body: T.PAYMENT_TERMS.SPLIT_BODY,
  },
  '70-30': {
    name: T.PAYMENT_TERMS.SPLIT_70_30_NAME,
    body: T.PAYMENT_TERMS.SPLIT_BODY,
  },
  'full-after-24h': {
    name: T.PAYMENT_TERMS.FULL_AFTER_NAME,
    body: T.PAYMENT_TERMS.FULL_AFTER_BODY,
  },
};

export function getLocalizedPaymentTemplateDisplay(
  translate: (key: TranslationKey) => string,
  template: PaymentTermsTemplate,
): Pick<PaymentTermsTemplate, 'name' | 'bodyTemplate'> {
  const keys = PAYMENT_TEMPLATE_I18N_KEYS[template.id];
  if (!keys) {
    return { name: template.name, bodyTemplate: template.bodyTemplate };
  }
  return {
    name: translate(keys.name),
    bodyTemplate: translate(keys.body),
  };
}

export const DEFAULT_PAYMENT_TEMPLATES: PaymentTermsTemplate[] = [
  {
    id: 'full-before-week',
    name: '100% עד שבוע לפני האירוע',
    installments: [{ percent: 100, dueType: 'WEEK_BEFORE_EVENT' }],
    bodyTemplate:
      'תשלום עבור האירוע{{TOTAL_PART}} ישולם במלואו לא יאוחר מ-7 ימים לפני מועד האירוע{{DUE_1}}.',
  },
  {
    id: '50-50',
    name: '50% שבוע לפני · 50% עד 24 שעות אחרי',
    installments: [
      { percent: 50, dueType: 'WEEK_BEFORE_EVENT' },
      { percent: 50, dueType: 'HOURS_24_AFTER_EVENT' },
    ],
    bodyTemplate:
      'תשלום עבור האירוע{{TOTAL_PART}} יבוצע בשני שלבים: {{PERCENT_1}}%{{AMOUNT_1_PART}} לא יאוחר מ-7 ימים לפני האירוע{{DUE_1}}, ויתרת {{PERCENT_2}}%{{AMOUNT_2_PART}} לא יאוחר מ-24 שעות לאחר סיום האירוע.',
  },
  {
    id: '70-30',
    name: '70% שבוע לפני · 30% עד 24 שעות אחרי',
    installments: [
      { percent: 70, dueType: 'WEEK_BEFORE_EVENT' },
      { percent: 30, dueType: 'HOURS_24_AFTER_EVENT' },
    ],
    bodyTemplate:
      'תשלום עבור האירוע{{TOTAL_PART}} יבוצע בשני שלבים: {{PERCENT_1}}%{{AMOUNT_1_PART}} לא יאוחר מ-7 ימים לפני האירוע{{DUE_1}}, ויתרת {{PERCENT_2}}%{{AMOUNT_2_PART}} לא יאוחר מ-24 שעות לאחר סיום האירוע.',
  },
  {
    id: 'full-after-24h',
    name: 'מלא עד 24 שעות לאחר האירוע',
    installments: [{ percent: 100, dueType: 'HOURS_24_AFTER_EVENT' }],
    bodyTemplate:
      'תשלום עבור האירוע{{TOTAL_PART}} יתבצע לא יאוחר מ-24 שעות לאחר סיום האירוע.',
  },
];

function parseTemplates(raw: unknown): PaymentTermsTemplate[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_PAYMENT_TEMPLATES;
  return raw.filter(
    (t): t is PaymentTermsTemplate =>
      !!t
      && typeof t === 'object'
      && typeof (t as PaymentTermsTemplate).id === 'string'
      && typeof (t as PaymentTermsTemplate).name === 'string'
      && typeof (t as PaymentTermsTemplate).bodyTemplate === 'string'
      && Array.isArray((t as PaymentTermsTemplate).installments),
  );
}

export function getPaymentTemplatesFromSettings(settings?: {
  paymentTemplates?: unknown;
  defaultPaymentTemplateId?: string | null;
} | null): {
  templates: PaymentTermsTemplate[];
  defaultTemplateId: string;
} {
  const templates = parseTemplates(settings?.paymentTemplates);
  const defaultTemplateId =
    settings?.defaultPaymentTemplateId
    && templates.some((t) => t.id === settings.defaultPaymentTemplateId)
      ? settings.defaultPaymentTemplateId
      : DEFAULT_PAYMENT_TEMPLATE_ID;

  return { templates, defaultTemplateId };
}

export function findPaymentTemplate(
  templates: PaymentTermsTemplate[],
  templateId?: string | null,
): PaymentTermsTemplate | undefined {
  if (!templateId) return undefined;
  return templates.find((t) => t.id === templateId);
}

function formatMoney(amount: number): string {
  return Math.round(amount).toLocaleString('he-IL');
}

function formatHebrewDate(date: Date): string {
  return date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function weekBeforeEvent(eventDate: Date): Date {
  const d = new Date(eventDate);
  d.setDate(d.getDate() - 7);
  return d;
}

export interface PaymentTermsRenderContext {
  total?: number;
  eventDate?: Date | string | null;
}

export function renderPaymentTermsText(
  template: PaymentTermsTemplate,
  ctx: PaymentTermsRenderContext,
): string {
  const total = Number(ctx.total) || 0;
  const eventDate = ctx.eventDate ? new Date(ctx.eventDate) : null;
  const validEventDate = eventDate && !Number.isNaN(eventDate.getTime()) ? eventDate : null;

  const inst = template.installments;
  const amount1 = inst[0] ? (total * inst[0].percent) / 100 : 0;
  const amount2 = inst[1] ? (total * inst[1].percent) / 100 : 0;
  const due1 = validEventDate && inst[0]?.dueType === 'WEEK_BEFORE_EVENT'
    ? weekBeforeEvent(validEventDate)
    : null;

  return template.bodyTemplate
    .replace(/\{\{TOTAL_PART\}\}/g, total > 0 ? ` (${formatMoney(total)} ₪)` : '')
    .replace(/\{\{PERCENT_1\}\}/g, String(inst[0]?.percent ?? ''))
    .replace(/\{\{PERCENT_2\}\}/g, String(inst[1]?.percent ?? ''))
    .replace(/\{\{AMOUNT_1_PART\}\}/g, amount1 > 0 ? ` (${formatMoney(amount1)} ₪)` : '')
    .replace(/\{\{AMOUNT_2_PART\}\}/g, amount2 > 0 ? ` (${formatMoney(amount2)} ₪)` : '')
    .replace(/\{\{DUE_1\}\}/g, due1 ? ` (${formatHebrewDate(due1)})` : '');
}

export function mergePaymentTermsIntoContract(
  contractText: string,
  paymentTermsParagraph: string,
): string {
  const paragraph = paymentTermsParagraph.trim();
  if (!paragraph) return contractText;

  if (contractText.includes(PAYMENT_TERMS_PLACEHOLDER)) {
    return contractText.replace(PAYMENT_TERMS_PLACEHOLDER, paragraph);
  }

  if (contractText.includes(LEGACY_PAYMENT_SENTENCE)) {
    return contractText.replace(LEGACY_PAYMENT_SENTENCE, paragraph);
  }

  return contractText;
}

export function stripPaymentTermsFromContract(contractText: string): string {
  if (contractText.includes(PAYMENT_TERMS_PLACEHOLDER)) {
    return contractText;
  }
  return contractText.replace(LEGACY_PAYMENT_SENTENCE, PAYMENT_TERMS_PLACEHOLDER);
}
