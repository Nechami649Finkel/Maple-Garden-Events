import React, { useEffect, useState } from 'react';
import styles from './BookingsManager.module.css';
import LiveAdditionForm from '../LiveAdditionForm/LiveAdditionForm';
import { useBookingsQuery } from '../../hooks/queries';
import { PaginationBar } from '../PaginationBar/PaginationBar';

const BookingsManager = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [showAdditionForm, setShowAdditionForm] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useBookingsQuery({
    status: 'BOOKED',
    page,
    limit: 24,
    search: debouncedSearch || undefined,
  });

  const bookings = data?.data ?? [];
  const pagination = data?.pagination;

  const dateStr = (b: any) => b.eventDate?.date ? new Date(b.eventDate.date).toLocaleDateString('he-IL') : '';

  const closeSelected = () => {
    setSelected(null);
    setShowAdditionForm(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>ניהול הזמנות</h2>
      </div>

      <input
        className={styles.searchInput}
        placeholder="חיפוש לפי שם או תעודת זהות..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {isLoading ? (
        <p className={styles.empty}>טוען...</p>
      ) : bookings.length === 0 ? (
        <p className={styles.empty}>{search ? 'לא נמצאו תוצאות.' : 'אין הזמנות סגורות.'}</p>
      ) : (
        <>
          <div className={styles.grid}>
            {bookings.map((b: any) => (
              <div key={b.id} className={styles.card} onClick={() => setSelected(b)}>
                <div className={styles.cardDate}>{dateStr(b)}</div>
                <div className={styles.cardName}>{b.clientAFullName}</div>
                {b.clientBFullName && <div className={styles.cardName}>{b.clientBFullName}</div>}
                <div className={styles.cardDetail}>סוג: {b.eventType} | {b.timeOfDay}</div>
                <div className={styles.cardDetail}>
                  {b.eventType === 'השכרת אולם בלי אוכל' ? 'השכרת אולם (ללא מנות)' : `מוזמנים: ${b.guestCount}`}
                </div>
              </div>
            ))}
          </div>
          {pagination && (
            <PaginationBar
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      {selected && (
        <>
          {!showAdditionForm && (
            <div className={styles.popupOverlay} onClick={closeSelected}>
              <div className={styles.popupBox} onClick={(e) => e.stopPropagation()}>
                <div className={styles.popupHeader}>
                  <span>פרטי הזמנה - {dateStr(selected)}</span>
                  <button className={styles.popupClose} onClick={closeSelected}>✕</button>
                </div>
                <div className={styles.popupBody}>
                  <div className={styles.popupRow}><label>סוג אירוע:</label><span>{selected.eventType}</span></div>
                  <div className={styles.popupRow}><label>מועד:</label><span>{selected.timeOfDay}</span></div>

                  {selected.eventType === 'השכרת אולם בלי אוכל' ? (
                    <div className={styles.popupRow}><label>מחיר השכרה בסיסי:</label><span>₪{selected.hallRentalPrice?.toLocaleString() || 0}</span></div>
                  ) : (
                    <>
                      <div className={styles.popupRow}><label>מוזמנים:</label><span>{selected.guestCount}</span></div>
                      <div className={styles.popupRow}><label>מחיר מנה:</label><span>₪{selected.finalPricePortion}</span></div>
                    </>
                  )}

                  <div className={styles.popupRow}><label>סה&quot;כ חשבון:</label><span style={{ fontWeight: 'bold', color: '#dc2626' }}>₪{selected.totalPrice?.toLocaleString()}</span></div>
                  <div className={styles.popupRow}><label>שולם:</label><span>₪{selected.paidAmount?.toLocaleString()}</span></div>

                  {selected.additions && selected.additions.map((add: any) => (
                    <div key={add.id} style={{ marginBottom: '15px', fontSize: '0.9rem', borderBottom: '1px solid #dcfce7', paddingBottom: '10px' }}>
                      <div style={{ color: '#4b5563', fontSize: '0.8rem', marginBottom: '4px' }}>
                        🕒 {new Date(add.createdAt).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                      <strong>פירוט:</strong> <span style={{ whiteSpace: 'pre-wrap' }}>{add.description}</span><br />
                      <strong>עלות:</strong> ₪{add.cost} (אחראי: {add.staffName})
                      <div style={{ marginTop: '8px' }}>
                        <span style={{ fontSize: '0.8rem', color: '#666' }}>חתימת לקוח:</span>
                        <br />
                        <img
                          src={add.signature}
                          alt="חתימת לקוח"
                          style={{ width: '150px', height: '60px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#fff' }}
                        />
                      </div>
                    </div>
                  ))}

                  <div className={styles.popupRow} style={{ marginTop: '15px' }}><label>צד א&apos; - שם:</label><span>{selected.clientAFullName}</span></div>
                  <div className={styles.popupRow}><label>ת.ז:</label><span>{selected.clientAIdNumber}</span></div>
                  <div className={styles.popupRow}><label>טלפון:</label><span>{selected.clientAPhone}</span></div>
                  <div className={styles.popupRow}><label>עיר:</label><span>{selected.clientACity}</span></div>

                  <div style={{ marginTop: '20px', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: '15px' }}>
                    <button
                      type="button"
                      onClick={() => setShowAdditionForm(true)}
                      style={{
                        backgroundColor: '#16a34a', color: 'white', padding: '10px 20px', borderRadius: '8px',
                        border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', width: '100%',
                      }}
                    >
                      + הוסף תוספת בזמן אירוע (בתשלום)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showAdditionForm && (
            <div className={styles.popupOverlay} onClick={() => setShowAdditionForm(false)}>
              <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setShowAdditionForm(false)}
                  style={{ position: 'absolute', top: '10px', left: '10px', background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', zIndex: 10 }}
                >
                  ✕
                </button>
                <LiveAdditionForm
                  bookingId={selected.id}
                  onSuccess={() => {
                    setShowAdditionForm(false);
                    alert('התוספת נרשמה בהצלחה והמחיר הכולל עודכן!');
                    window.location.reload();
                  }}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BookingsManager;
