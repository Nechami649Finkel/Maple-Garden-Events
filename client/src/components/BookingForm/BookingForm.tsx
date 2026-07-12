import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import styles from './BookingForm.module.css';
import { type TimeSlot, TIME_SLOTS, SLOT_LABELS, normalizeTimeSlot, getBlockedSlotsForDate, SLOT_HOURS, getSlotHours, getDefaultTimeSlot } from '../../utils/timeSlot';
import { parseNotesBundle, serializeNotesBundle } from '../../utils/notesStorage';
import { apiFetch } from '../../services/api';
import { useGlobalSettingsQuery } from '../../hooks/queries';
import {
  DEFAULT_PAYMENT_TEMPLATES,
  findPaymentTemplate,
  getPaymentTemplatesFromSettings,
  renderPaymentTermsText,
  type PaymentTermsTemplate,
} from '../../utils/paymentTerms';
import {
  buildExtrasLineItems,
  resolveFullContractText,
} from '../../utils/contractSections';
import { promptPrintAfterClose } from '../../utils/contractPrint';
import { getSignatureDataUrl } from '../../utils/signature';
import { scanCheckImage, fileToDataUrl, type DepositCheckDetails } from '../../utils/checkOcr';
import SignatureCanvas from 'react-signature-canvas';

import ClientsSection from './sections/ClientsSection';
import EventSettingsSection from './sections/EventSettingsSection';
import PaymentAndUpgradesSection from './sections/PaymentAndUpgradesSection';
import ContractModal from './sections/ContractModal';
import MetaBar from './sections/MetaBar';
import OptionDatesBar, { normalizeOptionDate } from './sections/OptionDatesBar';
import FinalizeOptionDatesBar from './sections/FinalizeOptionDatesBar';
import { verifyAllOptionDates } from '../../utils/optionDateApi';
import { calendarKeyFromDbDate } from '../../utils/dateLocal';
import { API_URL } from '../../config/api';
import { NotesList } from '../NotesList/NotesList';
import MenuDisplay from '../MenuDisplay/MenuDisplay';

export const KOSHER_PRICING: Record<string, { label: string, extra: number }> = {
  machpud: { label: 'הרב מחפוד', extra: 0 },
  rubin: { label: 'הרב רובין', extra: 10 },
  kehilot: { label: 'קהילות', extra: 10 },
  gross: { label: 'הרב גרוס', extra: 10 },
  landa: { label: 'הרב לנדא', extra: 20 },
  badatz: { label: 'בד"ץ העדה החרדית', extra: 20 },
};

export const DEFAULT_KOSHER_TYPE = 'machpud';
export const DEFAULT_VAT_TYPE = 'included';

export const SERVING_STYLES: Record<string, string> = {
  american: 'אמריקן סרביס',
  center: 'מרכז שולחן',
  bar: 'בר',
};

export const DEFAULT_SERVING_STYLE = 'american';

import {
  buildUpgradesPricingFromSettings,
  filterUpgradeDisplayOrder,
  HALL_UPGRADE_KEYS,
  EXTERNAL_UPGRADE_KEYS,
} from '../../utils/pricing';

/** קישורי דמה לתשלום לספקים חיצוניים — יוחלפו בקישורים אמיתיים */
export const EXTERNAL_SUPPLIER_LINKS: Record<string, string> = {
  baseDesign: 'https://example.com/pay/design',
  lighting: 'https://example.com/pay/lighting',
  amplification: 'https://example.com/pay/sound',
  screens: 'https://example.com/pay/screens',
  fireworks: 'https://example.com/pay/fireworks',
};

interface BookingFormProps {
  initialDates?: any[];
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
  const [relatedOptions, setRelatedOptions] = useState<any[]>([]);
  const [activeBookingId, setActiveBookingId] = useState(activeEditId || '');

  let datesToProcess: any[] = [];
  if (initialDates && initialDates.length > 0) datesToProcess = initialDates;
  else if (location.state?.selectedDates) datesToProcess = location.state.selectedDates;
  else if (location.state?.selectedDate) datesToProcess = [location.state.selectedDate];
  else if (location.state?.date) datesToProcess = [{ date: location.state.date, hebrewDate: location.state.hebrewDate || '' }];

