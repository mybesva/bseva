CREATE TABLE `category_master` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`code` varchar(50) NOT NULL,
	`description` text,
	`parentId` int,
	`applicableTo` enum('pujari','customer','both') NOT NULL DEFAULT 'both',
	`displayOrder` int DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `category_master_id` PRIMARY KEY(`id`),
	CONSTRAINT `category_master_code_unique` UNIQUE(`code`),
	CONSTRAINT `category_code_idx` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `email_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(100) NOT NULL,
	`name` varchar(200) NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`variables` json,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_templates_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `location_master` (
	`id` int AUTO_INCREMENT NOT NULL,
	`city` varchar(100) NOT NULL,
	`area` varchar(100),
	`state` varchar(100) NOT NULL,
	`pincode` varchar(10),
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`isServiceable` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `location_master_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `otp_verifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingId` int,
	`phone` varchar(20) NOT NULL,
	`otp` varchar(6) NOT NULL,
	`purpose` enum('booking_confirmation','login','password_reset') NOT NULL,
	`isVerified` boolean NOT NULL DEFAULT false,
	`expiresAt` timestamp NOT NULL,
	`attempts` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `otp_verifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sms_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(100) NOT NULL,
	`name` varchar(200) NOT NULL,
	`body` text NOT NULL,
	`variables` json,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sms_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `sms_templates_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `tithi_calendar` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` timestamp NOT NULL,
	`tithi` varchar(50) NOT NULL,
	`tithiNumber` int,
	`paksha` enum('shukla','krishna'),
	`nakshatra` varchar(50),
	`yoga` varchar(50),
	`karana` varchar(50),
	`sunrise` varchar(10),
	`sunset` varchar(10),
	`moonrise` varchar(10),
	`isAuspicious` boolean DEFAULT false,
	`festivals` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tithi_calendar_id` PRIMARY KEY(`id`),
	CONSTRAINT `tithi_date_idx` UNIQUE(`date`)
);
--> statement-breakpoint

ALTER TABLE `customer_profiles` ADD `locationCity` varchar(100);--> statement-breakpoint
ALTER TABLE `customer_profiles` ADD `locationArea` varchar(100);--> statement-breakpoint
ALTER TABLE `customer_profiles` ADD `fullAddress` text;--> statement-breakpoint
ALTER TABLE `customer_profiles` ADD `landmark` varchar(200);--> statement-breakpoint
ALTER TABLE `customer_profiles` ADD `pincode` varchar(10);--> statement-breakpoint
ALTER TABLE `customer_profiles` ADD `categoryId` int;--> statement-breakpoint
ALTER TABLE `priest_profiles` ADD `locationCity` varchar(100);--> statement-breakpoint
ALTER TABLE `priest_profiles` ADD `locationArea` varchar(100);--> statement-breakpoint
ALTER TABLE `priest_profiles` ADD `fullAddress` text;--> statement-breakpoint
ALTER TABLE `priest_profiles` ADD `landmark` varchar(200);--> statement-breakpoint
ALTER TABLE `priest_profiles` ADD `pincode` varchar(10);--> statement-breakpoint
ALTER TABLE `priest_profiles` ADD `categoryId` int;--> statement-breakpoint

ALTER TABLE `otp_verifications` ADD CONSTRAINT `otp_verifications_bookingId_bookings_id_fk` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `applicable_idx` ON `category_master` (`applicableTo`);--> statement-breakpoint
CREATE INDEX `location_city_idx` ON `location_master` (`city`);--> statement-breakpoint
CREATE INDEX `location_pincode_idx` ON `location_master` (`pincode`);--> statement-breakpoint
CREATE INDEX `otp_phone_idx` ON `otp_verifications` (`phone`);--> statement-breakpoint
CREATE INDEX `otp_booking_idx` ON `otp_verifications` (`bookingId`);--> statement-breakpoint
CREATE INDEX `customer_city_idx` ON `customer_profiles` (`locationCity`);--> statement-breakpoint
CREATE INDEX `customer_pincode_idx` ON `customer_profiles` (`pincode`);--> statement-breakpoint
CREATE INDEX `priest_rating_idx` ON `priest_profiles` (`rating`);--> statement-breakpoint
CREATE INDEX `priest_verified_idx` ON `priest_profiles` (`isVerified`);--> statement-breakpoint
CREATE INDEX `priest_city_idx` ON `priest_profiles` (`locationCity`);--> statement-breakpoint
CREATE INDEX `priest_pincode_idx` ON `priest_profiles` (`pincode`);