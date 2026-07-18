import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import '../../styles/bootstrap-maple-forms.css';
import styles from './BookingForm.module.css';
import { type TimeSlot, TIME_SLOTS, SLOT_LABELS, normalizeTimeSlot, getBlockedSlotsForDate, SLOT_HOURS, getSlotHours, getDefaultTimeSlot } from '../../utils/timeSlot';
import { parseNotesBundle, serializeNotesBundle } from '../../utils/notesStorage';
import { apiFetch, getAuthUser } from '../../services/api';
import { useGlobalSettingsQuery } from '../../hooks/queries';
import {
  DEFAULT_PAYMENT_TEMPLATES,
  findPaymentTemplate,
  getPaymentTemplatesFromSettings,
  renderPaymentTermsText,
  type PaymentTermsTemplate,
} from '../../utils/paymentTerms';
import {
  resolveFullContractText,
  parseStoredUpgrades,
} from '../../utils/contractSections';
import { finalizeBookingTotals } from '../../utils/hallBilling';
import { promptPrintAfterClose } from '../../utils/contractPrint';
import { getSignatureDataUrl, isSignaturePayload } from '../../utils/signature';
import { scanCheckImage, fileToDataUrl, type DepositCheckDetails } from '../../utils/checkOcr';
import SignatureCanvas from 'react-signature-canvas';

import ClientsSection from './sections/ClientsSection';
import EventSettingsSection from './sections/EventSettingsSection';
import UpgradesSection from './sections/UpgradesSection';
import UpgradeTablesPanel from '../Contract/UpgradeTablesPanel';
import PaymentAndUpgradesSection from './sections/PaymentAndUpgradesSection';
import ContractModal from './sections/ContractModal';
import MetaBar from './sections/MetaBar';
import OptionDatesBar from './sections/OptionDatesBar';
import FinalizeOptionDatesBar from './sections/FinalizeOptionDatesBar';
import { normalizeOptionDate, verifyAllOptionDates, type OptionDateItem } from '../../utils/optionDateApi';
import { calendarKeyFromDbDate } from '../../utils/dateLocal';
import { API_URL } from '../../config/api';
import { NotesList } from '../NotesList/NotesList';
import MenuDisplay from '../MenuDisplay/MenuDisplay';
import {
  clearBookingDraft,
  loadBookingDraft,
  saveBookingDraft,
} from '../../utils/bookingDraft';
import {
  DEFAULT_KOSHER_TYPE,
  DEFAULT_SERVING_STYLE,
  DEFAULT_VAT_TYPE,
  KOSHER_PRICING,
} from './bookingFormConstants';
import {
  buildUpgradesPricingFromSettings,
  filterUpgradeDisplayOrder,
  HALL_UPGRADE_KEYS,
  EXTERNAL_UPGRADE_KEYS,
  type UpgradeKey,
} from '../../utils/pricing';
import type { LoadedBooking, RelatedBookingOption } from './bookingFormTypes';

const DEFAULT_UPGRADES: Record<UpgradeKey, boolean> = {
  baseDesign: true,
  amplification: false,
  lighting: false,
  screens: false,
  reception: false,
  separateReception: false,
  extraSecurity: false,
  fireworks: false,
};

interface BookingFormProps {
  initialDates?: (string | OptionDateItem)[];
  isOption?: boolean;
}

const parseCombinedPhone = (combined: string | null | undefined) => {
  if (!combined) return { phone: '', phone2: '' };
  const marker = ' | נוסף: ';
  const idx = combined.indexOf(marker);
  if (idx === -1) return { phone: combined, phone2: '' };
  return { phone: combined.slice(0, idx), phone2: combined.slice(idx + marker.length) };
};

const parseAddress = (combined: string | null | undefined) => {
  if (!combined) return { city: '', address: '' };
  const idx = combined.indexOf(', ');
  if (idx === -1) return { city: '', address: combined };
  return { city: combined.slice(0, idx), address: combined.slice(idx + 2) };
};

const parseStoredTimeOfDay = (stored: string | null | undefined) => {
  if (!stored) return { timeOfDay: '', startTime: '', endTime: '' };
  const pipeParts = stored.split('|');
  const main = pipeParts[0]?.trim() || stored;
  const timePart = pipeParts[1]?.trim();
  const partOfDay = ['morning', 'noon', 'evening'];
  if (partOfDay.includes(main)) {
    if (timePart?.includes(' - ')) {
      const [start, end] = timePart.split(' - ');
      return { timeOfDay: main, startTime: start.trim(), endTime: end.trim() };
    }
    return { timeOfDay: main, startTime: '', endTime: '' };
  }
  if (stored.includes(' - ')) {
    const [start, end] = stored.split(' - ');
    const slot = normalizeTimeSlot(stored, start.trim());
    return { timeOfDay: slot || '', startTime: start.trim(), endTime: end.trim() };
  }
  return { timeOfDay: main, startTime: '', endTime: '' };
};

const HALL_ONLY_EVENT_TYPE = 'השכרת אולם בלי אוכל';

function calcOptionalGuestCount(guestCount: string | number): string {
  const count = Number(guestCount);
  if (!Number.isFinite(count) || count <= 0) return '';
  return String(Math.ceil(count * 0.1));
}

function validateHallRentalPrice(value: string): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return 'יש להזין מחיר השכרת אולם';
  const num = Number(trimmed);
  if (!Number.isFinite(num)) return 'יש להזין מספר תקין';
  if (num <= 0) return 'הסכום חייב להיות גדול מ-0';
  return '';
}

