CREATE TABLE `budgets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`categoryId` int NOT NULL,
	`monthlyLimit` decimal(12,2) NOT NULL,
	`alertThreshold` int NOT NULL DEFAULT 80,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `budgets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recurring_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`categoryId` int NOT NULL,
	`type` enum('income','expense') NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`description` text,
	`frequency` enum('daily','weekly','biweekly','monthly','quarterly','yearly') NOT NULL,
	`nextOccurrence` timestamp NOT NULL,
	`lastOccurrence` timestamp,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recurring_transactions_id` PRIMARY KEY(`id`)
);
