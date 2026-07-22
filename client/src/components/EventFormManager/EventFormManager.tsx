import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNavigationOverride } from '../../context/navigationContext';
import { useTranslation } from '../../i18n/useTranslation';
import { formatDate, formatDateTime, formatCurrency } from '@shared/i18n/formatters';
import {
  translateByValue,
  EVENT_TYPE_KEY_BY_VALUE,
  KASHRUT_KEY_BY_VALUE,
} from '@shared/i18n/bookingLookups';
import { formatTimeOfDayDisplay } from '../../utils/timeSlot';
import '../../styles/bootstrap-maple-forms.css';
import styles from './EventFormManager.module.css';
import CheckCamera from '../CheckCamera/CheckCamera';
import CheckDetailsForm from '../CheckDetailsForm/CheckDetailsForm';
import KashrutSelector from '../KashrutSelector/KashrutSelector';
import {
  DEFAULT_EVENT_KASHRUT,
  normalizeKashrutValue,
} from '../KashrutSelector/kashrutOptions';
import { scanCheckImage, fileToDataUrl, type DepositCheckDetails } from '../../utils/checkOcr';
import CancellationStats from '../CancellationStats/CancellationStats';
import MenuSelectionForm from '../MenuSelectionForm/MenuSelectionForm';
import FloorPlanBuilder from '../FloorPlanBuilder/FloorPlanBuilder';
import type { TableData } from '../FloorPlanBuilder/FloorPlanBuilder';
import { serverTablesToClient, clientTablesToServer } from '../../constants/defaultTableLayout';
import { calculatePortionBilling } from '../../utils/portionBilling';
import { hasEventEnded, type EventFormTime } from '../../utils/eventStart';
import { todayCalendarKey } from '../../utils/dateLocal';
import { API_URL } from '../../config/api';
import { secureFetch } from '../../services/api';
import {
  useBookingsQuery,
  useEventFormsQuery,
  useGlobalSettingsQuery,
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
  eventForm?: EventFormTime | null;
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

interface SegmentedControlProps {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  ariaLabel: string;
}

const SegmentedControl = ({ value, options, onChange, ariaLabel }: SegmentedControlProps) => (
  <div className="btn-group maple-segmented w-100" role="group" aria-label={ariaLabel}>
    {options.map((opt) => (
      <button
        key={opt.value}
        type="button"
        className={`btn btn-outline-primary ${value === opt.value ? 'active' : ''}`}
        onClick={() => onChange(opt.value)}
        aria-pressed={value === opt.value}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

const SectionIcon = ({ children }: { children: React.ReactNode }) => (
  <span className="maple-section-icon" aria-hidden="true">{children}</span>
);

export interface EventFormDesignExportConfig {
  booking: Booking;
  formData: EventFormData;
  notesList?: string[];
  selectedMenu?: Record<string, string[]> | null;
  hasEntertainers?: boolean | null;
  hasHonorTable?: boolean | null;
}

interface EventFormManagerProps {
  designExport?: EventFormDesignExportConfig;
}

const EventFormManager = ({ designExport }: EventFormManagerProps = {}) => {
  const { t, T, locale } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const separateMixedOptions = useMemo(
    () => [
      { value: 'separate', label: t(T.EVENT_FORM.SEATING_SEPARATE) },
      { value: 'mixed', label: t(T.EVENT_FORM.SEATING_MIXED) },
    ],
    [t],
  );

  const formatEventType = (value: string) => translateByValue(t, EVENT_TYPE_KEY_BY_VALUE, value);
  const formatKashrut = (value: string) => translateByValue(t, KASHRUT_KEY_BY_VALUE, value);
  const [selected, setSelected] = useState<Booking | null>(designExport?.booking ?? null);

  const { data: bookingsData, isLoading: bookingsLoading } = useBookingsQuery({
    status: 'BOOKED',
    limit: 200,
    page: 1,
  });
  const { data: allForms = [] } = useEventFormsQuery();
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
  
  const [formData, setFormData] = useState<EventFormData>(() => {
    if (designExport?.formData) {
      return {
        ...designExport.formData,
        kashrut: normalizeKashrutValue(designExport.formData.kashrut),
      };
    }
    return { kashrut: DEFAULT_EVENT_KASHRUT };
  });
  const [depositCheckFile, setDepositCheckFile] = useState<File | null>(null);
  const [checkScanning, setCheckScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const actionBusy = submitting || emailSending;
  const [notesList, setNotesList] = useState<string[]>(designExport?.notesList ?? []);
  const [newNote, setNewNote] = useState('');

  const [selectedMenu, setSelectedMenu] = useState<Record<string, string[]> | null>(designExport?.selectedMenu ?? null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isTableLayoutOpen, setIsTableLayoutOpen] = useState(false);
  const [isTableLayoutPreviewOpen, setIsTableLayoutPreviewOpen] = useState(false);
  const [savedTables, setSavedTables] = useState<TableData[] | undefined>(undefined);
  const [tableLayoutImageUrl, setTableLayoutImageUrl] = useState<string | null>(null);
  const [tableLayoutSaving, setTableLayoutSaving] = useState(false);
  const [hasHonorTable, setHasHonorTable] = useState<boolean | null>(designExport?.hasHonorTable ?? null);
  const [hasEntertainers, setHasEntertainers] = useState<boolean | null>(designExport?.hasEntertainers ?? null);
  const barPortionPrice = globalSettings?.barPortionPrice != null
    ? Number(globalSettings.barPortionPrice)
    : 60;
  const [showCamera, setShowCamera] = useState(false);

  // Reset draft form fields when selection identity changes (render-time adjustment).
  const [selectionSource, setSelectionSource] = useState(selected);
  if (!designExport && selected !== selectionSource) {
    setSelectionSource(selected);
    if (!selected) {
      setFormData({});
      setNotesList([]);
      setHasHonorTable(null);
      setHasEntertainers(null);
      setShowCamera(false);
    } else {
      setShowCamera(false);
    }
  }

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
      hasCheck && !!normalizeKashrutValue(formData.kashrut),
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
    if (isTableLayoutPreviewOpen) {
      setIsTableLayoutPreviewOpen(false);
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
    if (selected) {
      setSelected(null);
    }
  }, [showCamera, isTableLayoutPreviewOpen, isTableLayoutOpen, isMenuOpen, selected]);

  const navigationOverride = useMemo(() => {
    const inSubStep =
      showCamera || isTableLayoutPreviewOpen || isTableLayoutOpen || isMenuOpen || !!selected;
    return inSubStep ? { onBack: handleStepBack } : null;
  }, [showCamera, isTableLayoutPreviewOpen, isTableLayoutOpen, isMenuOpen, selected, handleStepBack]);

  useNavigationOverride(navigationOverride);

  const prepareFormDataForSave = (data: EventFormData): EventFormData => {
    const rest: EventFormData = { ...data };
    delete rest.menCount;
    delete rest.womenCount;
    return {
      ...rest,
      kashrut: normalizeKashrutValue(data.kashrut),
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
    alert(t(T.EVENT_FORM.MENU_SAVED));
  };

  // Fetch server form when a booking is selected; only setState after the async response.
  useEffect(() => {
    if (designExport || !selected) return;

    let cancelled = false;
    secureFetch(`${API_URL}/event-forms/${selected.id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(form => {
        if (cancelled) return;
        if (form && form.id) {
          const {
            tables,
            ...formFields
          } = form as EventFormData & {
            id?: string;
            createdAt?: string;
            updatedAt?: string;
            booking?: unknown;
            bookingId?: string;
            tables?: Parameters<typeof serverTablesToClient>[0];
          };
          const cleanForm: EventFormData = { ...formFields };
          Reflect.deleteProperty(cleanForm, 'id');
          Reflect.deleteProperty(cleanForm, 'createdAt');
          Reflect.deleteProperty(cleanForm, 'updatedAt');
          Reflect.deleteProperty(cleanForm, 'booking');
          Reflect.deleteProperty(cleanForm, 'bookingId');
          const guestTotal = cleanForm.finalGuestCount || selected.guestCount;
          const { menCount, womenCount } = countsFromPercents(
            cleanForm.menPercent,
            cleanForm.womenPercent,
            guestTotal
          );
          setFormData({
            ...cleanForm,
            menCount,
            womenCount,
            kashrut: normalizeKashrutValue(cleanForm.kashrut),
          });
          setHasHonorTable(!!(form.honorTableCount && form.honorTableCount > 0));
          setHasEntertainers(
            form.entertainersBar != null || form.entertainersSitting != null ? true : null
          );
          setNotesList(form.notes ? JSON.parse(form.notes) : []);
          setSelectedMenu(form.menuSelections || null);
          setSavedTables(tables?.length ? serverTablesToClient(tables) : undefined);
          setTableLayoutImageUrl(form.tableLayoutImageUrl || null);
        } else {
          setFormData({ kashrut: DEFAULT_EVENT_KASHRUT });
          setHasHonorTable(null);
          setHasEntertainers(null);
          setNotesList([]);
          setSavedTables(undefined);
          setTableLayoutImageUrl(null);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setFormData({ kashrut: DEFAULT_EVENT_KASHRUT });
        setHasHonorTable(null);
        setHasEntertainers(null);
        setNotesList([]);
        setSavedTables(undefined);
        setTableLayoutImageUrl(null);
      });
    return () => { cancelled = true; };
  }, [selected, designExport]);

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
        throw new Error(result.error || t(T.COMMON.ERRORS.SAVE_FAILED));
      }
      setSavedTables(tables);
      setTableLayoutImageUrl(imageDataUrl);
      alert(t(T.EVENT_FORM.TABLE_LAYOUT_SAVED));
      setIsTableLayoutOpen(false);
    } catch (error) {
      console.error('Table layout save error:', error);
      alert(t(T.EVENT_FORM.TABLE_LAYOUT_SAVE_ERROR));
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

  const dateStr = (b: Booking) => b.eventDate?.date ? formatDate(b.eventDate.date, locale) : '';

  const toEventCard = (b: Booking, hasForm: boolean): EventCardData => ({
    id: b.id,
    date: dateStr(b),
    clientName: b.clientAFullName,
    clientNameB: b.clientBFullName,
    eventType: formatEventType(b.eventType),
    guestCount: b.guestCount,
    status: hasForm ? 'confirmed' : 'gold',
    statusLabel: hasForm ? t(T.EVENT_FORM.STATUS_EXISTS) : t(T.EVENT_FORM.STATUS_PENDING),
  });

  const handleInputChange = (
    field: keyof EventFormData,
    value: EventFormData[keyof EventFormData] | string,
  ) => {
    if (field === 'menCount' || field === 'womenCount') {
      setFormData(prev => {
        const menCount = field === 'menCount'
          ? Math.max(0, parseInt(String(value), 10) || 0)
          : (prev.menCount || 0);
        const womenCount = field === 'womenCount'
          ? Math.max(0, parseInt(String(value), 10) || 0)
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
      alert(t(T.EVENT_FORM.CHECK_LOAD_ERROR));
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
      alert(t(T.EVENT_FORM.CHECK_PARSE_PARTIAL));
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
      alert(t(T.EVENT_FORM.SAVED_EMAIL_SENT));
      return;
    }
    if (result.emailSkipped) {
      alert(t(T.EVENT_FORM.SAVED_EMAIL_RECENT));
      return;
    }
    if (result.emailError) {
      alert(t(T.EVENT_FORM.SAVED_EMAIL_FAILED, { emailError: result.emailError }));
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
      a.download = `production-form-${selected.clientAFullName}-${todayCalendarKey()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
      alert(t(T.EVENT_FORM.PDF_ERROR));
    }
  };

  const buildShareMessage = () => {
    if (!selected) return '';
    const clientName = `${selected.clientAFullName} ${selected.clientBFullName ? `ו${selected.clientBFullName}` : ''}`;
    return t(T.EVENT_FORM.SHARE_WHATSAPP_BODY, {
      clientName,
      date: dateStr(selected),
      guestCount: formData.finalGuestCount ?? t(T.EVENT_FORM.NOT_ENTERED),
    });
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
      !!normalizeKashrutValue(formData.kashrut)
    );
  };

  const handleSaveForm = async () => {
    if (!selected || actionBusy) return;
    if (!isFormValid()) {
      alert(t(T.EVENT_FORM.REQUIRED_FIELDS));
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
        alert(`${t(T.UI.SAVE_ERROR)}: ${result.error || t(T.COMMON.ERRORS.GENERIC)}`);
      }
    } catch (error) {
      console.error('Save error:', error);
      alert(`${t(T.UI.SAVE_ERROR)}: ${error instanceof Error ? error.message : t(T.COMMON.ERRORS.GENERIC)}`);
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
        alert(t(T.EVENT_FORM.SAVE_BEFORE_PDF_ERROR));
        return;
      }

      const saveResult = await saveResponse.json();
      if (saveResult.emailSent || saveResult.emailSkipped || saveResult.emailError) {
        showEmailSaveMessage(saveResult);
      }

      await handleDownloadPDF();
    } catch (error) {
      console.error(error);
      alert(t(T.EVENT_FORM.SERVER_ERROR));
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
        alert(t(T.UI.SAVE_ERROR));
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
        alert(t(T.EVENT_FORM.SAVED_EMAIL_SENT));
      } else if (emailWasSkipped) {
        alert(t(T.EVENT_FORM.SAVED_EMAIL_RECENT));
      } else {
        alert(t(T.EVENT_FORM.EMAIL_ERROR, {
          error: saveResult.emailError || emailResult.error || t(T.COMMON.ACTIONS.RETRY),
        }));
      }
    } catch (error) {
      console.error(error);
      alert(t(T.EVENT_FORM.SERVER_ERROR));
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <div className={`${styles.container} ${selected ? styles.containerFormMode : ''}`}>
      {!selected && (
      <div className={styles.listTop}>
        <PageHeader
          title={t(T.EVENT_FORM.PAGE_TITLE)}
          subtitle={t(T.EVENT_FORM.PAGE_SUBTITLE)}
        />
        <div className={styles.viewTabs}>
          <button
            type="button"
            onClick={() => { setViewMode('bookings'); setShowPastEvents(false); }}
            className={`${styles.tabBtn} ${viewMode === 'bookings' ? styles.tabBtnActive : ''}`}
          >
            {t(T.EVENT_FORM.TAB_SEARCH)}
          </button>
          <button
            type="button"
            onClick={() => { setViewMode('forms'); setShowPastEvents(false); }}
            className={`${styles.tabBtn} ${viewMode === 'forms' ? styles.tabBtnActive : ''}`}
          >
            {t(T.EVENT_FORM.TAB_SAVED)}
          </button>
          <button
            type="button"
            onClick={() => { setViewMode('stats'); setShowPastEvents(false); }}
            className={`${styles.tabBtn} ${styles.tabBtnStats} ${viewMode === 'stats' ? styles.tabBtnActive : ''}`}
          >
            {t(T.EVENT_FORM.TAB_STATS)}
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
                placeholder={t(T.EVENT_FORM.SEARCH_BOOKINGS_PLACEHOLDER)}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label={t(T.EVENT_FORM.SEARCH_BOOKINGS_ARIA)}
              />
              <div className={styles.pastEventsBar}>
                {showPastEvents ? (
                  <button
                    type="button"
                    className={styles.pastEventsBtn}
                    onClick={() => setShowPastEvents(false)}
                  >
                    {t(T.EVENT_FORM.BACK_UPCOMING)}
                  </button>
                ) : pastBookings.length > 0 ? (
                  <button
                    type="button"
                    className={styles.pastEventsBtn}
                    onClick={() => setShowPastEvents(true)}
                  >
                    {t(T.EVENT_FORM.PAST_FORMS_COUNT, { count: pastBookings.length })}
                  </button>
                ) : null}
              </div>
              {loading ? (
                <p className={styles.empty}>{t(T.COMMON.LABELS.LOADING)}</p>
              ) : displayedBookings.length === 0 ? (
                <EmptyState
                  title={search ? t(T.EVENT_FORM.NO_RESULTS) : showPastEvents ? t(T.EVENT_FORM.NO_PAST_FORMS) : t(T.EVENT_FORM.NO_UPCOMING)}
                  message={search ? t(T.EVENT_FORM.SEARCH_HINT) : undefined}
                />
              ) : (
                <>
                  {displayedBookings.filter(b => !b.eventForm).length > 0 && (
                    <>
                      <SectionHeader
                        title={showPastEvents ? t(T.EVENT_FORM.PENDING_PAST) : t(T.EVENT_FORM.PENDING_UPCOMING)}
                        count={displayedBookings.filter(b => !b.eventForm).length}
                      />
                      <div className={styles.cardsGrid}>
                        {displayedBookings.filter(b => !b.eventForm).map(b => (
                          <EventCard
                            key={b.id}
                            event={toEventCard(b, false)}
                            onView={() => setSelected(b)}
                            viewLabel={t(T.EVENT_FORM.OPEN_FORM)}
                          />
                        ))}
                      </div>
                    </>
                  )}
                  {displayedBookings.filter(b => b.eventForm).length > 0 && (
                    <>
                      <SectionHeader
                        title={showPastEvents ? t(T.EVENT_FORM.SAVED_PAST) : t(T.EVENT_FORM.SAVED_UPCOMING)}
                        count={displayedBookings.filter(b => b.eventForm).length}
                      />
                      <div className={styles.cardsGrid}>
                        {displayedBookings.filter(b => b.eventForm).map(b => (
                          <EventCard
                            key={b.id}
                            event={toEventCard(b, true)}
                            onView={() => setSelected(b)}
                            viewLabel={t(T.EVENT_FORM.EDIT_FORM)}
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
                placeholder={t(T.EVENT_FORM.SEARCH_FORMS_PLACEHOLDER)}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label={t(T.EVENT_FORM.SEARCH_FORMS_ARIA)}
              />
              <div className={styles.pastEventsBar}>
                {showPastEvents ? (
                  <button
                    type="button"
                    className={styles.pastEventsBtn}
                    onClick={() => setShowPastEvents(false)}
                  >
                    {t(T.EVENT_FORM.BACK_UPCOMING_FORMS)}
                  </button>
                ) : pastForms.length > 0 ? (
                  <button
                    type="button"
                    className={styles.pastEventsBtn}
                    onClick={() => setShowPastEvents(true)}
                  >
                    {t(T.EVENT_FORM.PAST_FORMS_COUNT, { count: pastForms.length })}
                  </button>
                ) : null}
              </div>
              <p className={styles.listCount}>
                {showPastEvents
                  ? t(T.EVENT_FORM.FORMS_COUNT_PAST, { count: displayedForms.length })
                  : t(T.EVENT_FORM.FORMS_COUNT_UPCOMING, { count: displayedForms.length })}
              </p>
              {displayedForms.length === 0 ? (
                <EmptyState
                  title={search ? t(T.EVENT_FORM.NO_RESULTS) : showPastEvents ? t(T.EVENT_FORM.NO_PAST_FORMS) : t(T.EVENT_FORM.NO_SAVED_FORMS)}
                  message={search ? t(T.EVENT_FORM.SEARCH_FORMS_HINT) : undefined}
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
                      <h4>{form.booking?.clientAFullName || t(T.COMMON.LABELS.EM_DASH)}</h4>
                      <p>{t(T.EVENT_FORM.LABEL_DATE)} {form.booking?.eventDate?.date ? formatDate(form.booking.eventDate.date, locale) : t(T.COMMON.LABELS.EM_DASH)}</p>
                      <p>{t(T.EVENT_FORM.LABEL_GUESTS)} {form.finalGuestCount || t(T.COMMON.LABELS.EM_DASH)}</p>
                      <p>{t(T.EVENT_FORM.LABEL_SAVED)} {form.createdAt ? formatDateTime(form.createdAt, locale) : t(T.COMMON.LABELS.EM_DASH)}</p>
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
        <div className="maple-bs-form maple-form-container card shadow-sm h-100">
          <div className="card-header maple-progress-header">
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
              <div>
                <h3 className="h5 mb-1">{selected.clientAFullName} {selected.clientBFullName ? `+ ${selected.clientBFullName}` : ''}</h3>
                <p className="maple-subtitle mb-0">{dateStr(selected)} · {formatEventType(selected.eventType)} · {formatTimeOfDayDisplay(t, selected.timeOfDay)} · {t(T.EVENT_FORM.GUESTS_COUNT, { count: selected.guestCount })}</p>
              </div>
              <div className="flex-grow-1" style={{ maxWidth: 280 }}>
                <div className="progress" role="progressbar" aria-valuenow={formProgress} aria-valuemin={0} aria-valuemax={100} aria-label={t(T.EVENT_FORM.PROGRESS_ARIA)}>
                  <div className="progress-bar" style={{ width: `${formProgress}%` }} />
                </div>
                <span className="small text-muted">{t(T.EVENT_FORM.PROGRESS_READY, { percent: formProgress })}</span>
              </div>
            </div>
            <div className="d-flex flex-wrap gap-2 mt-2">
              <span className="maple-meta-chip">{t(T.EVENT_FORM.META_FINAL, { count: formData.finalGuestCount || t(T.COMMON.LABELS.EM_DASH) })}</span>
              <span className="maple-meta-chip">{t(T.EVENT_FORM.META_KASHRUT, { value: formatKashrut(normalizeKashrutValue(formData.kashrut)) })}</span>
            </div>
            {!designExport && (
              <button type="button" onClick={() => setSelected(null)} className="btn btn-sm btn-outline-secondary position-absolute top-0 end-0 m-3">✕ {t(T.UI.CLOSE)}</button>
            )}
          </div>

          <div className="maple-form-body card-body">
            <div className="maple-form-board">
            <div className={styles.boardColumn}>
            {/* שעה + עיצוב + ציוד טכני — מאוחד */}
            <div className={`card mb-0 ${styles.boardBasics}`}>
              <div className="card-body">
                <div className={styles.boardSubSection}>
                  <div className={styles.boardSubTitle}>
                    <span className={styles.boardSubTitleMain}>
                      <SectionIcon>
                        <svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 11h4v-2h-3V7h-2v6z"/></svg>
                      </SectionIcon>
                      {t(T.EVENT_FORM.SECTION_TIME_RECEPTION)}
                    </span>
                  </div>
                  <div className="row g-2">
                    <div className="col-12">
                      <label className="form-label">{t(T.EVENT_FORM.LABEL_RECEPTION_TIME)}</label>
                      <input
                        type="time"
                        className="form-control"
                        value={formData.eventTime || ''}
                        onChange={e => handleInputChange('eventTime', e.target.value)}
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label">{t(T.EVENT_FORM.LABEL_RECEPTION_TYPE)}</label>
                      <SegmentedControl
                        value={formData.receptionType || 'separate'}
                        options={separateMixedOptions}
                        onChange={(v) => handleInputChange('receptionType', v)}
                        ariaLabel={t(T.EVENT_FORM.LABEL_RECEPTION_TYPE)}
                      />
                    </div>
                  </div>
                </div>

                <div className={`${styles.boardSubSection} ${styles.boardSubSectionDesign}`}>
                  <div className={styles.boardSubTitle}>
                    <span className={styles.boardSubTitleMain}>
                      <SectionIcon>
                        <svg viewBox="0 0 24 24"><path d="M12 2l2.4 4.8L20 8l-3.6 3.5.85 5L12 14.8 6.75 16.5 7.6 11.5 4 8l5.6-1.2L12 2z"/></svg>
                      </SectionIcon>
                      {t(T.EVENT_FORM.SECTION_DESIGN)}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate('/gallery')}
                      className="btn btn-sm btn-outline-secondary"
                    >
                      {t(T.EVENT_FORM.SECTION_GALLERY)}
                    </button>
                  </div>
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label">{t(T.EVENT_FORM.LABEL_TABLECLOTHS)}</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder={t(T.EVENT_FORM.PLACEHOLDER_TABLECLOTH)}
                        value={formData.tableclothId || ''}
                        onChange={e => handleInputChange('tableclothId', e.target.value)}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label">{t(T.EVENT_FORM.LABEL_NAPKINS)}</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder={t(T.EVENT_FORM.PLACEHOLDER_NAPKIN)}
                        value={formData.napkinId || ''}
                        onChange={e => handleInputChange('napkinId', e.target.value)}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label">{t(T.EVENT_FORM.LABEL_CENTERPIECES)}</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder={t(T.EVENT_FORM.PLACEHOLDER_CENTERPIECE)}
                        value={formData.centerpiece || ''}
                        onChange={e => handleInputChange('centerpiece', e.target.value)}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label">{t(T.EVENT_FORM.LABEL_BRIDE_CHAIR)}</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder={t(T.EVENT_FORM.PLACEHOLDER_CHAIR)}
                        value={formData.bridgeChair || ''}
                        onChange={e => handleInputChange('bridgeChair', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className={`${styles.boardSubSection} ${styles.boardSubSectionEquip}`}>
                  <div className={styles.boardSubTitle}>
                    <span className={styles.boardSubTitleMain}>
                      <SectionIcon>
                        <svg viewBox="0 0 24 24"><path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2c0-1.77-1.02-3.29-2.5-4.03v8.06c1.48-.74 2.5-2.26 2.5-4.03z"/></svg>
                      </SectionIcon>
                      {t(T.EVENT_FORM.SECTION_TECH)}
                    </span>
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    <div className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id="has-lighting"
                        checked={formData.hasLighting || false}
                        onChange={e => handleCheckboxChange('hasLighting', e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="has-lighting">{t(T.EVENT_FORM.UPGRADE_LIGHTING)}</label>
                    </div>
                    <div className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id="has-sound"
                        checked={formData.hasSoundSystem || false}
                        onChange={e => handleCheckboxChange('hasSoundSystem', e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="has-sound">{t(T.EVENT_FORM.UPGRADE_SOUND)}</label>
                    </div>
                    <div className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id="has-screens"
                        checked={formData.hasScreens || false}
                        onChange={e => handleCheckboxChange('hasScreens', e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="has-screens">{t(T.EVENT_FORM.UPGRADE_SCREENS)}</label>
                    </div>
                    <div className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id="has-fireworks"
                        checked={formData.hasFireworks || false}
                        onChange={e => handleCheckboxChange('hasFireworks', e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="has-fireworks">{t(T.EVENT_FORM.UPGRADE_FIREWORKS)}</label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={`card mb-0 ${styles.boardEnt}`}>
              <div className="card-header maple-section-header">
                <h4 className="h6 mb-0 d-flex align-items-center">
                  <SectionIcon>
                    <svg viewBox="0 0 24 24"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>
                  </SectionIcon>
                  {t(T.EVENT_FORM.SECTION_ENTERTAINERS)}
                </h4>
              </div>
              <div className="card-body">
              <div className="mb-3">
                <label className="form-label">{t(T.EVENT_FORM.LABEL_HAS_ENTERTAINERS)}</label>
                <select
                  className="form-select"
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
                  <option value="">{t(T.EVENT_FORM.SELECT_PLACEHOLDER)}</option>
                  <option value="yes">{t(T.COMMON.LABELS.YES)}</option>
                  <option value="no">{t(T.COMMON.LABELS.NO)}</option>
                </select>
              </div>

              {hasEntertainers === true && (
              <>
              <div className="row g-2">
                <div className="col-12">
                  <label className="form-label">{t(T.EVENT_FORM.LABEL_ENTERTAINER_TYPE)}</label>
                  <select
                    className="form-select"
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
                    <option value="">{t(T.EVENT_FORM.SELECT_TYPE)}</option>
                    <option value="bar">{t(T.EVENT_FORM.ENTERTAINER_BAR)}</option>
                    <option value="sitting">{t(T.EVENT_FORM.ENTERTAINER_SITTING)}</option>
                  </select>
                </div>
              </div>

              {(formData.entertainersBar !== undefined || formData.entertainersSitting !== undefined) && (() => {
                const isBar = formData.entertainersBar !== undefined;
                const currentTotal = isBar ? (formData.entertainersBar || 0) : (formData.entertainersSitting || 0);
                return (
                  <>
                    <div className="row g-2">
                      <div className="col-6">
                        <label className="form-label">{t(T.EVENT_FORM.LABEL_TOTAL_PARTICIPANTS)}</label>
                        <input
                          type="number"
                          className="form-control"
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
                      <div className="col-6">
                        <label className="form-label">{t(T.EVENT_FORM.LABEL_MEN)}</label>
                        <input
                          type="number"
                          className="form-control"
                          min="0"
                          value={formData.entertainersMen || ''}
                          onChange={e => {
                            const men = parseInt(e.target.value) || 0;
                            handleInputChange('entertainersMen', men);
                            handleInputChange('entertainersWomen', Math.max(0, currentTotal - men));
                          }}
                        />
                      </div>
                      <div className="col-6">
                        <label className="form-label">{t(T.EVENT_FORM.LABEL_WOMEN)}</label>
                        <input
                          type="number"
                          className="form-control bg-light"
                          min="0"
                          value={formData.entertainersWomen || ''}
                          readOnly
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
                          <span className={styles.splitMen}>{t(T.EVENT_FORM.SPLIT_MEN, { percent: entMenPercent, count: entMen })}</span>
                          <span className={styles.splitWomen}>{t(T.EVENT_FORM.SPLIT_WOMEN, { percent: entWomenPercent, count: entWomen })}</span>
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
            </div>

            <div className={styles.boardColumn}>
            {/* מוזמנים וישיבה */}
            <div className={`card mb-0 ${styles.boardGuests}`}>
              <div className="card-header maple-section-header d-flex justify-content-between align-items-center">
                <h4 className="h6 mb-0 d-flex align-items-center">
                  <SectionIcon>
                    <svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
                  </SectionIcon>
                  {t(T.EVENT_FORM.SECTION_GUESTS)}
                </h4>
                <button
                  type="button"
                  onClick={() => setIsTableLayoutOpen(true)}
                  className={`btn btn-sm ${savedTables?.length ? 'btn-outline-primary' : 'btn-primary'}`}
                >
                  {savedTables?.length ? t(T.EVENT_FORM.TABLES_COUNT, { count: savedTables.length }) : t(T.EVENT_FORM.TABLE_LAYOUT)}
                </button>
              </div>
              <div className="card-body">
              <div className="row g-2">
                <div className="col-6">
                  <label className="form-label">{t(T.EVENT_FORM.LABEL_FINAL_GUESTS)}</label>
                  <input
                    type="number"
                    className="form-control"
                    min="0"
                    value={formData.finalGuestCount || ''}
                    onChange={e => handleInputChange('finalGuestCount', parseInt(e.target.value))}
                  />
                </div>
                <div className="col-6">
                  <label className="form-label">{t(T.EVENT_FORM.LABEL_SEATING_TYPE)}</label>
                  <SegmentedControl
                    value={formData.seatingType || 'separate'}
                    options={separateMixedOptions}
                    onChange={(v) => handleInputChange('seatingType', v)}
                    ariaLabel={t(T.EVENT_FORM.LABEL_SEATING_TYPE)}
                  />
                </div>
                <div className="col-6">
                  <label className="form-label">{t(T.EVENT_FORM.LABEL_HONOR_TABLE)}</label>
                  <select
                    className="form-select"
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
                    <option value="">{t(T.COMMON.LABELS.EM_DASH)}</option>
                    <option value="yes">{t(T.COMMON.LABELS.YES)}</option>
                    <option value="no">{t(T.COMMON.LABELS.NO)}</option>
                  </select>
                </div>
              </div>
              {hasHonorTable && (
                <div className="row g-2">
                  <div className="col-6">
                    <label className="form-label">{t(T.EVENT_FORM.LABEL_HONOR_COUNT)}</label>
                    <input
                      type="number"
                      className="form-control"
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
                  <button
                    type="button"
                    className={styles.tableLayoutPreviewBtn}
                    onClick={() => setIsTableLayoutPreviewOpen(true)}
                    title="לחץ להגדלה ולצפייה בסידור המלא"
                    aria-label="הגדלת סקיצת סידור שולחנות"
                  >
                    <img
                      src={tableLayoutImageUrl}
                      alt={t(T.EVENT_FORM.TABLE_SKETCH_ALT)}
                      className={styles.tableLayoutPreviewImg}
                    />
                    <span className={styles.tableLayoutPreviewHint}>לחץ להגדלה ולצפייה בסידור</span>
                  </button>
                </div>
              )}

              {formData.seatingType === 'separate' && (
                <div className="row g-2">
                  <div className="col-6">
                    <label className="form-label">{t(T.EVENT_FORM.LABEL_MEN_COUNT)}</label>
                    <input
                      type="number"
                      className="form-control"
                      min="0"
                      value={formData.menCount ?? ''}
                      onChange={e => handleInputChange('menCount', e.target.value)}
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label">{t(T.EVENT_FORM.LABEL_WOMEN_COUNT)}</label>
                    <input
                      type="number"
                      className="form-control"
                      min="0"
                      value={formData.womenCount ?? ''}
                      onChange={e => handleInputChange('womenCount', e.target.value)}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label">{t(T.EVENT_FORM.LABEL_SPLIT_PERCENT)}</label>
                    {formData.menPercent != null && formData.womenPercent != null ? (
                      <div className={styles.splitBadge}>
                        <span className={styles.splitMen}>{t(T.EVENT_FORM.SPLIT_MEN, { percent: formData.menPercent, count: formData.menCount ?? 0 })}</span>
                        <span className={styles.splitWomen}>{t(T.EVENT_FORM.SPLIT_WOMEN, { percent: formData.womenPercent, count: formData.womenCount ?? 0 })}</span>
                      </div>
                    ) : (
                      <div className={styles.splitBadgeEmpty}>{t(T.COMMON.LABELS.EM_DASH)}</div>
                    )}
                  </div>
                </div>
              )}

              {portionBilling && (
                <div
                  className={styles.portionStrip}
                  title={
                    portionBilling.seatingType === 'separate'
                      ? `${t(T.EVENT_FORM.PORTIONS_MEN, { men: portionBilling.menCount, portions: portionBilling.menBillablePortions })} · ${t(T.EVENT_FORM.PORTIONS_WOMEN, { women: portionBilling.womenCount, portions: portionBilling.womenBillablePortions })}`
                      : t(T.EVENT_FORM.PORTIONS_TOTAL, {
                          guests: formData.finalGuestCount ?? 0,
                          portions: portionBilling.totalBillablePortions,
                        })
                  }
                >
                  <span className={styles.portionStripLabel}>{t(T.EVENT_FORM.PORTIONS_BILLABLE)}</span>
                  <span className={styles.portionStripStrong}>
                    {portionBilling.totalBillablePortions} × {portionBilling.pricePerPortion} ₪ = {formatCurrency(portionBilling.totalAmount, locale)}
                  </span>
                </div>
              )}
              </div>
            </div>

            <div className={`card mb-0 ${styles.boardMenu}`}>
              <div className="card-body d-flex justify-content-between align-items-center flex-wrap gap-3">
                <div>
                  <h4 className="h6 mb-1 d-flex align-items-center">
                    <SectionIcon>
                      <svg viewBox="0 0 24 24"><path d="M8.1 13.34l2.83-2.83L3.91 3.5a4.008 4.008 0 0 0 0 5.66l4.19 4.18zm6.78-1.81a11.044 11.044 0 0 1-2.83 2.83l2.83 2.83 2.83-2.83-2.83-2.83zM20.49 19.63l-1.41-1.41-2.83 2.83 2.83 2.83 1.41-1.41-2.83-2.83 2.83-2.82z"/></svg>
                    </SectionIcon>
                    {t(T.EVENT_FORM.SECTION_MENU)}
                  </h4>
                  {selectedMenu ? (
                    <>
                      <span className="badge text-bg-success">{t(T.EVENT_FORM.MENU_SELECTED)}</span>
                      {menuStats && (
                        <p className="small text-muted mb-0 mt-1">
                          {t(T.EVENT_FORM.MENU_STATS, { categories: menuStats.categories, items: menuStats.items })}
                        </p>
                      )}
                    </>
                  ) : (
                    <span className="badge text-bg-warning">{t(T.EVENT_FORM.MENU_NOT_SELECTED)}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(true)}
                  className={`btn ${selectedMenu ? 'btn-outline-primary' : 'btn-primary'}`}
                >
                  {selectedMenu ? t(T.EVENT_FORM.EDIT_MENU) : t(T.EVENT_FORM.SELECT_MENU)}
                </button>
              </div>
            </div>
            </div>

            <div className={styles.boardColumn}>
            {/* תשלומים וכשרות */}
            <div className={`card mb-0 ${styles.boardPay}`}>
              <div className="card-header maple-section-header">
                <h4 className="h6 mb-0 d-flex align-items-center">
                  <SectionIcon>
                    <svg viewBox="0 0 24 24"><path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4V6h16v12zM4 10h16v2H4v-2z"/></svg>
                  </SectionIcon>
                  {t(T.EVENT_FORM.SECTION_PAYMENTS)}
                </h4>
              </div>

              <div className="card-body">
              <div className={styles.payGrid}>
                <div className="d-flex flex-wrap gap-2 mb-3">
                  {(depositCheckFile || formData.depositCheckUrl) ? (
                    <span className={styles.payStatusOk}>{t(T.EVENT_FORM.CHECK_ATTACHED)}</span>
                  ) : (
                    <span className={styles.payStatusWarn}>{t(T.EVENT_FORM.CHECK_MISSING)}</span>
                  )}
                  {formData.kashrut ? (
                    <span className={styles.payStatusOk}>{t(T.EVENT_FORM.KASHRUT_SELECTED, { value: formatKashrut(normalizeKashrutValue(formData.kashrut)) })}</span>
                  ) : (
                    <span className={styles.payStatusWarn}>{t(T.EVENT_FORM.KASHRUT_REQUIRED)}</span>
                  )}
                </div>
                <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
                  <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setShowCamera(true)}>
                    {t(T.EVENT_FORM.PHOTO)}
                  </button>
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => document.getElementById('fileInput')?.click()}>
                    {t(T.EVENT_FORM.UPLOAD)}
                  </button>
                  <input type="file" id="fileInput" accept="image/*" onChange={handleFileChange} className="d-none" />
                  <div className="form-check mb-0">
                    <input type="checkbox" className="form-check-input" id="deposit-received" checked={formData.depositCheckStatus || false} onChange={e => handleCheckboxChange('depositCheckStatus', e.target.checked)} />
                    <label className="form-check-label" htmlFor="deposit-received">{t(T.EVENT_FORM.CHECK_RECEIVED)}</label>
                  </div>
                  {(depositCheckFile || formData.depositCheckUrl) && (
                    <button type="button" onClick={handleDeleteCheckImage} className="btn btn-sm btn-outline-danger">
                      {t(T.EVENT_FORM.DELETE_CHECK)}
                    </button>
                  )}
                </div>

                {(formData.depositCheckUrl || formData.depositCheckDetails) && (
                  <CheckDetailsForm
                    details={formData.depositCheckDetails || {}}
                    imageUrl={formData.depositCheckUrl}
                    scanning={checkScanning}
                    onChange={details => handleInputChange('depositCheckDetails', details)}
                  />
                )}

                <div className="row g-2">
                  <div className="col-6">
                    <label className="form-label">{t(T.EVENT_FORM.LABEL_AKUM_CODE)}</label>
                    <input type="text" readOnly value={selected.akumApprovalCode || t(T.EVENT_FORM.NOT_ENTERED)} className={`form-control bg-light ${selected.akumApprovalCode ? 'text-success' : 'text-muted'}`} />
                  </div>
                  <div className="col-6">
                    <label className="form-label" htmlFor="event-kashrut">{t(T.EVENT_FORM.KASHRUT_ALT)}</label>
                    <KashrutSelector
                      id="event-kashrut"
                      value={formData.kashrut}
                      onChange={(val) => handleInputChange('kashrut', val)}
                    />
                  </div>
                </div>

                <div className="d-flex flex-wrap align-items-center gap-3 mt-3">
                  <div className="form-check">
                    <input type="checkbox" className="form-check-input" id="akum-paid" checked={formData.akumPaid || !!selected.akumApprovalCode} onChange={e => handleCheckboxChange('akumPaid', e.target.checked)} />
                    <label className="form-check-label" htmlFor="akum-paid">{t(T.EVENT_FORM.AKUM_PAID)}</label>
                  </div>
                  {selected.clientSignatureUrl && (
                    <img src={selected.clientSignatureUrl} alt={t(T.EVENT_FORM.CONTRACT_ALT)} className={styles.signatureThumb} title={t(T.EVENT_FORM.CONTRACT_SIGNED)} />
                  )}
                </div>
              </div>
              </div>
            </div>

            <div className={`card mb-0 ${styles.boardNotes}`}>
              <div className="card-header maple-section-header d-flex justify-content-between align-items-center">
                <h4 className="h6 mb-0 d-flex align-items-center">
                  <SectionIcon>
                    <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                  </SectionIcon>
                  {t(T.EVENT_FORM.SECTION_NOTES)}
                </h4>
                {notesList.length > 0 && <span className="badge text-bg-secondary">{notesList.length}</span>}
              </div>
              <div className="card-body">
              {notesList.length > 0 && (
                <div className={styles.notesScroll}>
                  {notesList.map((note, idx) => (
                    <div key={idx} className="d-flex align-items-start gap-2 mb-2">
                      <span className="text-muted">{idx + 1}.</span>
                      <span className="flex-grow-1">{note}</span>
                      <button onClick={() => removeNote(idx)} className="btn btn-sm btn-outline-danger">✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="input-group">
                <input
                  type="text"
                  placeholder={t(T.EVENT_FORM.ADD_NOTE)}
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && addNote()}
                  className="form-control"
                />
                <button onClick={addNote} className="btn btn-outline-primary">+</button>
              </div>
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
                    title={t(T.UI.CLOSE)}
                  >
                    {t(T.EVENT_FORM.CLOSE_AND_RETURN)}
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

            {isTableLayoutPreviewOpen && tableLayoutImageUrl && (
              <div
                className={styles.modalOverlay}
                onClick={() => setIsTableLayoutPreviewOpen(false)}
                role="dialog"
                aria-modal="true"
                aria-label="תצוגה מוגדלת של סידור שולחנות"
              >
                <div
                  className={styles.tableLayoutLightbox}
                  onClick={(e) => e.stopPropagation()}
                >
                  <img
                    src={tableLayoutImageUrl}
                    alt="סידור שולחנות — תצוגה מלאה"
                    className={styles.tableLayoutLightboxImg}
                  />
                  <div className={styles.tableLayoutLightboxActions}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        setIsTableLayoutPreviewOpen(false);
                        setIsTableLayoutOpen(true);
                      }}
                    >
                      פתיחת הסידור המלא לעריכה / צפייה
                    </button>
                    <button
                      type="button"
                      className={styles.modalCloseBtn}
                      onClick={() => setIsTableLayoutPreviewOpen(false)}
                    >
                      סגור
                    </button>
                  </div>
                </div>
              </div>
            )}

            {isTableLayoutOpen && (
              <div className={styles.tableLayoutOverlay}>
                <div className={styles.tableLayoutInner}>
                  <div style={{ marginBottom: '8px', textAlign: 'center' }}>
                    <h3 className={styles.tableLayoutTitle}>{t(T.EVENT_FORM.TABLE_LAYOUT_TITLE)}</h3>
                    {tableLayoutSaving && <span className={styles.tableLayoutSaving}>{t(T.EVENT_FORM.SAVING)}</span>}
                  </div>
                  <div className={styles.tableLayoutBuilder}>
                    <FloorPlanBuilder
                      key={`${selected.id}-${savedTables?.length ?? 0}-${layoutGuestCount}`}
                      initialTables={savedTables}
                      draftEventId={selected.id}
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

            <p className="small text-muted px-3 mb-0">
              {t(T.EVENT_FORM.TIP_DISCLAIMER)}
            </p>

            <div className="card-footer maple-form-footer d-flex flex-wrap gap-2 justify-content-between">
                <button onClick={() => setSelected(null)} className="btn btn-outline-secondary">{t(T.EVENT_FORM.CANCEL)}</button>

                <button
                  onClick={handleSaveForm}
                  className="btn btn-primary"
                  disabled={actionBusy}
                >
                  {submitting ? t(T.EVENT_FORM.SAVING) : t(T.EVENT_FORM.SAVE_FORM)}
                </button>

                <div className="d-flex flex-wrap gap-2">
                  <button
                    onClick={handleSaveAndDownloadPDF}
                    disabled={actionBusy}
                    className="btn btn-outline-primary"
                    title={t(T.EVENT_FORM.DOWNLOAD_FORM)}
                  >
                    {submitting ? t(T.EVENT_FORM.SAVING) : t(T.EVENT_FORM.DOWNLOAD_FORM)}
                  </button>

                  <button
                    onClick={() => {
                      const textMsg = buildShareMessage();
                      window.open(`https://wa.me/?text=${encodeURIComponent(textMsg)}`, '_blank');
                    }}
                    className="btn btn-success"
                    title={!isFormValid() ? t(T.EVENT_FORM.FILL_BEFORE_SHARE) : t(T.EVENT_FORM.SHARE_WHATSAPP)}
                  >
                    {t(T.EVENT_FORM.SHARE_WHATSAPP)}
                  </button>
                  <button
                    onClick={handleSendEmail}
                    disabled={actionBusy}
                    className="btn btn-outline-secondary"
                    title={t(T.EVENT_FORM.SHARE_EMAIL)}
                  >
                    {emailSending ? t(T.EVENT_FORM.SAVING) : t(T.EVENT_FORM.SHARE_EMAIL)}
                  </button>
                </div>
            </div>
          </div>
      )}
    </div>
  );
};

export default EventFormManager;