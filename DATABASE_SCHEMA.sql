-- ============================================================================
-- B-SEVA DATABASE SCHEMA
-- Complete SQL CREATE TABLE statements for all base tables
-- ============================================================================

-- ============================================================================
-- CORE USER MANAGEMENT
-- ============================================================================

CREATE TABLE `users` (
  `id` int AUTO_INCREMENT NOT NULL,
  `openId` varchar(64) NOT NULL UNIQUE,
  `name` text,
  `email` varchar(320),
  `phone` varchar(20),
  `loginMethod` varchar(64),
  `role` enum('customer','priest','admin') NOT NULL DEFAULT 'customer',
  `profileImage` text,
  `address` text,
  `city` varchar(100),
  `state` varchar(100),
  `pincode` varchar(10),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `lastSignedIn` timestamp NOT NULL DEFAULT (now()),
  `isActive` boolean NOT NULL DEFAULT true,
  PRIMARY KEY(`id`),
  INDEX `email_idx` (`email`),
  INDEX `phone_idx` (`phone`),
  INDEX `role_idx` (`role`)
);

CREATE TABLE `priest_profiles` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `experience` int NOT NULL,
  `languages` json NOT NULL,
  `specializations` json NOT NULL,
  `rating` decimal(3,2) DEFAULT '0.00',
  `totalReviews` int DEFAULT 0,
  `totalBookings` int DEFAULT 0,
  `isVerified` boolean NOT NULL DEFAULT false,
  `verificationDate` timestamp,
  `bio` text,
  `certifications` json,
  `availabilityStatus` enum('available','busy','unavailable') DEFAULT 'available',
  `basePrice` int DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  UNIQUE KEY `userId_idx` (`userId`),
  INDEX `rating_idx` (`rating`),
  INDEX `verified_idx` (`isVerified`),
  FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
);

CREATE TABLE `customer_profiles` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `dateOfBirth` timestamp,
  `gotra` varchar(100),
  `nakshatra` varchar(50),
  `rashi` varchar(50),
  `preferredLanguage` varchar(50),
  `totalBookings` int DEFAULT 0,
  `lifetimeValue` int DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  UNIQUE KEY `userId_idx` (`userId`),
  FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
);

-- ============================================================================
-- SERVICES & PUJAS
-- ============================================================================

CREATE TABLE `service_categories` (
  `id` int AUTO_INCREMENT NOT NULL,
  `name` varchar(100) NOT NULL,
  `slug` varchar(100) NOT NULL UNIQUE,
  `description` text,
  `icon` varchar(50),
  `displayOrder` int DEFAULT 0,
  `isActive` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  UNIQUE KEY `service_categories_slug_unique` (`slug`)
);

CREATE TABLE `puja_types` (
  `id` int AUTO_INCREMENT NOT NULL,
  `categoryId` int NOT NULL,
  `name` varchar(200) NOT NULL,
  `slug` varchar(200) NOT NULL UNIQUE,
  `shortDescription` text,
  `fullDescription` text,
  `rituals` json,
  `estimatedDuration` int NOT NULL,
  `priestRequirements` json,
  `basePriceEssential` int NOT NULL,
  `basePriceStandard` int NOT NULL,
  `basePricePremium` int NOT NULL,
  `imageUrl` text,
  `videoUrl` text,
  `isActive` boolean NOT NULL DEFAULT true,
  `popularityScore` int DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  UNIQUE KEY `puja_types_slug_unique` (`slug`),
  UNIQUE KEY `slug_idx` (`slug`),
  INDEX `category_idx` (`categoryId`),
  FOREIGN KEY (`categoryId`) REFERENCES `service_categories` (`id`)
);

CREATE TABLE `samagri_items` (
  `id` int AUTO_INCREMENT NOT NULL,
  `name` varchar(200) NOT NULL,
  `category` varchar(100),
  `description` text,
  `unit` varchar(50),
  `isActive` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY(`id`)
);

CREATE TABLE `puja_samagri` (
  `id` int AUTO_INCREMENT NOT NULL,
  `pujaTypeId` int NOT NULL,
  `samagriItemId` int NOT NULL,
  `quantity` decimal(10,2) NOT NULL,
  `tier` enum('essential','standard','premium') NOT NULL,
  `isOptional` boolean DEFAULT false,
  PRIMARY KEY(`id`),
  INDEX `puja_idx` (`pujaTypeId`),
  INDEX `samagri_idx` (`samagriItemId`),
  FOREIGN KEY (`pujaTypeId`) REFERENCES `puja_types` (`id`),
  FOREIGN KEY (`samagriItemId`) REFERENCES `samagri_items` (`id`)
);

-- ============================================================================
-- TEMPLES
-- ============================================================================

