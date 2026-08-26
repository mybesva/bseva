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
	CONSTRAINT `auspicious_dates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
	CONSTRAINT `booking_analytics_id` PRIMARY KEY(`id`),
	CONSTRAINT `date_idx` UNIQUE(`date`)
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingNumber` varchar(50) NOT NULL,
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
	CONSTRAINT `bookings_id` PRIMARY KEY(`id`),
	CONSTRAINT `bookings_bookingNumber_unique` UNIQUE(`bookingNumber`),
	CONSTRAINT `booking_number_idx` UNIQUE(`bookingNumber`)
);
--> statement-breakpoint
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
	CONSTRAINT `commission_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
	CONSTRAINT `customer_metrics_id` PRIMARY KEY(`id`),
	CONSTRAINT `customer_idx` UNIQUE(`customerId`)
);
--> statement-breakpoint
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
	CONSTRAINT `customer_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `userId_idx` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `language_strings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(200) NOT NULL,
	`language` varchar(10) NOT NULL,
	`value` text NOT NULL,
	`category` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `language_strings_id` PRIMARY KEY(`id`),
	CONSTRAINT `key_lang_idx` UNIQUE(`key`,`language`)
);
--> statement-breakpoint
CREATE TABLE `notification_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(100) NOT NULL,
	`name` varchar(200) NOT NULL,
	`subject` text,
	`body` text NOT NULL,
	`channel` enum('email','sms','push','in_app') NOT NULL,
	`variables` json,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_templates_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`message` text NOT NULL,
	`type` enum('booking','payment','review','system','promotion') NOT NULL,
	`isRead` boolean NOT NULL DEFAULT false,
	`actionUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingId` int NOT NULL,
	`transactionId` varchar(100),
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
	CONSTRAINT `payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payments_transactionId_unique` UNIQUE(`transactionId`),
	CONSTRAINT `transaction_idx` UNIQUE(`transactionId`)
);
--> statement-breakpoint
CREATE TABLE `platform_kpis` (
	`id` int AUTO_INCREMENT NOT NULL,
	`month` varchar(7) NOT NULL,
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
	CONSTRAINT `platform_kpis_id` PRIMARY KEY(`id`),
	CONSTRAINT `platform_kpis_month_unique` UNIQUE(`month`)
);
--> statement-breakpoint
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
	CONSTRAINT `priest_performance_id` PRIMARY KEY(`id`),
	CONSTRAINT `priest_month_idx` UNIQUE(`priestId`,`month`)
);
--> statement-breakpoint
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
	CONSTRAINT `priest_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `userId_idx` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `puja_samagri` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pujaTypeId` int NOT NULL,
	`samagriItemId` int NOT NULL,
	`quantity` decimal(10,2) NOT NULL,
	`tier` enum('essential','standard','premium') NOT NULL,
	`isOptional` boolean DEFAULT false,
	CONSTRAINT `puja_samagri_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `puja_types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`categoryId` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`slug` varchar(200) NOT NULL,
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
	CONSTRAINT `puja_types_id` PRIMARY KEY(`id`),
	CONSTRAINT `puja_types_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `slug_idx` UNIQUE(`slug`)
);
--> statement-breakpoint
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
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `booking_idx` UNIQUE(`bookingId`)
);
--> statement-breakpoint
CREATE TABLE `samagri_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`category` varchar(100),
	`description` text,
	`unit` varchar(50),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `samagri_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `service_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`description` text,
	`icon` varchar(50),
	`displayOrder` int DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `service_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `service_categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
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
	CONSTRAINT `temples_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('customer','priest','admin') NOT NULL DEFAULT 'customer';--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `profileImage` text;--> statement-breakpoint
ALTER TABLE `users` ADD `address` text;--> statement-breakpoint
ALTER TABLE `users` ADD `city` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `state` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `pincode` varchar(10);--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_customerId_users_id_fk` FOREIGN KEY (`customerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_priestId_users_id_fk` FOREIGN KEY (`priestId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_pujaTypeId_puja_types_id_fk` FOREIGN KEY (`pujaTypeId`) REFERENCES `puja_types`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_metrics` ADD CONSTRAINT `customer_metrics_customerId_users_id_fk` FOREIGN KEY (`customerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_profiles` ADD CONSTRAINT `customer_profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_bookingId_bookings_id_fk` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `priest_performance` ADD CONSTRAINT `priest_performance_priestId_users_id_fk` FOREIGN KEY (`priestId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `priest_profiles` ADD CONSTRAINT `priest_profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `puja_samagri` ADD CONSTRAINT `puja_samagri_pujaTypeId_puja_types_id_fk` FOREIGN KEY (`pujaTypeId`) REFERENCES `puja_types`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `puja_samagri` ADD CONSTRAINT `puja_samagri_samagriItemId_samagri_items_id_fk` FOREIGN KEY (`samagriItemId`) REFERENCES `samagri_items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `puja_types` ADD CONSTRAINT `puja_types_categoryId_service_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `service_categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_bookingId_bookings_id_fk` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_customerId_users_id_fk` FOREIGN KEY (`customerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_priestId_users_id_fk` FOREIGN KEY (`priestId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `date_idx` ON `auspicious_dates` (`date`);--> statement-breakpoint
CREATE INDEX `customer_idx` ON `bookings` (`customerId`);--> statement-breakpoint
CREATE INDEX `priest_idx` ON `bookings` (`priestId`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `bookings` (`status`);--> statement-breakpoint
CREATE INDEX `booking_date_idx` ON `bookings` (`bookingDate`);--> statement-breakpoint
CREATE INDEX `user_idx` ON `notifications` (`userId`);--> statement-breakpoint
CREATE INDEX `is_read_idx` ON `notifications` (`isRead`);--> statement-breakpoint
CREATE INDEX `booking_idx` ON `payments` (`bookingId`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `payments` (`status`);--> statement-breakpoint
CREATE INDEX `rating_idx` ON `priest_profiles` (`rating`);--> statement-breakpoint
CREATE INDEX `verified_idx` ON `priest_profiles` (`isVerified`);--> statement-breakpoint
CREATE INDEX `puja_idx` ON `puja_samagri` (`pujaTypeId`);--> statement-breakpoint
CREATE INDEX `samagri_idx` ON `puja_samagri` (`samagriItemId`);--> statement-breakpoint
CREATE INDEX `category_idx` ON `puja_types` (`categoryId`);--> statement-breakpoint
CREATE INDEX `priest_idx` ON `reviews` (`priestId`);--> statement-breakpoint
CREATE INDEX `rating_idx` ON `reviews` (`rating`);--> statement-breakpoint
CREATE INDEX `city_idx` ON `temples` (`city`);--> statement-breakpoint
CREATE INDEX `state_idx` ON `temples` (`state`);--> statement-breakpoint
CREATE INDEX `email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `phone_idx` ON `users` (`phone`);--> statement-breakpoint
CREATE INDEX `role_idx` ON `users` (`role`);