function splitFullName(fullName: string): { first: string; last: string } {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

const BookingForm = ({ initialDates, isOption: forcedIsOption }: BookingFormProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: editId, optionId } = useParams<{ id?: string; optionId?: string }>();
  const convertFromOption = !!optionId;
  const activeEditId = optionId || editId;
  const isEditMode = !!activeEditId;
  const [overrideCtx] = useState(() => ({
    dateId: location.state?.overrideOptionDateId as string | undefined,
    clientName: location.state?.overrideOptionClientName as string | undefined,
    optionSlots: (location.state?.overrideOptionSlots as TimeSlot[]) || [],
    rawTakenSlots: (location.state?.takenSlots as TimeSlot[]) || [],
  }));
  const overrideOptionDateId = overrideCtx.dateId;
  const overrideOptionClientName = overrideCtx.clientName;
  const overrideOptionSlots = overrideCtx.optionSlots;
  const rawTakenSlots = overrideCtx.rawTakenSlots;
  const takenSlots: TimeSlot[] = overrideOptionDateId
    ? rawTakenSlots.filter((slot) => !overrideOptionSlots.includes(slot))
    : rawTakenSlots;
  const stateBlockedSlots: TimeSlot[] = (location.state?.blockedSlots as TimeSlot[]) || [];
  const primaryDateStr = (() => {
    if (initialDates?.length) {
      const d = initialDates[0];
      return typeof d === 'object' ? d.date : d;
    }
    if (location.state?.date) return location.state.date as string;
    return '';
  })();
  const blockedSlots: TimeSlot[] = primaryDateStr
    ? getBlockedSlotsForDate(primaryDateStr)
    : stateBlockedSlots;
  const unavailableSlots = [...new Set([...takenSlots, ...blockedSlots])];
  const availableSlots = isEditMode
    ? TIME_SLOTS
    : TIME_SLOTS.filter((slot) => !unavailableSlots.includes(slot));
  const initialTimeSlot = (() => {
    if (isEditMode) return 'evening';
    if (overrideOptionDateId && overrideOptionSlots.length > 0) {
      return getDefaultTimeSlot(overrideOptionSlots) || overrideOptionSlots[0];
    }
    return getDefaultTimeSlot(availableSlots) || 'evening';
  })() as TimeSlot;
  const initialSlotHours = getSlotHours(initialTimeSlot);
  const sigCanvas = useRef<SignatureCanvas>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadingBooking, setLoadingBooking] = useState(isEditMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [relatedOptions, setRelatedOptions] = useState<RelatedBookingOption[]>([]);
  const [activeBookingId, setActiveBookingId] = useState(activeEditId || '');
  const [bookingUpdatedAt, setBookingUpdatedAt] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  let datesToProcess: (string | OptionDateItem)[] = [];
  if (initialDates && initialDates.length > 0) datesToProcess = initialDates;
  else if (location.state?.selectedDates) datesToProcess = location.state.selectedDates;
  else if (location.state?.selectedDate) datesToProcess = [location.state.selectedDate];
  else if (location.state?.date) datesToProcess = [{ date: location.state.date, hebrewDate: location.state.hebrewDate || '' }];

  const [selectedDatesDisplay, setSelectedDatesDisplay] = useState<OptionDateItem[]>(
    datesToProcess.map(normalizeOptionDate)
  );
  const isOptionMode = !convertFromOption && (forcedIsOption || location.state?.isOption);
  const [isOption, setIsOption] = useState(isOptionMode);
  const [optionDurationHours, setOptionDurationHours] = useState(48);
  const [orderNumber, setOrderNumber] = useState('');
  const [asyncSlotWarning, setAsyncSlotWarning] = useState('');

  const initialCalendarDateId = datesToProcess[0] ? normalizeOptionDate(datesToProcess[0]).date : '';

  const [formData, setFormData] = useState({
    createdBy: '', clientAFirstName: '', clientALastName: '', clientAFullName: '', clientAIdNumber: '', clientAPhone: '', clientAPhone2: '', clientAEmail: '', clientACity: '', clientAAddress: '',
    clientBFullName: '', clientBIdNumber: '', clientBPhone: '', clientBPhone2: '', clientBEmail: '', clientBCity: '', clientBAddress: '',
    calendarDateId: initialCalendarDateId, eventType: '', timeOfDay: initialTimeSlot, startTime: initialSlotHours.start, endTime: initialSlotHours.end,
    guestCount: '', minimumGuestCount: '', optionalGuestCount: '', finalPricePortion: '200', discountPercent: '', discountAmount: '', vatType: DEFAULT_VAT_TYPE, paymentTerms: '', leadSource: '', clientSignatureUrl: '',
   
    akumApprovalCode: '', hasMusic: false, hallRentalPrice: '',
    advancePaid: '',
    depositCheckUrl: '', depositCheckDetails: null as DepositCheckDetails | null,
  });

  const [menuNotesList, setMenuNotesList] = useState<string[]>([]);
  const [internalNotesList, setInternalNotesList] = useState<string[]>([]);
  const [servingStyle, setServingStyle] = useState(DEFAULT_SERVING_STYLE);
  const [kosherType, setKosherType] = useState(DEFAULT_KOSHER_TYPE);
  const [upgrades, setUpgrades] = useState({ ...DEFAULT_UPGRADES });
  const [addingUpgradeKey, setAddingUpgradeKey] = useState<string | null>(null);
  const [depositMethod, setDepositMethod] = useState('');
  const [checkScanning, setCheckScanning] = useState(false);
  const [contractSigned, setContractSigned] = useState(false);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [isMenuViewOpen, setIsMenuViewOpen] = useState(false);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [loadedContractText, setLoadedContractText] = useState('');
  const [contractTextOverride, setContractTextOverride] = useState<string | null>(null);
  const [contractBaseText, setContractBaseText] = useState('');
  const [apiPaymentTemplates, setApiPaymentTemplates] = useState<PaymentTermsTemplate[]>(DEFAULT_PAYMENT_TEMPLATES);
  const [paymentTemplateId, setPaymentTemplateId] = useState('50-50');
  const [paymentTermsCustom, setPaymentTermsCustom] = useState(false);
  const [paymentTermsText, setPaymentTermsText] = useState('');
  const { data: globalSettings } = useGlobalSettingsQuery();
  const vatRate = globalSettings?.vatRate != null ? Number(globalSettings.vatRate) : 17;
  const paymentTemplates = useMemo(() => {
    if (globalSettings?.paymentTemplates) {
      return getPaymentTemplatesFromSettings(globalSettings).templates;
    }
    return apiPaymentTemplates;
  }, [globalSettings, apiPaymentTemplates]);
  const upgradesPricing = useMemo(
    () => buildUpgradesPricingFromSettings(globalSettings),
    [globalSettings],
  );
  const visibleUpgradeKeys = useMemo(
    () => filterUpgradeDisplayOrder(globalSettings),
    [globalSettings],
  );

  const normalizedSlot = normalizeTimeSlot(formData.timeOfDay as string);
  const optionDatesSlotWarning =
    !isOption || selectedDatesDisplay.length === 0
      ? ''
      : !normalizedSlot
        ? 'יש לבחור זמן ביום לפני הוספת תאריכים.'
        : asyncSlotWarning;

  const handleSelectedDatesChange = (dates: OptionDateItem[]) => {
    setSelectedDatesDisplay(dates);
    const firstDate = dates[0]?.date || '';
    setFormData((prev) =>
      prev.calendarDateId === firstDate ? prev : { ...prev, calendarDateId: firstDate },
    );
  };

  useEffect(() => {
    let cancelled = false;
    getAuthUser().then((user) => {
      if (cancelled || !user?.email) return;
      setUserEmail(user.email);
      if (isEditMode) {
        setDraftRestored(true);
        return;
      }
      const draft = loadBookingDraft(user.email);
      if (!draft) {
        setDraftRestored(true);
        return;
      }
      const restore = window.confirm('נמצאה טיוטת הזמנה שלא נשמרה. לשחזר אותה?');
      if (restore) {
        const dates = (draft.selectedDatesDisplay as OptionDateItem[]).map(normalizeOptionDate);
        const firstDate = dates[0]?.date || '';
        setFormData((prev) => {
          const merged = { ...prev, ...(draft.formData as typeof prev) };
          return firstDate ? { ...merged, calendarDateId: firstDate } : merged;
        });
        setMenuNotesList(draft.menuNotesList);
        setInternalNotesList(draft.internalNotesList);
        setServingStyle(draft.servingStyle);
        setKosherType(draft.kosherType);
        setUpgrades(draft.upgrades);
        setDepositMethod(draft.depositMethod);
        // Draft never stores the signature image — never restore "signed" without it.
        setContractSigned(false);
        setSavedSignature(null);
        setSelectedDatesDisplay(dates);
        setIsOption(draft.isOption);
        setOptionDurationHours(draft.optionDurationHours);
        setPaymentTemplateId(draft.paymentTemplateId);
        setPaymentTermsCustom(draft.paymentTermsCustom);
        setPaymentTermsText(draft.paymentTermsText);
      } else {
        clearBookingDraft();
      }
      setDraftRestored(true);
    });
    return () => { cancelled = true; };
  }, [isEditMode]);

  useEffect(() => {
    if (isEditMode || !userEmail || !draftRestored) return;
    const timer = setTimeout(() => {
      saveBookingDraft(userEmail, {
        formData: { ...formData },
        menuNotesList,
        internalNotesList,
        servingStyle,
        kosherType,
        upgrades,
        depositMethod,
        contractSigned,
        selectedDatesDisplay,
        isOption,
        optionDurationHours,
        paymentTemplateId,
        paymentTermsCustom,
        paymentTermsText,
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [
    isEditMode,
    userEmail,
    draftRestored,
    formData,
    menuNotesList,
    internalNotesList,
    servingStyle,
    kosherType,
    upgrades,
    depositMethod,
    contractSigned,
    selectedDatesDisplay,
    isOption,
    optionDurationHours,
    paymentTemplateId,
    paymentTermsCustom,
    paymentTermsText,
  ]);

  useEffect(() => {
    apiFetch(`${API_URL}/bookings/contract-template`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success || !json.data) return;
        if (json.data.contractBaseText) {
          setContractBaseText(json.data.contractBaseText);
        }
        if (json.data.contractText) {
          setLoadedContractText((prev) => prev || json.data.contractText);
        }
        if (json.data.paymentTermsText) {
          setPaymentTermsText((prev) => prev || json.data.paymentTermsText);
        }
        if (json.data.paymentTemplateId) {
          setPaymentTemplateId(json.data.paymentTemplateId);
        }
        if (Array.isArray(json.data.paymentTemplates) && json.data.paymentTemplates.length > 0) {
          setApiPaymentTemplates(json.data.paymentTemplates);
        }
      })
      .catch(() => { /* ignore */ });
  }, []);

  useEffect(() => {
    if (!isOption || selectedDatesDisplay.length === 0 || !normalizedSlot) return;
    let cancelled = false;
    verifyAllOptionDates(
      selectedDatesDisplay.map(normalizeOptionDate),
      formData.eventType || 'חתונה',
      normalizedSlot,
    ).then((verify) => {
      if (!cancelled) setAsyncSlotWarning(verify.ok ? '' : verify.error);
    });
    return () => { cancelled = true; };
  }, [isOption, normalizedSlot, formData.eventType, selectedDatesDisplay]);

  useEffect(() => {
    if (isEditMode && convertFromOption) return;
    const dateCount = Math.max(selectedDatesDisplay.length, 1);
    const prefix = isOption ? 'OPT' : 'EVT';

    const loadNextCode = async () => {
      try {
        const res = await apiFetch(`${API_URL}/bookings/next-code?prefix=${prefix}&count=${dateCount}`);
        const json = await res.json();
        if (!res.ok || !json.success) return;
        const codes: string[] = json.data.codes || [];
        if (codes.length === 0) return;
        if (codes.length === 1) setOrderNumber(codes[0]);
        else setOrderNumber(`${codes[0]} – ${codes[codes.length - 1]}`);
      } catch { /* ignore */ }
    };
    loadNextCode();
  }, [isEditMode, convertFromOption, isOption, selectedDatesDisplay.length]);

  useEffect(() => {
    if (convertFromOption && activeEditId) {
      apiFetch(`${API_URL}/bookings/next-code?prefix=EVT&count=1`)
        .then(r => r.json())
        .then(json => {
          if (json.success && json.data?.code) setOrderNumber(json.data.code);
        })
        .catch(() => { /* ignore */ });
    }
  }, [convertFromOption, activeEditId]);

  useEffect(() => {
    if (!activeEditId) return;

    const applyBookingToForm = (b: LoadedBooking) => {
      const phoneA = parseCombinedPhone(b.clientAPhone);
      const phoneB = parseCombinedPhone(b.clientBPhone);
      const addrA = parseAddress(b.clientAAddress);
      const addrB = parseAddress(b.clientBAddress);
      const eventDateStr = b.eventDate?.date ? calendarKeyFromDbDate(new Date(b.eventDate.date)) : '';
      if (convertFromOption) {
        setIsOption(false);
      } else {
        setIsOption(!!(b.isOption || b.eventDate?.status === 'OPTION'));
        setOrderNumber(b.eventCode || b.id.slice(0, 8));
      }
      if (eventDateStr) setSelectedDatesDisplay([{ date: eventDateStr, hebrewDate: '' }]);
      const parsedTime = parseStoredTimeOfDay(b.timeOfDay);
      const loadedSlot = parsedTime.timeOfDay as TimeSlot;
      const defaultHours = loadedSlot && SLOT_HOURS[loadedSlot] ? getSlotHours(loadedSlot) : null;

      const nameParts = splitFullName(b.clientAFullName || '');

      setFormData({
        createdBy: b.createdBy || '',
        clientAFirstName: nameParts.first,
        clientALastName: nameParts.last,
        clientAFullName: b.clientAFullName || '', clientAIdNumber: b.clientAIdNumber || '', clientAPhone: phoneA.phone, clientAPhone2: phoneA.phone2, clientAEmail: b.clientAEmail || '', clientACity: addrA.city, clientAAddress: addrA.address,
        clientBFullName: b.clientBFullName || '', clientBIdNumber: b.clientBIdNumber || '', clientBPhone: phoneB.phone, clientBPhone2: phoneB.phone2, clientBEmail: b.clientBEmail || '', clientBCity: addrB.city, clientBAddress: addrB.address,
        calendarDateId: eventDateStr, eventType: b.eventType || '', timeOfDay: loadedSlot || 'evening', startTime: parsedTime.startTime || defaultHours?.start || '', endTime: parsedTime.endTime || defaultHours?.end || '',
        guestCount: String(b.guestCount ?? ''), minimumGuestCount: String(b.minimumGuestCount ?? b.guestCount ?? ''), optionalGuestCount: calcOptionalGuestCount(b.guestCount ?? ''), finalPricePortion: String(b.finalPricePortion ?? '200'), discountPercent: '', discountAmount: '', vatType: b.vatType === 'not_included' ? 'not_included' : DEFAULT_VAT_TYPE, paymentTerms: '', leadSource: b.leadSource || '', clientSignatureUrl: b.clientSignatureUrl || '',
        akumApprovalCode: b.akumApprovalCode || '', hasMusic: !!b.hasMusic,
        hallRentalPrice: b.hallRentalPrice ? String(b.hallRentalPrice) : '',
        advancePaid: b.advancePaid ? String(b.advancePaid) : '',
        depositCheckUrl: b.depositCheckUrl || '',
        depositCheckDetails: (b.depositCheckDetails as DepositCheckDetails | null) || null,
      });
      if (b.depositCheckUrl) {
        setDepositMethod(b.depositCheckUrl.startsWith('data:') ? 'check_capture' : 'check_upload');
      } else if (b.depositMethod) {
        setDepositMethod(b.depositMethod);
      }
      const notesBundle = parseNotesBundle(b.clientComments || '');
      setMenuNotesList(notesBundle.menu);
      setInternalNotesList(notesBundle.internal);
      setContractSigned(!!b.isContractSigned);
      if (b.clientSignatureUrl) setSavedSignature(b.clientSignatureUrl);
      if (b.contractText) {
        setLoadedContractText(b.contractText);
      }
      if (b.paymentTermsText) {
        setPaymentTermsText(b.paymentTermsText);
      }
      if (b.paymentTemplateId) {
        setPaymentTemplateId(b.paymentTemplateId);
        setPaymentTermsCustom(b.paymentTemplateId === 'custom');
      } else if (b.paymentTermsText) {
        setPaymentTermsCustom(true);
      }
      if (b.upgrades && typeof b.upgrades === 'object') {
        setUpgrades({ ...DEFAULT_UPGRADES, ...parseStoredUpgrades(b.upgrades) });
      } else if (b.hasMusic !== undefined) {
        setUpgrades((prev) => ({ ...prev, amplification: !!b.hasMusic }));
      }
      if (b.kosherType) setKosherType(b.kosherType);
    };

    const loadBooking = async () => {
      try {
        const res = await apiFetch(`${API_URL}/bookings/${activeEditId}`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          alert(json.message || 'שגיאה בטעינת ההזמנה');
          navigate('/calendar');
          return;
        }
        const b = json.data as LoadedBooking;
        const isStillOption = b.isOption || b.eventDate?.status === 'OPTION';
        if (convertFromOption && !isStillOption) {
          alert('האופציה כבר הומרה להזמנה.');
          navigate('/calendar');
          return;
        }
        applyBookingToForm(b);
        setActiveBookingId(b.id);
        if (b.updatedAt) setBookingUpdatedAt(b.updatedAt);
        setIsOption(false);

        const loadRelatedOptions = async (bookingId: string): Promise<RelatedBookingOption[]> => {
          try {
            const relatedRes = await apiFetch(`${API_URL}/bookings/${bookingId}/related-options`);
            if (relatedRes.ok) {
              const relatedJson = await relatedRes.json();
              if (relatedJson.success && Array.isArray(relatedJson.data) && relatedJson.data.length > 0) {
                return relatedJson.data as RelatedBookingOption[];
              }
            }
          } catch { /* ignore */ }
          return [b];
        };

        const applyRelatedOptionDates = (related: RelatedBookingOption[]) => {
          const dates = related
            .map((opt) => ({
              date: opt.eventDate?.date ? calendarKeyFromDbDate(new Date(opt.eventDate.date)) : '',
              hebrewDate: opt.eventDate?.hebrewDate || '',
            }))
            .filter((d) => d.date);
          setSelectedDatesDisplay(dates);
          const firstDate = dates[0]?.date || '';
          setFormData((prev) =>
            prev.calendarDateId === firstDate ? prev : { ...prev, calendarDateId: firstDate },
          );
        };

        if (convertFromOption) {
          const related = await loadRelatedOptions(b.id);
          setRelatedOptions(related);
        } else if (isStillOption) {
          const related = await loadRelatedOptions(b.id);
          setRelatedOptions(related);
          applyRelatedOptionDates(related);
        }
      } catch {
        alert('שגיאה בטעינת ההזמנה');
        navigate('/calendar');
      } finally {
        setLoadingBooking(false);
      }
    };
    loadBooking();
  }, [activeEditId, convertFromOption, navigate]);

  const handleSelectFinalizeDate = (bookingId: string) => {
    const selected = relatedOptions.find((o) => o.id === bookingId);
    if (!selected) return;
    setActiveBookingId(bookingId);
    const eventDateStr = selected.eventDate?.date
      ? calendarKeyFromDbDate(new Date(selected.eventDate.date))
      : '';
    if (eventDateStr) {
      handleSelectedDatesChange([{ date: eventDateStr, hebrewDate: selected.eventDate?.hebrewDate || '' }]);
    }
  };

  const unavailableKey = unavailableSlots.join(',');
  const availableKey = availableSlots.join(',');
  const [slotAdjustKey, setSlotAdjustKey] = useState(
    unavailableKey + '|' + availableKey + '|' + formData.eventType,
  );
  const slotKeyNow = unavailableKey + '|' + availableKey + '|' + formData.eventType;

  if (!isEditMode && slotKeyNow !== slotAdjustKey) {
    setSlotAdjustKey(slotKeyNow);
    const current = formData.timeOfDay as TimeSlot;
    let next: TimeSlot | '' = current;
    if (formData.eventType === 'חתונה') {
      const eveningOk = availableSlots.includes('evening') && !unavailableSlots.includes('evening');
      if (eveningOk) next = 'evening';
    }
    if (next && unavailableSlots.includes(next as TimeSlot)) {
      next = getDefaultTimeSlot(availableSlots) || '';
    } else if (!next && availableSlots.length > 0) {
      next = getDefaultTimeSlot(availableSlots) || '';
    }
    if (next && SLOT_HOURS[next as TimeSlot]) {
      const { start, end } = getSlotHours(next as TimeSlot);
      if (formData.timeOfDay !== next || formData.startTime !== start || formData.endTime !== end) {
        setFormData((prev) => ({ ...prev, timeOfDay: next as TimeSlot, startTime: start, endTime: end }));
      }
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'radio' && name === 'vatType') return setFormData(prev => ({ ...prev, vatType: value }));
    if (name === 'timeOfDay') {
      const slot = value as TimeSlot;
      const hours = SLOT_HOURS[slot] ? getSlotHours(slot) : null;
      setFormData((prev) => ({
        ...prev,
        timeOfDay: slot,
        ...(hours ? { startTime: hours.start, endTime: hours.end } : {}),
      }));
      if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
      return;
    }
    if (name === 'guestCount') {
      setFormData(prev => ({
        ...prev,
        guestCount: value,
        minimumGuestCount: value,
        optionalGuestCount: calcOptionalGuestCount(value),
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    if (name === 'hallRentalPrice') {
      setErrors(prev => ({ ...prev, hallRentalPrice: validateHallRentalPrice(value) }));
    } else if (name === 'eventType' && value !== HALL_ONLY_EVENT_TYPE) {
      setErrors((prev) => (prev.hallRentalPrice ? { ...prev, hallRentalPrice: '' } : prev));
    } else if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleUpgradeChange = (key: keyof typeof upgrades) => {
    if (key === 'baseDesign') return;
    setUpgrades((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAddUpgrade = async (key: UpgradeKey) => {
    setAddingUpgradeKey(key);
    try {
      if (editId) {
        const res = await apiFetch(`${API_URL}/bookings/${editId}/upgrades`, {
          method: 'PATCH',
          body: JSON.stringify({ upgradeKey: key }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          alert(json.message || 'לא ניתן להוסיף את השדרוג לחוזה');
          return;
        }
        setUpgrades((prev) => ({ ...prev, [key]: true }));
        if (json.data?.contractText) setContractTextOverride(json.data.contractText);
        if (json.data?.paymentTermsText) setPaymentTermsText(json.data.paymentTermsText);
        return;
      }
      setUpgrades((prev) => ({ ...prev, [key]: true }));
    } finally {
      setAddingUpgradeKey(null);
    }
  };

  const processCheckImage = async (imageSrc: string) => {
    setCheckScanning(true);
    try {
      const details = await scanCheckImage(imageSrc);
      setFormData(prev => ({ ...prev, depositCheckDetails: details }));
    } catch (error) {
      console.error('Check OCR failed:', error);
      setFormData(prev => ({ ...prev, depositCheckDetails: { scannedAt: new Date().toISOString() } }));
      alert('לא הצלחנו לזהות את כל פרטי הצ\'ק. ניתן למלא אותם ידנית.');
    } finally {
      setCheckScanning(false);
    }
  };

  const handleCheckCapture = async (imageSrc: string) => {
    setFormData(prev => ({ ...prev, depositCheckUrl: imageSrc }));
    await processCheckImage(imageSrc);
  };

  const handleCheckFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setFormData(prev => ({ ...prev, depositCheckUrl: dataUrl }));
      await processCheckImage(dataUrl);
    } catch {
      alert('שגיאה בטעינת קובץ הצ\'ק');
    }
  };

  const handleDeleteCheck = () => {
    setFormData(prev => ({
      ...prev,
      depositCheckUrl: '',
      depositCheckDetails: null,
    }));
  };

  const handleCheckDetailsChange = (details: DepositCheckDetails) => {
    setFormData(prev => ({ ...prev, depositCheckDetails: details }));
  };

  const handleDepositMethodChange = (method: string) => {
    setDepositMethod(method);
    if (method === 'credit_card') {
      handleDeleteCheck();
    }
  };

  const isHallOnly = formData.eventType === HALL_ONLY_EVENT_TYPE;
  const isFoodRelevant = !isHallOnly;
  const isWedding = formData.eventType === 'חתונה';

  const getEventDateStr = (): string | null => {
    if (selectedDatesDisplay.length > 0) {
      const first = selectedDatesDisplay[0];
      return typeof first === 'object' ? first.date : String(first);
    }
    return formData.calendarDateId || null;
  };

  const calculateTotals = () => {
  let mainBase = 0;

  if (isHallOnly) {
    mainBase += Number(formData.hallRentalPrice) || 0;
  } else if (isFoodRelevant) {
    const portions = Number(formData.guestCount) || 0;
    const portionPrice = Number(formData.finalPricePortion) || 0;
    mainBase += portions * portionPrice;
  }

  let hallExtrasBase = 0;
  if (isFoodRelevant) {
    const portions = Number(formData.guestCount) || 0;
    hallExtrasBase += portions * KOSHER_PRICING[kosherType].extra;
  }
  HALL_UPGRADE_KEYS.forEach((key) => {
    if (upgrades[key]) hallExtrasBase += upgradesPricing[key] ?? 0;
  });

  let externalExtrasBase = 0;
  EXTERNAL_UPGRADE_KEYS.forEach((key) => {
    if (key === 'baseDesign' && isHallOnly) return;
    if (upgrades[key]) externalExtrasBase += upgradesPricing[key] ?? 0;
  });

  let discountVal = 0;
  if (formData.discountPercent) discountVal += mainBase * (Number(formData.discountPercent) / 100);
  if (formData.discountAmount) discountVal += Number(formData.discountAmount);

  const mainSubtotal = Math.max(0, mainBase - discountVal);
  const hallExtrasSubtotal = hallExtrasBase;
  const externalExtrasSubtotal = externalExtrasBase;

  const mainVat = formData.vatType === 'not_included' ? mainSubtotal * (vatRate / 100) : 0;
  const hallExtrasVat = formData.vatType === 'not_included' ? hallExtrasSubtotal * (vatRate / 100) : 0;
  const externalExtrasVat = formData.vatType === 'not_included' ? externalExtrasSubtotal * (vatRate / 100) : 0;

  const baseTotal = mainSubtotal + mainVat;
  const hallExtrasTotal = hallExtrasSubtotal + hallExtrasVat;
  const externalExtrasTotal = externalExtrasSubtotal + externalExtrasVat;

  return finalizeBookingTotals({
    mainBase,
    hallExtrasBase,
    externalExtrasBase,
    discountVal,
    mainSubtotal,
    hallExtrasSubtotal,
    externalExtrasSubtotal,
    mainVat,
    hallExtrasVat,
    externalExtrasVat,
    baseTotal,
    hallExtrasTotal,
    externalExtrasTotal,
    base: mainBase + hallExtrasBase + externalExtrasBase,
    subtotal: mainSubtotal + hallExtrasSubtotal + externalExtrasSubtotal,
    vatAmount: mainVat + hallExtrasVat + externalExtrasVat,
  });
  };

  const totals = calculateTotals();

  const handlePaymentTermsTextChange = (text: string) => {
    setPaymentTermsText(text);
  };

  const autoPaymentTermsText = useMemo(() => {
    if (paymentTermsCustom || !contractBaseText) return null;
    const template = findPaymentTemplate(paymentTemplates, paymentTemplateId);
    if (!template) return null;
    const eventDate =
      selectedDatesDisplay.length > 0
        ? selectedDatesDisplay[0].date
        : formData.calendarDateId || null;
    return renderPaymentTermsText(template, {
      total: totals.hallTotal,
      eventDate,
    });
  }, [
    paymentTermsCustom,
    contractBaseText,
    paymentTemplates,
    paymentTemplateId,
    totals.hallTotal,
    selectedDatesDisplay,
    formData.calendarDateId,
  ]);

  const effectivePaymentTermsText = autoPaymentTermsText ?? paymentTermsText;

  const handlePaymentTermsCustomChange = (custom: boolean) => {
    if (custom && !paymentTermsCustom && autoPaymentTermsText) {
      setPaymentTermsText(autoPaymentTermsText);
    }
    setPaymentTermsCustom(custom);
  };

  const autoContractText = useMemo(() => {
    if (!contractBaseText) return null;
    return resolveFullContractText({
      baseContract: contractBaseText,
      paymentTerms: effectivePaymentTermsText,
      lineItemOptions: {
        upgrades,
        kosherType,
        guestCount: Number(formData.guestCount) || 0,
        isHallOnly,
        isFoodRelevant,
        upgradesPricing,
        upgradeKeys: visibleUpgradeKeys,
      },
      menuNotes: menuNotesList,
    });
  }, [
    contractBaseText,
    effectivePaymentTermsText,
    upgrades,
    kosherType,
    formData.guestCount,
    isHallOnly,
    isFoodRelevant,
    menuNotesList,
    upgradesPricing,
    visibleUpgradeKeys,
  ]);

  const [cachedAutoContractText, setCachedAutoContractText] = useState(autoContractText);
  if (autoContractText !== cachedAutoContractText) {
    setCachedAutoContractText(autoContractText);
    if (contractTextOverride !== null) setContractTextOverride(null);
  }

  const contractText = contractTextOverride ?? autoContractText ?? loadedContractText;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let signatureData: string | null = savedSignature;
    if (!signatureData && contractSigned) {
      signatureData = getSignatureDataUrl(sigCanvas);
    }
    if (!signatureData && isEditMode && formData.clientSignatureUrl) {
      signatureData = formData.clientSignatureUrl;
    }
    if (signatureData && !isSignaturePayload(signatureData)) {
      signatureData = null;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (isOption) {
      if (!formData.clientAFirstName?.trim()) {
        alert('חובה להזין שם פרטי.');
        return;
      }
      if (!formData.clientALastName?.trim()) {
        alert('חובה להזין שם משפחה.');
        return;
      }
      if (!formData.clientAPhone?.trim() || formData.clientAPhone.trim().length < 9) {
        alert('חובה להזין מספר טלפון תקין (לפחות 9 ספרות).');
        return;
      }
      if (!formData.createdBy?.trim()) {
        alert('חובה לבחור נציג מהרשימה.');
        return;
      }
      if (formData.clientAEmail?.trim() && !emailPattern.test(formData.clientAEmail.trim())) {
        alert('כתובת האימייל של בעל/ת השמחה אינה תקינה.');
        return;
      }
      if (formData.clientBEmail?.trim() && !emailPattern.test(formData.clientBEmail.trim())) {
        alert('כתובת האימייל של צד ב\' אינה תקינה.');
        return;
      }
    } else {
      if ((!isEditMode || convertFromOption) && !contractSigned) {
        alert('יש לחתום על החוזה בחלונית החתימה טרם השמירה.');
        return;
      }
      if (contractSigned && !signatureData) {
        alert('יש לחתום על החוזה בחלונית החתימה טרם השמירה.');
        return;
      }
      if (isHallOnly) {
        const hallError = validateHallRentalPrice(formData.hallRentalPrice);
        if (hallError) {
          setErrors((prev) => ({ ...prev, hallRentalPrice: hallError }));
          alert(hallError);
          return;
        }
      } else if (!formData.guestCount || Number(formData.guestCount) <= 0) {
        alert('חובה להזין מספר אורחים (מעל 0).');
        return;
      }

      if (!formData.clientAFullName?.trim()) {
        alert('חובה להזין שם לקוח.');
        return;
      }
      if (!formData.clientAPhone?.trim() || formData.clientAPhone.trim().length < 9) {
        alert('חובה להזין מספר טלפון תקין (לפחות 9 ספרות).');
        return;
      }
      if (!formData.eventType) {
        alert('חובה לבחור סוג אירוע.');
        return;
      }
      if (!formData.timeOfDay) {
        alert('חובה לבחור זמן ביום (בוקר / צהריים / ערב).');
        return;
      }
      if (selectedDatesDisplay.length === 0 && !formData.calendarDateId) {
        alert('חובה לבחור תאריך לאירוע.');
        return;
      }
      if (formData.clientAEmail?.trim() && !emailPattern.test(formData.clientAEmail.trim())) {
        alert('כתובת האימייל של בעל/ת השמחה אינה תקינה.');
        return;
      }
      if (formData.clientBEmail?.trim() && !emailPattern.test(formData.clientBEmail.trim())) {
        alert('כתובת האימייל של צד ב\' אינה תקינה.');
        return;
      }
    }

    if (selectedDatesDisplay.length === 0 && !formData.calendarDateId) {
      alert('חובה לבחור תאריך לאירוע.');
      return;
    }

    let datesForSubmit = selectedDatesDisplay;
    if (isOption && selectedDatesDisplay.length > 0) {
      const slot = normalizeTimeSlot(formData.timeOfDay as string);
      if (!slot) {
        alert('חובה לבחור זמן ביום (בוקר / צהריים / ערב).');
        return;
      }
      if (optionDatesSlotWarning) {
        alert(`לא ניתן לשמור — התאריך כבר לא זמין:\n${optionDatesSlotWarning}`);
        return;
      }
      const verify = await verifyAllOptionDates(
        selectedDatesDisplay.map(normalizeOptionDate),
        formData.eventType || 'חתונה',
        slot
      );
      if (!verify.ok) {
        alert(`לא ניתן לשמור — התאריך כבר לא זמין:\n${verify.error}`);
        return;
      }
      datesForSubmit = verify.dates;
      handleSelectedDatesChange(verify.dates);
    }

    const selectedSlot = normalizeTimeSlot(formData.timeOfDay, formData.startTime);
    if (
      !isOption
      && !convertFromOption
      && selectedSlot
      && !overrideOptionDateId
      && rawTakenSlots.includes(selectedSlot)
    ) {
      const freeSlots = TIME_SLOTS.filter((s) => !unavailableSlots.includes(s));
      if (freeSlots.length > 0) {
        alert(`משבצת ${SLOT_LABELS[selectedSlot] || selectedSlot} תפוסה. בחרי משבצת פנויה: ${freeSlots.map((s) => SLOT_LABELS[s]).join(', ')}.`);
      } else {
        alert('משבצת זו תפוסה על ידי אופציה. חזרי ללוח השנה ולחצי "סגירת אירוע במקום האופציה".');
      }
      return;
    }

    setIsSubmitting(true);
    
    try {
      const advanceAmount = Number(formData.advancePaid) || 0;
      if (!isOption && advanceAmount > 0 && !depositMethod) {
        alert('כשמזינים מקדמה — יש לבחור אמצעי תשלום (אשראי/מזומן, צ\'ק וכו\').');
        setIsSubmitting(false);
        return;
      }

      const clientAFullName = isOption
        ? `${formData.clientAFirstName.trim()} ${formData.clientALastName.trim()}`.trim()
        : formData.clientAFullName;

      const payload: Record<string, unknown> = {
        ...formData,
        clientAFullName,
        eventType: isOption ? (formData.eventType || 'לא צוין') : (isHallOnly ? HALL_ONLY_EVENT_TYPE : formData.eventType),
        timeOfDay: isOption ? (formData.timeOfDay || 'evening') : formData.timeOfDay,
        hasMusic: isWedding ? true : formData.hasMusic,
        clientComments: serializeNotesBundle({ menu: menuNotesList, internal: internalNotesList }),
        createdAt: new Date().toISOString(),
        allSelectedDates: datesForSubmit,
        isOption,
        optionDurationHours,
        servingStyle,
        kosherType,
        upgrades,
        depositMethod,
        contractSigned: !!(contractSigned && signatureData),
        calculatedTotals: totals,
        clientSignature: signatureData,
        clientSignatureUrl: signatureData || formData.clientSignatureUrl || null,
        contractText,
        paymentTemplateId: paymentTermsCustom ? 'custom' : paymentTemplateId,
        paymentTermsText: effectivePaymentTermsText,
      };

      if (convertFromOption) {
        payload.convertFromOption = true;
        payload.releaseDateIds = relatedOptions
          .filter((o) => o.id !== activeBookingId)
          .map((o) => o.calendarDateId);
      }

      if (overrideOptionDateId) {
        payload.overrideOptionDateId = overrideOptionDateId;
      }

      if (isHallOnly) {
        payload.guestCount = 0;
        payload.finalPricePortion = 0;
        payload.hallRentalPrice = Number(formData.hallRentalPrice);
      } else {
        payload.guestCount = formData.guestCount;
        payload.finalPricePortion = formData.finalPricePortion;
        delete payload.hallRentalPrice;
      }

      if (isEditMode && bookingUpdatedAt) {
        payload.expectedUpdatedAt = bookingUpdatedAt;
      }

      const submitId = convertFromOption ? activeBookingId : editId;
      const url = isEditMode ? `${API_URL}/bookings/${submitId}` : `${API_URL}/bookings`;
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const resData = await response.json();

      if (response.ok) {
        clearBookingDraft();
        const savedBooking = Array.isArray(resData.data) ? resData.data[0] : resData.data;
        const savedCode = savedBooking?.eventCode;
        const savedId = savedBooking?.id || submitId;
        const successMsg = convertFromOption
          ? `האירוע נסגר ונשמר בהצלחה!${savedCode ? `\nמספר הזמנה: ${savedCode}` : ''}`
          : isEditMode
            ? (isOption ? 'האופציה עודכנה בהצלחה!' : 'ההזמנה עודכנה בהצלחה!')
            : isOption
              ? `האופציה נשמרה בהצלחה!${savedCode ? `\nמספר אופציה: ${savedCode}` : ''}`
              : `האירוע נסגר ונשמר בהצלחה!${savedCode ? `\nמספר הזמנה: ${savedCode}` : ''}`;
        const easycountMsg = resData.easycount?.message;
        alert(easycountMsg ? `${successMsg}\n\n${easycountMsg}` : successMsg);
        if ((!isOption || convertFromOption) && contractSigned && savedId) {
          await promptPrintAfterClose(savedId);
        }
        navigate('/calendar');
      } else if (response.status === 409 && resData.conflict) {
        const updatedBy = resData.updatedBy ? ` (${resData.updatedBy})` : '';
        alert(`ההזמנה עודכנה על ידי משתמש אחר${updatedBy}. רענני את העמוד ונסי שוב.`);
        setIsSubmitting(false);
      } else {
        const fieldErrors = Array.isArray(resData.errors)
          ? resData.errors.map((e: { message?: string }) => e.message).filter(Boolean).join('\n')
          : '';
        alert(`שגיאה בשמירת הנתונים:\n${fieldErrors || resData.message || 'השרת החזיר שגיאה לא ידועה'}`);
        setIsSubmitting(false);
      }
    } catch {
      alert("שגיאת התחברות לשרת - ודאי שהשרת פועל ברקע");
      setIsSubmitting(false);
    }
  };

  if (loadingBooking) return (
    <div className="maple-bs-form maple-page-wrap">
      <p className="maple-loading">טוען...</p>
    </div>
  );

  return (
    <div className="maple-bs-form maple-page-wrap">
      <div className="card shadow-sm maple-form-card">
        <div className="card-header">
          <h2 className="h4 mb-1">
            {convertFromOption
              ? 'סגירת הזמנה מאופציה'
              : overrideOptionDateId
                ? 'סגירת אירוע במקום אופציה'
              : isEditMode
                ? (isOption ? 'עריכת אופציה' : 'עריכת הזמנה')
                : (isOption ? 'שמירת אופציה לאירוע' : 'סגירת הזמנת אירוע')}
          </h2>
          <p className="maple-subtitle">
            {isOption
              ? 'מילוי פרטי לקוח, תאריכי אופציה ושמירה'
              : 'מילוי פרטי הזמנה, תשלום וחתימה על חוזה'}
          </p>
        </div>

        {overrideOptionDateId && (
          <div className="alert alert-warning rounded-0 mb-0">
            האופציה{overrideOptionClientName ? ` של ${overrideOptionClientName}` : ''} תשוחרר ותוחלף באירוע החדש בעת השמירה.
          </div>
        )}

        <form className="card-body" onSubmit={handleSubmit}>
          <MetaBar formData={formData} handleChange={handleChange} isOption={isOption} orderNumber={orderNumber} optionDurationHours={optionDurationHours} setOptionDurationHours={setOptionDurationHours} />
          {convertFromOption && relatedOptions.length > 1 && (
            <FinalizeOptionDatesBar
              relatedOptions={relatedOptions}
              selectedBookingId={activeBookingId}
              onSelect={handleSelectFinalizeDate}
            />
          )}
          {isOption && (
            <OptionDatesBar
              selectedDates={selectedDatesDisplay}
              onChange={handleSelectedDatesChange}
              eventType={formData.eventType || 'חתונה'}
              timeSlot={formData.timeOfDay}
              slotWarning={optionDatesSlotWarning}
            />
          )}

          <div className="row g-3 maple-form-columns">
            <div className="col-lg-4">
              <ClientsSection formData={formData} handleChange={handleChange} errors={errors} isWedding={isWedding} isOption={isOption} />
              <UpgradesSection
                upgrades={upgrades}
                handleUpgradeChange={handleUpgradeChange}
                upgradesPricing={upgradesPricing}
                upgradeDisplayOrder={visibleUpgradeKeys}
                isHallOnly={isHallOnly}
              />
              <UpgradeTablesPanel
                upgrades={upgrades}
                onAddUpgrade={handleAddUpgrade}
                upgradesPricing={upgradesPricing}
                kosherType={kosherType}
                guestCount={Number(formData.guestCount) || 0}
                isHallOnly={isHallOnly}
                isFoodRelevant={isFoodRelevant}
                upgradeDisplayOrder={visibleUpgradeKeys}
                addingKey={addingUpgradeKey}
              />
              {!isOption && (
                <div className="card border-info mb-3">
                  <div className="card-body">
                    <span className="fw-semibold d-block mb-2">🎵 הסדרת רישיון אקו&quot;ם</span>

                    {!isWedding && (
                      <div className="form-check mb-2">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id="has-music"
                          checked={formData.hasMusic}
                          onChange={(e) => setFormData(prev => ({ ...prev, hasMusic: e.target.checked }))}
                        />
                        <label className="form-check-label" htmlFor="has-music">
                          יש מוזיקה באירוע (דורש תשלום לאקו&quot;ם)
                        </label>
                      </div>
                    )}

                    {(isWedding || formData.hasMusic) && (
                      <>
                        <p className="small text-secondary mb-2">
                          {isWedding ? 'חובה להסדיר רישיון השמעת מוזיקה מול אקו"ם.' : 'חובה להסדיר רישיון מול אקו"ם.'}
                        </p>
                        <a
                          href="https://apps.acum.org.il/licenses/family-event/register-payment?action=payFamilyEvent"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-sm btn-outline-primary mb-3"
                        >
                          לתשלום והפקת הרישיון לאקו&quot;ם
                        </a>
                        <div>
                          <label className="form-label">קוד אישור אקו&quot;ם:</label>
                          <input
                            type="text"
                            name="akumApprovalCode"
                            value={formData.akumApprovalCode}
                            onChange={handleChange}
                            className="form-control"
                            placeholder="מספר אישור לאחר התשלום..."
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="col-lg-4">
              <EventSettingsSection formData={formData} handleChange={handleChange} isOption={isOption} availableSlots={availableSlots} takenSlots={takenSlots} isEditMode={isEditMode} servingStyle={servingStyle} setServingStyle={setServingStyle} kosherType={kosherType} setKosherType={setKosherType} isFoodRelevant={isFoodRelevant} selectedDatesDisplay={selectedDatesDisplay} setIsMenuViewOpen={setIsMenuViewOpen} />
              {isFoodRelevant && (
                <div className="card mb-3">
                  <div className="card-header maple-section-header">הערות לתפריט</div>
                  <div className="card-body py-2">
                    <NotesList notes={menuNotesList} onChange={setMenuNotesList} placeholder="לדוגמה: אלרגיות..." />
                  </div>
                </div>
              )}
              <div className="card mb-3">
                <div className="card-header maple-section-header">הערות פנימיות</div>
                <div className="card-body py-2">
                  <NotesList notes={internalNotesList} onChange={setInternalNotesList} placeholder="הוסף הערה פנימית..." />
                </div>
              </div>
            </div>

            <div className="col-lg-4">
              <PaymentAndUpgradesSection formData={formData} handleChange={handleChange} isHallOnly={isHallOnly} isOption={isOption} depositMethod={depositMethod} setDepositMethod={handleDepositMethodChange} checkScanning={checkScanning} onCheckCapture={handleCheckCapture} onCheckFileUpload={handleCheckFileUpload} onDeleteCheck={handleDeleteCheck} onCheckDetailsChange={handleCheckDetailsChange} totals={totals} isFoodRelevant={isFoodRelevant} kosherType={kosherType} isEditMode={isEditMode} editId={editId} errors={errors} vatRate={vatRate} paymentTemplates={paymentTemplates} paymentTemplateId={paymentTemplateId} onPaymentTemplateChange={setPaymentTemplateId} paymentTermsCustom={paymentTermsCustom} onPaymentTermsCustomChange={handlePaymentTermsCustomChange} paymentTermsText={effectivePaymentTermsText} onPaymentTermsTextChange={handlePaymentTermsTextChange} eventDate={getEventDateStr()} easycountMeta={(globalSettings as { easycount?: { mode?: string; label?: string; canIssueRealDocuments?: boolean } } | undefined)?.easycount} />
            </div>
          </div>

          {(!isOption || convertFromOption) && (
          <div className="row g-3 mt-2">
            <div className="col-12">
              <div className="maple-contract-box p-3">
                {(savedSignature || formData.clientSignatureUrl) && (
                  <div className="mb-2 d-flex align-items-center gap-2">
                    <span className="text-success small">✓ חתימה נשמרה</span>
                    <img
                      src={savedSignature || formData.clientSignatureUrl}
                      alt="תצוגת חתימה"
                      style={{ maxHeight: 48, border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff' }}
                    />
                  </div>
                )}
                <div className="form-check mb-2">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="contract-signed"
                    checked={contractSigned && !!(savedSignature || formData.clientSignatureUrl)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setIsContractModalOpen(true);
                      } else {
                        setContractSigned(false);
                        setSavedSignature(null);
                        setFormData((prev) => ({ ...prev, clientSignatureUrl: '' }));
                        sigCanvas.current?.clear();
                      }
                    }}
                  />
                  <label className="form-check-label" htmlFor="contract-signed">
                    קראתי את החוזה, מאשר את התנאים וחותם
                  </label>
                </div>
                <button
                  type="button"
                  className="btn btn-link p-0"
                  onClick={() => setIsContractModalOpen(true)}
                >
                  {savedSignature || formData.clientSignatureUrl
                    ? 'לחץ לצפייה בחוזה או לחתימה מחדש'
                    : 'לחץ לקריאת החוזה ולחתימה דיגיטלית'}
                </button>
              </div>
            </div>
          </div>
          )}

          <div className="card-footer maple-form-footer d-flex gap-2">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={
                isSubmitting ||
                ((convertFromOption || (!isOption && !isEditMode)) &&
                  !(contractSigned && (savedSignature || formData.clientSignatureUrl)))
              }
            >
              {isSubmitting
                ? 'שומר נתונים...'
                : convertFromOption
                  ? 'שמירת וסגירת אירוע'
                  : isEditMode
                    ? 'שמירת שינויים'
                    : (isOption ? 'שמירת אופציה' : 'שמירת וסגירת אירוע')}
            </button>
          </div>
        </form>
      </div>

      <ContractModal
        isOpen={isContractModalOpen}
        onClose={() => setIsContractModalOpen(false)}
        isOption={isOption && !convertFromOption}
        sigCanvas={sigCanvas}
        setContractSigned={setContractSigned}
        onSignatureSaved={(dataUrl) => {
          setSavedSignature(dataUrl);
          setFormData((prev) => ({ ...prev, clientSignatureUrl: dataUrl }));
        }}
        contractText={contractText}
        onContractTextChange={setContractTextOverride}
        bookingId={editId}
      />

      {isMenuViewOpen && (
         <div className={styles.menuOverlay}><div className={styles.menuModal}><button type="button" className={styles.menuCloseBtn} onClick={() => setIsMenuViewOpen(false)}>✕ סגור</button><div className={styles.menuModalContent}><MenuDisplay /></div></div></div>
      )}
    </div>
  );
};

export default BookingForm;