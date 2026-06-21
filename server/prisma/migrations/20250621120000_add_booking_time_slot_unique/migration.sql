-- Backfill timeSlot from timeOfDay, then enforce unique (calendarDateId, timeSlot)

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "timeSlot" TEXT;

UPDATE "Booking"
SET "timeSlot" = CASE
  WHEN "timeOfDay" ILIKE 'morning%' OR "timeOfDay" ILIKE '%|morning%' THEN 'morning'
  WHEN "timeOfDay" ILIKE 'noon%' OR "timeOfDay" ILIKE '%|noon%' THEN 'noon'
  ELSE 'evening'
END
WHERE "timeSlot" IS NULL;

ALTER TABLE "Booking" ALTER COLUMN "timeSlot" SET DEFAULT 'evening';
ALTER TABLE "Booking" ALTER COLUMN "timeSlot" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Booking_calendarDateId_timeSlot_key"
  ON "Booking"("calendarDateId", "timeSlot");