  const [selectedDatesDisplay, setSelectedDatesDisplay] = useState<any[]>(
    datesToProcess.map(normalizeOptionDate)
  );
  const isOptionMode = !convertFromOption && (forcedIsOption || location.state?.isOption);
  const [isOption, setIsOption] = useState(isOptionMode);
  const [optionDurationHours, setOptionDurationHours] = useState(48);
  const [orderNumber, setOrderNumber] = useState('');
  const [optionDatesSlotWarning, setOptionDatesSlotWarning] = useState('');

  const [formData, setFormData] = useState({
    createdBy: '', clientAFirstName: '', clientALastName: '', clientAFullName: '', clientAIdNumber: '', clientAPhone: '', clientAPhone2: '', clientAEmail: '', clientACity: '', clientAAddress: '',
    clientBFullName: '', clientBIdNumber: '', clientBPhone: '', clientBPhone2: '', clientBEmail: '', clientBCity: '', clientBAddress: '',
    calendarDateId: '', eventType: '', timeOfDay: initialTimeSlot, startTime: initialSlotHours.start, endTime: initialSlotHours.end,
    guestCount: '', minimumGuestCount: '', optionalGuestCount: '', finalPricePortion: '200', discountPercent: '', discountAmount: '', vatType: DEFAULT_VAT_TYPE, paymentTerms: '', leadSource: '', clientSignatureUrl: '',
   
    akumApprovalCode: '', hasMusic: false, hallRentalPrice: '',
    depositCheckUrl: '', depositCheckDetails: null as DepositCheckDetails | null,
  });

  const [menuNotesList, setMenuNotesList] = useState<string[]>([]);
  const [internalNotesList, setInternalNotesList] = useState<string[]>([]);
  const [servingStyle, setServingStyle] = useState(DEFAULT_SERVING_STYLE);
  const [kosherType, setKosherType] = useState(DEFAULT_KOSHER_TYPE);
  const [upgrades, setUpgrades] = useState({
    baseDesign: true, amplification: false, lighting: false, screens: false, reception: false, separateReception: false, extraSecurity: false, fireworks: false,
  });
  const [depositMethod, setDepositMethod] = useState('');
  const [checkScanning, setCheckScanning] = useState(false);
  const [contractSigned, setContractSigned] = useState(false);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [isMenuViewOpen, setIsMenuViewOpen] = useState(false);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [contractText, setContractText] = useState('');
  const [contractBaseText, setContractBaseText] = useState('');
  const [paymentTemplates, setPaymentTemplates] = useState<PaymentTermsTemplate[]>(DEFAULT_PAYMENT_TEMPLATES);
  const [paymentTemplateId, setPaymentTemplateId] = useState('50-50');
  const [paymentTermsCustom, setPaymentTermsCustom] = useState(false);
  const [paymentTermsText, setPaymentTermsText] = useState('');
  const [vatRate, setVatRate] = useState(17);
  const { data: globalSettings } = useGlobalSettingsQuery();
  const upgradesPricing = useMemo(
    () => buildUpgradesPricingFromSettings(globalSettings),
    [globalSettings],
  );
  const visibleUpgradeKeys = useMemo(
    () => filterUpgradeDisplayOrder(globalSettings),
    [globalSettings],
  );

  useEffect(() => {
    if (globalSettings?.vatRate != null) setVatRate(Number(globalSettings.vatRate));
  }, [globalSettings]);

