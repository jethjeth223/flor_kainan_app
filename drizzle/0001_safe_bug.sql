PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_files` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text,
	`purpose` text DEFAULT 'chat' NOT NULL,
	`key` text NOT NULL,
	`mime` text NOT NULL,
	`name` text NOT NULL,
	`size` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_files`("id", "customer_id", "purpose", "key", "mime", "name", "size") SELECT "id", "customer_id", 'chat', "key", "mime", "name", "size" FROM `files`;--> statement-breakpoint
DROP TABLE `files`;--> statement-breakpoint
ALTER TABLE `__new_files` RENAME TO `files`;--> statement-breakpoint
PRAGMA defer_foreign_keys=OFF;