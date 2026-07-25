import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { formatDate, formatDateTime } from '@shared/i18n/formatters';
import {
  translateByValue,
  EVENT_TYPE_KEY_BY_VALUE,
  KASHRUT_KEY_BY_VALUE,
  DEFAULT_EVENT_TYPE,
} from '@shared/i18n/bookingLookups';
import { formatTimeOfDayDisplay } from '../../utils/timeSlot';
import { useNavigationOverride } from '../../context/navigationContext';
import '../../styles/bootstrap-maple-forms.css';
import styles from './EventFormManager.module.css';
import CheckCamera from '../CheckCamera/CheckCamera';
import CheckDetailsForm from '../CheckDetailsForm/CheckDetailsForm';
import { scanCheckImage, fileToDataUrl, type DepositCheckDetails } from '../../utils/checkOcr';
import CancellationStats from '../CancellationStats/CancellationStats';
import MenuSelectionForm from '../MenuSelectionForm/MenuSelectionForm';
import FloorPlanBuilder from '../FloorPlanBuilder/FloorPlanBuilder';
import type { TableData } from '../FloorPlanBuilder/FloorPlanBuilder';
import { serverTablesToClient, clientTablesToServer } from '../../constants/defaultTableLayout';
import { hasEventEnded } from '../../utils/eventStart';
import { todayCalendarKey } from '../../utils/dateLocal';
import { API_URL } from '../../config/api';
import { secureFetch, getAuthUser } from '../../services/api';
import {
  saveEventFormDraft,
  loadEventFormDraft,
  clearEventFormDraft,
  type EventFormDraftSnapshot,
} from '../../utils/eventFormDraft';
import { consumePendingDesignSelections } from '../../utils/designGallerySelection';
import { DesignSelectionSummary } from '../DesignGallery/DesignSelectionSummary';
import { DesignGalleryModal } from '../DesignGallery/DesignGalleryModal';
import type { DesignFormField } from '@shared/gallery';
import {
  useBookingsQuery,
  useEventFormsQuery,
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

const BAR_MITZVAH_EVENT_TYPE = 'בר מצווה';
const DEFAULT_RECEPTION_TIME = '18:00';
const EVENT_FORM_RETURN_BOOKING_KEY = 'eventFormReturnBookingId';

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
  kosherType?: string | null;
  depositCheckUrl?: string | null;
  depositCheckDetails?: DepositCheckDetails | null;
  depositCheckStatus?: boolean | null;
}

const showsReceptionTime = (eventType?: string) =>
  eventType === DEFAULT_EVENT_TYPE || eventType === BAR_MITZVAH_EVENT_TYPE;

const showsEntertainers = (eventType?: string) => eventType === DEFAULT_EVENT_TYPE;

const requiresReceptionTime = (eventType?: string) => eventType === DEFAULT_EVENT_TYPE;

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

/** Map Contract Form kosherType codes → Event Production Form kashrut values. */
const CONTRACT_KOSHER_TO_EVENT_KASHRUT: Record<string, string> = {
  rubin: 'רובין',
  רובין: 'רובין',
  bad_reuven: 'רובין',
  machpud: 'מחפוד',
  מחפוד: 'מחפוד',
  landa: 'לנדא',
  לנדא: 'לנדא',
  kehilot: 'בדץ קהילות',
  'בדץ קהילות': 'בדץ קהילות',
  gross: 'הרב גרוס',
  'הרב גרוס': 'הרב גרוס',
  badatz: 'בדץ ע"ח',
  'בדץ ע"ח': 'בדץ ע"ח',
};

