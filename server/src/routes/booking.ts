import { Router, Request, Response } from 'express';
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
} from '../validators/bookingActions.validator';
import { sendGreetingSchema } from '../validators/greeting.validator';
import { requireAuth } from '../middlewares/auth';
import { requireRole } from '../middlewares/requireRole';
import { RBAC } from '../config/rbac';
import { catchAsync } from '../middlewares/errorHandler';
import {
  assertUploadedFileMagicBytes,
  upload,
} from '../middlewares/uploadMiddleware';
import prisma from '../config/prisma';

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
} from '../controllers/booking';
import { sendGreeting, getScheduledGreetings, cancelScheduledGreetingHandler } from '../controllers/greeting';
import { buildBookingPdfData, generateContractPDF } from '../utils/pdfGenerator';
import { buildUpgradesPricingFromSettings } from '../utils/pricing';
import {
  createBookingHallInvoice,
  getBookingHallInvoices,
} from '../controllers/easyCount.controller';
import { createHallInvoiceSchema } from '../validators/easyCount.validator';

const router = Router();
router.use(requireAuth);

const { MANAGEMENT, MANAGER_ONLY, FINANCE_READ } = RBAC;

// --- חוזה PDF (קריאה) ---
router.get('/:id/contract-pdf', requireRole(...MANAGEMENT), catchAsync(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const booking = await prisma.booking.findUnique({
    where: { id: id },
    include: { eventDate: true, eventForm: true }
  }) as any;

  if (!booking) {
    return res.status(404).json({ success: false, message: 'ההזמנה לא נמצאה.' });
  }
  try {
    const systemSettings = await prisma.systemSettings.findUnique({ where: { id: 'global' } });
    const upgradesPricing = buildUpgradesPricingFromSettings(systemSettings);
    const pdfBuffer = await generateContractPDF(buildBookingPdfData(booking, { upgradesPricing }));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="contract_${booking.eventCode || booking.id}.pdf"`);
    res.send(pdfBuffer);
  } catch {
    return res.status(500).json({
      success: false,
      message: 'שגיאה ביצירת קובץ החוזה. ודאי ש-Chrome מותקן או הגדר PUPPETEER_EXECUTABLE_PATH.',
    });
  }
}));

// --- EasyCount / חשבוניות (Manager בלבד — Staff ללא הפקת מסמכים) ---
router.post('/:id/invoice', requireRole(...MANAGER_ONLY), validate(createHallInvoiceSchema), createBookingHallInvoice);
router.get('/:id/invoices', requireRole(...FINANCE_READ), getBookingHallInvoices);
router.post('/:id/easycount-receipt', requireRole(...MANAGER_ONLY), validate(reissueEasyCountSchema), reissueEasyCountReceipt);

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
