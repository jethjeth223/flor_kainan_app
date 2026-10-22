-- Cloud PostgreSQL schema. Business data is in a non-exposed schema.
CREATE SCHEMA kainan;
SET LOCAL search_path = kainan, pg_catalog;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='kainan_server') THEN
 CREATE ROLE kainan_server NOLOGIN;
END IF; END $$;
GRANT USAGE ON SCHEMA kainan TO kainan_server;


CREATE TABLE "audit" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"target" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL
);

CREATE TABLE "closeouts" (
	"day" text PRIMARY KEY NOT NULL,
	"opening_cash" integer NOT NULL,
	"actual_cash" integer NOT NULL,
	"expected_cash" integer NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL
);

CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL
);

CREATE TABLE "debts" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"amount" integer NOT NULL,
	"day" text NOT NULL,
	"note" text DEFAULT 'Opening balance from notebook' NOT NULL,
	FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON UPDATE no action ON DELETE no action,
	CONSTRAINT "debt_positive" CHECK("debts"."amount" > 0)
);

CREATE TABLE "files" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text,
	"purpose" text DEFAULT 'chat' NOT NULL CHECK (purpose IN ('chat','food')),
 "key" text NOT NULL,
	"mime" text NOT NULL,
	"name" text NOT NULL,
	"size" integer NOT NULL,
	FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON UPDATE no action ON DELETE no action
);

CREATE TABLE "foods" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text DEFAULT 'Ulam' NOT NULL,
	"serving" text DEFAULT '1 serving' NOT NULL,
	"price" integer NOT NULL,
	"image" text DEFAULT '' NOT NULL,
	"archived" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "food_price_positive" CHECK("foods"."price" > 0)
);

CREATE TABLE "menu_days" (
	"day" text PRIMARY KEY NOT NULL,
	"published" integer DEFAULT 0 NOT NULL
);

CREATE TABLE "menu_items" (
	"id" text PRIMARY KEY NOT NULL,
	"day" text NOT NULL,
	"food_id" text NOT NULL,
	"name" text NOT NULL,
	"serving" text NOT NULL,
	"price" integer NOT NULL,
	"capacity" integer DEFAULT 0 NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	"sold" integer DEFAULT 0 NOT NULL,
	"waste" integer DEFAULT 0 NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	FOREIGN KEY ("day") REFERENCES "menu_days"("day") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("food_id") REFERENCES "foods"("id") ON UPDATE no action ON DELETE no action,
	CONSTRAINT "stock_nonnegative" CHECK("menu_items"."capacity" >= "menu_items"."reserved" + "menu_items"."sold" + "menu_items"."waste" AND "menu_items"."reserved" >= 0 AND "menu_items"."sold" >= 0 AND "menu_items"."waste" >= 0),
	CONSTRAINT "menu_price_positive" CHECK("menu_items"."price" > 0)
);

CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text,
	"customer_name" text NOT NULL,
	"user_id" text,
	"day" text NOT NULL,
	"pickup_time" text DEFAULT '12:00' NOT NULL,
	"source" text DEFAULT 'preorder' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"total" integer NOT NULL,
	"credit" integer DEFAULT 0 NOT NULL,
	"restock" integer DEFAULT 1 NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL,
	"fulfilled_day" text,
	"fulfilled_at" text,
	FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON UPDATE no action ON DELETE no action,
	CONSTRAINT "order_total_nonnegative" CHECK("orders"."total" >= 0)
);

CREATE TABLE "order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"menu_item_id" text NOT NULL,
	"name" text NOT NULL,
	"serving" text NOT NULL,
	"price" integer NOT NULL,
	"quantity" integer NOT NULL,
	FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON UPDATE no action ON DELETE no action,
	CONSTRAINT "item_quantity_positive" CHECK("order_items"."quantity" > 0)
);

CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text,
	"debt_id" text,
	"amount" integer NOT NULL,
	"method" text NOT NULL,
	"status" text NOT NULL,
	"reference" text,
	"file_id" text,
	"day" text NOT NULL,
	"created_at" text NOT NULL,
	"verified_at" text,
	"note" text DEFAULT '' NOT NULL,
	FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("debt_id") REFERENCES "debts"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("file_id") REFERENCES "files"("id") ON UPDATE no action ON DELETE no action,
	CONSTRAINT "payment_positive" CHECK("payments"."amount" > 0),
	CONSTRAINT "payment_target" CHECK(("payments"."order_id" IS NOT NULL AND "payments"."debt_id" IS NULL) OR ("payments"."order_id" IS NULL AND "payments"."debt_id" IS NOT NULL))
);

