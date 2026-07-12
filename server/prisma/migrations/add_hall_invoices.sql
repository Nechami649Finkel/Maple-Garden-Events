CREATE TABLE IF NOT EXISTS "HallInvoice" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "paymentUrl" TEXT,
  "installmentLabel" TEXT,
  "description" TEXT,
  "paidAt" TIMESTAMP(3),
  "webhookPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HallInvoice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HallInvoice_externalId_key" UNIQUE ("externalId"),
  CONSTRAINT "HallInvoice_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "HallInvoice_bookingId_idx" ON "HallInvoice"("bookingId");
CREATE INDEX IF NOT EXISTS "HallInvoice_status_idx" ON "HallInvoice"("status");
