import { Router } from 'express';
import { validate } from '../middlewares/validate';
import { createBookingSchema, updateBookingSchema } from '../validators/booking.validator';
import {
  addEventAdditionSchema,
  bumpOptionSchema,
  addBookingUpgradeSchema,
  finalizeBookingSchema,
  notifyOptionInterestSchema,
  releaseOptionsSchema,
  reissueEasyCountSchema,
  listBookingPaymentsSchema,
  createBookingPaymentSchema,
} from '../validators/bookingActions.validator';
import { sendGreetingSchema } from '../validators/greeting.validator';
import { requireAuth } from '../middlewares/auth';
import { requireRole } from '../middlewares/requireRole';
import { RBAC } from '../config/rbac';
import {
  assertUploadedFileMagicBytes,
  upload,
} from '../middlewares/uploadMiddleware';

import {
  createBooking,
  getAllBookings,
  getBookingById,
  getRelatedOptionBookings,
  updateBooking,
  releaseOptions,
  bumpOption,
  notifyOptionInterest,
  finalizeBooking,
  getCancellationStats,
  addEventAddition,
  getNextEventCode,
  getContractTemplate,
  reissueEasyCountReceipt,
  addBookingUpgrade,
  signAndSendContract,
  getBookingPayments,
  createBookingPayment,
  getBookingContractPdf,
} from '../controllers/booking';
import { sendGreeting, getScheduledGreetings, cancelScheduledGreetingHandler } from '../controllers/greeting';
import {
  createBookingHallInvoice,
  getBookingHallInvoices,
} from '../controllers/easyCount.controller';
import { createHallInvoiceSchema } from '../validators/easyCount.validator';

const router = Router();
router.use(requireAuth);

const { MANAGEMENT, MANAGER_ONLY, FINANCE_READ } = RBAC;

// --- חוזה PDF (קריאה) ---
router.get('/:id/contract-pdf', requireRole(...MANAGEMENT), getBookingContractPdf);

// --- EasyCount / חשבוניות (Manager בלבד — Staff ללא הפקת מסמכים) ---
router.post('/:id/invoice', requireRole(...MANAGER_ONLY), validate(createHallInvoiceSchema), createBookingHallInvoice);
router.get('/:id/invoices', requireRole(...FINANCE_READ), getBookingHallInvoices);
router.post('/:id/easycount-receipt', requireRole(...MANAGER_ONLY), validate(reissueEasyCountSchema), reissueEasyCountReceipt);

// --- יומן תשלומים / יתרה ---
router.get('/:id/payments', requireRole(...FINANCE_READ), validate(listBookingPaymentsSchema), getBookingPayments);
router.post('/:id/payments', requireRole(...MANAGER_ONLY), validate(createBookingPaymentSchema), createBookingPayment);

// --- סטטיסטיקה וקודים (קריאה) ---
router.get('/stats/cancellations', requireRole(...MANAGEMENT), getCancellationStats); 
router.get('/next-code', requireRole(...MANAGEMENT), getNextEventCode);
router.get('/contract-template', requireRole(...MANAGEMENT), getContractTemplate);
router.get('/scheduled-greetings', requireRole(...MANAGEMENT), getScheduledGreetings);

// --- מחיקה / שחרור (Manager בלבד — Staff ללא מחיקה) ---
router.delete('/scheduled-greetings/:id', requireRole(...MANAGER_ONLY), cancelScheduledGreetingHandler);
router.post('/release', requireRole(...MANAGER_ONLY), validate(releaseOptionsSchema), releaseOptions);

// --- הזמנות — CRUD ---
router.post('/', requireRole(...MANAGEMENT), validate(createBookingSchema), createBooking);
router.get('/', requireRole(...MANAGEMENT), getAllBookings);
router.get('/:id/related-options', requireRole(...MANAGEMENT), getRelatedOptionBookings);
router.get('/:id', requireRole(...MANAGEMENT), getBookingById);
router.put('/:id', requireRole(...MANAGEMENT), validate(updateBookingSchema), updateBooking);
router.patch('/:id/upgrades', requireRole(...MANAGEMENT), validate(addBookingUpgradeSchema), addBookingUpgrade);

// --- פעולות אופציה ---
router.post('/bump', requireRole(...MANAGEMENT), validate(bumpOptionSchema), bumpOption);
router.post('/notify-option-interest', requireRole(...MANAGEMENT), validate(notifyOptionInterestSchema), notifyOptionInterest);
router.post('/finalize', requireRole(...MANAGEMENT), validate(finalizeBookingSchema), finalizeBooking);
router.post('/:id/sign-and-send', requireRole(...MANAGEMENT), signAndSendContract);

// --- ברכות ותוספות ---
router.post(
  '/send-greeting',
  requireRole(...MANAGEMENT),
  upload.single('attachment'),
  assertUploadedFileMagicBytes,
  validate(sendGreetingSchema),
  sendGreeting,
);
router.post('/:id/additions', requireRole(...MANAGEMENT), validate(addEventAdditionSchema), addEventAddition);

export default router;