CREATE TABLE "refunds" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"amount" integer NOT NULL,
	"method" text NOT NULL,
	"day" text NOT NULL,
	"created_at" text NOT NULL,
	"reference" text,
	FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON UPDATE no action ON DELETE no action,
	CONSTRAINT "refund_positive" CHECK("refunds"."amount" > 0)
);

CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"sender" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"file_id" text,
	"order_id" text,
	"created_at" text NOT NULL,
	"read_at" text,
	FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("file_id") REFERENCES "files"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON UPDATE no action ON DELETE no action
);

CREATE TABLE "money_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"category" text NOT NULL,
	"amount" integer NOT NULL,
	"method" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"day" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "money_positive" CHECK("money_entries"."amount" > 0)
);

CREATE TABLE "settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"shop_name" text DEFAULT 'Flor’s Kainan' NOT NULL,
	"location" text DEFAULT 'Mactan, Lapu-Lapu City' NOT NULL,
	"pickup_start" text DEFAULT '10:00' NOT NULL,
	"pickup_end" text DEFAULT '14:00' NOT NULL,
	"cutoff" text DEFAULT '20:00' NOT NULL,
	"gcash_name" text DEFAULT '' NOT NULL,
	"gcash_number" text DEFAULT '' NOT NULL,
	"notice" text DEFAULT 'Please wait for Flor to accept your order before sending payment.' NOT NULL,
	"demo" integer DEFAULT 0 NOT NULL,
	"configured" integer DEFAULT 0 NOT NULL
);

CREATE UNIQUE INDEX "customers_user_id_unique" ON "customers" ("user_id");

CREATE UNIQUE INDEX "menu_food_day" ON "menu_items" ("day","food_id");

CREATE INDEX "messages_customer" ON "messages" ("customer_id");

CREATE INDEX "items_order" ON "order_items" ("order_id");

CREATE INDEX "orders_day" ON "orders" ("day");

CREATE INDEX "orders_customer" ON "orders" ("customer_id");

CREATE UNIQUE INDEX "verified_gcash_reference" ON "payments" ("reference") WHERE "payments"."method" = 'gcash' AND "payments"."status" = 'verified' AND "payments"."reference" IS NOT NULL;


ALTER TABLE settings ADD CONSTRAINT settings_singleton CHECK (id=1);
ALTER TABLE menu_items ADD CONSTRAINT capacity_nonnegative CHECK (capacity>=0);
ALTER TABLE orders ADD CONSTRAINT valid_order_status CHECK (status IN ('pending','accepted','ready','picked_up','declined','cancelled','no_show'));
ALTER TABLE orders ADD CONSTRAINT valid_order_source CHECK (source IN ('preorder','walkin'));
ALTER TABLE payments ADD CONSTRAINT valid_payment CHECK (method IN ('cash','gcash') AND status IN ('pending','verified','rejected'));
ALTER TABLE money_entries ADD CONSTRAINT valid_money_kind CHECK (kind IN ('expense','capital','withdrawal','transfer_in','transfer_out') AND method IN ('cash','gcash'));
ALTER TABLE refunds ADD CONSTRAINT valid_refund_method CHECK (method IN ('cash','gcash'));
CREATE INDEX payments_order ON payments(order_id);
CREATE INDEX payments_debt ON payments(debt_id);
CREATE INDEX refunds_order ON refunds(order_id);
CREATE INDEX files_customer ON files(customer_id);
CREATE INDEX orders_user ON orders(user_id);
CREATE INDEX orders_fulfilled ON orders(fulfilled_day) WHERE status='picked_up';

