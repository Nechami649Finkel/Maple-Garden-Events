import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import styles from './BookingForm.module.css';
import { type TimeSlot, TIME_SLOTS, normalizeTimeSlot, getBlockedSlotsForDate, SLOT_HOURS, getSlotHours, getDefaultTimeSlot } from '../../utils/timeSlot';
import { parseNotesBundle, serializeNotesBundle } from '../../utils/notesStorage';
import { apiFetch } from '../../services/api';
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

export const SERVING_STYLES: Record<string, string> = {
  american: 'אמריקן סרביס',
  center: 'מרכז שולחן',
  bar: 'בר',
};

export const DEFAULT_SERVING_STYLE = 'american';

export const UPGRADES_PRICING: Record<string, number> = {
  baseDesign: 4500, amplification: 1400, lighting: 1800, screens: 800,
  reception: 2000, separateReception: 3000, extraSecurity: 650, fireworks: 700,
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
  const { id: editId } = useParams<{ id: string }>();
  const isEditMode = !!editId;
  const takenSlots: TimeSlot[] = (location.state?.takenSlots as TimeSlot[]) || [];
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
  const initialTimeSlot = (isEditMode ? 'evening' : getDefaultTimeSlot(availableSlots) || 'evening') as TimeSlot;
  const initialSlotHours = getSlotHours(initialTimeSlot);
  const sigCanvas = useRef<SignatureCanvas>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadingBooking, setLoadingBooking] = useState(isEditMode);
  const [isSubmitting, setIsSubmitting] = useState(false);

  let datesToProcess: any[] = [];
  if (initialDates && initialDates.length > 0) datesToProcess = initialDates;
  else if (location.state?.selectedDates) datesToProcess = location.state.selectedDates;
  else if (location.state?.selectedDate) datesToProcess = [location.state.selectedDate];
  else if (location.state?.date) datesToProcess = [{ date: location.state.date, hebrewDate: location.state.hebrewDate || '' }];

  const [selectedDatesDisplay, setSelectedDatesDisplay] = useState<any[]>(
    datesToProcess.map(normalizeOptionDate)
  );
  const isOptionMode = forcedIsOption || location.state?.isOption;
  const [isOption, setIsOption] = useState(isOptionMode);
  const [optionDurationHours, setOptionDurationHours] = useState(48);
  const [orderNumber, setOrderNumber] = useState('');

  const [formData, setFormData] = useState({
    createdBy: '',
    clientAFirstName: '',
    clientALastName: '',
    clientAFullName: '', clientAIdNumber: '', clientAPhone: '', clientAPhone2: '', clientAEmail: '', clientACity: '', clientAAddress: '',
    clientBFullName: '', clientBIdNumber: '', clientBPhone: '', clientBPhone2: '', clientBEmail: '', clientBCity: '', clientBAddress: '',
    calendarDateId: '', eventType: '', timeOfDay: isOptionMode ? '' : initialTimeSlot, startTime: isOptionMode ? '' : initialSlotHours.start, endTime: isOptionMode ? '' : initialSlotHours.end,
    guestCount: '', optionalGuestCount: '', finalPricePortion: '200', discountPercent: '', discountAmount: '', vatType: 'not_included', paymentTerms: '', leadSource: '', clientSignatureUrl: '',
   
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
  const [contractText, setContractText] = useState('');
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [isMenuViewOpen, setIsMenuViewOpen] = useState(false);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);

  useEffect(() => {
    if (isEditMode) return;
    const loadTemplate = async () => {
      try {
        const res = await apiFetch('http://localhost:5000/api/bookings/contract-template');
        const json = await res.json();
        if (res.ok && json.success) {
          setContractText(json.data?.contractText || '');
        }
      } catch {
        // fallback silently
      }
    };
    loadTemplate();
  }, [isEditMode]);

  useEffect(() => {
    if (selectedDatesDisplay.length > 0) {
      const firstDate = typeof selectedDatesDisplay[0] === 'object' ? selectedDatesDisplay[0].date : selectedDatesDisplay[0];
      setFormData(prev => ({ ...prev, calendarDateId: firstDate || '' }));
    }
  }, [selectedDatesDisplay]);

  useEffect(() => {
    if (isEditMode) return;
    const dateCount = Math.max(selectedDatesDisplay.length, 1);
    const prefix = isOption ? 'OPT' : 'EVT';

    const loadNextCode = async () => {
      try {
        const res = await apiFetch(`http://localhost:5000/api/bookings/next-code?prefix=${prefix}&count=${dateCount}`);
        const json = await res.json();
        if (!res.ok || !json.success) return;
        const codes: string[] = json.data.codes || [];
        if (codes.length === 0) return;
        if (codes.length === 1) setOrderNumber(codes[0]);
        else setOrderNumber(`${codes[0]} – ${codes[codes.length - 1]}`);
      } catch {}
    };
    loadNextCode();
  }, [isEditMode, isOption, selectedDatesDisplay.length]);

  useEffect(() => {
    if (!editId) return;
    const loadBooking = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/bookings/${editId}`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          alert(json.message || 'שגיאה בטעינת ההזמנה');
          navigate('/');
          return;
        }
        const b = json.data;
        const phoneA = parseCombinedPhone(b.clientAPhone);
        const phoneB = parseCombinedPhone(b.clientBPhone);
        const addrA = parseAddress(b.clientAAddress);
        const addrB = parseAddress(b.clientBAddress);
        const eventDateStr = b.eventDate?.date ? new Date(b.eventDate.date).toISOString().split('T')[0] : '';
        const loadedIsOption = b.eventDate?.status === 'OPTION';
        const nameParts = splitFullName(b.clientAFullName || '');
        setIsOption(loadedIsOption);
        setOrderNumber(b.eventCode || b.id.slice(0, 8));
        if (eventDateStr) setSelectedDatesDisplay([{ date: eventDateStr, hebrewDate: '' }]);
        const parsedTime = parseStoredTimeOfDay(b.timeOfDay);
        const loadedSlot = parsedTime.timeOfDay as TimeSlot;
        const defaultHours = loadedSlot && SLOT_HOURS[loadedSlot] ? getSlotHours(loadedSlot) : null;
        
     setFormData({
          createdBy: b.createdBy || '',
          clientAFirstName: nameParts.first,
          clientALastName: nameParts.last,
          clientAFullName: b.clientAFullName || '', clientAIdNumber: b.clientAIdNumber || '', clientAPhone: phoneA.phone, clientAPhone2: phoneA.phone2, clientAEmail: b.clientAEmail || '', clientACity: addrA.city, clientAAddress: addrA.address,
          clientBFullName: b.clientBFullName || '', clientBIdNumber: b.clientBIdNumber || '', clientBPhone: phoneB.phone, clientBPhone2: phoneB.phone2, clientBEmail: b.clientBEmail || '', clientBCity: addrB.city, clientBAddress: addrB.address,
          calendarDateId: eventDateStr, eventType: b.eventType || '', timeOfDay: parsedTime.timeOfDay, startTime: parsedTime.startTime || defaultHours?.start || '', endTime: parsedTime.endTime || defaultHours?.end || '',
          guestCount: String(b.guestCount ?? ''), optionalGuestCount: calcOptionalGuestCount(b.guestCount ?? ''), finalPricePortion: String(b.finalPricePortion ?? '200'), discountPercent: '', discountAmount: '', vatType: 'not_included', paymentTerms: '', leadSource: b.leadSource || '', clientSignatureUrl: b.clientSignatureUrl || '',
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
        } else {
          try {
            const templateRes = await apiFetch('http://localhost:5000/api/bookings/contract-template');
            const templateJson = await templateRes.json();
            if (templateRes.ok && templateJson.success) {
              setContractText(templateJson.data?.contractText || '');
            }
          } catch {
            // fallback silently
          }
        }
        if (b.hasMusic !== undefined) setUpgrades(prev => ({ ...prev, amplification: b.hasMusic }));
      } catch {
        alert('שגיאה בטעינת ההזמנה');
        navigate('/');
      } finally {
        setLoadingBooking(false);
      }
    };
    loadBooking();
  }, [editId, navigate]);

  useEffect(() => {
    if (isEditMode || isOption) return;
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
  }, [isEditMode, isOption, unavailableSlots.join(','), availableSlots.join(','), formData.timeOfDay]);

  useEffect(() => {
    if (isEditMode || isOption) return;
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
  }, [formData.timeOfDay, formData.eventType, isEditMode, isOption, unavailableSlots.join(','), availableSlots.join(',')]);

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
const calculateTotals = () => {
  let base = 0;
  
  // הוספנו את התנאי הזה: אם זה רק אולם, מחיר הבסיס הוא המחיר שהמנהל הזין
  if (isHallOnly) {
    base += Number(formData.hallRentalPrice) || 0;
  }

  Object.keys(upgrades).forEach((key) => {
    if (key === 'baseDesign' && isHallOnly) return; 
    if (upgrades[key as keyof typeof upgrades]) base += UPGRADES_PRICING[key];
  });

  if (isFoodRelevant) {
    const portions = Number(formData.guestCount) || 0;
    const basePrice = Number(formData.finalPricePortion) || 0;
    base += portions * (basePrice + KOSHER_PRICING[kosherType].extra);
  }

  let discountVal = 0;
  if (formData.discountPercent) discountVal += base * (Number(formData.discountPercent) / 100);
  if (formData.discountAmount) discountVal += Number(formData.discountAmount);
  let subtotal = Math.max(0, base - discountVal);
  let vatAmount = formData.vatType === 'not_included' ? subtotal * 0.18 : 0; 
  return { base, discountVal, subtotal, vatAmount, finalTotal: subtotal + vatAmount };
};
  const totals = calculateTotals();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let signatureData: string | null = savedSignature;
    if (!signatureData && contractSigned) {
      signatureData = getSignatureDataUrl(sigCanvas);
    }
    if (!signatureData && isEditMode && formData.clientSignatureUrl) {
      signatureData = formData.clientSignatureUrl;
    }

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
    } else {
      if (!isEditMode && !contractSigned) {
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
    }

    if (selectedDatesDisplay.length === 0 && !formData.calendarDateId) {
      alert('חובה לבחור תאריך לאירוע.');
      return;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.clientAEmail?.trim() && !emailPattern.test(formData.clientAEmail.trim())) {
      alert('כתובת האימייל של בעל/ת השמחה אינה תקינה.');
      return;
    }
    if (formData.clientBEmail?.trim() && !emailPattern.test(formData.clientBEmail.trim())) {
      alert('כתובת האימייל של צד ב\' אינה תקינה.');
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
        allSelectedDates: selectedDatesDisplay,
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
      };

      if (isHallOnly) {
        payload.guestCount = 0;
        payload.finalPricePortion = 0;
        payload.hallRentalPrice = Number(formData.hallRentalPrice);
      } else {
        payload.guestCount = formData.guestCount;
        payload.finalPricePortion = formData.finalPricePortion;
        delete payload.hallRentalPrice;
      }

      const url = isEditMode ? `http://localhost:5000/api/bookings/${editId}` : 'http://localhost:5000/api/bookings';
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const resData = await response.json();

      if (response.ok) {
        const savedBooking = Array.isArray(resData.data) ? resData.data[0] : resData.data;
        const savedCode = savedBooking?.eventCode;
        const savedId = savedBooking?.id || editId;
        alert(isEditMode ? 'ההזמנה עודכנה בהצלחה!' : isOption ? `האופציה נשמרה בהצלחה!${savedCode ? `\nמספר אופציה: ${savedCode}` : ''}` : `האירוע נסגר ונשמר בהצלחה!${savedCode ? `\nמספר הזמנה: ${savedCode}` : ''}`);
        if (!isOption && contractSigned && savedId) {
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
          <img src="/logo.png" alt="מיפל" className={styles.headerLogo} />
          <div className={styles.headerText}>
            <h2 className={styles.title}>{isEditMode ? (isOption ? 'עריכת אופציה' : 'עריכת הזמנה') : (isOption ? 'שמירת אופציה לאירוע' : 'סגירת הזמנת אירוע')}</h2>
          </div>
        </div>

        <form className={styles.formBody} onSubmit={handleSubmit} style={{ direction: 'rtl' }}>
          <MetaBar formData={formData} handleChange={handleChange} isOption={isOption} orderNumber={orderNumber} optionDurationHours={optionDurationHours} setOptionDurationHours={setOptionDurationHours} />
          {isOption && (
            <OptionDatesBar
              selectedDates={selectedDatesDisplay}
              onChange={setSelectedDatesDisplay}
              eventType={formData.eventType || 'חתונה'}
              timeSlot={formData.timeOfDay || 'evening'}
            />
          )}
          <ClientsSection formData={formData} handleChange={handleChange} errors={errors} setErrors={setErrors} isWedding={isWedding} isOption={isOption} styles={styles} />
          <EventSettingsSection formData={formData} handleChange={handleChange} isOption={isOption} availableSlots={availableSlots} takenSlots={takenSlots} isEditMode={isEditMode} servingStyle={servingStyle} setServingStyle={setServingStyle} kosherType={kosherType} setKosherType={setKosherType} isFoodRelevant={isFoodRelevant} selectedDatesDisplay={selectedDatesDisplay} setIsMenuViewOpen={setIsMenuViewOpen} styles={styles} />
             {isFoodRelevant && (
          <div className={styles.sectionCard}>
            <h3 className={styles.sectionHeader}>הערות לתפריט ובקשות מיוחדות</h3>
            <NotesList notes={menuNotesList} onChange={setMenuNotesList} placeholder="לדוגמה: אלרגיות מיוחדות..." />
          </div>)}

          <PaymentAndUpgradesSection
            formData={formData}
            handleChange={handleChange}
            upgrades={upgrades}
            handleUpgradeChange={handleUpgradeChange}
            isHallOnly={isHallOnly}
            depositMethod={depositMethod}
            setDepositMethod={handleDepositMethodChange}
            checkScanning={checkScanning}
            onCheckCapture={handleCheckCapture}
            onCheckFileUpload={handleCheckFileUpload}
            onDeleteCheck={handleDeleteCheck}
            onCheckDetailsChange={handleCheckDetailsChange}
            totals={totals}
            isFoodRelevant={isFoodRelevant}
            kosherType={kosherType}
            isEditMode={isEditMode}
            editId={editId}
            errors={errors}
            styles={styles}
          />

          <div className={styles.sectionCard}>
            <h3 className={styles.sectionHeader}>הערות פנימיות לניהול</h3>
            <NotesList notes={internalNotesList} onChange={setInternalNotesList} placeholder="הוסף הערה פנימית..." />
          </div>
          
          {/* עריכת מלל חוזה לאירוע קיים */}
          {isEditMode && !isOption && (
            <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '16px', marginBottom: '20px', textAlign: 'right' }}>
              <p style={{ margin: '0 0 10px', color: '#1e40af', fontWeight: '500' }}>
                מלל החוזה שמור ספציפית לאירוע זה. ניתן לערוך אותו לפני שמירת ההזמנה.
              </p>
              <button
                type="button"
                onClick={() => setIsContractModalOpen(true)}
                style={{
                  background: '#2563eb',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                ✏️ עריכת / צפייה במלל החוזה
              </button>
            </div>
          )}

          {/* הקופסה הירוקה לאישור החוזה - פותחת את המודאל בלחיצה */}
          {!isEditMode && !isOption && (
            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '16px', marginBottom: '20px', textAlign: 'right' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontSize: '1.05rem', color: '#1f293b', fontWeight: '500' }}>
                <input 
                  type="checkbox" 
                  checked={contractSigned} 
                  onChange={(e) => {
                    if (e.target.checked) {
                      setIsContractModalOpen(true); // לחיצה פותחת את המודאל
                    } else {
                      setContractSigned(false);
                      setSavedSignature(null);
                      sigCanvas.current?.clear();
                    }
                  }} 
                  style={{ width: '18px', height: '18px', accentColor: '#2563eb' }}
                />
                קראתי את החוזה, אני מאשר את התנאים וחותם
              </label>
              <div 
                onClick={() => setIsContractModalOpen(true)}
                style={{ color: '#2563eb', textDecoration: 'underline', cursor: 'pointer', marginTop: '8px', fontSize: '0.95rem', paddingRight: '30px' }}
              >
                לחץ כאן לקריאת החוזה המלא ולחתימה דיגיטלית
              </div>
            </div>
          )}
          
          {/* 🎵 קופסת התשלום לאקו"ם (מותנה סוג אירוע/מוזיקה) 🎵 */}
          {!isOption && (
            <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '16px', marginBottom: '20px', textAlign: 'right' }}>
              <span style={{ display: 'block', fontWeight: 'bold', color: '#92400e', marginBottom: '8px' }}>
                 🎵 הסדרת רישיון אקו"ם
              </span>
              
              {!isWedding && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', cursor: 'pointer', color: '#b45309', fontWeight: '500' }}>
                  <input 
                    type="checkbox" 
                    checked={formData.hasMusic} 
                    onChange={(e) => setFormData(prev => ({ ...prev, hasMusic: e.target.checked }))} 
                    style={{ width: '16px', height: '16px', accentColor: '#d97706' }}
                  />
                  יש מוזיקה באירוע (דורש תשלום לאקו"ם)
                </label>
              )}

              {(isWedding || formData.hasMusic) && (
                <>
                  <span style={{ fontSize: '0.95rem', color: '#b45309', display: 'block', marginBottom: '10px' }}>
                    {isWedding ? 'חובה להסדיר רישיון השמעת מוזיקה מול אקו"ם עבור אירועי חתונה.' : 'מכיוון שציינת שיש מוזיקה באירוע, חובה להסדיר רישיון מול אקו"ם.'}
                  </span>
                  <a 
                    href="https://apps.acum.org.il/licenses/family-event/register-payment?action=payFamilyEvent" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ color: '#d97706', fontWeight: 'bold', textDecoration: 'underline', display: 'inline-block', marginBottom: '15px' }}
                  >
                    לתשלום והפקת הרישיון לאקו"ם לחצו כאן
                  </a>
                  
                  <div className={styles.inputGroup}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#92400e' }}>קוד אישור אקו"ם (יתקבל לאחר התשלום):</label>
                    <input
                      type="text"
                      name="akumApprovalCode"
                      value={formData.akumApprovalCode}
                      onChange={handleChange}
                      className={styles.input}
                      placeholder="הזן מספר אישור שקיבלת לאחר התשלום..."
                      style={{ borderColor: '#fcd34d', backgroundColor: '#fff', width: '100%', maxWidth: '300px' }}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* כפתור השמירה הראשי */}
          <div className={styles.actions} style={{ display: 'flex', gap: '15px', justifyContent: 'flex-start', marginTop: '10px' }}>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isSubmitting || (!isEditMode && !isOption && !contractSigned)}
              style={{
                backgroundColor: '#A2C2A6', 
                color: 'white',
                padding: '12px 36px',
                borderRadius: '8px',
                border: 'none',
                cursor: (!isEditMode && !isOption && !contractSigned) ? 'not-allowed' : 'pointer',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                opacity: (!isEditMode && !isOption && !contractSigned) ? 0.6 : 1,
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
            >
              {isSubmitting ? 'שומר נתונים...' : isEditMode ? 'שמירת שינויים' : (isOption ? 'שמירת אופציה' : 'שמירת וסגירת אירוע')}
            </button>
          </div>

        </form>
      </div>

      <ContractModal
        isOpen={isContractModalOpen}
        onClose={() => setIsContractModalOpen(false)}
        isOption={isOption}
        sigCanvas={sigCanvas}
        setContractSigned={setContractSigned}
        onSignatureSaved={setSavedSignature}
        contractText={contractText}
        onContractTextChange={setContractText}
      />

      {isMenuViewOpen && (
         <div className={styles.menuOverlay}><div className={styles.menuModal}><button type="button" className={styles.menuCloseBtn} onClick={() => setIsMenuViewOpen(false)}>✕ סגור</button><div className={styles.menuModalContent}><MenuDisplay /></div></div></div>
      )}
    </div>
  );
};

export default BookingForm;