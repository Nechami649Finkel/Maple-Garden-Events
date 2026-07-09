import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNavigationOverride } from '../../context/NavigationContext';
import styles from './EventFormManager.module.css';
import CheckCamera from '../CheckCamera/CheckCamera';
import CheckDetailsForm from '../CheckDetailsForm/CheckDetailsForm';
import { scanCheckImage, fileToDataUrl, type DepositCheckDetails } from '../../utils/checkOcr';
import CancellationStats from '../CancellationStats/CancellationStats';
import KashrutSelector from '../KashrutSelector/KashrutSelector';
import MenuSelectionForm from '../MenuSelectionForm/MenuSelectionForm';
import FloorPlanBuilder from '../FloorPlanBuilder/FloorPlanBuilder';
import type { TableData } from '../FloorPlanBuilder/FloorPlanBuilder';
import { serverTablesToClient, clientTablesToServer } from '../../constants/defaultTableLayout';
import { calculatePortionBilling } from '../../utils/portionBilling';
import { hasEventEnded } from '../../utils/eventStart';
import { API_URL } from '../../config/api';
import { secureFetch } from '../../services/api';
import {
  useBookingsQuery,
  useEventFormsQuery,
  useGlobalSettingsQuery,
  useKashrutQuery,
} from '../../hooks/queries';
import {
  PageHeader,
  Input,
  EventCard,
  SectionHeader,
  EmptyState,
  type EventCardData,
} from '../ui';

interface Booking {
  id: string;
  clientAFullName: string;
  clientAIdNumber: string;
  clientBFullName?: string;
  clientBIdNumber?: string;
  clientSignatureUrl?: string;
  clientAEmail?: string; 
  clientBEmail?: string;
  eventDate: {
    date: string;
    status?: string;
  };
  guestCount: number;
  eventType: string;
  timeOfDay: string;
  eventForm?: any;
  akumApprovalCode?: string;
}

const computePercentSplit = (menCount: number, womenCount: number) => {
  const total = menCount + womenCount;
  if (total <= 0) return { menPercent: undefined, womenPercent: undefined };
  const menPercent = Math.round((menCount / total) * 100);
  return { menPercent, womenPercent: 100 - menPercent };
};

const countsFromPercents = (menPercent?: number, womenPercent?: number, guestTotal?: number) => {
  if (!guestTotal || guestTotal <= 0 || menPercent == null || womenPercent == null) {
    return { menCount: undefined, womenCount: undefined };
  }
  const menCount = Math.round((guestTotal * menPercent) / 100);
  return { menCount, womenCount: Math.max(0, guestTotal - menCount) };
};

interface EventFormData {
  eventTime?: string;
  receptionType?: string;
  finalGuestCount?: number;
  seatingType?: string;
  menCount?: number;
  womenCount?: number;
  menPercent?: number;
  womenPercent?: number;
  honorTableCount?: number;
  tableclothId?: string;
  napkinId?: string;
  centerpiece?: string;
  bridgeChair?: string;
  hasLighting?: boolean;
  hasSoundSystem?: boolean;
  hasScreens?: boolean;
  hasFireworks?: boolean;
  entertainersTotal?: number; 
  entertainersBar?: number;
  entertainersSitting?: number;
  entertainersMen?: number;
  entertainersWomen?: number;
  depositCheckUrl?: string;
  depositCheckStatus?: boolean;
  depositCheckDetails?: DepositCheckDetails | null;
  akumPaid?: boolean; 
  akumCode?: string;
  kashrut?: string;
  notes?: string;

  menuSelections?: Record<string, string[]> | null;
  guestPortionCount?: number;
  pricePerPortion?: number;
  totalPrice?: number;
}

const KASHRUT_LIST = [
  "רובין",
  "מחפוד",
  "לנדא",
  "בדץ קהילות",
  "הרב גרוס",
  'בדץ ע"ח'
];

interface SegmentedControlProps {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  ariaLabel: string;
}

