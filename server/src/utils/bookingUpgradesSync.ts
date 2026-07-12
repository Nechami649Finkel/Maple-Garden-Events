import {
  buildSelectedLineItems,
  resolveEffectiveUpgrades,
  type EventFormEquipmentFields,
  type ExtrasLineItem,
} from '../../../shared/contract';
import { resolveContractWithPaymentTerms, resolveDefaultPaymentTermsText } from './getContractText';
import { parseNotesBundle } from './notesStorage';
import { buildUpgradesPricingFromSettings } from './pricing';
import { isHallOnlyBooking } from '../validators/booking.validator';
import prisma from '../config/prisma';

type BookingForUpgradeSync = {
  upgrades: unknown;
  kosherType: string | null;
  guestCount: number;
  eventType: string;
  basePrice: number | null;
  liveAdditionsTotal: number | null;
  clientComments: string | null;
  paymentTermsText: string | null;
  eventDate: { date: Date };
};

export function computeExtrasPrices(selected: ExtrasLineItem[]) {
  let extrasPrice = 0;
  let externalExtrasPrice = 0;
  for (const item of selected) {
    if (item.paidTo === 'external') externalExtrasPrice += item.price;
    else extrasPrice += item.price;
  }
  return { extrasPrice, externalExtrasPrice };
}

export async function buildUpgradeLineItemOptions(
  booking: BookingForUpgradeSync,
  eventForm?: EventFormEquipmentFields | null,
  extraUpgradeKey?: string,
) {
  const systemSettings = await prisma.systemSettings.findUnique({ where: { id: 'global' } });
  const upgradesPricing = buildUpgradesPricingFromSettings(systemSettings);
  const hallOnly = isHallOnlyBooking(booking);
  let upgrades = resolveEffectiveUpgrades(booking.upgrades, eventForm);
  if (extraUpgradeKey) {
    upgrades = { ...upgrades, [extraUpgradeKey]: true };
  }

  return {
    upgrades,
    lineItemOptions: {
      upgrades,
      kosherType: booking.kosherType || 'machpud',
      guestCount: booking.guestCount,
      isHallOnly: hallOnly,
      isFoodRelevant: !hallOnly,
      upgradesPricing,
    },
  };
}

export async function refreshBookingUpgradesAndContract(
  booking: BookingForUpgradeSync,
  eventForm?: EventFormEquipmentFields | null,
  extraUpgradeKey?: string,
) {
  const { upgrades, lineItemOptions } = await buildUpgradeLineItemOptions(
    booking,
    eventForm,
    extraUpgradeKey,
  );
  const selected = buildSelectedLineItems(lineItemOptions);
  const { extrasPrice, externalExtrasPrice } = computeExtrasPrices(selected);

  const liveAdditionsTotal = Number(booking.liveAdditionsTotal) || 0;
  const basePrice = Number(booking.basePrice) || 0;
  const totalPrice = basePrice + extrasPrice + externalExtrasPrice + liveAdditionsTotal;

  const menuNotes = parseNotesBundle(booking.clientComments || '').menu;
  const paymentTermsText = booking.paymentTermsText?.trim()
    || await resolveDefaultPaymentTermsText(totalPrice, booking.eventDate.date);

  const contractText = await resolveContractWithPaymentTerms({
    paymentTermsText,
    total: totalPrice,
    eventDate: booking.eventDate.date,
    menuNotes,
    lineItemOptions,
  });

  return {
    upgrades,
    extrasPrice,
    externalExtrasPrice,
    totalPrice,
    paymentTermsText,
    contractText,
  };
}
