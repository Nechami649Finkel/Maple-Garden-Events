import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
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
import { calculatePortionBilling, MIN_PORTIONS_MIXED, MIN_PORTIONS_PER_UNIT } from '../../utils/portionBilling';

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
  };
  guestCount: number;
  eventType: string;
  timeOfDay: string;
  eventForm?: any;
  akumApprovalCode?: string;
}

interface EventFormData {
  eventTime?: string;
  receptionType?: string;
  finalGuestCount?: number;
  seatingType?: string;
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

const EventFormManager = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [allForms, setAllForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Booking | null>(null);
  
  const [viewMode, setViewMode] = useState<'bookings' | 'forms' | 'stats'>('bookings'); 
  
  const [formData, setFormData] = useState<EventFormData>({});
  const [depositCheckFile, setDepositCheckFile] = useState<File | null>(null);
  const [checkScanning, setCheckScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notesList, setNotesList] = useState<string[]>([]);
  const [newNote, setNewNote] = useState('');

  const [kashrutImage, setKashrutImage] = useState<string | null>(null);
  const [isKashrutModalOpen, setIsKashrutModalOpen] = useState(false);
  
  const [selectedMenu, setSelectedMenu] = useState<Record<string, string[]> | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isTableLayoutOpen, setIsTableLayoutOpen] = useState(false);
  const [savedTables, setSavedTables] = useState<TableData[] | undefined>(undefined);
  const [tableLayoutSaving, setTableLayoutSaving] = useState(false);
  const [hasHonorTable, setHasHonorTable] = useState<boolean | null>(null);
  const [hasEntertainers, setHasEntertainers] = useState<boolean | null>(null);
  const [barPortionPrice, setBarPortionPrice] = useState(60);

  const portionBilling = calculatePortionBilling({
    finalGuestCount: formData.finalGuestCount || 0,
    seatingType: formData.seatingType || 'separate',
    menPercent: formData.menPercent,
    pricePerPortion: barPortionPrice,
  });

  const prepareFormDataForSave = (data: EventFormData): EventFormData => ({
    ...data,
    honorTableCount: hasHonorTable ? data.honorTableCount : null,
    ...(hasEntertainers === false ? {
      entertainersBar: undefined,
      entertainersSitting: undefined,
      entertainersMen: undefined,
      entertainersWomen: undefined,
    } : {}),
  });