CREATE TABLE `temples` (
  `id` int AUTO_INCREMENT NOT NULL,
  `name` varchar(200) NOT NULL,
  `deity` varchar(100),
  `address` text NOT NULL,
  `city` varchar(100) NOT NULL,
  `state` varchar(100) NOT NULL,
  `pincode` varchar(10),
  `latitude` decimal(10,7),
  `longitude` decimal(10,7),
  `contactPhone` varchar(20),
  `contactEmail` varchar(320),
  `website` text,
  `description` text,
  `imageUrl` text,
  `isActive` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  INDEX `city_idx` (`city`),
  INDEX `state_idx` (`state`)
);

-- ============================================================================
-- BOOKINGS & TRANSACTIONS
-- ============================================================================

CREATE TABLE `bookings` (
  `id` int AUTO_INCREMENT NOT NULL,
  `bookingNumber` varchar(50) NOT NULL UNIQUE,
  `customerId` int NOT NULL,
  `priestId` int,
  `pujaTypeId` int NOT NULL,
  `tier` enum('essential','standard','premium') NOT NULL,
  `bookingDate` timestamp NOT NULL,
  `bookingTime` varchar(20),
  `location` text NOT NULL,
  `city` varchar(100),
  `specialInstructions` text,
  `status` enum('pending','confirmed','in_progress','completed','cancelled','refunded') NOT NULL DEFAULT 'pending',
  `totalAmount` int NOT NULL,
  `platformFee` int NOT NULL,
  `priestAmount` int NOT NULL,
  `samagriIncluded` boolean DEFAULT true,
  `numberOfPeople` int DEFAULT 1,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `completedAt` timestamp,
  `cancelledAt` timestamp,
  `cancellationReason` text,
  PRIMARY KEY(`id`),
  UNIQUE KEY `bookings_bookingNumber_unique` (`bookingNumber`),
  UNIQUE KEY `booking_number_idx` (`bookingNumber`),
  INDEX `customer_idx` (`customerId`),
  INDEX `priest_idx` (`priestId`),
  INDEX `status_idx` (`status`),
  INDEX `booking_date_idx` (`bookingDate`),
  FOREIGN KEY (`customerId`) REFERENCES `users` (`id`),
  FOREIGN KEY (`priestId`) REFERENCES `users` (`id`),
  FOREIGN KEY (`pujaTypeId`) REFERENCES `puja_types` (`id`)
);

CREATE TABLE `payments` (
  `id` int AUTO_INCREMENT NOT NULL,
  `bookingId` int NOT NULL,
  `transactionId` varchar(100) UNIQUE,
  `paymentMethod` varchar(50),
  `amount` int NOT NULL,
  `status` enum('pending','processing','completed','failed','refunded') NOT NULL DEFAULT 'pending',
  `paymentGateway` varchar(50),
  `gatewayResponse` json,
  `paidAt` timestamp,
  `refundedAt` timestamp,
  `refundAmount` int,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  UNIQUE KEY `payments_transactionId_unique` (`transactionId`),
  UNIQUE KEY `transaction_idx` (`transactionId`),
  INDEX `booking_idx` (`bookingId`),
  INDEX `status_idx` (`status`),
  FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`)
);

-- ============================================================================
-- REVIEWS & RATINGS
-- ============================================================================

CREATE TABLE `reviews` (
  `id` int AUTO_INCREMENT NOT NULL,
  `bookingId` int NOT NULL,
  `customerId` int NOT NULL,
  `priestId` int NOT NULL,
  `rating` int NOT NULL,
  `comment` text,
  `isVerified` boolean DEFAULT true,
  `isVisible` boolean DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  UNIQUE KEY `booking_idx` (`bookingId`),
  INDEX `customer_idx` (`customerId`),
  INDEX `priest_idx` (`priestId`),
  FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`),
  FOREIGN KEY (`customerId`) REFERENCES `users` (`id`),
  FOREIGN KEY (`priestId`) REFERENCES `users` (`id`)
);

-- ============================================================================
-- NOTIFICATIONS & COMMUNICATIONS
-- ============================================================================

CREATE TABLE `notification_templates` (
  `id` int AUTO_INCREMENT NOT NULL,
  `code` varchar(100) NOT NULL UNIQUE,
  `name` varchar(200) NOT NULL,
  `subject` text,
  `body` text NOT NULL,
  `channel` enum('email','sms','push','in_app') NOT NULL,
  `variables` json,
  `isActive` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  UNIQUE KEY `notification_templates_code_unique` (`code`)
);

CREATE TABLE `notifications` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `title` varchar(200) NOT NULL,
  `message` text NOT NULL,
  `type` enum('booking','payment','review','system','promotion') NOT NULL,
  `isRead` boolean NOT NULL DEFAULT false,
  `actionUrl` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY(`id`),
  INDEX `user_idx` (`userId`),
  INDEX `type_idx` (`type`),
  FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
);

