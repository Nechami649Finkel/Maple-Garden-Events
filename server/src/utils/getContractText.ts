import prisma from '../config/prisma';
import { DEFAULT_CONTRACT_TEXT } from './defaultContractText';
import { buildPortionMinimumClause } from './portionBilling';

const DEFAULT_BAR_PORTION_PRICE = 60;

export async function getBarPortionPrice(): Promise<number> {
  const settings = await prisma.systemSettings.findUnique({ where: { id: 'global' } });
  return settings?.barPortionPrice ?? DEFAULT_BAR_PORTION_PRICE;
}

function applyBarPortionPrice(text: string, barPortionPrice: number): string {
  let result = text.replace(/\{\{BAR_PORTION_PRICE\}\}/g, String(barPortionPrice));
  result = result.replace(/עלות למנה: [\d.]+ ש"ח/g, `עלות למנה: ${barPortionPrice} ש"ח`);

  if (!result.includes('מינימום מנות לחיוב')) {
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