  useEffect(() => {
    apiFetch(`${API_URL}/bookings/contract-template`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success || !json.data) return;
        if (json.data.contractBaseText) {
          setContractBaseText(json.data.contractBaseText);
        }
        if (json.data.contractText) {
          setContractText((prev) => prev || json.data.contractText);
        }
        if (json.data.paymentTermsText) {
          setPaymentTermsText((prev) => prev || json.data.paymentTermsText);
        }
        if (json.data.paymentTemplateId) {
          setPaymentTemplateId(json.data.paymentTemplateId);
        }
        if (Array.isArray(json.data.paymentTemplates) && json.data.paymentTemplates.length > 0) {
          setPaymentTemplates(json.data.paymentTemplates);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (globalSettings?.paymentTemplates) {
      const meta = getPaymentTemplatesFromSettings(globalSettings);
      setPaymentTemplates(meta.templates);
    }
  }, [globalSettings]);

  useEffect(() => {
    if (selectedDatesDisplay.length > 0) {
      const firstDate = typeof selectedDatesDisplay[0] === 'object' ? selectedDatesDisplay[0].date : selectedDatesDisplay[0];
      setFormData(prev => ({ ...prev, calendarDateId: firstDate || '' }));
    }
  }, [selectedDatesDisplay]);

  useEffect(() => {
    if (!isOption || selectedDatesDisplay.length === 0) {
      setOptionDatesSlotWarning('');
      return;
    }
    const slot = normalizeTimeSlot(formData.timeOfDay as string);
    if (!slot) {
      setOptionDatesSlotWarning('יש לבחור זמן ביום לפני הוספת תאריכים.');
      return;
    }
    let cancelled = false;
    verifyAllOptionDates(
      selectedDatesDisplay.map(normalizeOptionDate),
      formData.eventType || 'חתונה',
      slot,
    ).then((verify) => {
      if (cancelled) return;
      setOptionDatesSlotWarning(verify.ok ? '' : verify.error);
    });
    return () => { cancelled = true; };
  }, [isOption, formData.timeOfDay, formData.eventType, selectedDatesDisplay]);

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
      } catch {}
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
        .catch(() => {});
    }
  }, [convertFromOption, activeEditId]);

  const applyBookingToForm = (b: any) => {
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
      calendarDateId: eventDateStr, eventType: b.eventType || '', timeOfDay: parsedTime.timeOfDay, startTime: parsedTime.startTime || defaultHours?.start || '', endTime: parsedTime.endTime || defaultHours?.end || '',
      guestCount: String(b.guestCount ?? ''), minimumGuestCount: String(b.minimumGuestCount ?? b.guestCount ?? ''), optionalGuestCount: calcOptionalGuestCount(b.guestCount ?? ''), finalPricePortion: String(b.finalPricePortion ?? '200'), discountPercent: '', discountAmount: '', vatType: DEFAULT_VAT_TYPE, paymentTerms: '', leadSource: b.leadSource || '', clientSignatureUrl: b.clientSignatureUrl || '',
      akumApprovalCode: b.akumApprovalCode || '', hasMusic: !!b.hasMusic,
      hallRentalPrice: b.hallRentalPrice ? String(b.hallRentalPrice) : '',
      depositCheckUrl: b.depositCheckUrl || '',
      depositCheckDetails: (b.depositCheckDetails as DepositCheckDetails | null) || null,
    });
    if (b.depositCheckUrl) {
      setDepositMethod(b.depositCheckUrl.startsWith('data:') ? 'check_capture' : 'check_upload');
    }
    const notesBundle = parseNotesBundle(b.clientComments || '');
    setMenuNotesList(notesBundle.menu);
    setInternalNotesList(notesBundle.internal);
    setContractSigned(!!b.isContractSigned);
    if (b.clientSignatureUrl) setSavedSignature(b.clientSignatureUrl);
    if (b.contractText) {
      setContractText(b.contractText);
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
    if (b.hasMusic !== undefined) setUpgrades(prev => ({ ...prev, amplification: b.hasMusic }));
  };

  useEffect(() => {
    if (!activeEditId) return;
    const loadBooking = async () => {
      try {
        const res = await apiFetch(`${API_URL}/bookings/${activeEditId}`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          alert(json.message || 'שגיאה בטעינת ההזמנה');
          navigate('/');
          return;
        }
        const b = json.data;
        const isStillOption = b.isOption || b.eventDate?.status === 'OPTION';
        if (convertFromOption && !isStillOption) {
          alert('האופציה כבר הומרה להזמנה.');
          navigate('/');
          return;
        }
        applyBookingToForm(b);
        setActiveBookingId(b.id);

        const loadRelatedOptions = async (bookingId: string) => {
          try {
            const relatedRes = await apiFetch(`${API_URL}/bookings/${bookingId}/related-options`);
            if (relatedRes.ok) {
              const relatedJson = await relatedRes.json();
              if (relatedJson.success && Array.isArray(relatedJson.data) && relatedJson.data.length > 0) {
                return relatedJson.data;
              }
            }
          } catch {}
          return [b];
        };

        const applyRelatedOptionDates = (related: any[]) => {
          setSelectedDatesDisplay(
            related
              .map((opt: any) => ({
                date: opt.eventDate?.date ? calendarKeyFromDbDate(new Date(opt.eventDate.date)) : '',
                hebrewDate: opt.eventDate?.hebrewDate || '',
              }))
              .filter((d) => d.date)
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
        navigate('/');
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
      setSelectedDatesDisplay([{ date: eventDateStr, hebrewDate: selected.eventDate?.hebrewDate || '' }]);
      setFormData((prev) => ({ ...prev, calendarDateId: eventDateStr }));
    }
  };

  useEffect(() => {
    if (isEditMode) return;
    const free = availableSlots;
    const current = formData.timeOfDay as TimeSlot;

    if (current && unavailableSlots.includes(current)) {
      const next = getDefaultTimeSlot(free);
      if (!next) return;
      const hours = getSlotHours(next);
      setFormData((prev) =>
        prev.timeOfDay === next && prev.startTime === hours.start && prev.endTime === hours.end
          ? prev
          : { ...prev, timeOfDay: next, startTime: hours.start, endTime: hours.end }
      );
    } else if (!current && free.length > 0) {
      const next = getDefaultTimeSlot(free);
      const hours = getSlotHours(next);
      setFormData((prev) => ({ ...prev, timeOfDay: next, startTime: hours.start, endTime: hours.end }));
    }
  }, [isEditMode, unavailableSlots.join(','), availableSlots.join(','), formData.timeOfDay]);

  useEffect(() => {
    if (isEditMode) return;
    if (formData.eventType === 'חתונה') {
      const eveningOk = availableSlots.includes('evening') && !unavailableSlots.includes('evening');
      if (eveningOk && formData.timeOfDay !== 'evening') {
        const { start, end } = getSlotHours('evening');
        setFormData((prev) => ({ ...prev, timeOfDay: 'evening', startTime: start, endTime: end }));
        return;
      }
    }
    const slot = formData.timeOfDay as TimeSlot;
    if (!slot || !SLOT_HOURS[slot]) return;
    const { start, end } = getSlotHours(slot);
    setFormData((prev) => {
      if (prev.startTime === start && prev.endTime === end) return prev;
      return { ...prev, startTime: start, endTime: end };
    });
  }, [formData.timeOfDay, formData.eventType, isEditMode, unavailableSlots.join(','), availableSlots.join(',')]);

  useEffect(() => {
    if (formData.eventType !== HALL_ONLY_EVENT_TYPE) {
      setErrors((prev) => (prev.hallRentalPrice ? { ...prev, hallRentalPrice: '' } : prev));
    }
  }, [formData.eventType]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'radio' && name === 'vatType') return setFormData(prev => ({ ...prev, vatType: value }));
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
    } else if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleUpgradeChange = (key: keyof typeof upgrades) => {
    if (key === 'baseDesign') return;
    setUpgrades((prev) => ({ ...prev, [key]: !prev[key] }));
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
  const extrasTotal = hallExtrasTotal;
  const finalTotal = baseTotal + hallExtrasTotal + externalExtrasTotal;

  return {
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
    extrasTotal,
    finalTotal,
    base: mainBase + hallExtrasBase + externalExtrasBase,
    subtotal: mainSubtotal + hallExtrasSubtotal + externalExtrasSubtotal,
    vatAmount: mainVat + hallExtrasVat + externalExtrasVat,
  };
  };

  const totals = calculateTotals();

  const handlePaymentTermsTextChange = (text: string) => {
    setPaymentTermsText(text);
  };

  useEffect(() => {
    if (paymentTermsCustom || !contractBaseText) return;
    const template = findPaymentTemplate(paymentTemplates, paymentTemplateId);
    if (!template) return;
    const paragraph = renderPaymentTermsText(template, {
      total: totals.finalTotal,
      eventDate: getEventDateStr(),
    });
    setPaymentTermsText(paragraph);
  }, [
    paymentTemplateId,
    paymentTermsCustom,
    contractBaseText,
    paymentTemplates,
    totals.finalTotal,
    selectedDatesDisplay,
    formData.calendarDateId,
  ]);

  useEffect(() => {
    if (!contractBaseText) return;
    const extras = buildExtrasLineItems({
      upgrades,
      kosherType,
      guestCount: Number(formData.guestCount) || 0,
      isHallOnly,
      isFoodRelevant,
      upgradesPricing,
    });
    setContractText(resolveFullContractText({
      baseContract: contractBaseText,
      paymentTerms: paymentTermsText,
      extras,
      menuNotes: menuNotesList,
    }));
  }, [
    contractBaseText,
    paymentTermsText,
    upgrades,
    kosherType,
    formData.guestCount,
    isHallOnly,
    isFoodRelevant,
    menuNotesList,
    upgradesPricing,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let signatureData: string | null = savedSignature;
    if (!signatureData && contractSigned) {
      signatureData = getSignatureDataUrl(sigCanvas);
    }
    if (!signatureData && isEditMode && formData.clientSignatureUrl) {
      signatureData = formData.clientSignatureUrl;
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
      setSelectedDatesDisplay(verify.dates);
    }

    const selectedSlot = normalizeTimeSlot(formData.timeOfDay, formData.startTime, formData.endTime);
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
        contractSigned,
        calculatedTotals: totals,
        clientSignature: signatureData,
        contractText,
        paymentTemplateId: paymentTermsCustom ? 'custom' : paymentTemplateId,
        paymentTermsText,
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

      const submitId = convertFromOption ? activeBookingId : editId;
      const url = isEditMode ? `${API_URL}/bookings/${submitId}` : `${API_URL}/bookings`;
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const resData = await response.json();

      if (response.ok) {
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
        alert(successMsg);
        if ((!isOption || convertFromOption) && contractSigned && savedId) {
          await promptPrintAfterClose(savedId);
        }
        navigate('/');
      } else {
        const fieldErrors = Array.isArray(resData.errors)
          ? resData.errors.map((e: { message?: string }) => e.message).filter(Boolean).join('\n')
          : '';
        alert(`שגיאה בשמירת הנתונים:\n${fieldErrors || resData.message || 'השרת החזיר שגיאה לא ידועה'}`);
        setIsSubmitting(false);
      }
    } catch (error) {
      alert("שגיאת התחברות לשרת - ודאי שהשרת פועל ברקע");
      setIsSubmitting(false);
    }
  };

  if (loadingBooking) return <div className={styles.container}><p className={styles.loadingText}>טוען...</p></div>;

  return (
    <div className={styles.container}>
      <div className={styles.formCard}>
        <div className={styles.header}>
          <div className={styles.headerText}>
            <h2 className={styles.title}>
              {convertFromOption
                ? 'סגירת הזמנה מאופציה'
                : overrideOptionDateId
                  ? 'סגירת אירוע במקום אופציה'
                : isEditMode
                  ? (isOption ? 'עריכת אופציה' : 'עריכת הזמנה')
                  : (isOption ? 'שמירת אופציה לאירוע' : 'סגירת הזמנת אירוע')}
            </h2>
          </div>
        </div>

        {overrideOptionDateId && (
          <div className={styles.overrideOptionBanner}>
            האופציה{overrideOptionClientName ? ` של ${overrideOptionClientName}` : ''} תשוחרר ותוחלף באירוע החדש בעת השמירה.
          </div>
        )}

        <form className={styles.formWrapper} onSubmit={handleSubmit} style={{ direction: 'rtl' }}>
          <MetaBar formData={formData} handleChange={handleChange} isOption={isOption} orderNumber={orderNumber} optionDurationHours={optionDurationHours} setOptionDurationHours={setOptionDurationHours} selectedDatesDisplay={selectedDatesDisplay} />
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
              onChange={setSelectedDatesDisplay}
              eventType={formData.eventType || 'חתונה'}
              timeSlot={formData.timeOfDay}
              slotWarning={optionDatesSlotWarning}
            />
          )}

          <div className={styles.formGrid}>
            <div className={styles.formColumn}>
              <ClientsSection formData={formData} handleChange={handleChange} errors={errors} setErrors={setErrors} isWedding={isWedding} isOption={isOption} styles={styles} />
            </div>

            <div className={styles.formColumn}>
              <EventSettingsSection formData={formData} handleChange={handleChange} isOption={isOption} availableSlots={availableSlots} takenSlots={takenSlots} isEditMode={isEditMode} servingStyle={servingStyle} setServingStyle={setServingStyle} kosherType={kosherType} setKosherType={setKosherType} isFoodRelevant={isFoodRelevant} selectedDatesDisplay={selectedDatesDisplay} setIsMenuViewOpen={setIsMenuViewOpen} styles={styles} />
              {isFoodRelevant && (
                <div className={`${styles.sectionCard} ${styles.compactNotesWrap}`}>
                  <h3 className={styles.sectionHeader}>הערות לתפריט</h3>
                  <NotesList notes={menuNotesList} onChange={setMenuNotesList} placeholder="לדוגמה: אלרגיות..." />
                </div>
              )}
            </div>

            <div className={styles.formColumn}>
              <PaymentAndUpgradesSection formData={formData} handleChange={handleChange} upgrades={upgrades} handleUpgradeChange={handleUpgradeChange} upgradesPricing={upgradesPricing} upgradeDisplayOrder={visibleUpgradeKeys} isHallOnly={isHallOnly} isOption={isOption} depositMethod={depositMethod} setDepositMethod={handleDepositMethodChange} checkScanning={checkScanning} onCheckCapture={handleCheckCapture} onCheckFileUpload={handleCheckFileUpload} onDeleteCheck={handleDeleteCheck} onCheckDetailsChange={handleCheckDetailsChange} totals={totals} isFoodRelevant={isFoodRelevant} kosherType={kosherType} isEditMode={isEditMode} editId={editId} errors={errors} vatRate={vatRate} styles={styles} paymentTemplates={paymentTemplates} paymentTemplateId={paymentTemplateId} onPaymentTemplateChange={setPaymentTemplateId} paymentTermsCustom={paymentTermsCustom} onPaymentTermsCustomChange={setPaymentTermsCustom} paymentTermsText={paymentTermsText} onPaymentTermsTextChange={handlePaymentTermsTextChange} eventDate={getEventDateStr()} />
            </div>
          </div>

          <div className={`${styles.formBottomRow} ${isOption ? styles.formBottomRowCompact : ''}`}>
            <div className={`${styles.sectionCard} ${styles.compactNotesWrap}`}>
              <h3 className={styles.sectionHeader}>הערות פנימיות</h3>
              <NotesList notes={internalNotesList} onChange={setInternalNotesList} placeholder="הוסף הערה פנימית..." />
            </div>

            {((!isEditMode && !isOption) || convertFromOption) && (
              <div className={styles.contractBox}>
                <label className={styles.contractCheckLabel}>
                  <input
                    type="checkbox"
                    checked={contractSigned}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setIsContractModalOpen(true);
                      } else {
                        setContractSigned(false);
                        setSavedSignature(null);
                        sigCanvas.current?.clear();
                      }
                    }}
                  />
                  קראתי את החוזה, מאשר את התנאים וחותם
                </label>
                <div className={styles.contractLink} onClick={() => setIsContractModalOpen(true)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setIsContractModalOpen(true)}>
                  לחץ לקריאת החוזה ולחתימה דיגיטלית
                </div>
              </div>
            )}

            {!isOption && (
              <div className={styles.akumBox}>
                <span className={styles.akumTitle}>🎵 הסדרת רישיון אקו&quot;ם</span>

                {!isWedding && (
                  <label className={styles.akumCheckLabel}>
                    <input
                      type="checkbox"
                      checked={formData.hasMusic}
                      onChange={(e) => setFormData(prev => ({ ...prev, hasMusic: e.target.checked }))}
                    />
                    יש מוזיקה באירוע (דורש תשלום לאקו&quot;ם)
                  </label>
                )}

                {(isWedding || formData.hasMusic) && (
                  <>
                    <span className={styles.akumText}>
                      {isWedding ? 'חובה להסדיר רישיון השמעת מוזיקה מול אקו"ם.' : 'חובה להסדיר רישיון מול אקו"ם.'}
                    </span>
                    <a
                      href="https://apps.acum.org.il/licenses/family-event/register-payment?action=payFamilyEvent"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.akumLink}
                    >
                      לתשלום והפקת הרישיון לאקו&quot;ם
                    </a>
                    <div className={styles.inputGroup}>
                      <label className={styles.akumInputLabel}>קוד אישור אקו&quot;ם:</label>
                      <input
                        type="text"
                        name="akumApprovalCode"
                        value={formData.akumApprovalCode}
                        onChange={handleChange}
                        className={`${styles.input} ${styles.akumInput}`}
                        placeholder="מספר אישור לאחר התשלום..."
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className={styles.formFooter}>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isSubmitting || ((convertFromOption || (!isOption && !isEditMode)) && !contractSigned)}
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

      <ContractModal isOpen={isContractModalOpen} onClose={() => setIsContractModalOpen(false)} isOption={isOption && !convertFromOption} sigCanvas={sigCanvas} setContractSigned={setContractSigned} onSignatureSaved={setSavedSignature} contractText={contractText} onContractTextChange={setContractText} />

      {isMenuViewOpen && (
         <div className={styles.menuOverlay}><div className={styles.menuModal}><button type="button" className={styles.menuCloseBtn} onClick={() => setIsMenuViewOpen(false)}>✕ סגור</button><div className={styles.menuModalContent}><MenuDisplay /></div></div></div>
      )}
    </div>
  );
};

export default BookingForm;