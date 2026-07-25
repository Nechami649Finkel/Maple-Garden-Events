-- One-time feedback completion timestamp
ALTER TABLE "Feedback"
  ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
