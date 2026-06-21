import { Router, Request, Response } from 'express';
import multer from 'multer';
import { validate } from '../middlewares/validate';
import { createBookingSchema } from '../validators/booking.validator';
import { requireAuth } from '../middlewares/auth';
import { catchAsync } from '../middlewares/errorHandler';
import prisma from '../config/prisma';

import {
  createBooking,
  getAllBookings,
  getBookingById,
  updateBooking,
  releaseOptions,
  bumpOption,
  finalizeBooking,
  getCancellationStats,
  addEventAddition,
  getNextEventCode,
  getContractTemplate,
} from '../controllers/booking';
import { sendGreeting } from '../controllers/greeting';
import { generateEventFormPDF } from '../utils/pdfGenerator';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// --- ראוט להורדת חוזה חתום (צפייה ב-PDF) ---
// --- ראוט להורדת חוזה חתום ---
router.get('/:id/contract-pdf', requireAuth, catchAsync(async (req: Request, res: Response) => {
  // תיקון הטיפוס כאן: מוודאים שזה תמיד string בודד
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const booking = await prisma.booking.findUnique({
    where: { id: id }, // משתמשים במשתנה הבטוח שהגדרנו למעלה
    include: { eventDate: true, eventForm: true }
  }) as any;

  if (!booking || !booking.clientSignatureUrl) {
    return res.status(404).json({ success: false, message: 'חוזה חתום לא נמצא.' });
  }
  
  // ... שאר הקוד נשאר בדיוק כפי שהיה ...

  // פונקציית עזר להמרת כל ערך למחרוזת בטוחה
  const toStr = (val: unknown): string => (val ? String(val) : '');

  // יצירת ה-PDF
  const pdfBuffer = await generateEventFormPDF({
    eventCode: toStr(booking.eventCode),
    clientAFullName: toStr(booking.clientAFullName),
    clientAIdNumber: toStr(booking.clientAIdNumber),
    clientAPhone: booking.clientAPhone ? toStr(booking.clientAPhone) : undefined,
    clientAEmail: booking.clientAEmail ? toStr(booking.clientAEmail) : undefined,
    eventDate: booking.eventDate?.date ? booking.eventDate.date.toISOString() : new Date().toISOString(),
    guestCount: Number(booking.guestCount || 0),
    eventType: toStr(booking.eventType),
    clientSignatureUrl: booking.clientSignatureUrl,
    contractText: booking.contractText,
    eventForm: booking.eventForm || {}
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="contract_${booking.eventCode || booking.id}.pdf"`);
  res.send(pdfBuffer);
}));

// --- ראוטים סטטיסטיקה וקודים ---
router.get('/stats/cancellations', getCancellationStats); 
router.get('/next-code', getNextEventCode);
router.get('/contract-template', getContractTemplate);

// --- ראוטים של הזמנות ---
router.post('/', requireAuth, validate(createBookingSchema), createBooking);
router.get('/', getAllBookings);
router.get('/:id', getBookingById);
router.put('/:id', updateBooking);
router.post('/release', releaseOptions);
router.post('/bump', bumpOption);
router.post('/finalize', finalizeBooking);
router.post('/send-greeting', upload.single('attachment'), sendGreeting);

// --- ראוט לתוספות אירוע ---
router.post('/:id/additions', addEventAddition);

export default router;