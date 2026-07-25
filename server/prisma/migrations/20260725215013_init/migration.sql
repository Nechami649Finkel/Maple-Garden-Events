-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientAFullName" TEXT NOT NULL,
    "clientAIdNumber" TEXT NOT NULL,
    "clientAPhone" TEXT NOT NULL,
    "clientAEmail" TEXT,
    "clientAAddress" TEXT,
    "clientBFullName" TEXT,
    "clientBIdNumber" TEXT,
    "clientBPhone" TEXT,
    "clientBEmail" TEXT,
    "clientBAddress" TEXT,
    "calendarDateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "timeOfDay" TEXT NOT NULL,
    "timeSlot" TEXT NOT NULL DEFAULT 'evening',
    "guestCount" INTEGER NOT NULL,
    "minimumGuestCount" INTEGER,
    "finalPricePortion" DOUBLE PRECISION NOT NULL,
    "managerComments" TEXT,
    "clientComments" TEXT,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "basePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "extrasPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "externalExtrasPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "liveAdditionsTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hallRentalPrice" DOUBLE PRECISION,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
    "eventCode" TEXT NOT NULL,
    "hasMusic" BOOLEAN NOT NULL DEFAULT true,
    "akumApprovalCode" TEXT,
    "advancePaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "securityCheckStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "securityCheckUrl" TEXT,
    "isContractSigned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "cancellationReason" TEXT,
    "isOption" BOOLEAN NOT NULL DEFAULT false,
    "leadSource" TEXT,
    "optionDurationHours" INTEGER NOT NULL DEFAULT 48,
    "clientSignatureUrl" TEXT,
    "depositCheckUrl" TEXT,
    "depositCheckDetails" JSONB,
    "depositMethod" TEXT,
    "easycountDocId" TEXT,
    "easycountDocUrl" TEXT,
    "easycountStatus" TEXT,
    "easycountError" TEXT,
    "vatType" TEXT NOT NULL DEFAULT 'included',
    "contractText" TEXT,
    "paymentTemplateId" TEXT,
    "paymentTermsText" TEXT,
    "paymentDeadline" TIMESTAMP(3),
    "depositPaid" BOOLEAN NOT NULL DEFAULT false,
    "lastPaymentReminderSent" TIMESTAMP(3),
    "upgrades" JSONB,
    "kosherType" TEXT,
    "financialSummarySentAt" TIMESTAMP(3),

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HallInvoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HallInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingPayment" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventCheckIn" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "familiesLabel" TEXT,
    "orderedPortions" INTEGER,
    "entertainerPortions" INTEGER,
    "reservePortions" INTEGER,
    "hallReceivedConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "reserveTables" JSONB,
    "specialAdditions" TEXT,
    "customerSignature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuCategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "MenuCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dish" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "Dish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventDate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "lockedBy" TEXT,
    "clientName" TEXT,
    "clientPhone" TEXT,
    "clientEmail" TEXT,
    "optionExpiresAt" TIMESTAMP(3),

    CONSTRAINT "EventDate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventForm" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "eventTime" TEXT,
    "receptionType" TEXT,
    "finalGuestCount" INTEGER,
    "seatingType" TEXT,
    "menPercent" INTEGER,
    "womenPercent" INTEGER,
    "honorTableCount" INTEGER,
    "tableclothId" TEXT,
    "napkinId" TEXT,
    "centerpiece" TEXT,
    "bridgeChair" TEXT,
    "hasLighting" BOOLEAN NOT NULL DEFAULT false,
    "hasSoundSystem" BOOLEAN NOT NULL DEFAULT false,
    "hasScreens" BOOLEAN NOT NULL DEFAULT false,
    "hasFireworks" BOOLEAN NOT NULL DEFAULT false,
    "entertainersBar" INTEGER,
    "entertainersSitting" INTEGER,
    "entertainersMen" INTEGER,
    "entertainersWomen" INTEGER,
    "depositCheckUrl" TEXT,
    "depositCheckStatus" BOOLEAN NOT NULL DEFAULT false,
    "depositCheckDetails" JSONB,
    "akumCode" TEXT,
    "kashrut" TEXT,
    "guestPortionCount" INTEGER,
    "pricePerPortion" DOUBLE PRECISION,
    "kashrutSurcharge" DOUBLE PRECISION,
    "designPrice" DOUBLE PRECISION,
    "extrasJson" TEXT,
    "totalPrice" DOUBLE PRECISION,
    "contractSigned" BOOLEAN NOT NULL DEFAULT false,
    "contractSentAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "menuSelections" JSONB,
    "akumPaid" BOOLEAN,
    "tableLayoutImageUrl" TEXT,

    CONSTRAINT "EventForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CancellationLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "clientName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CancellationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TablePosition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventFormId" TEXT NOT NULL,
    "tableNumber" INTEGER NOT NULL,
    "positionX" DOUBLE PRECISION NOT NULL,
    "positionY" DOUBLE PRECISION NOT NULL,
    "section" TEXT,
    "isHonor" BOOLEAN NOT NULL DEFAULT false,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,

    CONSTRAINT "TablePosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "tenantId" TEXT NOT NULL,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 17.0,
    "defaultAdvance" DOUBLE PRECISION NOT NULL DEFAULT 5000.0,
    "optionDurationHours" INTEGER NOT NULL DEFAULT 48,
    "basePricePerPortion" DOUBLE PRECISION NOT NULL DEFAULT 250.0,
    "kashrutSurcharge" DOUBLE PRECISION NOT NULL DEFAULT 30.0,
    "staffPortionPrice" DOUBLE PRECISION NOT NULL DEFAULT 120.0,
    "designBasePrice" DOUBLE PRECISION NOT NULL DEFAULT 4500.0,
    "centerpiecePrice" DOUBLE PRECISION NOT NULL DEFAULT 150.0,
    "bridgeChairPrice" DOUBLE PRECISION NOT NULL DEFAULT 800.0,
    "lightingPrice" DOUBLE PRECISION NOT NULL DEFAULT 2500.0,
    "soundSystemPrice" DOUBLE PRECISION NOT NULL DEFAULT 2000.0,
    "screensPrice" DOUBLE PRECISION NOT NULL DEFAULT 1500.0,
    "fireworksPrice" DOUBLE PRECISION NOT NULL DEFAULT 1000.0,
    "akumFee" DOUBLE PRECISION NOT NULL DEFAULT 350.0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "extraSecurityPrice" DOUBLE PRECISION NOT NULL DEFAULT 650.0,
    "nextEventNumber" INTEGER NOT NULL DEFAULT 0,
    "receptionPrice" DOUBLE PRECISION NOT NULL DEFAULT 2000.0,
    "separateReceptionPrice" DOUBLE PRECISION NOT NULL DEFAULT 3000.0,
    "contractText" TEXT,
    "barPortionPrice" DOUBLE PRECISION NOT NULL DEFAULT 60.0,
    "paymentTemplates" JSONB,
    "defaultPaymentTemplateId" TEXT,
    "hiddenPriceFields" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtraService" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtraService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignGalleryItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "modelCode" TEXT,
    "imageUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignGalleryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffMember" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "clientSide" TEXT NOT NULL,
    "clientName" TEXT,
    "foodRating" INTEGER,
    "serviceRating" INTEGER,
    "venueRating" INTEGER,
    "averageScore" DOUBLE PRECISION,
    "comments" TEXT,
    "token" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "lastNotifiedAt" TIMESTAMP(3),
    "lastEmailSent" BOOLEAN NOT NULL DEFAULT false,
    "lastWhatsappSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KashrutCertificate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "imageUrl" TEXT,
    "validUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isGlobalCertificate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "KashrutCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventAddition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "staffName" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "agreedToTerms" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventAddition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorizedUser" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'manager',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthorizedUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledGreeting" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "attachmentPath" TEXT,
    "attachmentName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "sendStats" JSONB,
    "errorMessage" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledGreeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppInboundMessage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bookingId" TEXT,
    "fromPhone" TEXT NOT NULL,
    "waMessageId" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "text" TEXT,
    "forwardedToManager" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppInboundMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_subdomain_key" ON "Tenant"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_eventCode_key" ON "Booking"("eventCode");

