-- C5/C6: מעקב מועדי תשלום ותזכורות אוטומטיות
ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "paymentDeadline" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "depositPaid" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "lastPaymentReminderSent" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Booking_paymentDeadline_idx" ON "Booking"("paymentDeadline");
CREATE INDEX IF NOT EXISTS "Booking_lastPaymentReminderSent_idx" ON "Booking"("lastPaymentReminderSent");
