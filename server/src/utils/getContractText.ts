import prisma from '../config/prisma';
import { DEFAULT_CONTRACT_TEXT } from './defaultContractText';
import { buildPortionMinimumClause } from './portionBilling';
import {
  findPaymentTemplate,
  getPaymentTemplatesFromSettings,
  renderPaymentTermsText,
} from './paymentTerms';
import { type ExtrasLineItem, resolveFullContractText } from './contractSections';

const DEFAULT_BAR_PORTION_PRICE = 60;

export async function getBarPortionPrice(): Promise<number> {
  const settings = await prisma.systemSettings.findUnique({ where: { id: 'global' } });
  return settings?.barPortionPrice ?? DEFAULT_BAR_PORTION_PRICE;
}

function applyBarPortionPrice(text: string, barPortionPrice: number): string {
  let result = text.replace(/\{\{BAR_PORTION_PRICE\}\}/g, String(barPortionPrice));
  result = result.replace(/עלות למנה: [\d.]+ ש"ח/g, `עלות למנה: ${barPortionPrice} ש"ח`);
  // Prefer the current contract wording ("מנות בר").
  result = result.replace(/מינימום מנות לחיוב:/g, 'מינימום מנות בר לחיוב:');

  if (!result.includes('מינימום מנות בר לחיוב')) {
    result = `${result.trim()}\n\n${buildPortionMinimumClause(barPortionPrice)}`;
  }

  return result;
}

export async function getContractText(): Promise<string> {
  const settings = await prisma.systemSettings.findUnique({ where: { id: 'global' } });
  const barPortionPrice = settings?.barPortionPrice ?? DEFAULT_BAR_PORTION_PRICE;
  const baseText = settings?.contractText?.trim() || DEFAULT_CONTRACT_TEXT;
  return applyBarPortionPrice(baseText, barPortionPrice);
}

export async function resolveDefaultPaymentTermsText(
  total = 0,
  eventDate?: Date | string | null,
): Promise<string> {
  const settings = await prisma.systemSettings.findUnique({ where: { id: 'global' } });
  const { templates, defaultTemplateId } = getPaymentTemplatesFromSettings(settings);
  const template = findPaymentTemplate(templates, defaultTemplateId) ?? templates[0];
  if (!template) return '';
  return renderPaymentTermsText(template, { total, eventDate });
}

export async function resolveContractWithPaymentTerms(options?: {
  paymentTermsText?: string | null;
  total?: number;
  eventDate?: Date | string | null;
  extras?: ExtrasLineItem[];
  menuNotes?: string[];
  lineItemOptions?: Parameters<typeof import('./contractSections').buildSelectedLineItems>[0];
}): Promise<string> {
  const base = await getContractText();
  const paymentParagraph =
    options?.paymentTermsText?.trim()
    || (await resolveDefaultPaymentTermsText(options?.total, options?.eventDate));
  return resolveFullContractText({
    baseContract: base,
    paymentTerms: paymentParagraph,
    extras: options?.extras,
    menuNotes: options?.menuNotes ?? [],
    lineItemOptions: options?.lineItemOptions,
  });
}