const kashrutFromContract = (kosherType?: string | null): string | undefined => {
  if (!kosherType) return undefined;
  return CONTRACT_KOSHER_TO_EVENT_KASHRUT[kosherType] || CONTRACT_KOSHER_TO_EVENT_KASHRUT[kosherType.trim()];
};

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
  const location = useLocation();
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
  const { data: kashruts = [] } = useKashrutQuery();

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
  
  const [formData, setFormData] = useState<EventFormData>(designExport?.formData ?? {});
  const [depositCheckFile, setDepositCheckFile] = useState<File | null>(null);
  const [checkScanning, setCheckScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const actionBusy = submitting || emailSending;
  const [notesList, setNotesList] = useState<string[]>(designExport?.notesList ?? []);
  const [newNote, setNewNote] = useState('');

  const [kashrutImage, setKashrutImage] = useState<string | null>(null);
  const [isKashrutModalOpen, setIsKashrutModalOpen] = useState(false);
  
  const [selectedMenu, setSelectedMenu] = useState<Record<string, string[]> | null>(designExport?.selectedMenu ?? null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isTableLayoutOpen, setIsTableLayoutOpen] = useState(false);
  const [savedTables, setSavedTables] = useState<TableData[] | undefined>(undefined);
  const [tableLayoutImageUrl, setTableLayoutImageUrl] = useState<string | null>(null);
  const [isTableLayoutModalOpen, setIsTableLayoutModalOpen] = useState(false);
  const [tableLayoutSaving, setTableLayoutSaving] = useState(false);
  const [hasHonorTable, setHasHonorTable] = useState<boolean | null>(designExport?.hasHonorTable ?? null);
  const [hasEntertainers, setHasEntertainers] = useState<boolean | null>(designExport?.hasEntertainers ?? null);
  const [showCamera, setShowCamera] = useState(false);
  const [isDesignGalleryOpen, setIsDesignGalleryOpen] = useState(false);

  const menuStats = useMemo(() => {
    if (!selectedMenu) return null;
    const categories = Object.keys(selectedMenu).length;
    const items = Object.values(selectedMenu).reduce((sum, arr) => sum + arr.length, 0);
    return { categories, items };
  }, [selectedMenu]);

  const isWeddingEvent = selected?.eventType === DEFAULT_EVENT_TYPE;
  const showReceptionTimeField = showsReceptionTime(selected?.eventType);
  const showEntertainersSection = showsEntertainers(selected?.eventType);

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
    const entertainersOk = !showEntertainersSection || hasEntertainers === false || hasEntertainers === true;
    const receptionTimeOk = !requiresReceptionTime(selected?.eventType) || !!formData.eventTime;
    const hasCheck = !!(depositCheckFile || formData.depositCheckUrl);
    const sections = [
      receptionTimeOk,
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
  }, [formData, hasEntertainers, depositCheckFile, selectedMenu, selected?.eventType, showEntertainersSection]);

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
    if (isDesignGalleryOpen) {
      setIsDesignGalleryOpen(false);
      return;
    }
    if (isTableLayoutModalOpen) {
      setIsTableLayoutModalOpen(false);
      return;
    }
    if (selected) {
      setSelected(null);
    }
  }, [showCamera, isTableLayoutOpen, isMenuOpen, isKashrutModalOpen, isDesignGalleryOpen, isTableLayoutModalOpen, selected]);

  const navigationOverride = useMemo(() => {
    const inSubStep =
      showCamera
      || isTableLayoutOpen
      || isMenuOpen
      || isKashrutModalOpen
      || isDesignGalleryOpen
      || isTableLayoutModalOpen
      || !!selected;
    return inSubStep ? { onBack: handleStepBack } : null;
  }, [showCamera, isTableLayoutOpen, isMenuOpen, isKashrutModalOpen, isDesignGalleryOpen, isTableLayoutModalOpen, selected, handleStepBack]);

  useNavigationOverride(navigationOverride);

  const prepareFormDataForSave = (data: EventFormData): EventFormData => {
    const { menCount, womenCount, ...rest } = data;
    const clearEntertainers = !showEntertainersSection || hasEntertainers === false;
    return {
      ...rest,
      honorTableCount: hasHonorTable ? data.honorTableCount : undefined,
      ...(clearEntertainers ? {
        entertainersBar: undefined,
        entertainersSitting: undefined,
        entertainersMen: undefined,
        entertainersWomen: undefined,
      } : {}),
      ...(!showReceptionTimeField ? { eventTime: undefined } : {}),
    };
  };

  const hydrateFormFromBooking = (
    cleanForm: Partial<EventFormData>,
    booking: Booking,
  ): EventFormData => {
    const guestTotal = cleanForm.finalGuestCount || booking.guestCount;
    const { menCount, womenCount } = countsFromPercents(
      cleanForm.menPercent,
      cleanForm.womenPercent,
      guestTotal,
    );
    const receptionVisible = showsReceptionTime(booking.eventType);
    return {
      ...cleanForm,
      finalGuestCount: guestTotal || undefined,
      menCount,
      womenCount,
      eventTime: cleanForm.eventTime || (receptionVisible ? DEFAULT_RECEPTION_TIME : undefined),
      // Prefer saved event-form value; otherwise seed from contract choice (still editable).
      kashrut: cleanForm.kashrut || kashrutFromContract(booking.kosherType),
      depositCheckUrl: cleanForm.depositCheckUrl || booking.depositCheckUrl || undefined,
      depositCheckDetails:
        cleanForm.depositCheckDetails ?? booking.depositCheckDetails ?? null,
      depositCheckStatus:
        cleanForm.depositCheckStatus ?? booking.depositCheckStatus ?? undefined,
    };
  };

  const handleMenuSave = (menuSelections: Record<string, string[]>) => {
    setSelectedMenu(menuSelections);
    setIsMenuOpen(false); 
    alert(t(T.EVENT_FORM.MENU_SAVED));
  };

  useEffect(() => {
    if (kashruts.length > 0 && kashruts[0].imageUrl) {
      setKashrutImage(kashruts[0].imageUrl);
    }
  }, [kashruts]);

  useEffect(() => {
    if (designExport) return;

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
      .then(async (form) => {
        if (form && form.id) {
          const { id, createdAt, updatedAt, booking, bookingId, tables, ...cleanForm } = form;
          const bookingSource: Booking = {
            ...selected,
            kosherType: selected.kosherType ?? booking?.kosherType,
            depositCheckUrl: selected.depositCheckUrl ?? booking?.depositCheckUrl,
            depositCheckDetails: selected.depositCheckDetails ?? booking?.depositCheckDetails,
            depositCheckStatus: selected.depositCheckStatus ?? booking?.depositCheckStatus,
          };
          setFormData(hydrateFormFromBooking(cleanForm, bookingSource));
          setHasHonorTable(!!(form.honorTableCount && form.honorTableCount > 0));
          setHasEntertainers(
            showsEntertainers(selected.eventType)
              ? (form.entertainersBar != null || form.entertainersSitting != null ? true : null)
              : false
          );
          setNotesList(form.notes ? JSON.parse(form.notes) : []);
          setSelectedMenu(form.menuSelections || null);
          setSavedTables(tables?.length ? serverTablesToClient(tables) : undefined);
          setTableLayoutImageUrl(form.tableLayoutImageUrl || null);

          const currentUser = await getAuthUser();
          if (currentUser?.email) {
            const draft = loadEventFormDraft(selected.id, currentUser.email);
            if (draft) {
              if (window.confirm('מצאנו טיוטה מקומית לא שמורה. האם תרצה לשחזר אותה?')) {
                setFormData(draft.formData as EventFormData);
                setHasHonorTable(draft.hasHonorTable);
                setHasEntertainers(draft.hasEntertainers);
                setNotesList(draft.notesList);
                setSelectedMenu(draft.selectedMenu);
              } else {
                clearEventFormDraft(selected.id);
              }
            }
          }

          const pendingDesign = consumePendingDesignSelections(selected.id);
          if (pendingDesign && Object.keys(pendingDesign).length > 0) {
            setFormData((prev) => ({ ...prev, ...pendingDesign }));
          }
        } else {
          setFormData(hydrateFormFromBooking({}, selected));
          setHasHonorTable(null);
          setHasEntertainers(showsEntertainers(selected.eventType) ? null : false);
          setNotesList([]);
          setSavedTables(undefined);
          setTableLayoutImageUrl(null);
          const pendingDesign = consumePendingDesignSelections(selected.id);
          if (pendingDesign && Object.keys(pendingDesign).length > 0) {
            setFormData((prev) => ({ ...prev, ...pendingDesign }));
          }
        }
      })
      .catch(() => {
        setFormData(hydrateFormFromBooking({}, selected));
        setHasHonorTable(null);
        setHasEntertainers(showsEntertainers(selected.eventType) ? null : false);
        setNotesList([]);
        setSavedTables(undefined);
        setTableLayoutImageUrl(null);
        const pendingDesign = consumePendingDesignSelections(selected.id);
        if (pendingDesign && Object.keys(pendingDesign).length > 0) {
          setFormData((prev) => ({ ...prev, ...pendingDesign }));
        }
      });
  }, [selected, designExport]);

  // Restore the open booking after returning from Gallery (or other sub-routes).
  useEffect(() => {
    if (designExport || selected || loading) return;
    const state = location.state as { bookingId?: string; restoreEventForm?: boolean } | null;
    const bookingId =
      state?.bookingId ||
      (typeof sessionStorage !== 'undefined'
        ? sessionStorage.getItem(EVENT_FORM_RETURN_BOOKING_KEY)
        : null);
    if (!bookingId || bookings.length === 0) return;
    const match = bookings.find((b) => b.id === bookingId);
    if (match) {
      setSelected(match);
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(EVENT_FORM_RETURN_BOOKING_KEY);
      }
      if (state?.bookingId) {
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [bookings, selected, loading, location.state, location.pathname, navigate, designExport]);

  useEffect(() => {
    if (!selected || actionBusy) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    getAuthUser().then((currentUser) => {
      if (cancelled || !currentUser?.email) return;
      timer = setTimeout(() => {
        const snapshot: EventFormDraftSnapshot = {
          formData,
          hasHonorTable,
          hasEntertainers,
          notesList,
          selectedMenu,
        };
        saveEventFormDraft(selected.id, currentUser.email, snapshot);
      }, 1000);
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [selected, formData, hasHonorTable, hasEntertainers, notesList, selectedMenu, actionBusy]);

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
    const receptionTimeOk = !requiresReceptionTime(selected?.eventType) || !!formData.eventTime;

    return !!(
      receptionTimeOk &&
      currentReception &&
      formData.finalGuestCount &&
      currentSeating &&
      (currentSeating === 'mixed' || ((formData.menCount || 0) + (formData.womenCount || 0) > 0)) &&
      (formData.depositCheckUrl || depositCheckFile) && 
      formData.kashrut
    );
  };

  const openGallery = () => {
    setIsDesignGalleryOpen(true);
  };

  const designSelectedValues = useMemo(
    () => ({
      tableclothId: formData.tableclothId,
      napkinId: formData.napkinId,
      centerpiece: formData.centerpiece,
      bridgeChair: formData.bridgeChair,
    }),
    [
      formData.tableclothId,
      formData.napkinId,
      formData.centerpiece,
      formData.bridgeChair,
    ],
  );

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
        clearEventFormDraft(selected.id);
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

      clearEventFormDraft(selected.id);

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

      clearEventFormDraft(selected.id);

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
              <span className="maple-meta-chip">{t(T.EVENT_FORM.META_KASHRUT, { value: formData.kashrut ? formatKashrut(formData.kashrut) : t(T.COMMON.LABELS.EM_DASH) })}</span>
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
                    {showReceptionTimeField && (
                      <div className="col-12">
                        <label className="form-label">
                          {isWeddingEvent
                            ? t(T.EVENT_FORM.LABEL_RECEPTION_TIME)
                            : t(T.EVENT_FORM.LABEL_RECEPTION_TIME_OPTIONAL)}
                        </label>
                        <input
                          type="time"
                          className="form-control"
                          value={formData.eventTime ?? DEFAULT_RECEPTION_TIME}
                          onChange={e => handleInputChange('eventTime', e.target.value)}
                        />
                      </div>
                    )}
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
                      {t(T.EVENT_FORM.SECTION_DESIGNS_GALLERY)}
                    </span>
                  </div>
                  <DesignSelectionSummary
                    selectedValues={designSelectedValues}
                    onOpenGallery={openGallery}
                  />
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

            {showEntertainersSection && (
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
            )}
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
                    onClick={() => setIsTableLayoutModalOpen(true)}
                    className={styles.tableLayoutPreviewBtn}
                    title={t(T.EVENT_FORM.ENLARGE_TABLE_LAYOUT)}
                    aria-label={t(T.EVENT_FORM.ENLARGE_TABLE_LAYOUT)}
                  >
                    <img
                      src={tableLayoutImageUrl}
                      alt={t(T.EVENT_FORM.TABLE_SKETCH_ALT)}
                      className={styles.tableLayoutPreviewImg}
                    />
                  </button>
                </div>
              )}

              {isTableLayoutModalOpen && tableLayoutImageUrl && (
                <div onClick={() => setIsTableLayoutModalOpen(false)} className={styles.modalOverlay}>
                  <div onClick={e => e.stopPropagation()} className={styles.imageLightboxContent}>
                    <button
                      type="button"
                      onClick={() => setIsTableLayoutModalOpen(false)}
                      className={styles.imageLightboxCloseBtn}
                      aria-label={t(T.UI.CLOSE)}
                    >
                      ✕
                    </button>
                    <img
                      src={tableLayoutImageUrl}
                      alt={t(T.EVENT_FORM.ENLARGED_TABLE_SKETCH_ALT)}
                      className={styles.modalImg}
                    />
                  </div>
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
                    <span className={styles.payStatusOk}>{t(T.EVENT_FORM.KASHRUT_SELECTED, { value: formatKashrut(formData.kashrut) })}</span>
                  ) : (
                    <span className={styles.payStatusWarn}>{t(T.EVENT_FORM.KASHRUT_REQUIRED)}</span>
                  )}
                </div>
                <div className="alert alert-secondary py-2 px-3 mb-3 small" role="note">
                  {t(T.EVENT_FORM.DEPOSIT_INTERNAL_ONLY)}
                </div>
                <div className="d-flex flex-wrap gap-2 mb-3">
                  <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setShowCamera(true)}>
                    {t(T.EVENT_FORM.PHOTO)}
                  </button>
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => document.getElementById('fileInput')?.click()}>
                    {t(T.EVENT_FORM.UPLOAD)}
                  </button>
                  <input type="file" id="fileInput" accept="image/*" onChange={handleFileChange} className="d-none" />
                  <div className="form-check">
                    <input type="checkbox" className="form-check-input" id="deposit-received" checked={formData.depositCheckStatus || false} onChange={e => handleCheckboxChange('depositCheckStatus', e.target.checked)} />
                    <label className="form-check-label" htmlFor="deposit-received">{t(T.EVENT_FORM.CHECK_RECEIVED)}</label>
                  </div>
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
                    <label className="form-label">{t(T.EVENT_FORM.KASHRUT_ALT)}</label>
                    <div className={styles.kashrutRow}>
                      <select className="form-select" value={formData.kashrut || ''} onChange={(e) => handleInputChange('kashrut', e.target.value)}>
                        <option value="">{t(T.EVENT_FORM.SELECT_KASHRUT)}</option>
                        {KASHRUT_LIST.map((kName, idx) => (
                          <option key={idx} value={kName}>{formatKashrut(kName)}</option>
                        ))}
                      </select>
                      {kashrutImage ? (
                        <div onClick={() => setIsKashrutModalOpen(true)} className={styles.kashrutThumb} title={t(T.EVENT_FORM.ENLARGE_CERT)}>
                          <img src={kashrutImage} alt={t(T.EVENT_FORM.KASHRUT_ALT)} />
                        </div>
                      ) : (
                        <div className={styles.kashrutThumbEmpty}>{t(T.COMMON.LABELS.EM_DASH)}</div>
                      )}
                    </div>
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
                  {(depositCheckFile || formData.depositCheckUrl) && (
                    <button onClick={handleDeleteCheckImage} className="btn btn-sm btn-outline-danger">{t(T.EVENT_FORM.DELETE_CHECK)}</button>
                  )}
                </div>
              </div>
              </div>
              {isKashrutModalOpen && kashrutImage && (
                <div onClick={() => setIsKashrutModalOpen(false)} className={styles.modalOverlay}>
                  <div onClick={e => e.stopPropagation()} className={styles.modalContent}>
                    <img src={kashrutImage} alt={t(T.EVENT_FORM.ENLARGED_CERT_ALT)} className={styles.modalImg} />
                    <button onClick={() => setIsKashrutModalOpen(false)} className={styles.modalCloseBtn}>{t(T.UI.CLOSE)}</button>
                  </div>
                </div>
              )}

              <DesignGalleryModal
                isOpen={isDesignGalleryOpen}
                onClose={() => setIsDesignGalleryOpen(false)}
                selectedValues={designSelectedValues}
                onSelect={(field: DesignFormField, value: string) => {
                  handleInputChange(field, value);
                }}
              />
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