CREATE FUNCTION order_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=kainan,pg_catalog AS $$
BEGIN
 IF NEW.status = OLD.status THEN RETURN NEW; END IF;
 IF NOT ((OLD.status='pending' AND NEW.status IN ('accepted','declined','cancelled')) OR
  (OLD.status IN ('accepted','ready') AND NEW.status IN ('ready','picked_up','cancelled','no_show'))) THEN
  RAISE EXCEPTION 'Invalid order transition'; END IF;
 IF EXISTS(SELECT 1 FROM closeouts WHERE day=NEW.day) THEN RAISE EXCEPTION 'Day is closed'; END IF;
 -- Lock all affected portions in stable order before checking or moving stock.
 PERFORM 1 FROM menu_items WHERE id IN (SELECT menu_item_id FROM order_items WHERE order_id=NEW.id) ORDER BY id FOR UPDATE;
 IF NEW.status='accepted' THEN
  IF NEW.total != COALESCE((SELECT SUM(price*quantity) FROM order_items WHERE order_id=NEW.id),0)
   OR NOT EXISTS(SELECT 1 FROM order_items WHERE order_id=NEW.id) THEN RAISE EXCEPTION 'Order total does not match items'; END IF;
  IF EXISTS(SELECT 1 FROM order_items i JOIN menu_items m ON m.id=i.menu_item_id
   WHERE i.order_id=NEW.id AND (m.day!=NEW.day OR m.enabled!=1 OR
    m.capacity-m.reserved-m.sold-m.waste < (SELECT SUM(j.quantity) FROM order_items j WHERE j.order_id=NEW.id AND j.menu_item_id=m.id)))
   THEN RAISE EXCEPTION 'Insufficient portions'; END IF;
  UPDATE menu_items SET reserved=reserved+(SELECT SUM(quantity) FROM order_items WHERE order_id=NEW.id AND menu_item_id=menu_items.id)
   WHERE id IN (SELECT menu_item_id FROM order_items WHERE order_id=NEW.id);
 ELSIF NEW.status='picked_up' THEN
  IF NEW.fulfilled_day IS NULL OR NEW.fulfilled_at IS NULL THEN RAISE EXCEPTION 'Pickup date required'; END IF;
  IF EXISTS(SELECT 1 FROM closeouts WHERE day=NEW.fulfilled_day) THEN RAISE EXCEPTION 'Day is closed'; END IF;
  IF COALESCE((SELECT SUM(amount) FROM payments WHERE order_id=NEW.id AND status='verified'),0)<NEW.total
   AND (NEW.credit!=1 OR NEW.customer_id IS NULL) THEN RAISE EXCEPTION 'Unpaid balance'; END IF;
  UPDATE menu_items SET
   reserved=reserved-(SELECT SUM(quantity) FROM order_items WHERE order_id=NEW.id AND menu_item_id=menu_items.id),
   sold=sold+(SELECT SUM(quantity) FROM order_items WHERE order_id=NEW.id AND menu_item_id=menu_items.id)
   WHERE id IN (SELECT menu_item_id FROM order_items WHERE order_id=NEW.id);
 ELSIF NEW.status IN ('cancelled','no_show') AND OLD.status IN ('accepted','ready') THEN
  UPDATE menu_items SET
   reserved=reserved-(SELECT SUM(quantity) FROM order_items WHERE order_id=NEW.id AND menu_item_id=menu_items.id),
   waste=waste+(CASE WHEN NEW.restock=0 THEN (SELECT SUM(quantity) FROM order_items WHERE order_id=NEW.id AND menu_item_id=menu_items.id) ELSE 0 END)
   WHERE id IN (SELECT menu_item_id FROM order_items WHERE order_id=NEW.id);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER order_transition_guard BEFORE UPDATE OF status ON orders FOR EACH ROW EXECUTE FUNCTION order_guard();