  const handleMenuSave = (menuSelections: Record<string, string[]>) => {
    setSelectedMenu(menuSelections);
    setIsMenuOpen(false); 
    alert("התפריט נשמר כחלק מפרטי האירוע!");
  };

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/bookings?status=BOOKED&limit=200`)
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          const bookedBookings = res.data.filter((b: any) => b.eventDate?.status === 'BOOKED');
          setBookings(bookedBookings);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    fetch('http://localhost:5000/api/event-forms')
      .then(r => r.json())
      .then(forms => setAllForms(forms || []))
      .catch(console.error);

    fetch('http://localhost:5000/api/kashrut')
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0 && data[0].imageUrl) {
          setKashrutImage(data[0].imageUrl);
        }
      })
      .catch(err => console.error("שגיאה בטעינת תעודת כשרות:", err));

    fetch('http://localhost:5000/api/settings/global')
      .then(res => res.json())
      .then(data => {
        if (data?.barPortionPrice) setBarPortionPrice(Number(data.barPortionPrice));
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selected) {
      setFormData({});
      setNotesList([]);
      setHasHonorTable(null);
      setHasEntertainers(null);
      return;
    }
    fetch(`http://localhost:5000/api/event-forms/${selected.id}`)
      .then(r => r.json())
      .then(form => {
        if (form && form.id) {
          const { id, createdAt, updatedAt, booking, bookingId, tables, ...cleanForm } = form;
          setFormData(cleanForm);
          setHasHonorTable(!!(form.honorTableCount && form.honorTableCount > 0));
          setHasEntertainers(
            form.entertainersBar != null || form.entertainersSitting != null ? true : null
          );
          setNotesList(form.notes ? JSON.parse(form.notes) : []);
          setSelectedMenu(form.menuSelections || null);
          setSavedTables(tables?.length ? serverTablesToClient(tables) : undefined);
        } else {
          setFormData({});
          setHasHonorTable(null);
          setHasEntertainers(null);
          setNotesList([]);
          setSavedTables(undefined);
        }
      })
      .catch(() => {
        setFormData({});
        setHasHonorTable(null);
        setHasEntertainers(null);
        setNotesList([]);
        setSavedTables(undefined);
      });
  }, [selected]);

  const handleTableLayoutSave = async (tables: TableData[]) => {
    if (!selected) return;
    setTableLayoutSaving(true);
    try {
      const response = await fetch(`http://localhost:5000/api/event-forms/${selected.id}/tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tables: clientTablesToServer(tables) }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'שגיאה בשמירה');
      }
      setSavedTables(tables);
      alert('סידור השולחנות נשמר בהצלחה!');
      setIsTableLayoutOpen(false);
    } catch (error) {
      console.error('Table layout save error:', error);
      alert('שגיאה בשמירת סידור השולחנות');
    } finally {
      setTableLayoutSaving(false);
    }
  };

  const filtered = bookings.filter(b =>
    b.clientAFullName?.includes(search) ||
    b.clientAIdNumber?.includes(search) ||
    b.clientBFullName?.includes(search) ||
    b.clientBIdNumber?.includes(search)
  );

  const dateStr = (b: Booking) => b.eventDate?.date ? new Date(b.eventDate.date).toLocaleDateString('he-IL') : '';

  const handleInputChange = (field: keyof EventFormData, value: any) => {
    if (field === 'menPercent') {
      const newMenPercent = Math.min(parseInt(value) || 0, 100);
      const womenPercent = 100 - newMenPercent;
      setFormData(prev => ({
        ...prev,
        menPercent: newMenPercent,
        womenPercent: womenPercent
      }));
    } else if (field === 'womenPercent') {
      const newWomenPercent = Math.min(parseInt(value) || 0, 100);
      const menPercent = 100 - newWomenPercent;
      setFormData(prev => ({
        ...prev,
        womenPercent: newWomenPercent,
        menPercent: menPercent
      }));
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

  const handleDownloadPDF = async () => {
    if (!selected) return;
    try {
      const response = await fetch(`http://localhost:5000/api/event-forms/${selected.id}/pdf`);
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
      (currentSeating === 'mixed' || (formData.menPercent !== undefined && formData.womenPercent !== undefined)) &&
      (formData.depositCheckUrl || depositCheckFile) && 
      formData.kashrut
    );
  };

  const handleSaveForm = async () => {
    if (!selected) return;
    if (!isFormValid()) {
      alert('אנא מלא את כל השדות החובה:\n✓ שעה וקבלת פנים\n✓ סוג ישיבה\n✓ מוזמנים סופיים\n✓ חלוקה (אחוזים)\n✓ צ"ק פיקדון\n✓ כשרות\n\nהערות = אופציונלי');
      return;
    }
    setSubmitting(true);
    try {
      const checkUrl = await uploadCheckFile();
      const dataToSave: EventFormData = prepareFormDataForSave({
        ...formData,
        depositCheckUrl: checkUrl || formData.depositCheckUrl,
        notes: JSON.stringify(notesList),
        menuSelections: selectedMenu,
        guestPortionCount: portionBilling?.totalBillablePortions,
        pricePerPortion: portionBilling?.pricePerPortion ?? barPortionPrice,
        totalPrice: portionBilling?.totalAmount,
      });

      const response = await fetch(`http://localhost:5000/api/event-forms/${selected.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave)
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const result = await response.json();
      if (result.success) {
        const updatedBookings = bookings.map(b =>
          b.id === selected.id ? { ...b, eventForm: result.data } : b
        );
        setBookings(updatedBookings);
        setDepositCheckFile(null);
        setSubmitting(false);
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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>טופס הפקת אירוע</h2>
        {!selected && (
          <div className={styles.viewTabs}>
            <button
              onClick={() => setViewMode('bookings')}
              className={`${styles.tabBtn} ${viewMode === 'bookings' ? styles.tabBtnActive : ''}`}
            >
              חיפוש הזמנה
            </button>
            <button
              onClick={() => setViewMode('forms')}
              className={`${styles.tabBtn} ${viewMode === 'forms' ? styles.tabBtnActive : ''}`}
            >
              כל הטפסים
            </button>
            <button
              onClick={() => setViewMode('stats')}
              className={`${styles.tabBtn} ${styles.tabBtnStats} ${viewMode === 'stats' ? styles.tabBtnActive : ''}`}
            >
              סטטיסטיקות
            </button>
          </div>
        )}
      </div>

      {!selected ? (
        <>
          {viewMode === 'bookings' && (
            <>
              <input
                className={styles.searchInput}
                placeholder="חיפוש לפי שם או תעודת זהות..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {loading ? (
                <p className={styles.empty}>טוען...</p>
              ) : filtered.length === 0 ? (
                <p className={styles.empty}>{search ? 'לא נמצאו תוצאות.' : 'אין הזמנות סגורות.'}</p>
              ) : (
                <>
                  {filtered.filter(b => !b.eventForm).length > 0 && (
                    <>
                      <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', color: '#e53e3e' }}>⚠️ ממתינות למילוי טופס ({filtered.filter(b => !b.eventForm).length})</p>
                      <div className={styles.grid}>
                        {filtered.filter(b => !b.eventForm).map(b => (
                          <div key={b.id} className={styles.card} onClick={() => setSelected(b)}>
                            <div className={styles.cardDate}>{dateStr(b)}</div>
                            <div className={styles.cardName}>{b.clientAFullName}</div>
                            {b.clientBFullName && <div className={styles.cardName}>{b.clientBFullName}</div>}
                            <div className={styles.cardDetail}>סוג: {b.eventType}</div>
                            <div className={styles.cardDetail}>מוזמנים: {b.guestCount}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {filtered.filter(b => b.eventForm).length > 0 && (
                    <>
                      <p style={{ margin: '20px 0 10px 0', fontWeight: 'bold', color: '#38a169' }}>✓ טפסים שמורים ({filtered.filter(b => b.eventForm).length})</p>
                      <div className={styles.grid}>
                        {filtered.filter(b => b.eventForm).map(b => (
                          <div key={b.id} className={styles.card} onClick={() => setSelected(b)}>
                            <div className={styles.cardDate}>{dateStr(b)}</div>
                            <div className={styles.cardName}>{b.clientAFullName}</div>
                            {b.clientBFullName && <div className={styles.cardName}>{b.clientBFullName}</div>}
                            <div className={styles.cardDetail}>סוג: {b.eventType}</div>
                            <div className={styles.cardDetail}>מוזמנים: {b.guestCount}</div>
                            <div className={styles.cardStatus}>✓ טופס קיים</div>
                          </div>
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
              <input
                className={styles.searchInput}
                placeholder="חיפוש לפי שם לקוח..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <p style={{ marginBottom: '20px', color: '#666', fontSize: '14px' }}>
                📊 סה"כ טפסים שנשמרו: {allForms.length}
              </p>
              {allForms.length === 0 ? (
                <p className={styles.empty}>אין טפסים שנשמרו עדיין.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px' }}>
                  {allForms
                    .filter((form) =>
                      !search ||
                      form.booking?.clientAFullName?.includes(search) ||
                      form.booking?.clientBFullName?.includes(search)
                    )
                    .map((form, idx) => (
                    <div key={idx} style={{
                      padding: '16px', border: '1px solid #ddd', borderRadius: '8px', background: 'white',
                      cursor: 'pointer', transition: 'all 0.3s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
                    onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
                    onClick={() => {
                      if (form.booking) {
                        setSelected(form.booking as Booking);
                      }
                    }}>
                      <h4 style={{ margin: '0 0 8px 0' }}>
                        {form.booking?.clientAFullName || '—'}
                      </h4>
                      <p style={{ margin: '4px 0', fontSize: '12px', color: '#666' }}>
                        📅 {form.booking?.eventDate?.date ? new Date(form.booking.eventDate.date).toLocaleDateString('he-IL') : '—'}
                      </p>
                      <p style={{ margin: '4px 0', fontSize: '12px', color: '#666' }}>
                        👥 {form.finalGuestCount || '—'} מוזמנים
                      </p>
                      <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#999' }}>
                        💾 שמור: {form.createdAt ? new Date(form.createdAt).toLocaleString('he-IL') : '—'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {viewMode === 'stats' && (
            <div style={{ marginTop: '20px' }}>
              <CancellationStats />
            </div>
          )}
        </>
      ) : (
        <div className={styles.formContainer}>
          <div className={styles.formHeader}>
            <h3>{selected.clientAFullName} {selected.clientBFullName ? `+ ${selected.clientBFullName}` : ''}</h3>
            <p>{dateStr(selected)}</p>
            <button onClick={() => setSelected(null)} className={styles.closeBtn}>✕ סגור</button>
          </div>

          <div className={styles.formBody}>
            {/* שעה וקבלת פנים */}
            <div className={styles.section}>
              <h4>📅 שעה וקבלת פנים</h4>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label>שעת קבלת פנים</label>
                  <input
                    type="time"
                    value={formData.eventTime || ''}
                    onChange={e => handleInputChange('eventTime', e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label>סוג קבלת פנים</label>
                  <select value={formData.receptionType || 'separate'} onChange={e => handleInputChange('receptionType', e.target.value)}>
                    <option value="separate">נפרד</option>
                    <option value="mixed">מעורב</option>
                  </select>
                </div>
              </div>
            </div>

            {/* מוזמנים וישיבה */}
            <div className={styles.section}>
              <h4>👥 מוזמנים וישיבה</h4>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label>כמות מוזמנים סופית</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.finalGuestCount || ''}
                    onChange={e => handleInputChange('finalGuestCount', parseInt(e.target.value))}
                  />
                </div>
                <div className={styles.field}>
                  <label>סוג ישיבה</label>
                  <select value={formData.seatingType || 'separate'} onChange={e => handleInputChange('seatingType', e.target.value)}>
                    <option value="separate">נפרד</option>
                    <option value="mixed">מעורב</option>
                  </select>
                </div>
              </div>
              {formData.seatingType === 'separate' && (
                <div className={styles.row}>
                  <div className={styles.field}>
                    <label>אחוז גברים</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.menPercent || ''}
                      onChange={e => handleInputChange('menPercent', parseInt(e.target.value))}
                    />
                  </div>
                  <div className={styles.field}>
                    <label>אחוז נשים</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.womenPercent || ''}
                      onChange={e => handleInputChange('womenPercent', parseInt(e.target.value))}
                    />
                  </div>
                </div>
              )}

              {formData.seatingType === 'separate' && formData.menPercent && formData.womenPercent && (
                <div className={styles.chartContainer}>
                  {(() => {
                    const totalGuests = formData.finalGuestCount || 0;
                    const menCount = Math.round((formData.menPercent / 100) * totalGuests);
                    const womenCount = totalGuests - menCount;
                    return (
                      <>
                        <div className={styles.chartStats}>
                          <div className={styles.statItem}>
                            <span className={styles.statColor} style={{ backgroundColor: '#2196F3' }}></span>
                            <span>גברים: {formData.menPercent}% ({menCount} אנשים)</span>
                          </div>
                          <div className={styles.statItem}>
                            <span className={styles.statColor} style={{ backgroundColor: '#F44336' }}></span>
                            <span>נשים: {formData.womenPercent}% ({womenCount} אנשים)</span>
                          </div>
                        </div>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={[
                                { name: `גברים (${menCount})`, value: formData.menPercent },
                                { name: `נשים (${womenCount})`, value: formData.womenPercent }
                              ]}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={false}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              <Cell fill="#2196F3" />
                              <Cell fill="#F44336" />
                            </Pie>
                            <Tooltip formatter={(value) => `${value}%`} />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </>
                    );
                  })()}
                </div>
              )}

              {portionBilling && (
                <div style={{
                  marginTop: '16px',
                  padding: '16px 20px',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '8px',
                }}>
                  <h5 style={{ margin: '0 0 12px', color: '#166534', fontSize: '15px' }}>💰 חישוב מנות לחיוב (מינימום)</h5>
                  {portionBilling.seatingType === 'separate' ? (
                    <>
                      <p style={{ margin: '4px 0', fontSize: '14px' }}>
                        גברים: {portionBilling.menCount} בפועל → <strong>{portionBilling.menBillablePortions}</strong> מנות לחיוב (מינימום {MIN_PORTIONS_PER_UNIT})
                      </p>
                      <p style={{ margin: '4px 0', fontSize: '14px' }}>
                        נשים: {portionBilling.womenCount} בפועל → <strong>{portionBilling.womenBillablePortions}</strong> מנות לחיוב (מינימום {MIN_PORTIONS_PER_UNIT})
                      </p>
                    </>
                  ) : (
                    <p style={{ margin: '4px 0', fontSize: '14px' }}>
                      מוזמנים: {formData.finalGuestCount} → <strong>{portionBilling.totalBillablePortions}</strong> מנות לחיוב (מינימום {MIN_PORTIONS_MIXED})
                    </p>
                  )}
                  <p style={{ margin: '12px 0 0', fontSize: '15px', color: '#14532d', fontWeight: 'bold' }}>
                    סה"כ {portionBilling.totalBillablePortions} מנות × {portionBilling.pricePerPortion} ₪ = {portionBilling.totalAmount.toLocaleString('he-IL')} ₪
                  </p>
                  <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#64748b' }}>
                    עלות מנה מוגדרת בהגדרות מתחם · מינימום מנות מופיע בחוזה ללא פירוט כמות ספציפית
                  </p>
                </div>
              )}

              <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                {savedTables && savedTables.length > 0 ? (
                  <span style={{ fontSize: '13px', color: '#16a34a', fontWeight: 'bold' }}>
                    ✓ סידור שולחנות שמור ({savedTables.length} שולחנות)
                  </span>
                ) : (
                  <span style={{ fontSize: '13px', color: '#64748b' }}>טרם נשמר סידור שולחנות לאירוע זה</span>
                )}
                <button
                  type="button"
                  onClick={() => setIsTableLayoutOpen(true)}
                  style={{
                    padding: '10px 20px',
                    background: savedTables?.length ? '#3b82f6' : '#8b5cf6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  {savedTables?.length ? 'ערוך סידור שולחנות אולם' : '🪑 סידור שולחנות אולם'}
                </button>
              </div>
            </div>

            {/* שולחן כבוד */}
            <div className={styles.section}>
              <h4>👑 שולחן כבוד</h4>
              <div className={styles.field}>
                <label>האם יש שולחן כבוד?</label>
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
                  <option value="">בחר...</option>
                  <option value="yes">כן</option>
                  <option value="no">לא</option>
                </select>
              </div>
              {hasHonorTable && (
                <div className={styles.field}>
                  <label>כמות אנשים בשולחן כבוד</label>
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
              )}
            </div>

            {/* עיצוב עם כפתור לגלריה */}
            <div className={styles.section}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h4 style={{ margin: 0 }}>🎨 עיצוב</h4>
                <button 
                  onClick={() => navigate('/gallery')} 
                  style={{
                    padding: '6px 12px', background: '#ecfdf5', color: '#059669', 
                    border: '1px solid #10b981', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'
                  }}
                >
                  🖼️ מעבר לגלריה לבחירת תמונות
                </button>
              </div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label>מפות שולחן</label>
                  <input
                    type="text"
                    placeholder="בחר מפה..."
                    value={formData.tableclothId || ''}
                    onChange={e => handleInputChange('tableclothId', e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label>מפיות</label>
                  <input
                    type="text"
                    placeholder="בחר מפית..."
                    value={formData.napkinId || ''}
                    onChange={e => handleInputChange('napkinId', e.target.value)}
                  />
                </div>
              </div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label>מרכזי שולחן</label>
                  <input
                    type="text"
                    placeholder="תיאור מרכזי שולחן"
                    value={formData.centerpiece || ''}
                    onChange={e => handleInputChange('centerpiece', e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label>כסא כלה</label>
                  <input
                    type="text"
                    placeholder="תיאור כסא כלה"
                    value={formData.bridgeChair || ''}
                    onChange={e => handleInputChange('bridgeChair', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* ציוד טכני */}
            <div className={styles.section}>
              <h4>⚡ ציוד טכני</h4>
              <div className={styles.checkboxRow}>
                <label>
                  <input
                    type="checkbox"
                    checked={formData.hasLighting || false}
                    onChange={e => handleCheckboxChange('hasLighting', e.target.checked)}
                  />
                  תאורה
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={formData.hasSoundSystem || false}
                    onChange={e => handleCheckboxChange('hasSoundSystem', e.target.checked)}
                  />
                  הגברה
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={formData.hasScreens || false}
                    onChange={e => handleCheckboxChange('hasScreens', e.target.checked)}
                  />
                  מסכים
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={formData.hasFireworks || false}
                    onChange={e => handleCheckboxChange('hasFireworks', e.target.checked)}
                  />
                  זיקוקים
                </label>
              </div>
            </div>

    {/* משמחים */}
            <div className={styles.section}>
              <h4>משמחים 🎭</h4>
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
                      
                      // איפוס שדות בעת החלפת סוג
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

              {/* נציג את השדות רק אם נבחר סוג */}
              {(formData.entertainersBar !== undefined || formData.entertainersSitting !== undefined) && (() => {
                // מזהים מה נבחר ומה הסך הכל הנוכחי
                const isBar = formData.entertainersBar !== undefined;
                const currentTotal = isBar ? (formData.entertainersBar || 0) : (formData.entertainersSitting || 0);

                return (
                  <>
                    <div className={styles.row}>
                      <div className={styles.field}>
                        <label>סה"כ כמות משתתפים</label>
                        <input
                          type="number"
                          min="0"
                          value={currentTotal || ''}
                          onChange={e => {
                            const total = parseInt(e.target.value) || 0;
                            const men = formData.entertainersMen || 0;
                            
                            // מעדכן את השדה הנכון (בר או ישיבה) לפי מה שנבחר
                            handleInputChange(isBar ? 'entertainersBar' : 'entertainersSitting', total);
                            // משלים אוטומטית נשים
                            handleInputChange('entertainersWomen', Math.max(0, total - men));
                          }}
                        />
                      </div>
                    </div>

                    <div className={styles.row}>
                      <div className={styles.field}>
                        <label>כמות גברים</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.entertainersMen || ''}
                          onChange={e => {
                            const men = parseInt(e.target.value) || 0;
                            handleInputChange('entertainersMen', men);
                            // משלים אוטומטית נשים מתוך הסך הכל הקיים
                            handleInputChange('entertainersWomen', Math.max(0, currentTotal - men));
                          }}
                        />
                      </div>
                      <div className={styles.field}>
                        <label>כמות נשים (מושלם אוטומטית)</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.entertainersWomen || ''}
                          readOnly
                          style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed' }}
                        />
                      </div>
                    </div>

                    {/* גרף עוגה למשמחים */}
                    {currentTotal > 0 && (
                      <div className={styles.chartContainer}>
                        {(() => {
                          const entMen = formData.entertainersMen || 0;
                          const entWomen = formData.entertainersWomen || 0;
                          const entMenPercent = ((entMen / currentTotal) * 100).toFixed(0);
                          const entWomenPercent = ((entWomen / currentTotal) * 100).toFixed(0);

                          return (
                            <>
                              <div className={styles.chartStats}>
                                <div className={styles.statItem}>
                                  <span className={styles.statColor} style={{ backgroundColor: '#2196F3' }}></span>
                                  <span>גברים: {entMenPercent}% ({entMen} איש)</span>
                                </div>
                                <div className={styles.statItem}>
                                  <span className={styles.statColor} style={{ backgroundColor: '#F44336' }}></span>
                                  <span>נשים: {entWomenPercent}% ({entWomen} אישה)</span>
                                </div>
                              </div>
                              <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                  <Pie
                                    data={[
                                      { name: `גברים`, value: entMen },
                                      { name: `נשים`, value: entWomen }
                                    ]}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    outerRadius={80}
                                    dataKey="value"
                                  >
                                    <Cell fill="#2196F3" />
                                    <Cell fill="#F44336" />
                                  </Pie>
                                  <Tooltip formatter={(value: any, name: any) => [`${value} משתתפים (${((Number(value) / currentTotal) * 100).toFixed(0)}%)`, name]} />
                                  <Legend />
                                </PieChart>
                              </ResponsiveContainer>
                            </>
                          )
                        })()}
                      </div>
                    )}
                  </>
                );
              })()}
              </>
              )}
            </div>

            {/* צ'ק פיקדון */}
            <div className={styles.section}>
              <h4>💳 צ'ק פיקדון</h4>
              <div className={styles.field}>
                <label>תמונת צ'ק פיקדון</label>
                
                {!formData.depositCheckUrl && !depositCheckFile && (
                  <CheckCamera
                    disabled={checkScanning}
                    onCapture={async (imageSrc) => {
                      handleInputChange('depositCheckUrl', imageSrc);
                      setDepositCheckFile(null);
                      await processCheckImage(imageSrc);
                    }}
                    onRetake={handleDeleteCheckImage}
                  />
                )}

                <div className={styles.checkImageOptions} style={{ marginTop: '15px' }}>
                  <button 
                    type="button"
                    className={styles.uploadBtn}
                    onClick={() => document.getElementById('fileInput')?.click()}
                  >
                    📁 העלה תמונה מהמחשב / גלריה
                  </button>
                  <input 
                    type="file"
                    id="fileInput"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </div>

                {depositCheckFile && (
                  <div className={styles.fileContainer}>
                    <p className={styles.fileName}>✓ {depositCheckFile.name}</p>
                    <button onClick={handleDeleteCheckImage} className={styles.deleteBtn}>🗑️ מחק</button>
                  </div>
                )}
                {formData.depositCheckUrl && !depositCheckFile && (
                  <div className={styles.fileContainer}>
                    <p className={styles.fileName}>✓ צ'ק צולם/צורף בהצלחה</p>
                    <button onClick={handleDeleteCheckImage} className={styles.deleteBtn}>🗑️ מחק</button>
                  </div>
                )}

                {(formData.depositCheckUrl || formData.depositCheckDetails) && (
                  <CheckDetailsForm
                    details={formData.depositCheckDetails || {}}
                    imageUrl={formData.depositCheckUrl}
                    scanning={checkScanning}
                    onChange={details => handleInputChange('depositCheckDetails', details)}
                    styles={styles}
                  />
                )}
              </div>
              <div className={styles.checkboxRow}>
                <label>
                  <input
                    type="checkbox"
                    checked={formData.depositCheckStatus || false}
                    onChange={e => handleCheckboxChange('depositCheckStatus', e.target.checked)}
                  />
                  צ'ק קיבל
                </label>
              </div>
            </div>
            {selected.clientSignatureUrl && (
  <div className={styles.section}>
    <h4>✍️ חוזה חתום</h4>
    <img src={selected.clientSignatureUrl} alt="חתימת חוזה" style={{ width: '100%', maxWidth: '300px', border: '1px solid #ddd' }} />
  </div>
)}

           {/* אקו"ם */}
            <div className={styles.section}>
              <h4>🎵 אקו"ם</h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {/* שדה תצוגה אוטומטי לקוד האישור מההזמנה */}
                <div className={styles.field}>
                  <label>קוד אישור אקו"ם </label>
                  <input
                    type="text"
                    readOnly
                    value={selected.akumApprovalCode || 'לא הוזן קוד אישור'}
                    style={{ 
                      backgroundColor: '#f8fafc', 
                      color: selected.akumApprovalCode ? '#15803d' : '#94a3b8', 
                      fontWeight: 'bold', 
                      cursor: 'not-allowed',
                      borderColor: selected.akumApprovalCode ? '#bbf7d0' : '#e2e8f0'
                    }}
                  />
                </div>

                <div className={styles.field}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
                    <input
                      type="checkbox"
                      // אם יש קוד אישור שמור בהזמנה, נסמן את התיבה אוטומטית. אחרת, נסתמך על מה שנשמר בטופס
                      checked={formData.akumPaid || !!selected.akumApprovalCode}
                      onChange={e => handleCheckboxChange('akumPaid', e.target.checked)}
                      style={{ width: '18px', height: '18px', accentColor: '#16a34a' }}
                    />
                    האם שילם לאקו"ם
                  </label>
                </div>
              </div>
            </div>

            {/* כשרות */}
            <div className={styles.section}>
              <h4>כשרות</h4>
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                <select 
                  value={formData.kashrut || ''} 
                  onChange={(e) => handleInputChange('kashrut', e.target.value)}
                  style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value="">בחר כשרות...</option>
                  {KASHRUT_LIST.map((kName, idx) => (
                    <option key={idx} value={kName}>{kName}</option>
                  ))}
                </select>

                {/* תצוגת התעודה ליד הכשרות! */}
                {kashrutImage ? (
                  <div 
                    onClick={() => setIsKashrutModalOpen(true)}
                    style={{ cursor: 'pointer', width: '50px', height: '50px', border: '2px solid #ddd', borderRadius: '6px', overflow: 'hidden' }}
                    title="לחץ להגדלת התעודה"
                  >
                    <img src={kashrutImage} alt="תעודת כשרות" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div style={{ width: '50px', height: '50px', background: '#f1f5f9', border: '1px dashed #cbd5e1', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#999', textAlign: 'center' }}>
                    אין תמונה בשרת
                  </div>
                )}
              </div>

              {/* מודאל הגדלת התמונה של הכשרות */}
              {isKashrutModalOpen && kashrutImage && (
                <div 
                  onClick={() => setIsKashrutModalOpen(false)}
                  style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '20px' }}
                >
                  <div onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                    <img src={kashrutImage} alt="תעודה מוגדלת" style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '8px', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }} />
                    <button 
                      onClick={() => setIsKashrutModalOpen(false)}
                      style={{ display: 'block', margin: '20px auto 0', padding: '10px 30px', background: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      סגור חלון
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ---> כפתור בחירת תפריט אלגנטי <--- */}
            <div className={styles.section} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '15px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '20px' }}>
              <div>
                <h4 style={{ margin: '0 0 5px 0' }}>🍽️ תפריט האירוע</h4>
                {selectedMenu ? (
                  <span style={{ fontSize: '13px', color: '#16a34a', fontWeight: 'bold' }}>✓ תפריט נבחר ושמור בטופס</span>
                ) : (
                  <span style={{ fontSize: '13px', color: '#64748b' }}>טרם נבחר תפריט לאירוע זה</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsMenuOpen(true)}
                style={{
                  padding: '10px 20px', background: selectedMenu ? '#3b82f6' : '#d4af37', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
                }}
              >
                {selectedMenu ? 'ערוך תפריט נבחר' : '📋 בחירת תפריט'}
              </button>
            </div>

            {/* ---> מודאל צף לבחירת תפריט - בתצוגת מסך מלא <--- */}
            {isMenuOpen && (
              <div 
                style={{ position: 'fixed', inset: 0, background: '#f8fafc', display: 'flex', justifyContent: 'center', zIndex: 9999 }}
              >
                <div 
                  onClick={e => e.stopPropagation()} 
                  style={{ width: '100vw', height: '100vh', position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                >
                  {/* כפתור סגירה צף ובולט בפינה */}
                  <button 
                    onClick={() => setIsMenuOpen(false)}
                    style={{ position: 'absolute', top: '20px', left: '30px', background: 'white', color: '#ef4444', border: '2px solid #ef4444', borderRadius: '8px', padding: '8px 20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', zIndex: 10, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                    title="סגור חלון"
                  >
                    ✕ סגור וחזור לטופס
                  </button>
                  
                  {/* אזור התוכן המרווח שנגלל על כל המסך */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '40px 20px' }}>
                    <div style={{ maxWidth: '1200px', margin: '0 auto', background: 'white', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', padding: '30px' }}>
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
              <div
                style={{ position: 'fixed', inset: 0, background: '#f8fafc', display: 'flex', flexDirection: 'column', zIndex: 9999 }}
              >
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '16px' }}>
                  <div style={{ marginBottom: '8px', textAlign: 'center' }}>
                    <h3 style={{ margin: 0, color: '#334155' }}>סידור שולחנות אולם</h3>
                    {tableLayoutSaving && <span style={{ color: '#64748b', fontSize: '14px' }}>שומר...</span>}
                  </div>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <FloorPlanBuilder
                      key={selected.id}
                      initialTables={savedTables}
                      onSave={handleTableLayoutSave}
                      onClose={() => setIsTableLayoutOpen(false)}
                      downloadFileName={`sidur-shulchanot-${selected.clientAFullName}-${dateStr(selected).replace(/\./g, '-')}.png`}
                    />
                  </div>
                </div>
              </div>
            )}
           
            {/* הערות ממוספרות */}
            <div className={styles.section}>
              <h4>📝 הערות (אופציונלי)</h4>
              <div className={styles.notesContainer}>
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
              </div>
              <div className={styles.addNoteRow}>
                <input
                  type="text"
                  placeholder="הוסף הערה חדשה..."
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && addNote()}
                  className={styles.noteInput}
                />
                <button onClick={addNote} className={styles.addNoteBtn}>+ הוסף</button>
              </div>
            </div>

            <p style={{
              margin: '20px 0 0',
              fontSize: '12px',
              fontWeight: '700',
              color: '#475569',
              textAlign: 'right',
            }}>
              * המחיר אינו כולל טיפ כמקובל במקום
            </p>

          {/* כפתורים למטה */}
            <div className={styles.formFooter} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={() => setSelected(null)} className={styles.cancelBtn}>ביטול</button>
              
       <button
  onClick={async () => {
    try {
      const checkUrl = await uploadCheckFile();
      const dataToSave = prepareFormDataForSave({
        ...formData,
        depositCheckUrl: checkUrl || formData.depositCheckUrl,
        notes: JSON.stringify(notesList),
        menuSelections: selectedMenu
      });

      // 1. שמירה אוטומטית ישירות למסד הנתונים
      const saveResponse = await fetch(`http://localhost:5000/api/event-forms/${selected.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSave) 
      });

      if (!saveResponse.ok) {
         alert('שגיאה בשמירת הנתונים טרם הורדת ה-PDF.');
         return;
      }
      
      // 2. אחרי שהשמירה הצליחה - קוראים לפונקציית ההורדה שלך
      await handleDownloadPDF(); 
      
    } catch (error) {
      console.error(error);
      alert('שגיאת תקשורת עם השרת בעת הפעולה.');
    }
  }}
  style={{
    padding: '10px 20px', background: '#f59e0b', color: 'white', border: 'none', 
    borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', opacity: 1,
    display: 'flex', alignItems: 'center', gap: '8px'
  }}
  title="שמור והורד PDF"