-- CreateIndex
CREATE INDEX "Booking_tenantId_idx" ON "Booking"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_calendarDateId_timeSlot_key" ON "Booking"("calendarDateId", "timeSlot");

-- CreateIndex
CREATE UNIQUE INDEX "HallInvoice_externalId_key" ON "HallInvoice"("externalId");

-- CreateIndex
CREATE INDEX "HallInvoice_bookingId_idx" ON "HallInvoice"("bookingId");

-- CreateIndex
CREATE INDEX "HallInvoice_status_idx" ON "HallInvoice"("status");

-- CreateIndex
CREATE INDEX "HallInvoice_tenantId_idx" ON "HallInvoice"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingPayment_easycountTransactionId_key" ON "BookingPayment"("easycountTransactionId");

-- CreateIndex
CREATE INDEX "BookingPayment_bookingId_idx" ON "BookingPayment"("bookingId");

-- CreateIndex
CREATE INDEX "BookingPayment_tenantId_idx" ON "BookingPayment"("tenantId");

-- CreateIndex
CREATE INDEX "BookingPayment_paidAt_idx" ON "BookingPayment"("paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventCheckIn_bookingId_key" ON "EventCheckIn"("bookingId");

-- CreateIndex
CREATE INDEX "EventCheckIn_tenantId_idx" ON "EventCheckIn"("tenantId");

-- CreateIndex
CREATE INDEX "MenuCategory_tenantId_idx" ON "MenuCategory"("tenantId");

-- CreateIndex
CREATE INDEX "Dish_tenantId_idx" ON "Dish"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "EventDate_date_key" ON "EventDate"("date");

-- CreateIndex
CREATE INDEX "EventDate_tenantId_idx" ON "EventDate"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "EventForm_bookingId_key" ON "EventForm"("bookingId");

-- CreateIndex
CREATE INDEX "EventForm_tenantId_idx" ON "EventForm"("tenantId");

-- CreateIndex
CREATE INDEX "CancellationLog_tenantId_idx" ON "CancellationLog"("tenantId");

-- CreateIndex
CREATE INDEX "TablePosition_tenantId_idx" ON "TablePosition"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TablePosition_eventFormId_tableNumber_key" ON "TablePosition"("eventFormId", "tableNumber");

-- CreateIndex
CREATE INDEX "SystemSettings_tenantId_idx" ON "SystemSettings"("tenantId");

-- CreateIndex
CREATE INDEX "ExtraService_tenantId_idx" ON "ExtraService"("tenantId");

-- CreateIndex
CREATE INDEX "DesignGalleryItem_tenantId_idx" ON "DesignGalleryItem"("tenantId");

-- CreateIndex
CREATE INDEX "DesignGalleryItem_tenantId_category_idx" ON "DesignGalleryItem"("tenantId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMember_name_key" ON "StaffMember"("name");

-- CreateIndex
CREATE INDEX "StaffMember_tenantId_idx" ON "StaffMember"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_token_key" ON "Feedback"("token");

-- CreateIndex
CREATE INDEX "Feedback_tenantId_idx" ON "Feedback"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_bookingId_clientSide_key" ON "Feedback"("bookingId", "clientSide");

-- CreateIndex
CREATE INDEX "KashrutCertificate_tenantId_idx" ON "KashrutCertificate"("tenantId");

-- CreateIndex
CREATE INDEX "EventAddition_tenantId_idx" ON "EventAddition"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthorizedUser_email_key" ON "AuthorizedUser"("email");

-- CreateIndex
CREATE INDEX "AuthorizedUser_tenantId_idx" ON "AuthorizedUser"("tenantId");

-- CreateIndex
CREATE INDEX "ScheduledGreeting_tenantId_idx" ON "ScheduledGreeting"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppInboundMessage_waMessageId_key" ON "WhatsAppInboundMessage"("waMessageId");

-- CreateIndex
CREATE INDEX "WhatsAppInboundMessage_tenantId_idx" ON "WhatsAppInboundMessage"("tenantId");

-- CreateIndex
CREATE INDEX "WhatsAppInboundMessage_fromPhone_idx" ON "WhatsAppInboundMessage"("fromPhone");

-- CreateIndex
CREATE INDEX "WhatsAppInboundMessage_bookingId_idx" ON "WhatsAppInboundMessage"("bookingId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_calendarDateId_fkey" FOREIGN KEY ("calendarDateId") REFERENCES "EventDate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HallInvoice" ADD CONSTRAINT "HallInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HallInvoice" ADD CONSTRAINT "HallInvoice_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingPayment" ADD CONSTRAINT "BookingPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingPayment" ADD CONSTRAINT "BookingPayment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingPayment" ADD CONSTRAINT "BookingPayment_hallInvoiceId_fkey" FOREIGN KEY ("hallInvoiceId") REFERENCES "HallInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCheckIn" ADD CONSTRAINT "EventCheckIn_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCheckIn" ADD CONSTRAINT "EventCheckIn_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuCategory" ADD CONSTRAINT "MenuCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dish" ADD CONSTRAINT "Dish_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dish" ADD CONSTRAINT "Dish_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MenuCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDate" ADD CONSTRAINT "EventDate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventForm" ADD CONSTRAINT "EventForm_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventForm" ADD CONSTRAINT "EventForm_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationLog" ADD CONSTRAINT "CancellationLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TablePosition" ADD CONSTRAINT "TablePosition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TablePosition" ADD CONSTRAINT "TablePosition_eventFormId_fkey" FOREIGN KEY ("eventFormId") REFERENCES "EventForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemSettings" ADD CONSTRAINT "SystemSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraService" ADD CONSTRAINT "ExtraService_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignGalleryItem" ADD CONSTRAINT "DesignGalleryItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KashrutCertificate" ADD CONSTRAINT "KashrutCertificate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAddition" ADD CONSTRAINT "EventAddition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAddition" ADD CONSTRAINT "EventAddition_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorizedUser" ADD CONSTRAINT "AuthorizedUser_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledGreeting" ADD CONSTRAINT "ScheduledGreeting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppInboundMessage" ADD CONSTRAINT "WhatsAppInboundMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppInboundMessage" ADD CONSTRAINT "WhatsAppInboundMessage_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

