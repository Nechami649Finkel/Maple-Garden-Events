import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  BOOKING_PAYMENT_METHODS,
  formatBookingPaymentMethodLabel,
  formatBookingPaymentSourceLabel,
  type BookingPaymentMethod,
} from '@shared/i18n/statusLookups';
import { formatCurrency, formatDate } from '@shared/i18n/formatters';
import { useTranslation } from '../../i18n/useTranslation';
import { useToast } from '../ui/Toast/ToastProvider';
import {
  useBookingPaymentsQuery,
  useCreateBookingPaymentMutation,
} from '../../hooks/queries';
import { getAuthUser, type AuthUserInfo } from '../../services/api';
import type { BookingApi } from '../../utils/bookingApi';
import styles from './BookingPaymentsPanel.module.css';

export interface BookingPaymentsPanelProps {
  bookingId: string;
  isOption?: boolean;
  /** Called after a successful ledger write so the parent can refresh booking summary fields. */
  onPaymentUpdated?: (patch: Partial<BookingApi>) => void;
}

function todayInputValue(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const BookingPaymentsPanel = ({
  bookingId,
  isOption,
  onPaymentUpdated,
}: BookingPaymentsPanelProps) => {
  const { t, T, locale } = useTranslation();
  const { showToast } = useToast();
  const [user, setUser] = useState<AuthUserInfo | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<BookingPaymentMethod>('cash');
  const [paidAt, setPaidAt] = useState(todayInputValue);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  const {
    data,
    isLoading,
    error: fetchError,
  } = useBookingPaymentsQuery(bookingId);

  const createPayment = useCreateBookingPaymentMutation(bookingId);

  useEffect(() => {
    let cancelled = false;
    getAuthUser().then((u) => {
      if (!cancelled) setUser(u);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const canRecord = user?.role === 'manager' && !isOption;
  const money = (value: number) => formatCurrency(value, locale);

  const payments = useMemo(() => {
    const rows = data?.payments ?? [];
    return [...rows].sort(
      (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime(),
    );
  }, [data?.payments]);

  const totalCost = data?.totalCost ?? 0;
  const totalPaid = data?.totalPaid ?? 0;
  const remainingBalance = data?.remainingBalance ?? 0;

  const loadError =
    fetchError instanceof Error
      ? fetchError.message
      : fetchError
        ? t(T.PAYMENTS.LOAD_ERROR)
        : '';

  const resetForm = () => {
    setAmount('');
    setPaymentMethod('cash');
    setPaidAt(todayInputValue());
    setNotes('');
    setFormError('');
  };

  const handleOpenForm = () => {
    if (isOption) {
      showToast(t(T.PAYMENTS.OPTION_BLOCKED), 'error');
      return;
    }
    if (user && user.role !== 'manager') {
      showToast(t(T.PAYMENTS.STAFF_VIEW_ONLY), 'info');
      return;
    }
    setShowForm(true);
    setFormError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError(t(T.PAYMENTS.AMOUNT_REQUIRED));
      return;
    }
    if (!paymentMethod) {
      setFormError(t(T.PAYMENTS.METHOD_REQUIRED));
      return;
    }

    try {
      const result = await createPayment.mutateAsync({
        amount: parsedAmount,
        paymentMethod,
        paidAt: paidAt || undefined,
        notes: notes.trim() ? notes.trim() : null,
      });
      showToast(t(T.PAYMENTS.CREATE_SUCCESS), 'success');
      setShowForm(false);
      resetForm();
      onPaymentUpdated?.({
        totalPaid: result.totalPaid,
        paidAmount: result.totalPaid,
        paymentStatus: result.paymentStatus,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : t(T.PAYMENTS.CREATE_ERROR);
      setFormError(msg);
      showToast(msg, 'error');
    }
  };

  return (
    <section className={styles.panel} aria-labelledby="booking-payments-title">
      <h3 id="booking-payments-title" className={styles.title}>
        {t(T.PAYMENTS.TITLE)}
      </h3>

      {isLoading ? (
        <p className={styles.muted}>{t(T.COMMON.LABELS.LOADING)}</p>
      ) : (
        <>
          {loadError && <p className={styles.error}>{loadError}</p>}

          <div className={styles.summary}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>{t(T.PAYMENTS.TOTAL_COST)}</span>
              <span className={styles.summaryValue}>{money(totalCost)}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>{t(T.PAYMENTS.TOTAL_PAID)}</span>
              <span className={`${styles.summaryValue} ${styles.summaryPaid}`}>
                {money(totalPaid)}
              </span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>{t(T.PAYMENTS.REMAINING)}</span>
              <span className={`${styles.summaryValue} ${styles.summaryRemain}`}>
                {money(remainingBalance)}
              </span>
            </div>
          </div>

          {isOption && <p className={styles.hint}>{t(T.PAYMENTS.OPTION_BLOCKED)}</p>}
          {!isOption && user && user.role !== 'manager' && (
            <p className={styles.hint}>{t(T.PAYMENTS.STAFF_VIEW_ONLY)}</p>
          )}

          <div className={styles.actions}>
            {!showForm ? (
              <button
                type="button"
                className={styles.btnPrimary}
                disabled={!canRecord || createPayment.isPending}
                onClick={handleOpenForm}
              >
                {t(T.PAYMENTS.RECORD)}
              </button>
            ) : null}
          </div>

          {showForm && canRecord && (
            <form className={`${styles.form} needs-validation`} onSubmit={handleSubmit} noValidate>
              {formError && <p className={styles.error}>{formError}</p>}
              <div className={`row g-2 ${styles.formRow}`}>
                <div className="col-12 col-sm-4">
                  <label htmlFor="payment-amount">{t(T.PAYMENTS.AMOUNT)}</label>
                  <input
                    id="payment-amount"
                    className="form-control form-control-sm"
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={createPayment.isPending}
                  />
                </div>
                <div className="col-12 col-sm-4">
                  <label htmlFor="payment-method">{t(T.PAYMENTS.METHOD)}</label>
                  <select
                    id="payment-method"
                    className="form-select form-select-sm"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as BookingPaymentMethod)}
                    disabled={createPayment.isPending}
                    required
                  >
                    {BOOKING_PAYMENT_METHODS.map((method) => (
                      <option key={method} value={method}>
                        {formatBookingPaymentMethodLabel(t, method)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-sm-4">
                  <label htmlFor="payment-paid-at">{t(T.PAYMENTS.PAID_AT)}</label>
                  <input
                    id="payment-paid-at"
                    className="form-control form-control-sm"
                    type="date"
                    value={paidAt}
                    onChange={(e) => setPaidAt(e.target.value)}
                    disabled={createPayment.isPending}
                  />
                </div>
              </div>
              <div className={styles.formRow}>
                <label htmlFor="payment-notes">{t(T.PAYMENTS.NOTES)}</label>
                <input
                  id="payment-notes"
                  className="form-control form-control-sm"
                  type="text"
                  maxLength={500}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={createPayment.isPending}
                />
              </div>
              <div className={styles.actions}>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  disabled={createPayment.isPending}
                >
                  {createPayment.isPending ? t(T.PAYMENTS.RECORDING) : t(T.PAYMENTS.SUBMIT)}
                </button>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  disabled={createPayment.isPending}
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                >
                  {t(T.PAYMENTS.CANCEL)}
                </button>
              </div>
            </form>
          )}

          <h4 className={styles.historyTitle}>{t(T.PAYMENTS.HISTORY)}</h4>
          {payments.length === 0 ? (
            <p className={styles.muted}>{t(T.PAYMENTS.EMPTY)}</p>
          ) : (
            <div className={`${styles.tableWrap} table-responsive`}>
              <table className={`table table-sm ${styles.table}`}>
                <thead>
                  <tr>
                    <th scope="col">{t(T.PAYMENTS.COL_DATE)}</th>
                    <th scope="col">{t(T.PAYMENTS.COL_AMOUNT)}</th>
                    <th scope="col">{t(T.PAYMENTS.COL_METHOD)}</th>
                    <th scope="col">{t(T.PAYMENTS.COL_SOURCE)}</th>
                    <th scope="col">{t(T.PAYMENTS.COL_NOTES)}</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDate(row.paidAt, locale)}</td>
                      <td>{money(row.amount)}</td>
                      <td>{formatBookingPaymentMethodLabel(t, row.paymentMethod)}</td>
                      <td>{formatBookingPaymentSourceLabel(t, row.source)}</td>
                      <td className={styles.notesCell}>{row.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default BookingPaymentsPanel;