>
  הורד PDF 📥
</button>

              {/* כפתור ווצאפ עם לוגו מקורי */}
              <button
                onClick={() => {
                  const clientName = `${selected.clientAFullName} ${selected.clientBFullName ? `ו${selected.clientBFullName}` : ''}`;
                  const textMsg = `שלום, מצורף עדכון לגבי טופס הפקת אירוע - משפחת ${clientName} בתאריך ${dateStr(selected)}.\nמוזמנים: ${formData.finalGuestCount || 'לא צוין'}.`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(textMsg)}`, '_blank');
                }}
              
                style={{
                  padding: '10px 20px', background: '#25D366', color: 'white', border: 'none', borderRadius: '6px', 
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}
                title={!isFormValid() ? 'יש למלא טופס לפני שיתוף' : 'שלח לווצאפ'}
              >
                <svg fill="currentColor" viewBox="0 0 448 512" height="18px" width="18px" xmlns="http://www.w3.org/2000/svg">
                  <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"></path>
                </svg>
                שלח ווצאפ
              </button>
<button
  onClick={async () => {
    try {
      alert('שומר את הטופס ושולח למייל... אנא המתן מעט'); 
      
      const checkUrl = await uploadCheckFile();
      const dataToSave = prepareFormDataForSave({
        ...formData,
        depositCheckUrl: checkUrl || formData.depositCheckUrl,
        notes: JSON.stringify(notesList),
        menuSelections: selectedMenu
      });

      // 1. שמירה אוטומטית ישירות למסד הנתונים
      const saveResponse = await fetch(`http://localhost:5000/api/event-forms/${selected.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSave) 
      });

      if (!saveResponse.ok) {
         alert('שגיאה בשמירת הנתונים, המייל לא נשלח.');
         return;
      }
      
      // 2. אחרי שהשמירה הצליחה - מבקשים מהשרת לשלוח את המייל
      const emailResponse = await fetch(`http://localhost:5000/api/event-forms/${selected.id}/send-email`, {
        method: 'POST',
      });
      
      const data = await emailResponse.json();
      if (emailResponse.ok && data.success) {
        alert('הטופס נשמר והמייל נשלח בהצלחה!');
      } else {
        alert(`שגיאה בשליחת המייל: ${data.error || 'אנא נסה שוב'}`);
      }
    } catch (error) {
      console.error(error);
      alert('שגיאת תקשורת עם השרת בעת הפעולה.');
    }
  }}
  style={{
    padding: '10px 20px', background: '#0ea5e9', color: 'white', border: 'none', 
    borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', opacity: 1,
    display: 'flex', alignItems: 'center', gap: '8px'
  }}
  title="שמור ושלח למייל"
>
  <svg fill="currentColor" viewBox="0 0 512 512" height="18px" width="18px" xmlns="http://www.w3.org/2000/svg">
    <path d="M48 64C21.5 64 0 85.5 0 112c0 15.1 7.1 29.3 19.2 38.4L236.8 313.6c11.4 8.5 27 8.5 38.4 0L492.8 150.4c12.1-9.1 19.2-23.3 19.2-38.4c0-26.5-21.5-48-48-48H48zM0 176V384c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V176L294.4 339.2c-22.8 17.1-54 17.1-76.8 0L0 176z"></path>
  </svg>                                
  שלח למייל
</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventFormManager;