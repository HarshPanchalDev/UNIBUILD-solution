-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `role` ENUM('PARTNER', 'STORE_MANAGER', 'OWNER') NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `mobile` VARCHAR(15) NULL,
    `email` VARCHAR(160) NULL,
    `passwordHash` VARCHAR(255) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_mobile_key`(`mobile`),
    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_role_idx`(`role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tokenHash` CHAR(64) NOT NULL,
    `userId` INTEGER NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `ip` VARCHAR(64) NULL,
    `userAgent` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Session_tokenHash_key`(`tokenHash`),
    INDEX `Session_userId_idx`(`userId`),
    INDEX `Session_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OtpRequest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mobile` VARCHAR(15) NOT NULL,
    `purpose` ENUM('PARTNER_LOGIN', 'PARTNER_REGISTER', 'STAFF_LOGIN') NOT NULL,
    `codeHash` CHAR(64) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `ip` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OtpRequest_mobile_purpose_createdAt_idx`(`mobile`, `purpose`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RateLimit` (
    `key` VARCHAR(191) NOT NULL,
    `count` INTEGER NOT NULL,
    `resetAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CodeSequence` (
    `key` VARCHAR(40) NOT NULL,
    `next` INTEGER NOT NULL DEFAULT 1,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Partner` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `code` VARCHAR(20) NULL,
    `trade` ENUM('CONTRACTOR', 'PLUMBER', 'ELECTRICIAN', 'PAINTER') NOT NULL,
    `areaServed` VARCHAR(160) NOT NULL,
    `photoKey` VARCHAR(255) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED') NOT NULL DEFAULT 'PENDING',
    `tier` ENUM('SAATHI', 'SILVER', 'GOLD') NOT NULL DEFAULT 'SAATHI',
    `pendingDeduction` INTEGER NOT NULL DEFAULT 0,
    `termsAcceptedAt` DATETIME(3) NOT NULL,
    `whatsappOptIn` BOOLEAN NOT NULL DEFAULT false,
    `statusReason` VARCHAR(500) NULL,
    `approvedAt` DATETIME(3) NULL,
    `approvedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Partner_userId_key`(`userId`),
    UNIQUE INDEX `Partner_code_key`(`code`),
    INDEX `Partner_status_idx`(`status`),
    INDEX `Partner_trade_idx`(`trade`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TierHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `partnerId` INTEGER NOT NULL,
    `fromTier` ENUM('SAATHI', 'SILVER', 'GOLD') NOT NULL,
    `toTier` ENUM('SAATHI', 'SILVER', 'GOLD') NOT NULL,
    `quarter` VARCHAR(10) NULL,
    `purchaseValue` DECIMAL(16, 2) NULL,
    `reason` VARCHAR(500) NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TierHistory_partnerId_idx`(`partnerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Site` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(20) NOT NULL,
    `displayName` VARCHAR(120) NULL,
    `ownerName` VARCHAR(120) NOT NULL,
    `colony` VARCHAR(120) NOT NULL,
    `address` VARCHAR(255) NULL,
    `mapsUrl` VARCHAR(500) NULL,
    `status` ENUM('ACTIVE', 'COMPLETED', 'MERGED') NOT NULL DEFAULT 'ACTIVE',
    `isIncomplete` BOOLEAN NOT NULL DEFAULT false,
    `source` ENUM('COUNTER', 'FIELD_SURVEY', 'PARTNER_REQUEST', 'ADMIN', 'UPLOAD') NOT NULL DEFAULT 'ADMIN',
    `mergedIntoId` INTEGER NULL,
    `submittedByPartnerId` INTEGER NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Site_code_key`(`code`),
    INDEX `Site_colony_idx`(`colony`),
    INDEX `Site_ownerName_idx`(`ownerName`),
    INDEX `Site_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SitePhone` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `siteId` INTEGER NOT NULL,
    `phone` VARCHAR(15) NOT NULL,
    `label` VARCHAR(40) NULL,

    INDEX `SitePhone_phone_idx`(`phone`),
    UNIQUE INDEX `SitePhone_siteId_phone_key`(`siteId`, `phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SiteAlias` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `alias` VARCHAR(20) NOT NULL,
    `siteId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SiteAlias_alias_key`(`alias`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SiteLink` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `siteId` INTEGER NOT NULL,
    `partnerId` INTEGER NOT NULL,
    `trade` ENUM('CONTRACTOR', 'PLUMBER', 'ELECTRICIAN', 'PAINTER') NOT NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `endedOn` DATE NULL,
    `status` ENUM('ACTIVE', 'ENDED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
    `activeSlot` VARCHAR(40) NULL,
    `reason` VARCHAR(500) NULL,
    `endReason` VARCHAR(500) NULL,
    `reminderSentAt` DATETIME(3) NULL,
    `renewedFromId` INTEGER NULL,
    `createdById` INTEGER NULL,
    `endedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SiteLink_activeSlot_key`(`activeSlot`),
    INDEX `SiteLink_siteId_trade_idx`(`siteId`, `trade`),
    INDEX `SiteLink_partnerId_idx`(`partnerId`),
    INDEX `SiteLink_status_endDate_idx`(`status`, `endDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SiteLinkRequest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `partnerId` INTEGER NOT NULL,
    `type` ENUM('EXISTING_SITE', 'NEW_SITE') NOT NULL,
    `siteCode` VARCHAR(20) NULL,
    `ownerName` VARCHAR(120) NULL,
    `phone` VARCHAR(15) NULL,
    `colony` VARCHAR(120) NULL,
    `mapsUrl` VARCHAR(500) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `reviewNote` VARCHAR(500) NULL,
    `reviewedById` INTEGER NULL,
    `reviewedAt` DATETIME(3) NULL,
    `siteId` INTEGER NULL,
    `linkId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SiteLinkRequest_status_idx`(`status`),
    INDEX `SiteLinkRequest_partnerId_idx`(`partnerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UploadBatch` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kind` ENUM('INVOICE', 'CREDIT_NOTE') NOT NULL,
    `fileName` VARCHAR(255) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `storageKey` VARCHAR(255) NULL,
    `status` ENUM('PROCESSED', 'REJECTED', 'FAILED') NOT NULL,
    `errorMessage` TEXT NULL,
    `linesRead` INTEGER NOT NULL DEFAULT 0,
    `documentsProcessed` INTEGER NOT NULL DEFAULT 0,
    `documentsSkipped` INTEGER NOT NULL DEFAULT 0,
    `linesException` INTEGER NOT NULL DEFAULT 0,
    `linesIgnored` INTEGER NOT NULL DEFAULT 0,
    `pointsCredited` INTEGER NOT NULL DEFAULT 0,
    `pointsReversed` INTEGER NOT NULL DEFAULT 0,
    `summary` JSON NULL,
    `settingsVersionId` INTEGER NULL,
    `uploadedById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UploadBatch_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Invoice` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `number` VARCHAR(60) NOT NULL,
    `invoiceDate` DATE NOT NULL,
    `paymentDate` DATE NOT NULL,
    `uploadBatchId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Invoice_number_key`(`number`),
    INDEX `Invoice_paymentDate_idx`(`paymentDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InvoiceLine` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `invoiceId` INTEGER NOT NULL,
    `rowNumber` INTEGER NOT NULL,
    `siteCodeRaw` VARCHAR(40) NULL,
    `siteId` INTEGER NULL,
    `itemName` VARCHAR(255) NOT NULL,
    `categoryRaw` VARCHAR(60) NULL,
    `category` INTEGER NULL,
    `quantity` DECIMAL(14, 3) NOT NULL,
    `unit` VARCHAR(20) NULL,
    `taxableValue` DECIMAL(14, 2) NOT NULL,
    `status` ENUM('CREDITED', 'NO_PARTNER', 'WALK_IN', 'EXCEPTION', 'NETTED_OUT', 'DISMISSED') NOT NULL,
    `lotId` INTEGER NULL,

    INDEX `InvoiceLine_invoiceId_idx`(`invoiceId`),
    INDEX `InvoiceLine_siteId_status_idx`(`siteId`, `status`),
    INDEX `InvoiceLine_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreditNote` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `number` VARCHAR(60) NOT NULL,
    `noteDate` DATE NOT NULL,
    `originalInvoiceNumber` VARCHAR(60) NOT NULL,
    `status` ENUM('APPLIED', 'PENDING_INVOICE') NOT NULL,
    `uploadBatchId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CreditNote_number_key`(`number`),
    INDEX `CreditNote_originalInvoiceNumber_idx`(`originalInvoiceNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreditNoteLine` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `creditNoteId` INTEGER NOT NULL,
    `rowNumber` INTEGER NOT NULL,
    `siteCodeRaw` VARCHAR(40) NULL,
    `itemName` VARCHAR(255) NOT NULL,
    `categoryRaw` VARCHAR(60) NULL,
    `category` INTEGER NULL,
    `quantity` DECIMAL(14, 3) NOT NULL,
    `unit` VARCHAR(20) NULL,
    `taxableValue` DECIMAL(14, 2) NOT NULL,
    `status` ENUM('REVERSED', 'NO_POINTS', 'PENDING_INVOICE', 'APPLIED_NET', 'EXCEPTION', 'DISMISSED') NOT NULL,
    `pointsReversed` INTEGER NOT NULL DEFAULT 0,
    `originalInvoiceNumber` VARCHAR(60) NOT NULL,

    INDEX `CreditNoteLine_creditNoteId_idx`(`creditNoteId`),
    INDEX `CreditNoteLine_originalInvoiceNumber_status_idx`(`originalInvoiceNumber`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UploadException` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uploadBatchId` INTEGER NOT NULL,
    `kind` ENUM('INVOICE', 'CREDIT_NOTE') NOT NULL,
    `invoiceLineId` INTEGER NULL,
    `creditNoteLineId` INTEGER NULL,
    `documentNumber` VARCHAR(60) NOT NULL,
    `rowNumber` INTEGER NOT NULL,
    `reason` ENUM('MISSING_SITE_CODE', 'UNKNOWN_SITE_CODE', 'MISSING_CATEGORY', 'INVALID_CATEGORY', 'INVALID_VALUE', 'INVALID_DATE', 'UNKNOWN_INVOICE') NOT NULL,
    `raw` JSON NOT NULL,
    `status` ENUM('OPEN', 'RESOLVED', 'DISMISSED') NOT NULL DEFAULT 'OPEN',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `history` JSON NULL,
    `resolutionNote` VARCHAR(500) NULL,
    `resolvedById` INTEGER NULL,
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `UploadException_invoiceLineId_key`(`invoiceLineId`),
    UNIQUE INDEX `UploadException_creditNoteLineId_key`(`creditNoteLineId`),
    INDEX `UploadException_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PointLot` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `partnerId` INTEGER NOT NULL,
    `invoiceId` INTEGER NULL,
    `siteId` INTEGER NULL,
    `category` INTEGER NULL,
    `trade` ENUM('CONTRACTOR', 'PLUMBER', 'ELECTRICIAN', 'PAINTER') NOT NULL,
    `basisType` VARCHAR(10) NOT NULL,
    `basis` DECIMAL(16, 3) NOT NULL DEFAULT 0,
    `returnedBasis` DECIMAL(16, 3) NOT NULL DEFAULT 0,
    `taxableValue` DECIMAL(16, 2) NOT NULL DEFAULT 0,
    `ratePoints` DECIMAL(10, 4) NOT NULL DEFAULT 0,
    `ratePer` DECIMAL(10, 4) NOT NULL DEFAULT 1,
    `multiplier` DECIMAL(6, 4) NOT NULL DEFAULT 1,
    `tier` ENUM('SAATHI', 'SILVER', 'GOLD') NOT NULL,
    `points` INTEGER NOT NULL,
    `remaining` INTEGER NOT NULL,
    `redeemedPoints` INTEGER NOT NULL DEFAULT 0,
    `reversedPoints` INTEGER NOT NULL DEFAULT 0,
    `expiredPoints` INTEGER NOT NULL DEFAULT 0,
    `adjustedPoints` INTEGER NOT NULL DEFAULT 0,
    `creditedAt` DATETIME(3) NOT NULL,
    `unlockAt` DATETIME(3) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `unlockNotifiedAt` DATETIME(3) NULL,
    `settingsVersionId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PointLot_partnerId_expiresAt_idx`(`partnerId`, `expiresAt`),
    INDEX `PointLot_invoiceId_category_idx`(`invoiceId`, `category`),
    INDEX `PointLot_unlockAt_idx`(`unlockAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LedgerEntry` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `partnerId` INTEGER NOT NULL,
    `type` ENUM('CREDIT', 'REVERSAL', 'REDEMPTION', 'REDEMPTION_REFUND', 'EXPIRY', 'ADJUSTMENT') NOT NULL,
    `points` INTEGER NOT NULL,
    `lotId` INTEGER NULL,
    `invoiceId` INTEGER NULL,
    `creditNoteId` INTEGER NULL,
    `redemptionId` INTEGER NULL,
    `siteId` INTEGER NULL,
    `category` INTEGER NULL,
    `note` VARCHAR(500) NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LedgerEntry_partnerId_createdAt_idx`(`partnerId`, `createdAt`),
    INDEX `LedgerEntry_type_createdAt_idx`(`type`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LotAllocation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lotId` INTEGER NOT NULL,
    `ledgerEntryId` INTEGER NOT NULL,
    `points` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LotAllocation_lotId_idx`(`lotId`),
    INDEX `LotAllocation_ledgerEntryId_idx`(`ledgerEntryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReversalShortfall` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `partnerId` INTEGER NOT NULL,
    `creditNoteLineId` INTEGER NOT NULL,
    `points` INTEGER NOT NULL,
    `recoveredPoints` INTEGER NOT NULL DEFAULT 0,
    `policy` VARCHAR(30) NOT NULL,
    `status` ENUM('OPEN', 'RECOVERED', 'WAIVED') NOT NULL DEFAULT 'OPEN',
    `note` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ReversalShortfall_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Reward` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `description` VARCHAR(500) NULL,
    `section` VARCHAR(60) NOT NULL DEFAULT 'General',
    `points` INTEGER NOT NULL,
    `imageKey` VARCHAR(255) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'RETIRED') NOT NULL DEFAULT 'ACTIVE',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Redemption` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `number` VARCHAR(20) NOT NULL,
    `partnerId` INTEGER NOT NULL,
    `rewardId` INTEGER NOT NULL,
    `rewardName` VARCHAR(120) NOT NULL,
    `points` INTEGER NOT NULL,
    `pointValue` DECIMAL(10, 4) NOT NULL,
    `notes` VARCHAR(500) NULL,
    `status` ENUM('REQUESTED', 'APPROVED', 'READY', 'COLLECTED', 'REJECTED') NOT NULL DEFAULT 'REQUESTED',
    `rejectionReason` VARCHAR(500) NULL,
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `approvedAt` DATETIME(3) NULL,
    `readyAt` DATETIME(3) NULL,
    `collectedAt` DATETIME(3) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `handledById` INTEGER NULL,

    UNIQUE INDEX `Redemption_number_key`(`number`),
    INDEX `Redemption_status_idx`(`status`),
    INDEX `Redemption_partnerId_idx`(`partnerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SettingsVersion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `values` JSON NOT NULL,
    `note` VARCHAR(500) NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `audience` ENUM('PARTNER', 'STAFF') NOT NULL,
    `userId` INTEGER NULL,
    `type` VARCHAR(40) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `body` VARCHAR(1000) NOT NULL,
    `data` JSON NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_audience_userId_readAt_idx`(`audience`, `userId`, `readAt`),
    INDEX `Notification_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `action` VARCHAR(60) NOT NULL,
    `entityType` VARCHAR(40) NOT NULL,
    `entityId` VARCHAR(40) NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `reason` VARCHAR(500) NULL,
    `ip` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    INDEX `AuditLog_action_idx`(`action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Partner` ADD CONSTRAINT `Partner_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TierHistory` ADD CONSTRAINT `TierHistory_partnerId_fkey` FOREIGN KEY (`partnerId`) REFERENCES `Partner`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Site` ADD CONSTRAINT `Site_mergedIntoId_fkey` FOREIGN KEY (`mergedIntoId`) REFERENCES `Site`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Site` ADD CONSTRAINT `Site_submittedByPartnerId_fkey` FOREIGN KEY (`submittedByPartnerId`) REFERENCES `Partner`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SitePhone` ADD CONSTRAINT `SitePhone_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `Site`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SiteAlias` ADD CONSTRAINT `SiteAlias_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `Site`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SiteLink` ADD CONSTRAINT `SiteLink_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `Site`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SiteLink` ADD CONSTRAINT `SiteLink_partnerId_fkey` FOREIGN KEY (`partnerId`) REFERENCES `Partner`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SiteLinkRequest` ADD CONSTRAINT `SiteLinkRequest_partnerId_fkey` FOREIGN KEY (`partnerId`) REFERENCES `Partner`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UploadBatch` ADD CONSTRAINT `UploadBatch_settingsVersionId_fkey` FOREIGN KEY (`settingsVersionId`) REFERENCES `SettingsVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_uploadBatchId_fkey` FOREIGN KEY (`uploadBatchId`) REFERENCES `UploadBatch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceLine` ADD CONSTRAINT `InvoiceLine_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditNote` ADD CONSTRAINT `CreditNote_uploadBatchId_fkey` FOREIGN KEY (`uploadBatchId`) REFERENCES `UploadBatch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditNoteLine` ADD CONSTRAINT `CreditNoteLine_creditNoteId_fkey` FOREIGN KEY (`creditNoteId`) REFERENCES `CreditNote`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UploadException` ADD CONSTRAINT `UploadException_uploadBatchId_fkey` FOREIGN KEY (`uploadBatchId`) REFERENCES `UploadBatch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PointLot` ADD CONSTRAINT `PointLot_partnerId_fkey` FOREIGN KEY (`partnerId`) REFERENCES `Partner`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PointLot` ADD CONSTRAINT `PointLot_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PointLot` ADD CONSTRAINT `PointLot_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `Site`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LedgerEntry` ADD CONSTRAINT `LedgerEntry_partnerId_fkey` FOREIGN KEY (`partnerId`) REFERENCES `Partner`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LotAllocation` ADD CONSTRAINT `LotAllocation_lotId_fkey` FOREIGN KEY (`lotId`) REFERENCES `PointLot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LotAllocation` ADD CONSTRAINT `LotAllocation_ledgerEntryId_fkey` FOREIGN KEY (`ledgerEntryId`) REFERENCES `LedgerEntry`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReversalShortfall` ADD CONSTRAINT `ReversalShortfall_partnerId_fkey` FOREIGN KEY (`partnerId`) REFERENCES `Partner`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Redemption` ADD CONSTRAINT `Redemption_partnerId_fkey` FOREIGN KEY (`partnerId`) REFERENCES `Partner`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Redemption` ADD CONSTRAINT `Redemption_rewardId_fkey` FOREIGN KEY (`rewardId`) REFERENCES `Reward`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
