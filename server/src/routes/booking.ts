import { Router, Request, Response } from 'express';
import multer from 'multer';
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
import { catchAsync } from '../middlewares/errorHandler';
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
} from '../controllers/booking';
import { sendGreeting, getScheduledGreetings, cancelScheduledGreetingHandler } from '../controllers/greeting';
import { buildBookingPdfData, generateContractPDF } from '../utils/pdfGenerator';
import { buildUpgradesPricingFromSettings } from '../utils/pricing';

const router = Router();
router.use(requireAuth);
const upload = multer({ storage: multer.memoryStorage() });

// --- ראוט להורדת חוזה חתום (צפייה ב-PDF) ---
// --- ראוט להורדת חוזה חתום ---
router.get('/:id/contract-pdf', catchAsync(async (req: Request, res: Response) => {
  // תיקון הטיפוס כאן: מוודאים שזה תמיד string בודד
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const booking = await prisma.booking.findUnique({
    where: { id: id }, // משתמשים במשתנה הבטוח שהגדרנו למעלה
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

// --- ראוטים סטטיסטיקה וקודים ---
router.get('/stats/cancellations', getCancellationStats); 
router.get('/next-code', getNextEventCode);
router.get('/contract-template', getContractTemplate);
router.get('/scheduled-greetings', getScheduledGreetings);
router.delete('/scheduled-greetings/:id', cancelScheduledGreetingHandler);

// --- ראוטים של הזמנות ---
router.post('/', validate(createBookingSchema), createBooking);
router.get('/', getAllBookings);
router.get('/:id/related-options', getRelatedOptionBookings);
router.get('/:id', getBookingById);
router.put('/:id', validate(updateBookingSchema), updateBooking);
router.patch('/:id/upgrades', validate(addBookingUpgradeSchema), addBookingUpgrade);
router.post('/release', validate(releaseOptionsSchema), releaseOptions);
router.post('/bump', validate(bumpOptionSchema), bumpOption);
router.post('/notify-option-interest', validate(notifyOptionInterestSchema), notifyOptionInterest);
router.post('/finalize', validate(finalizeBookingSchema), finalizeBooking);
router.post('/:id/easycount-receipt', validate(reissueEasyCountSchema), reissueEasyCountReceipt);
router.post('/send-greeting', upload.single('attachment'), validate(sendGreetingSchema), sendGreeting);

// --- ראוט לתוספות אירוע ---
router.post('/:id/additions', validate(addEventAdditionSchema), addEventAddition);

export default router;