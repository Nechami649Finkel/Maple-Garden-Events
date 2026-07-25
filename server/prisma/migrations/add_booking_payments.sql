-- Payment ledger per booking (EasyCount sync + manual / advance entries)
CREATE TABLE IF NOT EXISTS "BookingPayment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paymentMethod" TEXT NOT NULL,
  "easycountTransactionId" TEXT,
  "hallInvoiceId" TEXT,
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BookingPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BookingPayment_easycountTransactionId_key"
  ON "BookingPayment"("easycountTransactionId");

CREATE INDEX IF NOT EXISTS "BookingPayment_bookingId_idx"
  ON "BookingPayment"("bookingId");

CREATE INDEX IF NOT EXISTS "BookingPayment_tenantId_idx"
  ON "BookingPayment"("tenantId");

CREATE INDEX IF NOT EXISTS "BookingPayment_paidAt_idx"
  ON "BookingPayment"("paidAt");

DO $$ BEGIN
  ALTER TABLE "BookingPayment"
    ADD CONSTRAINT "BookingPayment_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BookingPayment"
    ADD CONSTRAINT "BookingPayment_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BookingPayment"
    ADD CONSTRAINT "BookingPayment_hallInvoiceId_fkey"
    FOREIGN KEY ("hallInvoiceId") REFERENCES "HallInvoice"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Idempotency for post-event manager financial summary
ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "financialSummarySentAt" TIMESTAMP(3);
