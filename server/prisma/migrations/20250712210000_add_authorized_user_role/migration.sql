-- Add role column to AuthorizedUser for RBAC
ALTER TABLE "AuthorizedUser" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'manager';