CREATE FUNCTION payment_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=kainan,pg_catalog AS $$
DECLARE remaining bigint;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF OLD.status='verified' THEN RAISE EXCEPTION 'Verified payments are immutable'; END IF;
  IF NEW.order_id IS DISTINCT FROM OLD.order_id OR NEW.debt_id IS DISTINCT FROM OLD.debt_id OR NEW.amount!=OLD.amount OR NEW.method!=OLD.method
   THEN RAISE EXCEPTION 'Payment details are immutable'; END IF;
 END IF;
 IF TG_OP='INSERT' OR NEW.status='verified' THEN
  IF EXISTS(SELECT 1 FROM closeouts WHERE day=NEW.day) THEN RAISE EXCEPTION 'Day is closed'; END IF;
  IF NEW.order_id IS NOT NULL THEN
   PERFORM 1 FROM orders WHERE id=NEW.order_id FOR UPDATE;
   IF NOT EXISTS(SELECT 1 FROM orders WHERE id=NEW.order_id AND status IN ('accepted','ready','picked_up')) THEN RAISE EXCEPTION 'Order must be accepted before payment'; END IF;
   SELECT total-COALESCE((SELECT SUM(amount) FROM payments WHERE order_id=NEW.order_id AND status='verified' AND id!=NEW.id),0) INTO remaining FROM orders WHERE id=NEW.order_id;
  ELSE
   PERFORM 1 FROM debts WHERE id=NEW.debt_id FOR UPDATE;
   SELECT amount-COALESCE((SELECT SUM(amount) FROM payments WHERE debt_id=NEW.debt_id AND status='verified' AND id!=NEW.id),0) INTO remaining FROM debts WHERE id=NEW.debt_id;
  END IF;
  IF NEW.amount>remaining THEN RAISE EXCEPTION 'Overpayment'; END IF;
 END IF;
 IF NEW.method='gcash' THEN NEW.reference=upper(trim(NEW.reference)); END IF;
 IF NEW.method='gcash' AND NEW.status='verified' AND (NEW.reference IS NULL OR length(NEW.reference)=0)
  THEN RAISE EXCEPTION 'GCash reference required'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER payment_insert_guard BEFORE INSERT OR UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION payment_guard();

CREATE FUNCTION money_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=kainan,pg_catalog AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM closeouts WHERE day=NEW.day) THEN RAISE EXCEPTION 'Day is closed'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER money_closed_guard BEFORE INSERT ON money_entries FOR EACH ROW EXECUTE FUNCTION money_guard();

CREATE FUNCTION refund_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=kainan,pg_catalog AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM closeouts WHERE day=NEW.day) THEN RAISE EXCEPTION 'Day is closed'; END IF;
 PERFORM 1 FROM orders WHERE id=NEW.order_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM orders WHERE id=NEW.order_id AND status IN ('cancelled','no_show','declined')) THEN RAISE EXCEPTION 'Cancel before refund'; END IF;
 IF NEW.amount>COALESCE((SELECT SUM(amount) FROM payments WHERE order_id=NEW.order_id AND status='verified'),0)-COALESCE((SELECT SUM(amount) FROM refunds WHERE order_id=NEW.order_id),0)
  THEN RAISE EXCEPTION 'Refund exceeds amount owed'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER refund_insert_guard BEFORE INSERT ON refunds FOR EACH ROW EXECUTE FUNCTION refund_guard();


ALTER TABLE audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON audit TO kainan_server USING (true) WITH CHECK (true);
ALTER TABLE closeouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON closeouts TO kainan_server USING (true) WITH CHECK (true);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON customers TO kainan_server USING (true) WITH CHECK (true);
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON debts TO kainan_server USING (true) WITH CHECK (true);
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON files TO kainan_server USING (true) WITH CHECK (true);
ALTER TABLE foods ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON foods TO kainan_server USING (true) WITH CHECK (true);
ALTER TABLE menu_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON menu_days TO kainan_server USING (true) WITH CHECK (true);
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON menu_items TO kainan_server USING (true) WITH CHECK (true);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON orders TO kainan_server USING (true) WITH CHECK (true);
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON order_items TO kainan_server USING (true) WITH CHECK (true);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON payments TO kainan_server USING (true) WITH CHECK (true);
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON refunds TO kainan_server USING (true) WITH CHECK (true);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON messages TO kainan_server USING (true) WITH CHECK (true);
ALTER TABLE money_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON money_entries TO kainan_server USING (true) WITH CHECK (true);
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON settings TO kainan_server USING (true) WITH CHECK (true);
REVOKE ALL ON SCHEMA kainan FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA kainan FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA kainan FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA kainan TO kainan_server;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA kainan TO kainan_server;
ALTER DEFAULT PRIVILEGES IN SCHEMA kainan REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

