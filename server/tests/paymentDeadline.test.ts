import {
  DEFAULT_PAYMENT_TEMPLATES,
  computePaymentObligation,
  buildInstallmentSchedule,
} from '../src/utils/paymentTerms';
import {
  buildManagerOverdueAlert,
  evaluateBookingPaymentStatus,
  startOfLocalDay,
} from '../src/Services/paymentDeadlineService';

describe('מועדי תשלום — paymentTerms', () => {
  const template50 = DEFAULT_PAYMENT_TEMPLATES.find((t) => t.id === '50-50')!;
  const eventDate = new Date('2026-08-15T12:00:00');
  const hallAmount = 10000;

  it('לוח 50-50 — שני תשלומים של 5000', () => {
    const schedule = buildInstallmentSchedule(template50, hallAmount, eventDate);
    expect(schedule).toHaveLength(2);
    expect(schedule[0].amount).toBe(5000);
    expect(schedule[1].amount).toBe(5000);
  });

  it('לפני מועד — לא באיחור', () => {
    const asOf = new Date('2026-08-01T10:00:00'); // 14 יום לפני אירוע, לפני שבוע-לפני
    const obligation = computePaymentObligation(template50, hallAmount, eventDate, 0, asOf);
    expect(obligation.isOverdue).toBe(false);
    expect(obligation.requiredByNow).toBe(0);
  });

  it('אחרי מועד 50% — באיחור אם לא שולם', () => {
    const asOf = new Date('2026-08-10T10:00:00'); // אחרי 8/8 (שבוע לפני)
    const obligation = computePaymentObligation(template50, hallAmount, eventDate, 1000, asOf);
    expect(obligation.isOverdue).toBe(true);
    expect(obligation.requiredByNow).toBe(5000);
  });

  it('אחרי מועד — לא באיחור אם committed מכסה את הנדרש', () => {
    const asOf = new Date('2026-08-10T10:00:00');
    const obligation = computePaymentObligation(template50, hallAmount, eventDate, 5000, asOf);
    expect(obligation.isOverdue).toBe(false);
  });

  it('pending נספר ב-committed — evaluateBookingPaymentStatus', () => {
    const asOf = new Date('2026-08-10T10:00:00');
    const booking = {
      isOption: false,
      paymentTemplateId: '50-50',
      totalPaid: 0,
      basePrice: 8000,
      extrasPrice: 2000,
      liveAdditionsTotal: 0,
      totalPrice: 10000,
      eventDate: { date: eventDate },
      hallInvoices: [{ amount: 5000, status: 'pending' }],
    };

    const evaluation = evaluateBookingPaymentStatus(booking, template50, asOf);
    expect(evaluation).toBeNull();
  });
});

describe('תבניות התראה — paymentDeadlineService', () => {
  it('buildManagerOverdueAlert — כולל pending', () => {
    const missed = new Date('2026-08-08');
    const alert = buildManagerOverdueAlert({
      bookingId: 'x',
      clientName: 'ישראל ישראלי',
      clientPhone: '050',
      clientEmail: null,
      eventCode: 'EVT-1',
      eventDate: new Date('2026-08-15'),
      balance: {
        hallAmount: 10000,
        paidTotal: 1000,
        paidFromInvoices: 0,
        pendingTotal: 2000,
        committedTotal: 3000,
        remaining: 7000,
        canIssueInvoice: true,
      },
      obligation: {
        requiredByNow: 5000,
        overdueInstallments: [],
        nextDueDate: null,
        isOverdue: true,
      },
      missedDeadline: missed,
    });

    expect(alert.alertType).toBe('איחור בתשלום');
    expect(alert.details).toMatch(/התרעה: הלקוח/);
    expect(alert.details).toMatch(/ממתין לגבייה/);
  });

  it('startOfLocalDay — תחילת יום ל-idempotency', () => {
    const d = new Date('2026-07-13T15:30:00');
    const start = startOfLocalDay(d);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
  });
});
