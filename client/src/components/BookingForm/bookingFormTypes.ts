import type { DepositCheckDetails } from '../../utils/checkOcr';
import type { PaymentTermsTemplate } from '../../utils/paymentTerms';
import type { TimeSlot } from '../../utils/timeSlot';

export interface BookingFormData {
  createdBy: string;
  clientAFirstName: string;
  clientALastName: string;
  clientAFullName: string;
  clientAIdNumber: string;
  clientAPhone: string;
  clientAPhone2: string;
  clientAEmail: string;
  clientACity: string;
  clientAAddress: string;
  clientBFullName: string;
  clientBIdNumber: string;
  clientBPhone: string;
  clientBPhone2: string;
  clientBEmail: string;
  clientBCity: string;
  clientBAddress: string;
  calendarDateId: string;
  eventType: string;
  timeOfDay: TimeSlot | string;
  startTime: string;
  endTime: string;
  guestCount: string;
  minimumGuestCount: string;
  optionalGuestCount: string;
  finalPricePortion: string;
  discountPercent: string;
  discountAmount: string;
  vatType: string;
  paymentTerms: string;
  leadSource: string;
  clientSignatureUrl: string;
  akumApprovalCode: string;
  hasMusic: boolean;
  hallRentalPrice: string;
  advancePaid: string;
  depositCheckUrl: string;
  depositCheckDetails: DepositCheckDetails | null;
}

export type BookingFormChangeHandler = (
  e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
) => void;

export interface RelatedBookingOption {
  id: string;
  calendarDateId?: string;
  eventCode?: string;
  eventDate?: {
    date: string;
    hebrewDate?: string;
    status?: string;
  };
}

export interface LoadedBooking {
  id: string;
  updatedAt?: string;
  isOption?: boolean;
  calendarDateId?: string;
  eventCode?: string;
  createdBy?: string;
  clientAFullName?: string;
  clientAIdNumber?: string;
  clientAPhone?: string;
  clientAEmail?: string;
  clientAAddress?: string;
  clientBFullName?: string;
  clientBIdNumber?: string;
  clientBPhone?: string;
  clientBEmail?: string;
  clientBAddress?: string;
  eventType?: string;
  timeOfDay?: string;
  guestCount?: number | string;
  minimumGuestCount?: number | string;
  finalPricePortion?: number | string;
  vatType?: string;
  leadSource?: string;
  clientSignatureUrl?: string;
  akumApprovalCode?: string;
  hasMusic?: boolean;
  hallRentalPrice?: number | string;
  advancePaid?: number | string;
  depositCheckUrl?: string;
  depositCheckDetails?: DepositCheckDetails | null;
  depositMethod?: string;
  clientComments?: string;
  isContractSigned?: boolean;
  contractText?: string;
  paymentTermsText?: string;
  paymentTemplateId?: string;
  upgrades?: Record<string, boolean>;
  kosherType?: string;
  eventDate?: {
    date: string;
    hebrewDate?: string;
    status?: string;
  };
}

export interface ContractTemplateApiData {
  contractBaseText?: string;
  contractText?: string;
  paymentTermsText?: string;
  paymentTemplateId?: string;
  paymentTemplates?: PaymentTermsTemplate[];
}
