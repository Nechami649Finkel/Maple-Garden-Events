-- Design gallery catalog (tenant-scoped design options with images)
CREATE TABLE IF NOT EXISTS "DesignGalleryItem" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "modelCode" TEXT,
  "imageUrl" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DesignGalleryItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DesignGalleryItem_tenantId_idx" ON "DesignGalleryItem"("tenantId");
CREATE INDEX IF NOT EXISTS "DesignGalleryItem_tenantId_category_idx" ON "DesignGalleryItem"("tenantId", "category");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DesignGalleryItem_tenantId_fkey'
  ) THEN
    ALTER TABLE "DesignGalleryItem"
      ADD CONSTRAINT "DesignGalleryItem_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
