CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`target` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `closeouts` (
	`day` text PRIMARY KEY NOT NULL,
	`opening_cash` integer NOT NULL,
	`actual_cash` integer NOT NULL,
	`expected_cash` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_user_id_unique` ON `customers` (`user_id`);--> statement-breakpoint
CREATE TABLE `debts` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`amount` integer NOT NULL,
	`day` text NOT NULL,
	`note` text DEFAULT 'Opening balance from notebook' NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "debt_positive" CHECK("debts"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`key` text NOT NULL,
	`mime` text NOT NULL,
	`name` text NOT NULL,
	`size` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `foods` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`category` text DEFAULT 'Ulam' NOT NULL,
	`serving` text DEFAULT '1 serving' NOT NULL,
	`price` integer NOT NULL,
	`image` text DEFAULT '' NOT NULL,
	`archived` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "food_price_positive" CHECK("foods"."price" > 0)
);
--> statement-breakpoint
CREATE TABLE `menu_days` (
	`day` text PRIMARY KEY NOT NULL,
	`published` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `menu_items` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`food_id` text NOT NULL,
	`name` text NOT NULL,
	`serving` text NOT NULL,
	`price` integer NOT NULL,
	`capacity` integer DEFAULT 0 NOT NULL,
	`reserved` integer DEFAULT 0 NOT NULL,
	`sold` integer DEFAULT 0 NOT NULL,
	`waste` integer DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`day`) REFERENCES `menu_days`(`day`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "stock_nonnegative" CHECK("menu_items"."capacity" >= "menu_items"."reserved" + "menu_items"."sold" + "menu_items"."waste" AND "menu_items"."reserved" >= 0 AND "menu_items"."sold" >= 0 AND "menu_items"."waste" >= 0),
	CONSTRAINT "menu_price_positive" CHECK("menu_items"."price" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `menu_food_day` ON `menu_items` (`day`,`food_id`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`sender` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`file_id` text,
	`order_id` text,
	`created_at` text NOT NULL,
	`read_at` text,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `messages_customer` ON `messages` (`customer_id`);--> statement-breakpoint
CREATE TABLE `money_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`category` text NOT NULL,
	`amount` integer NOT NULL,
	`method` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`day` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "money_positive" CHECK("money_entries"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`menu_item_id` text NOT NULL,
	`name` text NOT NULL,
	`serving` text NOT NULL,
	`price` integer NOT NULL,
	`quantity` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "item_quantity_positive" CHECK("order_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE INDEX `items_order` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text,
	`customer_name` text NOT NULL,
	`user_id` text,
	`day` text NOT NULL,
	`pickup_time` text DEFAULT '12:00' NOT NULL,
	`source` text DEFAULT 'preorder' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`total` integer NOT NULL,
	`credit` integer DEFAULT 0 NOT NULL,
	`restock` integer DEFAULT 1 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`fulfilled_day` text,
	`fulfilled_at` text,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "order_total_nonnegative" CHECK("orders"."total" >= 0)
);
--> statement-breakpoint
CREATE INDEX `orders_day` ON `orders` (`day`);--> statement-breakpoint
CREATE INDEX `orders_customer` ON `orders` (`customer_id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text,
	`debt_id` text,
	`amount` integer NOT NULL,
	`method` text NOT NULL,
	`status` text NOT NULL,
	`reference` text,
	`file_id` text,
	`day` text NOT NULL,
	`created_at` text NOT NULL,
	`verified_at` text,
	`note` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`debt_id`) REFERENCES `debts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "payment_positive" CHECK("payments"."amount" > 0),
	CONSTRAINT "payment_target" CHECK(("payments"."order_id" IS NOT NULL AND "payments"."debt_id" IS NULL) OR ("payments"."order_id" IS NULL AND "payments"."debt_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `verified_gcash_reference` ON `payments` (`reference`) WHERE "payments"."method" = 'gcash' AND "payments"."status" = 'verified' AND "payments"."reference" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `refunds` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`amount` integer NOT NULL,
	`method` text NOT NULL,
	`day` text NOT NULL,
	`created_at` text NOT NULL,
	`reference` text,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "refund_positive" CHECK("refunds"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`shop_name` text DEFAULT 'Flor’s Kainan' NOT NULL,
	`location` text DEFAULT 'Mactan, Lapu-Lapu City' NOT NULL,
	`pickup_start` text DEFAULT '10:00' NOT NULL,
	`pickup_end` text DEFAULT '14:00' NOT NULL,
	`cutoff` text DEFAULT '20:00' NOT NULL,
	`gcash_name` text DEFAULT '' NOT NULL,
	`gcash_number` text DEFAULT '' NOT NULL,
	`notice` text DEFAULT 'Please wait for Flor to accept your order before sending payment.' NOT NULL,
	`demo` integer DEFAULT 0 NOT NULL,
	`configured` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
-- Business invariants live in the database as well as the API. D1 batch()
-- executes each complete operation atomically, including these triggers.
CREATE TRIGGER order_transition_guard BEFORE UPDATE OF status ON orders
WHEN NEW.status != OLD.status
BEGIN
  SELECT (CASE WHEN NOT (
    (OLD.status='pending' AND NEW.status IN ('accepted','declined','cancelled')) OR
    (OLD.status IN ('accepted','ready') AND NEW.status IN ('ready','picked_up','cancelled','no_show'))
  ) THEN RAISE(ABORT,'Invalid order transition') END);
  SELECT (CASE WHEN EXISTS(SELECT 1 FROM closeouts WHERE day=NEW.day)
    THEN RAISE(ABORT,'Day is closed') END);
END;
--> statement-breakpoint
CREATE TRIGGER reserve_order BEFORE UPDATE OF status ON orders
WHEN NEW.status='accepted' AND OLD.status='pending'
BEGIN
  SELECT (CASE WHEN NEW.total != COALESCE((SELECT SUM(price*quantity) FROM order_items WHERE order_id=NEW.id),0)
    OR NOT EXISTS(SELECT 1 FROM order_items WHERE order_id=NEW.id)
    THEN RAISE(ABORT,'Order total does not match items') END);
  SELECT (CASE WHEN EXISTS(
    SELECT 1 FROM order_items i JOIN menu_items m ON m.id=i.menu_item_id
    WHERE i.order_id=NEW.id AND (m.day!=NEW.day OR m.enabled!=1 OR
    m.capacity-m.reserved-m.sold-m.waste < (SELECT SUM(j.quantity) FROM order_items j WHERE j.order_id=NEW.id AND j.menu_item_id=m.id))
  ) THEN RAISE(ABORT,'Insufficient portions') END);
  UPDATE menu_items SET reserved=reserved+COALESCE((SELECT SUM(quantity) FROM order_items WHERE order_id=NEW.id AND menu_item_id=menu_items.id),0)
    WHERE id IN (SELECT menu_item_id FROM order_items WHERE order_id=NEW.id);
END;
--> statement-breakpoint
CREATE TRIGGER fulfill_order BEFORE UPDATE OF status ON orders
WHEN NEW.status='picked_up' AND OLD.status IN ('accepted','ready')
BEGIN
  SELECT (CASE WHEN EXISTS(SELECT 1 FROM closeouts WHERE day=NEW.fulfilled_day)
    THEN RAISE(ABORT,'Day is closed') END);
  SELECT (CASE WHEN COALESCE((SELECT SUM(amount) FROM payments WHERE order_id=NEW.id AND status='verified'),0)<NEW.total
    AND (NEW.credit!=1 OR NEW.customer_id IS NULL) THEN RAISE(ABORT,'Unpaid balance') END);
  UPDATE menu_items SET
    reserved=reserved-COALESCE((SELECT SUM(quantity) FROM order_items WHERE order_id=NEW.id AND menu_item_id=menu_items.id),0),
    sold=sold+COALESCE((SELECT SUM(quantity) FROM order_items WHERE order_id=NEW.id AND menu_item_id=menu_items.id),0)
    WHERE id IN (SELECT menu_item_id FROM order_items WHERE order_id=NEW.id);
END;
--> statement-breakpoint
CREATE TRIGGER release_order BEFORE UPDATE OF status ON orders
WHEN NEW.status IN ('cancelled','no_show') AND OLD.status IN ('accepted','ready')
BEGIN
  UPDATE menu_items SET
    reserved=reserved-COALESCE((SELECT SUM(quantity) FROM order_items WHERE order_id=NEW.id AND menu_item_id=menu_items.id),0),
    waste=waste+(CASE WHEN NEW.restock=0 THEN COALESCE((SELECT SUM(quantity) FROM order_items WHERE order_id=NEW.id AND menu_item_id=menu_items.id),0) ELSE 0 END)
    WHERE id IN (SELECT menu_item_id FROM order_items WHERE order_id=NEW.id);
END;
--> statement-breakpoint
CREATE TRIGGER payment_insert_guard BEFORE INSERT ON payments
BEGIN
  SELECT (CASE WHEN NEW.method NOT IN ('cash','gcash') OR NEW.status NOT IN ('pending','verified','rejected') THEN RAISE(ABORT,'Invalid payment') END);
  SELECT (CASE WHEN EXISTS(SELECT 1 FROM closeouts WHERE day=NEW.day) THEN RAISE(ABORT,'Day is closed') END);
  SELECT (CASE WHEN NEW.order_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM orders WHERE id=NEW.order_id AND status IN ('accepted','ready','picked_up')) THEN RAISE(ABORT,'Order must be accepted before payment') END);
  SELECT (CASE WHEN NEW.amount > CASE WHEN NEW.order_id IS NOT NULL THEN
    (SELECT total FROM orders WHERE id=NEW.order_id)-COALESCE((SELECT SUM(amount) FROM payments WHERE order_id=NEW.order_id AND status='verified'),0)
    ELSE (SELECT amount FROM debts WHERE id=NEW.debt_id)-COALESCE((SELECT SUM(amount) FROM payments WHERE debt_id=NEW.debt_id AND status='verified'),0) END
    THEN RAISE(ABORT,'Overpayment') END);
  SELECT (CASE WHEN NEW.method='gcash' AND NEW.status='verified' AND (NEW.reference IS NULL OR length(trim(NEW.reference))=0) THEN RAISE(ABORT,'GCash reference required') END);
END;
--> statement-breakpoint
CREATE TRIGGER payment_verify_guard BEFORE UPDATE ON payments
BEGIN
  SELECT (CASE WHEN OLD.status='verified' THEN RAISE(ABORT,'Verified payments are immutable') END);
  SELECT (CASE WHEN NEW.order_id IS NOT OLD.order_id OR NEW.debt_id IS NOT OLD.debt_id OR NEW.amount!=OLD.amount OR NEW.method!=OLD.method THEN RAISE(ABORT,'Payment details are immutable') END);
  SELECT (CASE WHEN NEW.status='verified' AND EXISTS(SELECT 1 FROM closeouts WHERE day=NEW.day) THEN RAISE(ABORT,'Day is closed') END);
  SELECT (CASE WHEN NEW.status='verified' AND NEW.order_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM orders WHERE id=NEW.order_id AND status IN ('accepted','ready','picked_up')) THEN RAISE(ABORT,'Order must be accepted before payment') END);
  SELECT (CASE WHEN NEW.status='verified' AND NEW.amount > CASE WHEN NEW.order_id IS NOT NULL THEN
    (SELECT total FROM orders WHERE id=NEW.order_id)-COALESCE((SELECT SUM(amount) FROM payments WHERE order_id=NEW.order_id AND status='verified' AND id!=NEW.id),0)
    ELSE (SELECT amount FROM debts WHERE id=NEW.debt_id)-COALESCE((SELECT SUM(amount) FROM payments WHERE debt_id=NEW.debt_id AND status='verified' AND id!=NEW.id),0) END
    THEN RAISE(ABORT,'Overpayment') END);
END;
--> statement-breakpoint
CREATE TRIGGER money_closed_guard BEFORE INSERT ON money_entries
BEGIN
  SELECT (CASE WHEN EXISTS(SELECT 1 FROM closeouts WHERE day=NEW.day) THEN RAISE(ABORT,'Day is closed') END);
END;
--> statement-breakpoint
CREATE TRIGGER refund_guard BEFORE INSERT ON refunds
BEGIN
  SELECT (CASE WHEN EXISTS(SELECT 1 FROM closeouts WHERE day=NEW.day) THEN RAISE(ABORT,'Day is closed') END);
  SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM orders WHERE id=NEW.order_id AND status IN ('cancelled','no_show','declined')) THEN RAISE(ABORT,'Cancel before refund') END);
  SELECT (CASE WHEN NEW.amount > COALESCE((SELECT SUM(amount) FROM payments WHERE order_id=NEW.order_id AND status='verified'),0)-COALESCE((SELECT SUM(amount) FROM refunds WHERE order_id=NEW.order_id),0) THEN RAISE(ABORT,'Refund exceeds amount owed') END);
END;