const SegmentedControl = ({ value, options, onChange, ariaLabel }: SegmentedControlProps) => (
  <div className={styles.segmentedControl} role="group" aria-label={ariaLabel}>
    {options.map((opt) => (
      <button
        key={opt.value}
        type="button"
        className={`${styles.segmentedBtn} ${value === opt.value ? styles.segmentedBtnActive : ''}`}
        onClick={() => onChange(opt.value)}
        aria-pressed={value === opt.value}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

const SectionIcon = ({ children }: { children: React.ReactNode }) => (
  <span className={styles.sectionIcon} aria-hidden="true">{children}</span>
);

const SEPARATE_MIXED_OPTIONS = [
  { value: 'separate', label: 'נפרד' },
  { value: 'mixed', label: 'מעורב' },
];

const EventFormManager = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Booking | null>(null);

  const { data: bookingsData, isLoading: bookingsLoading } = useBookingsQuery({
    status: 'BOOKED',
    limit: 200,
    page: 1,
  });
  const { data: allForms = [] } = useEventFormsQuery();
  const { data: kashruts = [] } = useKashrutQuery();
  const { data: globalSettings } = useGlobalSettingsQuery();

  const bookings = useMemo(
    () =>
      ((bookingsData?.data ?? []) as Booking[]).filter(
        (b) => b.eventDate?.status === 'BOOKED',
      ),
    [bookingsData],
  );
  const loading = bookingsLoading;
  
  const [viewMode, setViewMode] = useState<'bookings' | 'forms' | 'stats'>('bookings');
  const [showPastEvents, setShowPastEvents] = useState(false);
  
  const [formData, setFormData] = useState<EventFormData>({});
  const [depositCheckFile, setDepositCheckFile] = useState<File | null>(null);
  const [checkScanning, setCheckScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const actionBusy = submitting || emailSending;
  const [notesList, setNotesList] = useState<string[]>([]);
  const [newNote, setNewNote] = useState('');

  const [kashrutImage, setKashrutImage] = useState<string | null>(null);
  const [isKashrutModalOpen, setIsKashrutModalOpen] = useState(false);
  
  const [selectedMenu, setSelectedMenu] = useState<Record<string, string[]> | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isTableLayoutOpen, setIsTableLayoutOpen] = useState(false);
  const [savedTables, setSavedTables] = useState<TableData[] | undefined>(undefined);
  const [tableLayoutImageUrl, setTableLayoutImageUrl] = useState<string | null>(null);
  const [tableLayoutSaving, setTableLayoutSaving] = useState(false);
  const [hasHonorTable, setHasHonorTable] = useState<boolean | null>(null);
  const [hasEntertainers, setHasEntertainers] = useState<boolean | null>(null);
  const [barPortionPrice, setBarPortionPrice] = useState(60);
  const [showCamera, setShowCamera] = useState(false);

  const portionBilling = calculatePortionBilling({
    finalGuestCount: formData.finalGuestCount || 0,
    seatingType: formData.seatingType || 'separate',
    menPercent: formData.menPercent,
    pricePerPortion: barPortionPrice,
  });

  const menuStats = useMemo(() => {
    if (!selectedMenu) return null;
    const categories = Object.keys(selectedMenu).length;
    const items = Object.values(selectedMenu).reduce((sum, arr) => sum + arr.length, 0);
    return { categories, items };
  }, [selectedMenu]);

  const formProgress = useMemo(() => {
    const seating = formData.seatingType || 'separate';
    const seatingOk =
      seating === 'mixed' ||
      (formData.menCount || 0) + (formData.womenCount || 0) > 0;
    const hasEquipment = !!(
      formData.hasLighting ||
      formData.hasSoundSystem ||
      formData.hasScreens ||
      formData.hasFireworks
    );
    const entertainersOk = hasEntertainers === false || hasEntertainers === true;
    const hasCheck = !!(depositCheckFile || formData.depositCheckUrl);
    const sections = [
      !!formData.eventTime,
      !!formData.finalGuestCount && seatingOk,
      !!(
        formData.tableclothId ||
        formData.napkinId ||
        formData.centerpiece ||
        formData.bridgeChair
      ),
      hasEquipment,
      entertainersOk,
      hasCheck && !!formData.kashrut,
      !!selectedMenu && Object.keys(selectedMenu).length > 0,
      true,
    ];
    return Math.round((sections.filter(Boolean).length / sections.length) * 100);
  }, [formData, hasEntertainers, depositCheckFile, selectedMenu]);

  const handleStepBack = useCallback(() => {
    if (showCamera) {
      setShowCamera(false);
      return;
    }
    if (isTableLayoutOpen) {
      setIsTableLayoutOpen(false);
      return;
    }
    if (isMenuOpen) {
      setIsMenuOpen(false);
      return;
    }
    if (isKashrutModalOpen) {
      setIsKashrutModalOpen(false);
      return;
    }
    if (selected) {
      setSelected(null);
    }
  }, [showCamera, isTableLayoutOpen, isMenuOpen, isKashrutModalOpen, selected]);

  const navigationOverride = useMemo(() => {
    const inSubStep = showCamera || isTableLayoutOpen || isMenuOpen || isKashrutModalOpen || !!selected;
    return inSubStep ? { onBack: handleStepBack } : null;
  }, [showCamera, isTableLayoutOpen, isMenuOpen, isKashrutModalOpen, selected, handleStepBack]);

  useNavigationOverride(navigationOverride);

  const prepareFormDataForSave = (data: EventFormData): EventFormData => {
    const { menCount, womenCount, ...rest } = data;
    return {
      ...rest,
      honorTableCount: hasHonorTable ? data.honorTableCount : undefined,
      ...(hasEntertainers === false ? {
        entertainersBar: undefined,
        entertainersSitting: undefined,
        entertainersMen: undefined,
        entertainersWomen: undefined,
      } : {}),
    };
  };

  const handleMenuSave = (menuSelections: Record<string, string[]>) => {
    setSelectedMenu(menuSelections);
    setIsMenuOpen(false); 
    alert("התפריט נשמר כחלק מפרטי האירוע!");
  };

  useEffect(() => {
    if (kashruts.length > 0 && kashruts[0].imageUrl) {
      setKashrutImage(kashruts[0].imageUrl);
    }
  }, [kashruts]);

  useEffect(() => {
    if (globalSettings?.barPortionPrice) {
      setBarPortionPrice(Number(globalSettings.barPortionPrice));
    }
  }, [globalSettings]);

  useEffect(() => {
    if (!selected) {
      setFormData({});
      setNotesList([]);
      setHasHonorTable(null);
      setHasEntertainers(null);
      setShowCamera(false);
      return;
    }
    setShowCamera(false);
    secureFetch(`${API_URL}/event-forms/${selected.id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(form => {
        if (form && form.id) {
          const { id, createdAt, updatedAt, booking, bookingId, tables, ...cleanForm } = form;
          const guestTotal = cleanForm.finalGuestCount || selected.guestCount;
          const { menCount, womenCount } = countsFromPercents(
            cleanForm.menPercent,
            cleanForm.womenPercent,
            guestTotal
          );
          setFormData({ ...cleanForm, menCount, womenCount });
          setHasHonorTable(!!(form.honorTableCount && form.honorTableCount > 0));
          setHasEntertainers(
            form.entertainersBar != null || form.entertainersSitting != null ? true : null
          );
          setNotesList(form.notes ? JSON.parse(form.notes) : []);
          setSelectedMenu(form.menuSelections || null);
          setSavedTables(tables?.length ? serverTablesToClient(tables) : undefined);
          setTableLayoutImageUrl(form.tableLayoutImageUrl || null);
        } else {
          setFormData({});
          setHasHonorTable(null);
          setHasEntertainers(null);
          setNotesList([]);
          setSavedTables(undefined);
          setTableLayoutImageUrl(null);
        }
      })
      .catch(() => {
        setFormData({});
        setHasHonorTable(null);
        setHasEntertainers(null);
        setNotesList([]);
        setSavedTables(undefined);
        setTableLayoutImageUrl(null);
      });
  }, [selected]);

  const handleTableLayoutSave = async (tables: TableData[], imageDataUrl: string) => {
    if (!selected) return;
    setTableLayoutSaving(true);
    try {
      const response = await secureFetch(`${API_URL}/event-forms/${selected.id}/tables`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tables: clientTablesToServer(tables),
          tableLayoutImageUrl: imageDataUrl,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'שגיאה בשמירה');
      }
      setSavedTables(tables);
      setTableLayoutImageUrl(imageDataUrl);
      alert('סידור השולחנות נשמר בהצלחה!');
      setIsTableLayoutOpen(false);
    } catch (error) {
      console.error('Table layout save error:', error);
      alert('שגיאה בשמירת סידור השולחנות');
    } finally {
      setTableLayoutSaving(false);
    }
  };

  const layoutGuestCount = Number(formData.finalGuestCount) || 0;

  const matchesSearch = (b: Booking) =>
    b.clientAFullName?.includes(search) ||
    b.clientAIdNumber?.includes(search) ||
    b.clientBFullName?.includes(search) ||
    b.clientBIdNumber?.includes(search);

  const isPastBooking = (b: Booking) =>
    !!b.eventDate?.date && hasEventEnded(b, b.eventDate.date, b.eventForm);

  const searchFiltered = bookings.filter(matchesSearch);
  const upcomingBookings = searchFiltered.filter((b) => !isPastBooking(b));
  const pastBookings = searchFiltered.filter(isPastBooking);
  const displayedBookings = showPastEvents ? pastBookings : upcomingBookings;

  const isPastForm = (form: { booking?: Booking | null; eventTime?: string | null }) => {
    if (!form.booking?.eventDate?.date) return false;
    return hasEventEnded(form.booking, form.booking.eventDate.date, form);
  };

  const searchFilteredForms = allForms.filter(
    (form) =>
      !search ||
      form.booking?.clientAFullName?.includes(search) ||
      form.booking?.clientBFullName?.includes(search),
  );
  const upcomingForms = searchFilteredForms.filter((form) => !isPastForm(form));
  const pastForms = searchFilteredForms.filter(isPastForm);
  const displayedForms = showPastEvents ? pastForms : upcomingForms;

  const dateStr = (b: Booking) => b.eventDate?.date ? new Date(b.eventDate.date).toLocaleDateString('he-IL') : '';

  const toEventCard = (b: Booking, hasForm: boolean): EventCardData => ({
    id: b.id,
    date: dateStr(b),
    clientName: b.clientAFullName,
    clientNameB: b.clientBFullName,
    eventType: b.eventType,
    guestCount: b.guestCount,
    status: hasForm ? 'confirmed' : 'gold',
    statusLabel: hasForm ? 'טופס קיים' : 'ממתין למילוי',
  });

  const handleInputChange = (field: keyof EventFormData, value: any) => {
    if (field === 'menCount' || field === 'womenCount') {
      setFormData(prev => {
        const menCount = field === 'menCount'
          ? Math.max(0, parseInt(value, 10) || 0)
          : (prev.menCount || 0);
        const womenCount = field === 'womenCount'
          ? Math.max(0, parseInt(value, 10) || 0)
          : (prev.womenCount || 0);
        const { menPercent, womenPercent } = computePercentSplit(menCount, womenCount);
        return { ...prev, menCount, womenCount, menPercent, womenPercent };
      });
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleCheckboxChange = (field: keyof EventFormData, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: checked
    }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDepositCheckFile(file);
    try {
      const dataUrl = await fileToDataUrl(file);
      handleInputChange('depositCheckUrl', dataUrl);
      await processCheckImage(dataUrl);
    } catch {
      alert('שגיאה בטעינת קובץ הצ\'ק');
    }
  };

  const processCheckImage = async (imageSrc: string) => {
    setCheckScanning(true);
    try {
      const details = await scanCheckImage(imageSrc);
      handleInputChange('depositCheckDetails', details);
    } catch (error) {
      console.error('Check OCR failed:', error);
      handleInputChange('depositCheckDetails', { scannedAt: new Date().toISOString() });
      alert('לא הצלחנו לזהות את כל פרטי הצ\'ק. ניתן למלא אותם ידנית.');
    } finally {
      setCheckScanning(false);
    }
  };

  const uploadCheckFile = async (): Promise<string | null> => {
    if (!depositCheckFile) return formData.depositCheckUrl || null;
    try {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve(e.target?.result as string);
        };
        reader.readAsDataURL(depositCheckFile);
      });
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    }
  };

  const showEmailSaveMessage = (result: {
    emailSent?: boolean;
    emailSkipped?: boolean;
    emailError?: string;
  }) => {
    if (result.emailSent) {
      alert('הטופס נשמר והמייל נשלח בהצלחה!');
      return;
    }
    if (result.emailSkipped) {
      alert('הטופס נשמר (מייל כבר נשלח לפני פחות מדקה)');
      return;
    }
    if (result.emailError) {
      alert(`הטופס נשמר, אך המייל לא נשלח: ${result.emailError}`);
    }
  };

  const buildDataToSave = async () => {
    const checkUrl = await uploadCheckFile();
    return prepareFormDataForSave({
      ...formData,
      depositCheckUrl: checkUrl || formData.depositCheckUrl,
      notes: JSON.stringify(notesList),
      menuSelections: selectedMenu,
      guestPortionCount: portionBilling?.totalBillablePortions,
      pricePerPortion: portionBilling?.pricePerPortion ?? barPortionPrice,
      totalPrice: portionBilling?.totalAmount,
    });
  };
  const handleDownloadPDF = async () => {
    if (!selected) return;
    try {
      const response = await secureFetch(`${API_URL}/event-forms/${selected.id}/pdf`, { credentials: 'include' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `event-form-${selected.clientAFullName}-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
      alert('שגיאה בהורדת PDF');
    }
  };

  const handleShare = () => {
    if (!selected) return;
    const clientName = `${selected.clientAFullName} ${selected.clientBFullName ? `ו${selected.clientBFullName}` : ''}`;
    const textMsg = `שלום, מצורף עדכון לגבי טופס הפקת אירוע - משפחת ${clientName} בתאריך ${dateStr(selected)}.\nמוזמנים: ${formData.finalGuestCount || 'לא צוין'}.`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(textMsg)}`, '_blank');
    window.setTimeout(() => {
      window.open(`mailto:?subject=${encodeURIComponent(`טופס אירוע: ${clientName}`)}&body=${encodeURIComponent(textMsg)}`, '_blank');
    }, 500);
  };

  const handleDeleteCheckImage = () => {
    setDepositCheckFile(null);
    setFormData(prev => ({
      ...prev,
      depositCheckUrl: undefined,
      depositCheckDetails: undefined,
    }));
  };

  const addNote = () => {
    if (newNote.trim()) {
      setNotesList([...notesList, newNote]);
      setNewNote('');
    }
  };

  const removeNote = (index: number) => {
    setNotesList(notesList.filter((_, i) => i !== index));
  };

  const isFormValid = () => {
    const currentReception = formData.receptionType || 'separate';
    const currentSeating = formData.seatingType || 'separate';

    return !!(
      formData.eventTime &&
      currentReception &&
      formData.finalGuestCount &&
      currentSeating &&
      (currentSeating === 'mixed' || ((formData.menCount || 0) + (formData.womenCount || 0) > 0)) &&
      (formData.depositCheckUrl || depositCheckFile) && 
      formData.kashrut
    );
  };

  const handleSaveForm = async () => {
    if (!selected || actionBusy) return;
    if (!isFormValid()) {
      alert('אנא מלא את כל השדות החובה:\n✓ שעה וקבלת פנים\n✓ סוג ישיבה\n✓ מוזמנים סופיים\n✓ חלוקה (כמות גברים/נשים)\n✓ צ"ק פיקדון\n✓ כשרות\n\nהערות = אופציונלי');
      return;
    }
    setSubmitting(true);
    try {
      const dataToSave = await buildDataToSave();

      const response = await secureFetch(`${API_URL}/event-forms/${selected.id}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave)
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const result = await response.json();
      if (result.success) {
        setDepositCheckFile(null);
        showEmailSaveMessage(result);
        setSelected(null);
        return;
      } else {
        alert('שגיאה בשמירה: ' + (result.error || 'unknown'));
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('שגיאה בשמירה: ' + (error instanceof Error ? error.message : 'unknown'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAndDownloadPDF = async () => {
    if (!selected || actionBusy) return;
    setSubmitting(true);
    try {
      const dataToSave = await buildDataToSave();

      const saveResponse = await secureFetch(`${API_URL}/event-forms/${selected.id}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave),
      });

      if (!saveResponse.ok) {
        alert('שגיאה בשמירת הנתונים טרם הורדת ה-PDF.');
        return;
      }

      const saveResult = await saveResponse.json();
      if (saveResult.emailSent || saveResult.emailSkipped || saveResult.emailError) {
        showEmailSaveMessage(saveResult);
      }

      await handleDownloadPDF();
    } catch (error) {
      console.error(error);
      alert('שגיאת תקשורת עם השרת בעת הפעולה.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendEmail = async () => {
    if (!selected || actionBusy) return;
    setEmailSending(true);
    try {
      const dataToSave = await buildDataToSave();

      const saveResponse = await secureFetch(`${API_URL}/event-forms/${selected.id}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave),
      });

      if (!saveResponse.ok) {
        alert('שגיאה בשמירת הנתונים, המייל לא נשלח.');
        return;
      }

      const saveResult = await saveResponse.json();

      const emailResponse = await secureFetch(`${API_URL}/event-forms/${selected.id}/send-email`, {
        method: 'POST',
        credentials: 'include',
      });

      const emailResult = await emailResponse.json();
      const emailWasSent =
        saveResult.emailSent ||
        (emailResponse.ok && emailResult.success && !emailResult.skipped);
      const emailWasSkipped =
        !emailWasSent && (saveResult.emailSkipped || emailResult.skipped);

      if (emailWasSent) {
        alert('הטופס נשמר והמייל נשלח בהצלחה!');
      } else if (emailWasSkipped) {
        alert('הטופס נשמר (מייל כבר נשלח לפני פחות מדקה)');
      } else {
        alert(`שגיאה בשליחת המייל: ${saveResult.emailError || emailResult.error || 'אנא נסה שוב'}`);
      }
    } catch (error) {
      console.error(error);
      alert('שגיאת תקשורת עם השרת בעת הפעולה.');
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <div className={`${styles.container} ${selected ? styles.containerFormMode : ''}`}>
      {!selected && (
      <div className={styles.listTop}>
        <PageHeader
          title="טופס הפקת אירוע"
          subtitle="ניהול טפסי הפקה — חיפוש הזמנות, מילוי פרטים ושליחה ללקוח"
        />
        <div className={styles.viewTabs}>
          <button
            type="button"
            onClick={() => { setViewMode('bookings'); setShowPastEvents(false); }}
            className={`${styles.tabBtn} ${viewMode === 'bookings' ? styles.tabBtnActive : ''}`}
          >
            חיפוש הזמנה
          </button>
          <button
            type="button"
            onClick={() => { setViewMode('forms'); setShowPastEvents(false); }}
            className={`${styles.tabBtn} ${viewMode === 'forms' ? styles.tabBtnActive : ''}`}
          >
            טפסים שמורים
          </button>
          <button
            type="button"
            onClick={() => { setViewMode('stats'); setShowPastEvents(false); }}
            className={`${styles.tabBtn} ${styles.tabBtnStats} ${viewMode === 'stats' ? styles.tabBtnActive : ''}`}
          >
            סטטיסטיקות
          </button>
        </div>
      </div>
      )}

      {!selected ? (
        <>
          {viewMode === 'bookings' && (
            <>
              <Input
                fieldClassName={styles.searchWrap}
                placeholder="חיפוש לפי שם או תעודת זהות..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="חיפוש הזמנות לטופס הפקה"
              />
              <div className={styles.pastEventsBar}>
                {showPastEvents ? (
                  <button
                    type="button"
                    className={styles.pastEventsBtn}
                    onClick={() => setShowPastEvents(false)}
                  >
                    חזרה לאירועים קרובים
                  </button>
                ) : pastBookings.length > 0 ? (
                  <button
                    type="button"
                    className={styles.pastEventsBtn}
                    onClick={() => setShowPastEvents(true)}
                  >
                    טפסי אירועים שעברו ({pastBookings.length})
                  </button>
                ) : null}
              </div>
              {loading ? (
                <p className={styles.empty}>טוען...</p>
              ) : displayedBookings.length === 0 ? (
                <EmptyState
                  title={search ? 'לא נמצאו תוצאות' : showPastEvents ? 'אין טפסי אירועים שעברו' : 'אין אירועים קרובים'}
                  message={search ? 'נסה לחפש בשם אחר או בתעודת זהות' : undefined}
                />
              ) : (
                <>
                  {displayedBookings.filter(b => !b.eventForm).length > 0 && (
                    <>
                      <SectionHeader
                        title={showPastEvents ? 'ממתינות למילוי (עבר)' : 'ממתינות למילוי טופס'}
                        count={displayedBookings.filter(b => !b.eventForm).length}
                      />
                      <div className={styles.cardsGrid}>
                        {displayedBookings.filter(b => !b.eventForm).map(b => (
                          <EventCard
                            key={b.id}
                            event={toEventCard(b, false)}
                            onView={() => setSelected(b)}
                            viewLabel="פתיחת טופס הפקה"
                          />
                        ))}
                      </div>
                    </>
                  )}
                  {displayedBookings.filter(b => b.eventForm).length > 0 && (
                    <>
                      <SectionHeader
                        title={showPastEvents ? 'טפסים שמורים (עבר)' : 'טפסים שמורים'}
                        count={displayedBookings.filter(b => b.eventForm).length}
                      />
                      <div className={styles.cardsGrid}>
                        {displayedBookings.filter(b => b.eventForm).map(b => (
                          <EventCard
                            key={b.id}
                            event={toEventCard(b, true)}
                            onView={() => setSelected(b)}
                            viewLabel="עריכת טופס הפקה"
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )}

          {viewMode === 'forms' && (
            <>
              <Input
                fieldClassName={styles.searchWrap}
                placeholder="חיפוש לפי שם לקוח..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="חיפוש טפסים שמורים"
              />
              <div className={styles.pastEventsBar}>
                {showPastEvents ? (
                  <button
                    type="button"
                    className={styles.pastEventsBtn}
                    onClick={() => setShowPastEvents(false)}
                  >
                    חזרה לטפסים של אירועים קרובים
                  </button>
                ) : pastForms.length > 0 ? (
                  <button
                    type="button"
                    className={styles.pastEventsBtn}
                    onClick={() => setShowPastEvents(true)}
                  >
                    טפסי אירועים שעברו ({pastForms.length})
                  </button>
                ) : null}
              </div>
              <p className={styles.listCount}>
                {showPastEvents
                  ? `טפסים של אירועים שעברו: ${displayedForms.length}`
                  : `טפסים של אירועים קרובים: ${displayedForms.length}`}
              </p>
              {displayedForms.length === 0 ? (
                <EmptyState
                  title={search ? 'לא נמצאו תוצאות' : showPastEvents ? 'אין טפסי אירועים שעברו' : 'אין טפסים של אירועים קרובים'}
                  message={search ? 'נסה לחפש בשם לקוח אחר' : undefined}
                />
              ) : (
                <div className={styles.savedFormsGrid}>
                  {displayedForms.map((form) => (
                    <div
                      key={form.id}
                      className={styles.savedFormCard}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (form.booking) {
                          setSelected(form.booking as Booking);
                        }
                      }}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && form.booking) {
                          e.preventDefault();
                          setSelected(form.booking as Booking);
                        }
                      }}
                    >
                      <h4>{form.booking?.clientAFullName || '—'}</h4>
                      <p>תאריך: {form.booking?.eventDate?.date ? new Date(form.booking.eventDate.date).toLocaleDateString('he-IL') : '—'}</p>
                      <p>מוזמנים: {form.finalGuestCount || '—'}</p>
                      <p>נשמר: {form.createdAt ? new Date(form.createdAt).toLocaleString('he-IL') : '—'}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {viewMode === 'stats' && (
            <div className={styles.statsTabWrap}>
              <CancellationStats />
            </div>
          )}
        </>
      ) : (
        <div className={styles.formContainer}>
          <div className={styles.formHeader}>
            <div className={styles.formHeaderMain}>
              <div className={styles.formHeaderText}>
                <h3>{selected.clientAFullName} {selected.clientBFullName ? `+ ${selected.clientBFullName}` : ''}</h3>
                <p>{dateStr(selected)} · {selected.eventType} · {selected.timeOfDay} · {selected.guestCount} מוזמנים</p>
              </div>
              <div className={styles.formHeaderProgress}>
                <div className={styles.progressTrack} role="progressbar" aria-valuenow={formProgress} aria-valuemin={0} aria-valuemax={100} aria-label="התקדמות מילוי הטופס">
                  <div className={styles.progressFill} style={{ width: `${formProgress}%` }} />
                </div>
                <span className={styles.progressLabel}>{formProgress}% מוכן</span>
              </div>
            </div>
            <div className={styles.formHeaderMeta}>
              <span className={styles.headerMetaChip}>סופי: {formData.finalGuestCount || '—'}</span>
              <span className={styles.headerMetaChip}>כשרות: {formData.kashrut || '—'}</span>
            </div>
            <button type="button" onClick={() => setSelected(null)} className={styles.closeBtn}>✕ סגור</button>
          </div>

          <div className={styles.formBody}>
            <div className={styles.formBoard}>
            {/* שעה וקבלת פנים */}
            <div className={`${styles.section} ${styles.boardTime}`}>
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionHeaderTitle}>
                  <SectionIcon>
                    <svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 11h4v-2h-3V7h-2v6z"/></svg>
                  </SectionIcon>
                  שעה וקבלת פנים
                </h4>
              </div>
              <div className={styles.sectionInner}>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label>שעת קבלת פנים</label>
                  <input
                    type="time"
                    value={formData.eventTime || ''}
                    onChange={e => handleInputChange('eventTime', e.target.value)}
                  />
                </div>
                <div className={styles.fieldSegmented}>
                  <label>סוג קבלת פנים</label>
                  <SegmentedControl
                    value={formData.receptionType || 'separate'}
                    options={SEPARATE_MIXED_OPTIONS}
                    onChange={(v) => handleInputChange('receptionType', v)}
                    ariaLabel="סוג קבלת פנים"
                  />
                </div>
              </div>
              </div>
            </div>

            {/* מוזמנים וישיבה */}
            <div className={`${styles.section} ${styles.boardGuests}`}>
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionHeaderTitle}>
                  <SectionIcon>
                    <svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
                  </SectionIcon>
                  מוזמנים וישיבה
                </h4>
                <button
                  type="button"
                  onClick={() => setIsTableLayoutOpen(true)}
                  className={savedTables?.length ? styles.btnSecondary : styles.btnPrimary}
                >
                  {savedTables?.length ? `${savedTables.length} שולחנות` : 'סידור שולחנות'}
                </button>
              </div>
              <div className={styles.sectionInner}>
              <div className={`${styles.row} ${styles.rowThree}`}>
                <div className={styles.field}>
                  <label>כמות מוזמנים סופית</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.finalGuestCount || ''}
                    onChange={e => handleInputChange('finalGuestCount', parseInt(e.target.value))}
                  />
                </div>
                <div className={styles.fieldSegmented}>
                  <label>סוג ישיבה</label>
                  <SegmentedControl
                    value={formData.seatingType || 'separate'}
                    options={SEPARATE_MIXED_OPTIONS}
                    onChange={(v) => handleInputChange('seatingType', v)}
                    ariaLabel="סוג ישיבה"
                  />
                </div>
                <div className={styles.field}>
                  <label>שולחן כבוד</label>
                  <select
                    value={hasHonorTable === null ? '' : hasHonorTable ? 'yes' : 'no'}
                    onChange={e => {
                      if (e.target.value === '') {
                        setHasHonorTable(null);
                        handleInputChange('honorTableCount', undefined);
                        return;
                      }
                      const yes = e.target.value === 'yes';
                      setHasHonorTable(yes);
                      if (!yes) handleInputChange('honorTableCount', undefined);
                    }}
                  >
                    <option value="">—</option>
                    <option value="yes">כן</option>
                    <option value="no">לא</option>
                  </select>
                </div>
              </div>
              {hasHonorTable && (
                <div className={styles.row}>
                  <div className={styles.field}>
                    <label>כמות בשולחן כבוד</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.honorTableCount ?? ''}
                      onChange={e => handleInputChange(
                        'honorTableCount',
                        e.target.value === '' ? undefined : parseInt(e.target.value, 10)
                      )}
                    />
                  </div>
                </div>
              )}

              {tableLayoutImageUrl && (
                <div className={styles.tableLayoutPreviewBlock}>
                  <img
                    src={tableLayoutImageUrl}
                    alt="סקיצת סידור שולחנות"
                    className={styles.tableLayoutPreviewImg}
                  />
                </div>
              )}

              {formData.seatingType === 'separate' && (
                <div className={`${styles.row} ${styles.rowThree}`}>
                  <div className={styles.field}>
                    <label>כמות גברים</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.menCount ?? ''}
                      onChange={e => handleInputChange('menCount', e.target.value)}
                    />
                  </div>
                  <div className={styles.field}>
                    <label>כמות נשים</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.womenCount ?? ''}
                      onChange={e => handleInputChange('womenCount', e.target.value)}
                    />
                  </div>
                  <div className={styles.field}>
                    <label>חלוקה (אחוזים)</label>
                    {formData.menPercent != null && formData.womenPercent != null ? (
                      <div className={styles.splitBadge}>
                        <span className={styles.splitMen}>ג {formData.menPercent}%</span>
                        <span className={styles.splitWomen}>נ {formData.womenPercent}%</span>
                      </div>
                    ) : (
                      <div className={styles.splitBadgeEmpty}>—</div>
                    )}
                  </div>
                </div>
              )}

              {portionBilling && (
                <div
                  className={styles.portionStrip}
                  title={
                    portionBilling.seatingType === 'separate'
                      ? `גברים: ${portionBilling.menCount} → ${portionBilling.menBillablePortions} מנות · נשים: ${portionBilling.womenCount} → ${portionBilling.womenBillablePortions} מנות`
                      : `מוזמנים: ${formData.finalGuestCount} → ${portionBilling.totalBillablePortions} מנות`
                  }
                >
                  <span className={styles.portionStripLabel}>מנות לחיוב:</span>
                  <span className={styles.portionStripStrong}>
                    {portionBilling.totalBillablePortions} × {portionBilling.pricePerPortion} ₪ = {portionBilling.totalAmount.toLocaleString('he-IL')} ₪
                  </span>
                </div>
              )}
              </div>
            </div>

            {/* עיצוב */}
            <div className={`${styles.section} ${styles.boardDesign}`}>
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionHeaderTitle}>
                  <SectionIcon>
                    <svg viewBox="0 0 24 24"><path d="M12 2l2.4 4.8L20 8l-3.6 3.5.85 5L12 14.8 6.75 16.5 7.6 11.5 4 8l5.6-1.2L12 2z"/></svg>
                  </SectionIcon>
                  עיצוב
                </h4>
                <button
                  type="button"
                  onClick={() => navigate('/gallery')}
                  className={styles.btnOutline}
                >
                  גלריה
                </button>
              </div>
              <div className={styles.sectionInner}>
              <div className={`${styles.row} ${styles.rowFour}`}>
                <div className={styles.field}>
                  <label>מפות</label>
                  <input
                    type="text"
                    placeholder="מפה..."
                    value={formData.tableclothId || ''}
                    onChange={e => handleInputChange('tableclothId', e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label>מפיות</label>
                  <input
                    type="text"
                    placeholder="מפית..."
                    value={formData.napkinId || ''}
                    onChange={e => handleInputChange('napkinId', e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label>מרכזי שולחן</label>
                  <input
                    type="text"
                    placeholder="מרכז..."
                    value={formData.centerpiece || ''}
                    onChange={e => handleInputChange('centerpiece', e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label>כסא כלה</label>
                  <input
                    type="text"
                    placeholder="כסא..."
                    value={formData.bridgeChair || ''}
                    onChange={e => handleInputChange('bridgeChair', e.target.value)}
                  />
                </div>
              </div>
              </div>
            </div>

            {/* ציוד טכני */}
            <div className={`${styles.section} ${styles.boardEquip}`}>
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionHeaderTitle}>
                  <SectionIcon>
                    <svg viewBox="0 0 24 24"><path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2c0-1.77-1.02-3.29-2.5-4.03v8.06c1.48-.74 2.5-2.26 2.5-4.03z"/></svg>
                  </SectionIcon>
                  ציוד טכני
                </h4>
              </div>
              <div className={styles.sectionInner}>
              <div className={styles.checkboxInlineRow}>
                <label className={styles.checkboxPill}>
                  <input
                    type="checkbox"
                    checked={formData.hasLighting || false}
                    onChange={e => handleCheckboxChange('hasLighting', e.target.checked)}
                  />
                  תאורה
                </label>
                <label className={styles.checkboxPill}>
                  <input
                    type="checkbox"
                    checked={formData.hasSoundSystem || false}
                    onChange={e => handleCheckboxChange('hasSoundSystem', e.target.checked)}
                  />
                  הגברה
                </label>
                <label className={styles.checkboxPill}>
                  <input
                    type="checkbox"
                    checked={formData.hasScreens || false}
                    onChange={e => handleCheckboxChange('hasScreens', e.target.checked)}
                  />
                  מסכים
                </label>
                <label className={styles.checkboxPill}>
                  <input
                    type="checkbox"
                    checked={formData.hasFireworks || false}
                    onChange={e => handleCheckboxChange('hasFireworks', e.target.checked)}
                  />
                  זיקוקים
                </label>
              </div>
              </div>
            </div>

            <div className={`${styles.section} ${styles.boardEnt}`}>
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionHeaderTitle}>
                  <SectionIcon>
                    <svg viewBox="0 0 24 24"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>
                  </SectionIcon>
                  משמחים
                </h4>
              </div>
              <div className={styles.sectionInner}>
              <div className={styles.field}>
                <label>האם יש משמחים?</label>
                <select
                  value={hasEntertainers === null ? '' : hasEntertainers ? 'yes' : 'no'}
                  onChange={e => {
                    if (e.target.value === '') {
                      setHasEntertainers(null);
                      handleInputChange('entertainersBar', undefined);
                      handleInputChange('entertainersSitting', undefined);
                      handleInputChange('entertainersMen', undefined);
                      handleInputChange('entertainersWomen', undefined);
                      return;
                    }
                    const yes = e.target.value === 'yes';
                    setHasEntertainers(yes);
                    if (!yes) {
                      handleInputChange('entertainersBar', undefined);
                      handleInputChange('entertainersSitting', undefined);
                      handleInputChange('entertainersMen', undefined);
                      handleInputChange('entertainersWomen', undefined);
                    }
                  }}
                >
                  <option value="">בחר...</option>
                  <option value="yes">כן</option>
                  <option value="no">לא</option>
                </select>
              </div>

              {hasEntertainers === true && (
              <>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label>סוג משמחים</label>
                  <select
                    value={
                      formData.entertainersBar !== undefined ? 'bar' :
                      formData.entertainersSitting !== undefined ? 'sitting' : ''
                    }
                    onChange={e => {
                      const type = e.target.value;
                      handleInputChange('entertainersMen', undefined);
                      handleInputChange('entertainersWomen', undefined);
                      if (type === 'bar') {
                        handleInputChange('entertainersBar', 0);
                        handleInputChange('entertainersSitting', undefined);
                      } else if (type === 'sitting') {
                        handleInputChange('entertainersSitting', 0);
                        handleInputChange('entertainersBar', undefined);
                      } else {
                        handleInputChange('entertainersBar', undefined);
                        handleInputChange('entertainersSitting', undefined);
                      }
                    }}
                  >
                    <option value="">בחר סוג...</option>
                    <option value="bar">בר</option>
                    <option value="sitting">ישיבה</option>
                  </select>
                </div>
              </div>

              {(formData.entertainersBar !== undefined || formData.entertainersSitting !== undefined) && (() => {
                const isBar = formData.entertainersBar !== undefined;
                const currentTotal = isBar ? (formData.entertainersBar || 0) : (formData.entertainersSitting || 0);
                return (
                  <>
                    <div className={`${styles.row} ${styles.rowThree}`}>
                      <div className={styles.field}>
                        <label>סה&quot;כ משתתפים</label>
                        <input
                          type="number"
                          min="0"
                          value={currentTotal || ''}
                          onChange={e => {
                            const total = parseInt(e.target.value) || 0;
                            const men = formData.entertainersMen || 0;
                            handleInputChange(isBar ? 'entertainersBar' : 'entertainersSitting', total);
                            handleInputChange('entertainersWomen', Math.max(0, total - men));
                          }}
                        />
                      </div>
                      <div className={styles.field}>
                        <label>גברים</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.entertainersMen || ''}
                          onChange={e => {
                            const men = parseInt(e.target.value) || 0;
                            handleInputChange('entertainersMen', men);
                            handleInputChange('entertainersWomen', Math.max(0, currentTotal - men));
                          }}
                        />
                      </div>
                      <div className={styles.field}>
                        <label>נשים</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.entertainersWomen || ''}
                          readOnly
                          className={styles.inputAuto}
                        />
                      </div>
                    </div>

                    {currentTotal > 0 && (() => {
                      const entMen = formData.entertainersMen || 0;
                      const entWomen = formData.entertainersWomen || 0;
                      const entMenPercent = Math.round((entMen / currentTotal) * 100);
                      const entWomenPercent = 100 - entMenPercent;
                      return (
                        <div className={styles.splitBadge}>
                          <span className={styles.splitMen}>ג {entMenPercent}% ({entMen})</span>
                          <span className={styles.splitWomen}>נ {entWomenPercent}% ({entWomen})</span>
                        </div>
                      );
                    })()}
                  </>
                );
              })()}
              </>
              )}
              </div>
            </div>

            {/* תשלומים וכשרות */}
            <div className={`${styles.section} ${styles.boardPay}`}>
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionHeaderTitle}>
                  <SectionIcon>
                    <svg viewBox="0 0 24 24"><path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4V6h16v12zM4 10h16v2H4v-2z"/></svg>
                  </SectionIcon>
                  תשלומים וכשרות
                </h4>
              </div>

              <div className={styles.sectionInner}>
              <div className={styles.payGrid}>
                <div className={styles.payStatusRow}>
                  {(depositCheckFile || formData.depositCheckUrl) ? (
                    <span className={styles.payStatusOk}>✓ צ&apos;ק צורף</span>
                  ) : (
                    <span className={styles.payStatusWarn}>⚠ חסר צ&apos;ק פיקדון</span>
                  )}
                  {formData.kashrut ? (
                    <span className={styles.payStatusOk}>✓ כשרות: {formData.kashrut}</span>
                  ) : (
                    <span className={styles.payStatusWarn}>⚠ יש לבחור כשרות</span>
                  )}
                </div>
                <div className={styles.payActions}>
                  <button type="button" className={styles.btnOutline} onClick={() => setShowCamera(true)}>
                    צלם
                  </button>
                  <button type="button" className={styles.uploadBtn} onClick={() => document.getElementById('fileInput')?.click()}>
                    העלה
                  </button>
                  <input type="file" id="fileInput" accept="image/*" onChange={handleFileChange} className={styles.hiddenInput} />
                  <label className={styles.checkboxInline}>
                    <input type="checkbox" checked={formData.depositCheckStatus || false} onChange={e => handleCheckboxChange('depositCheckStatus', e.target.checked)} />
                    צ&apos;ק קיבל
                  </label>
                </div>

                {(formData.depositCheckUrl || formData.depositCheckDetails) && (
                  <CheckDetailsForm
                    details={formData.depositCheckDetails || {}}
                    imageUrl={formData.depositCheckUrl}
                    scanning={checkScanning}
                    onChange={details => handleInputChange('depositCheckDetails', details)}
                    styles={styles}
                  />
                )}

                <div className={styles.row}>
                  <div className={styles.field}>
                    <label>קוד אקו"ם</label>
                    <input type="text" readOnly value={selected.akumApprovalCode || 'לא הוזן'} className={selected.akumApprovalCode ? styles.inputReadonlyOk : styles.inputReadonlyEmpty} />
                  </div>
                  <div className={styles.field}>
                    <label>כשרות</label>
                    <div className={styles.kashrutRow}>
                      <select value={formData.kashrut || ''} onChange={(e) => handleInputChange('kashrut', e.target.value)}>
                        <option value="">בחר...</option>
                        {KASHRUT_LIST.map((kName, idx) => (
                          <option key={idx} value={kName}>{kName}</option>
                        ))}
                      </select>
                      {kashrutImage ? (
                        <div onClick={() => setIsKashrutModalOpen(true)} className={styles.kashrutThumb} title="הגדלת תעודה">
                          <img src={kashrutImage} alt="כשרות" />
                        </div>
                      ) : (
                        <div className={styles.kashrutThumbEmpty}>—</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className={styles.payFooter}>
                  <label className={styles.checkboxInline}>
                    <input type="checkbox" checked={formData.akumPaid || !!selected.akumApprovalCode} onChange={e => handleCheckboxChange('akumPaid', e.target.checked)} />
                    שילם לאקו"ם
                  </label>
                  {selected.clientSignatureUrl && (
                    <img src={selected.clientSignatureUrl} alt="חוזה" className={styles.signatureThumb} title="חוזה חתום" />
                  )}
                  {(depositCheckFile || formData.depositCheckUrl) && (
                    <button onClick={handleDeleteCheckImage} className={styles.deleteBtn}>מחק צ'ק</button>
                  )}
                </div>
              </div>
              </div>
              {isKashrutModalOpen && kashrutImage && (
                <div onClick={() => setIsKashrutModalOpen(false)} className={styles.modalOverlay}>
                  <div onClick={e => e.stopPropagation()} className={styles.modalContent}>
                    <img src={kashrutImage} alt="תעודה מוגדלת" className={styles.modalImg} />
                    <button onClick={() => setIsKashrutModalOpen(false)} className={styles.modalCloseBtn}>סגור</button>
                  </div>
                </div>
              )}
            </div>

            <div className={`${styles.section} ${styles.boardMenu}`}>
              <div className={styles.menuRow}>
                <div>
                  <h4 className={styles.inlineTitle}>
                    <span className={styles.sectionHeaderTitle}>
                      <SectionIcon>
                        <svg viewBox="0 0 24 24"><path d="M8.1 13.34l2.83-2.83L3.91 3.5a4.008 4.008 0 0 0 0 5.66l4.19 4.18zm6.78-1.81a11.044 11.044 0 0 1-2.83 2.83l2.83 2.83 2.83-2.83-2.83-2.83zM20.49 19.63l-1.41-1.41-2.83 2.83 2.83 2.83 1.41-1.41-2.83-2.83 2.83-2.82z"/></svg>
                      </SectionIcon>
                      תפריט האירוע
                    </span>
                  </h4>
                  {selectedMenu ? (
                    <>
                      <span className={styles.statusOk}>✓ תפריט נבחר</span>
                      {menuStats && (
                        <p className={styles.menuSummary}>
                          {menuStats.categories} קטגוריות · {menuStats.items} מנות
                        </p>
                      )}
                    </>
                  ) : (
                    <span className={styles.statusPending}>טרם נבחר תפריט</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(true)}
                  className={selectedMenu ? styles.btnSecondary : styles.btnPrimary}
                >
                  {selectedMenu ? 'ערוך תפריט' : 'בחירת תפריט'}
                </button>
              </div>
            </div>

            <div className={`${styles.section} ${styles.boardNotes}`}>
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionHeaderTitle}>
                  <SectionIcon>
                    <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                  </SectionIcon>
                  הערות
                </h4>
                {notesList.length > 0 && <span className={styles.notesBadge}>{notesList.length}</span>}
              </div>
              <div className={styles.sectionInner}>
              {notesList.length > 0 && (
                <div className={styles.notesList}>
                  {notesList.map((note, idx) => (
                    <div key={idx} className={styles.noteItem}>
                      <span className={styles.noteNumber}>{idx + 1}.</span>
                      <span className={styles.noteText}>{note}</span>
                      <button onClick={() => removeNote(idx)} className={styles.removeNoteBtn}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div className={styles.addNoteRow}>
                <input
                  type="text"
                  placeholder="הוסף הערה..."
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && addNote()}
                  className={styles.noteInput}
                />
                <button onClick={addNote} className={styles.addNoteBtn}>+</button>
              </div>
              </div>
            </div>
            </div>

            {showCamera && (
              <div className={styles.cameraOverlay}>
                <div className={styles.cameraModal}>
                  <button type="button" className={styles.cameraCloseBtn} onClick={() => setShowCamera(false)}>✕</button>
                  <CheckCamera
                    disabled={checkScanning}
                    onCapture={async (imageSrc) => {
                      handleInputChange('depositCheckUrl', imageSrc);
                      setDepositCheckFile(null);
                      setShowCamera(false);
                      await processCheckImage(imageSrc);
                    }}
                    onRetake={handleDeleteCheckImage}
                  />
                </div>
              </div>
            )}

            {isMenuOpen && (
              <div className={styles.fullscreenOverlay}>
                <div className={styles.fullscreenInner}>
                  <button 
                    onClick={() => setIsMenuOpen(false)}
                    className={styles.fullscreenCloseBtn}
                    title="סגור חלון"
                  >
                    ✕ סגור וחזור לטופס
                  </button>
                  
                  <div className={styles.fullscreenScroll}>
                    <div className={styles.fullscreenPanel}>
                      <MenuSelectionForm 
                         onSaveMenu={handleMenuSave} 
                         initialSelections={selectedMenu} 
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isTableLayoutOpen && (
              <div className={styles.tableLayoutOverlay}>
                <div className={styles.tableLayoutInner}>
                  <div style={{ marginBottom: '8px', textAlign: 'center' }}>
                    <h3 className={styles.tableLayoutTitle}>סידור שולחנות אולם</h3>
                    {tableLayoutSaving && <span className={styles.tableLayoutSaving}>שומר...</span>}
                  </div>
                  <div className={styles.tableLayoutBuilder}>
                    <FloorPlanBuilder
                      key={`${selected.id}-${savedTables?.length ?? 0}-${layoutGuestCount}`}
                      initialTables={savedTables}
                      guestCount={layoutGuestCount}
                      seatingType={formData.seatingType || 'separate'}
                      menPercent={formData.menPercent}
                      womenPercent={formData.womenPercent}
                      includeHonorTables={hasHonorTable !== false}
                      onSave={handleTableLayoutSave}
                      onClose={() => setIsTableLayoutOpen(false)}
                      downloadFileName={`sidur-shulchanot-${selected.clientAFullName}-${dateStr(selected).replace(/\./g, '-')}.png`}
                    />
                  </div>
                </div>
              </div>
            )}

          </div>

            <p className={styles.formTip}>
              * המחיר אינו כולל טיפ כמקובל במקום
            </p>

            <div className={styles.formFooter}>
              <div className={styles.formFooterInner}>
                <button onClick={() => setSelected(null)} className={styles.cancelBtn}>ביטול</button>

                <button
                  onClick={handleSaveForm}
                  className={styles.saveBtn}
                  disabled={actionBusy}
                >
                  {submitting ? 'שומר...' : 'שמירת טופס'}
                </button>

                <div className={styles.formFooterSecondary}>
                  <button
                    onClick={handleSaveAndDownloadPDF}
                    disabled={actionBusy}
                    className={styles.downloadBtn}
                    title="שמור והורד PDF"
                  >
                    {submitting ? 'שומר...' : 'הורד PDF'}
                  </button>

                  <button
                    onClick={() => {
                      const clientName = `${selected.clientAFullName} ${selected.clientBFullName ? `ו${selected.clientBFullName}` : ''}`;
                      const textMsg = `שלום, מצורף עדכון לגבי טופס הפקת אירוע - משפחת ${clientName} בתאריך ${dateStr(selected)}.\nמוזמנים: ${formData.finalGuestCount || 'לא צוין'}.`;
                      window.open(`https://wa.me/?text=${encodeURIComponent(textMsg)}`, '_blank');
                    }}
                    className={styles.whatsappBtn}
                    title={!isFormValid() ? 'יש למלא טופס לפני שיתוף' : 'שלח לווצאפ'}
                  >
                    <svg className={styles.btnIcon} fill="currentColor" viewBox="0 0 448 512" xmlns="http://www.w3.org/2000/svg">
                      <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"></path>
                    </svg>
                    שלח ווצאפ
                  </button>
                  <button
                    onClick={handleSendEmail}
                    disabled={actionBusy}
                    className={styles.emailBtn}
                    title="שמור ושלח למייל"
                  >
                    <svg className={styles.btnIcon} fill="currentColor" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
                      <path d="M48 64C21.5 64 0 85.5 0 112c0 15.1 7.1 29.3 19.2 38.4L236.8 313.6c11.4 8.5 27 8.5 38.4 0L492.8 150.4c12.1-9.1 19.2-23.3 19.2-38.4c0-26.5-21.5-48-48-48H48zM0 176V384c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V176L294.4 339.2c-22.8 17.1-54 17.1-76.8 0L0 176z"></path>
                    </svg>
                    {emailSending ? 'שולח...' : 'שלח למייל'}
                  </button>
                </div>
              </div>
            </div>
          </div>
      )}
    </div>
  );
};

export default EventFormManager;