/**
 * Thin HTTP controllers for /api/bookings.
 * Business logic lives in Services/booking/*.
 */

import { Request, Response } from 'express';
import { catchAsync } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';
import type { HttpResult } from '../Services/booking/httpResult';
import {
  createBooking as createBookingService,
  updateBooking as updateBookingService,
  finalizeBooking as finalizeBookingService,
  addEventAddition as addEventAdditionService,
} from '../Services/booking/bookingLifecycle.service';
import {
  getBookingById as getBookingByIdService,
  getAllBookings as getAllBookingsService,
  getNextEventCode as getNextEventCodeService,
  getCancellationStats as getCancellationStatsService,
} from '../Services/booking/bookingQuery.service';
import {
  getRelatedOptionBookings as getRelatedOptionBookingsService,
  releaseOptions as releaseOptionsService,
  bumpOption as bumpOptionService,
  notifyOptionInterest as notifyOptionInterestService,
} from '../Services/booking/bookingOptions.service';
import {
  addBookingUpgrade as addBookingUpgradeService,
  getContractTemplate as getContractTemplateService,
  signAndSendContract as signAndSendContractService,
  generateContractPdfForBooking,
} from '../Services/booking/bookingContract.service';
import {
  reissueEasyCountReceipt as reissueEasyCountReceiptService,
  getBookingPayments as getBookingPaymentsService,
  createBookingPayment as createBookingPaymentService,
} from '../Services/booking/bookingPaymentOrchestration.service';

export type { EasyCountBookingResult } from '../Services/easyCount';

function sendHttpResult(res: Response, result: HttpResult) {
  return res.status(result.status).json(result.body);
}

function requireTenant(req: Request | AuthRequest, res: Response): string | null {
  const tenantId = (req as AuthRequest).user?.tenantId;
  if (!tenantId) {
    res.status(403).json({ error: 'Tenant context is missing.' });
    return null;
  }
  return tenantId;
}

export const createBooking = catchAsync(async (req: AuthRequest, res: Response) => {
  if (!requireTenant(req, res)) return;
  return sendHttpResult(res, await createBookingService(req));
});

export const getBookingById = catchAsync(async (req: Request, res: Response) => {
  if (!requireTenant(req, res)) return;
  return sendHttpResult(res, await getBookingByIdService(req));
});

export const reissueEasyCountReceipt = catchAsync(async (req: Request, res: Response) => {
  if (!requireTenant(req, res)) return;
  return sendHttpResult(res, await reissueEasyCountReceiptService(req));
});

export const getRelatedOptionBookings = catchAsync(async (req: Request, res: Response) => {
  if (!requireTenant(req, res)) return;
  return sendHttpResult(res, await getRelatedOptionBookingsService(req));
});

export const updateBooking = catchAsync(async (req: AuthRequest, res: Response) => {
  if (!requireTenant(req, res)) return;
  return sendHttpResult(res, await updateBookingService(req));
});

export const addBookingUpgrade = catchAsync(async (req: Request, res: Response) => {
  if (!requireTenant(req, res)) return;
  return sendHttpResult(res, await addBookingUpgradeService(req));
});

export const getContractTemplate = catchAsync(async (req: Request, res: Response) => {
  if (!requireTenant(req, res)) return;
  return sendHttpResult(res, await getContractTemplateService(req));
});

export const getNextEventCode = catchAsync(async (req: Request, res: Response) => {
  return sendHttpResult(res, await getNextEventCodeService(req));
});

export const getCancellationStats = catchAsync(async (req: Request, res: Response) => {
  if (!requireTenant(req, res)) return;
  return sendHttpResult(res, await getCancellationStatsService(req));
});

export const addEventAddition = async (req: Request, res: Response) => {
  if (!requireTenant(req, res)) return;
  const result = await addEventAdditionService(req);
  return sendHttpResult(res, result);
};

export const finalizeBooking = catchAsync(async (req: Request, res: Response) => {
  if (!requireTenant(req, res)) return;
  return sendHttpResult(res, await finalizeBookingService(req));
});

export const getAllBookings = catchAsync(async (req: Request, res: Response) => {
  if (!requireTenant(req, res)) return;
  return sendHttpResult(res, await getAllBookingsService(req));
});

export const releaseOptions = catchAsync(async (req: Request, res: Response) => {
  if (!requireTenant(req, res)) return;
  return sendHttpResult(res, await releaseOptionsService(req));
});

export const bumpOption = catchAsync(async (req: Request, res: Response) => {
  if (!requireTenant(req, res)) return;
  return sendHttpResult(res, await bumpOptionService(req));
});

export const notifyOptionInterest = catchAsync(async (req: Request, res: Response) => {
  if (!requireTenant(req, res)) return;
  return sendHttpResult(res, await notifyOptionInterestService(req));
});

export const signAndSendContract = catchAsync(async (req: Request, res: Response) => {
  return sendHttpResult(res, await signAndSendContractService(req));
});

export const getBookingPayments = catchAsync(async (req: Request, res: Response) => {
  if (!requireTenant(req, res)) return;
  return sendHttpResult(res, await getBookingPaymentsService(req));
});

export const createBookingPayment = catchAsync(async (req: Request, res: Response) => {
  if (!requireTenant(req, res)) return;
  return sendHttpResult(res, await createBookingPaymentService(req));
});

/** Used by routes/booking.ts GET /:id/contract-pdf */
export const getBookingContractPdf = catchAsync(async (req: Request, res: Response) => {
  if (!requireTenant(req, res)) return;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const result = await generateContractPdfForBooking(String(id), (req as AuthRequest).user?.tenantId);
  if (result.buffer) {
    if (result.headers) {
      for (const [key, value] of Object.entries(result.headers)) {
        res.setHeader(key, String(value));
      }
    }
    return res.status(result.status).send(result.buffer);
  }
  return sendHttpResult(res, { status: result.status, body: result.body });
});
