import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../services/api';
import { API_URL } from '../../config/api';
import { useTranslation } from '../../i18n/useTranslation';
import { formatCurrency } from '@shared/i18n/formatters';

export interface HallInvoiceRow {
  id: string;
  externalId: string;
  amount: number;
  status: string;
  paymentUrl?: string | null;
  installmentLabel?: string | null;
  description?: string | null;
  paidAt?: string | null;
  createdAt: string;
}

interface HallInvoicesPanelProps {
  bookingId: string;
  isOption?: boolean;
  onPaymentUpdated?: () => void;
}

interface HallInvoicesData {
  hallAmount: number;
  remaining: number;
  invoices: HallInvoiceRow[];
}

const HallInvoicesPanel = ({ bookingId, isOption, onPaymentUpdated }: HallInvoicesPanelProps) => {
  const { t, T, locale } = useTranslation();
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState('');

  const money = (value: number) => formatCurrency(value, locale);

  const {
    data,
    isLoading: loading,
    error: fetchError,
    refetch,
  } = useQuery({
    queryKey: ['hall-invoices', bookingId],
    queryFn: async (): Promise<HallInvoicesData> => {
      const res = await apiFetch(`${API_URL}/bookings/${bookingId}/invoices`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || t(T.INVOICES.LOAD_ERROR));
      return {
        hallAmount: json.data.hallAmount ?? 0,
        remaining: json.data.remaining ?? 0,
        invoices: json.data.invoices ?? [],
      };
    },
  });

  const hallAmount = data?.hallAmount ?? 0;
  const remaining = data?.remaining ?? 0;
  const invoices = data?.invoices ?? [];
  const error =
    actionError ||
    (fetchError instanceof Error ? fetchError.message : fetchError ? t(T.INVOICES.LOAD_ERROR) : '');

  const handleCreateInvoice = async () => {
    if (isOption) {
      alert(t(T.INVOICES.OPTION_BLOCKED));
      return;
    }
    if (remaining <= 0) {
      alert(t(T.INVOICES.NO_BALANCE));
      return;
    }

    setCreating(true);
    setActionError('');
    try {
      const res = await apiFetch(`${API_URL}/bookings/${bookingId}/invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || t(T.INVOICES.CREATE_ERROR));
      await refetch();
      onPaymentUpdated?.();
      if (json.data?.invoice?.paymentUrl) {
        window.open(json.data.invoice.paymentUrl, '_blank', 'noopener,noreferrer');
      } else {
        alert(t(T.INVOICES.CREATED, { id: json.data.invoice.externalId }));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : t(T.INVOICES.CREATE_ERROR);
      setActionError(msg);
      alert(msg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <section
      style={{
        marginTop: '16px',
        padding: '12px',
        background: '#f8fafc',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
      }}
    >
      <h3 style={{ margin: '0 0 10px', fontSize: '1rem' }}>{t(T.BOOKINGS.INVOICES_TITLE)}</h3>
      {loading ? (
        <p style={{ margin: 0, color: '#64748b' }}>{t(T.COMMON.LABELS.LOADING)}</p>
      ) : (
        <>
          <p style={{ margin: '0 0 8px', fontSize: '0.9rem' }}>
            {t(T.BOOKINGS.INVOICE_REMAINING, {
              remaining: remaining.toLocaleString(locale),
              hallAmount: hallAmount.toLocaleString(locale),
            })}
          </p>
          {error && (
            <p style={{ color: '#dc2626', margin: '0 0 8px', fontSize: '0.85rem' }}>{error}</p>
          )}
          <button
            type="button"
            disabled={creating || isOption || remaining <= 0}
            onClick={handleCreateInvoice}
            style={{
              padding: '8px 14px',
              background: creating || isOption || remaining <= 0 ? '#94a3b8' : '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: creating || isOption || remaining <= 0 ? 'not-allowed' : 'pointer',
              marginBottom: invoices.length > 0 ? '12px' : 0,
            }}
          >
            {creating ? t(T.INVOICES.CREATING) : t(T.INVOICES.CREATE)}
          </button>
          {invoices.length > 0 && (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: '0.85rem' }}>
              {invoices.map((inv) => (
                <li
                  key={inv.id}
                  style={{
                    padding: '8px 0',
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    alignItems: 'center',
                  }}
                >
                  <span>{money(inv.amount)}</span>
                  <span style={{ color: '#64748b' }}>{inv.status}</span>
                  <span style={{ color: '#94a3b8' }}>{inv.externalId}</span>
                  {inv.paymentUrl && (
                    <a href={inv.paymentUrl} target="_blank" rel="noopener noreferrer">
                      {t(T.INVOICES.PAYMENT_LINK)}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
};

export default HallInvoicesPanel;
