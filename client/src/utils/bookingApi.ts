/** Event date relation on booking records from GET /api/bookings */
export type EventDateRef = {
  date: string;
  optionExpiresAt?: string | null;
};

export type EventAdditionApi = {
  id: string;
  createdAt: string;
  description: string;
  cost: number;
  staffName: string;
  signature?: string | null;
};

/** Booking payload from GET /api/bookings (list & detail) */
export type BookingApi = {
  id: string;
  calendarDateId?: string;
  isOption?: boolean;
  eventCode?: string;
  eventType?: string;
  timeOfDay?: string | null;
  guestCount?: number | null;
  clientAFullName?: string;
  clientBFullName?: string;
  clientAIdNumber?: string;
  clientBIdNumber?: string;
  clientAPhone?: string;
  clientBPhone?: string;
  clientAEmail?: string;
  clientBEmail?: string;
  clientAAddress?: string;
  clientBAddress?: string;
  eventDate?: EventDateRef;
  finalPricePortion?: number;
  basePrice?: number;
  totalPrice?: number;
  extrasPrice?: number;
  externalExtrasPrice?: number;
  liveAdditionsTotal?: number;
  hallRentalPrice?: number | null;
  paidAmount?: number;
  advancePaid?: number;
  totalPaid?: number;
  paymentStatus?: string;
  depositMethod?: string;
  easycountStatus?: string | null;
  easycountDocId?: string | null;
  easycountError?: string | null;
  easycountDocUrl?: string | null;
  hasMusic?: boolean;
  akumApprovalCode?: string | null;
  isContractSigned?: boolean;
  clientSignatureUrl?: string | null;
  securityCheckStatus?: string;
  createdBy?: string;
  updatedBy?: string | null;
  createdAt?: string;
  leadSource?: string | null;
  clientComments?: string | null;
  managerComments?: string | null;
  additions?: EventAdditionApi[];
};
