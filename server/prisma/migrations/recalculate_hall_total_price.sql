-- Recalculate totalPrice to hall-only (excludes externalExtrasPrice).
-- Run once on existing data after hall billing separation deploy.
UPDATE "Booking"
SET "totalPrice" = COALESCE("basePrice", 0)
  + COALESCE("extrasPrice", 0)
  + COALESCE("liveAdditionsTotal", 0)
WHERE COALESCE("externalExtrasPrice", 0) > 0
  AND "totalPrice" > COALESCE("basePrice", 0) + COALESCE("extrasPrice", 0) + COALESCE("liveAdditionsTotal", 0);
