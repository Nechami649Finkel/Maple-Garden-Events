export type EasyCountInvoiceStatus = 'draft' | 'pending' | 'paid' | 'cancelled' | 'failed';

export interface EasyCountInvoiceRequest {
  bookingId: string;
  eventCode: string;
  clientName: string;
  clientEmail?: string | null;
  clientPhone: string;
  amount: number;
  description: string;
  installmentLabel?: string;
}

export interface EasyCountInvoiceResult {
  externalId: string;
  paymentUrl?: string;
  status: EasyCountInvoiceStatus;
}