-- ============================================================================
-- ANALYTICS & METRICS
-- ============================================================================

CREATE TABLE `booking_analytics` (
  `id` int AUTO_INCREMENT NOT NULL,
  `date` timestamp NOT NULL,
  `totalBookings` int DEFAULT 0,
  `completedBookings` int DEFAULT 0,
  `cancelledBookings` int DEFAULT 0,
  `totalGMV` int DEFAULT 0,
  `totalCommission` int DEFAULT 0,
  `averageBookingValue` int DEFAULT 0,
  `newCustomers` int DEFAULT 0,
  `repeatCustomers` int DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY(`id`),
  UNIQUE KEY `date_idx` (`date`)
);

CREATE TABLE `customer_metrics` (
  `id` int AUTO_INCREMENT NOT NULL,
  `customerId` int NOT NULL,
  `firstBookingDate` timestamp,
  `lastBookingDate` timestamp,
  `totalBookings` int DEFAULT 0,
  `lifetimeValue` int DEFAULT 0,
  `averageBookingValue` int DEFAULT 0,
  `acquisitionSource` varchar(100),
  `acquisitionCost` int DEFAULT 0,
  `retentionStatus` enum('active','at_risk','churned') DEFAULT 'active',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  UNIQUE KEY `customer_idx` (`customerId`),
  FOREIGN KEY (`customerId`) REFERENCES `users` (`id`)
);

CREATE TABLE `priest_performance` (
  `id` int AUTO_INCREMENT NOT NULL,
  `priestId` int NOT NULL,
  `month` varchar(7) NOT NULL,
  `totalBookings` int DEFAULT 0,
  `completedBookings` int DEFAULT 0,
  `cancelledBookings` int DEFAULT 0,
  `totalEarnings` int DEFAULT 0,
  `averageRating` decimal(3,2),
  `totalReviews` int DEFAULT 0,
  `responseTime` int DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY(`id`),
  UNIQUE KEY `priest_month_idx` (`priestId`, `month`),
  FOREIGN KEY (`priestId`) REFERENCES `users` (`id`)
);

CREATE TABLE `platform_kpis` (
  `id` int AUTO_INCREMENT NOT NULL,
  `month` varchar(7) NOT NULL UNIQUE,
  `totalGMV` int DEFAULT 0,
  `totalCommission` int DEFAULT 0,
  `takeRate` decimal(5,2),
  `grossMargin` decimal(5,2),
  `ebitda` int DEFAULT 0,
  `totalActiveCustomers` int DEFAULT 0,
  `totalActivePriests` int DEFAULT 0,
  `customerRetentionRate` decimal(5,2),
  `priestRetentionRate` decimal(5,2),
  `averageLTV` int DEFAULT 0,
  `averageCAC` int DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY(`id`)
);

-- ============================================================================
-- CONFIGURATION & SETTINGS
-- ============================================================================

CREATE TABLE `commission_rules` (
  `id` int AUTO_INCREMENT NOT NULL,
  `name` varchar(100) NOT NULL,
  `ruleType` enum('percentage','fixed','tiered') NOT NULL,
  `value` decimal(10,2) NOT NULL,
  `minAmount` int,
  `maxAmount` int,
  `applicableTo` enum('all','puja_type','priest_tier'),
  `referenceId` int,
  `isActive` boolean NOT NULL DEFAULT true,
  `effectiveFrom` timestamp NOT NULL,
  `effectiveTo` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY(`id`)
);

CREATE TABLE `auspicious_dates` (
  `id` int AUTO_INCREMENT NOT NULL,
  `date` timestamp NOT NULL,
  `occasion` varchar(200),
  `muhurtaStart` varchar(20),
  `muhurtaEnd` varchar(20),
  `nakshatra` varchar(50),
  `tithi` varchar(50),
  `description` text,
  `isHighlyAuspicious` boolean DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY(`id`)
);

CREATE TABLE `language_strings` (
  `id` int AUTO_INCREMENT NOT NULL,
  `key` varchar(200) NOT NULL,
  `language` varchar(10) NOT NULL,
  `value` text NOT NULL,
  `category` varchar(100),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  UNIQUE KEY `key_lang_idx` (`key`, `language`)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Additional indexes for common queries
CREATE INDEX `bookings_customerId_status` ON `bookings` (`customerId`, `status`);
CREATE INDEX `bookings_priestId_status` ON `bookings` (`priestId`, `status`);
CREATE INDEX `bookings_pujaTypeId` ON `bookings` (`pujaTypeId`);
CREATE INDEX `payments_bookingId_status` ON `payments` (`bookingId`, `status`);
CREATE INDEX `reviews_priestId` ON `reviews` (`priestId`);
CREATE INDEX `priest_profiles_isVerified` ON `priest_profiles` (`isVerified`);
CREATE INDEX `users_role` ON `users` (`role`);

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
