import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  shopName: text("shop_name").notNull().default("Flor’s Kainan"),
  location: text("location").notNull().default("Mactan, Lapu-Lapu City"),
  pickupStart: text("pickup_start").notNull().default("10:00"),
  pickupEnd: text("pickup_end").notNull().default("14:00"),
  cutoff: text("cutoff").notNull().default("20:00"),
  gcashName: text("gcash_name").notNull().default(""),
  gcashNumber: text("gcash_number").notNull().default(""),
  notice: text("notice")
    .notNull()
    .default(
      "Please wait for Flor to accept your order before sending payment.",
    ),
  demo: integer("demo").notNull().default(0),
  configured: integer("configured").notNull().default(0),
});
export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  userId: text("user_id").unique(),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
});
export const foods = sqliteTable(
  "foods",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default("Ulam"),
    serving: text("serving").notNull().default("1 serving"),
    price: integer("price").notNull(),
    image: text("image").notNull().default(""),
    archived: integer("archived").notNull().default(0),
  },
  (t) => [check("food_price_positive", sql`${t.price} > 0`)],
);
export const menuDays = sqliteTable("menu_days", {
  day: text("day").primaryKey(),
  published: integer("published").notNull().default(0),
});
export const menuItems = sqliteTable(
  "menu_items",
  {
    id: text("id").primaryKey(),
    day: text("day")
      .notNull()
      .references(() => menuDays.day),
    foodId: text("food_id")
      .notNull()
      .references(() => foods.id),
    name: text("name").notNull(),
    serving: text("serving").notNull(),
    price: integer("price").notNull(),
    capacity: integer("capacity").notNull().default(0),
    reserved: integer("reserved").notNull().default(0),
    sold: integer("sold").notNull().default(0),
    waste: integer("waste").notNull().default(0),
    enabled: integer("enabled").notNull().default(1),
  },
  (t) => [
    uniqueIndex("menu_food_day").on(t.day, t.foodId),
    check(
      "stock_nonnegative",
      sql`${t.capacity} >= ${t.reserved} + ${t.sold} + ${t.waste} AND ${t.reserved} >= 0 AND ${t.sold} >= 0 AND ${t.waste} >= 0`,
    ),
    check("menu_price_positive", sql`${t.price} > 0`),
  ],
);
export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id").references(() => customers.id),
    customerName: text("customer_name").notNull(),
    userId: text("user_id"),
    day: text("day").notNull(),
    pickupTime: text("pickup_time").notNull().default("12:00"),
    source: text("source").notNull().default("preorder"),
    status: text("status").notNull().default("pending"),
    total: integer("total").notNull(),
    credit: integer("credit").notNull().default(0),
    restock: integer("restock").notNull().default(1),
    note: text("note").notNull().default(""),
    createdAt: text("created_at").notNull(),
    fulfilledDay: text("fulfilled_day"),
    fulfilledAt: text("fulfilled_at"),
  },
  (t) => [
    index("orders_day").on(t.day),
    index("orders_customer").on(t.customerId),
    check("order_total_nonnegative", sql`${t.total} >= 0`),
  ],
);
export const orderItems = sqliteTable(
  "order_items",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id),
    menuItemId: text("menu_item_id")
      .notNull()
      .references(() => menuItems.id),
    name: text("name").notNull(),
    serving: text("serving").notNull(),
    price: integer("price").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (t) => [
    index("items_order").on(t.orderId),
    check("item_quantity_positive", sql`${t.quantity} > 0`),
  ],
);
export const debts = sqliteTable(
  "debts",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id),
    amount: integer("amount").notNull(),
    day: text("day").notNull(),
    note: text("note").notNull().default("Opening balance from notebook"),
  },
  (t) => [check("debt_positive", sql`${t.amount} > 0`)],
);
export const files = sqliteTable("files", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").references(() => customers.id),
  purpose: text("purpose").notNull().default("chat"),
  key: text("key").notNull(),
  mime: text("mime").notNull(),
  name: text("name").notNull(),
  size: integer("size").notNull(),
});
export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id").references(() => orders.id),
    debtId: text("debt_id").references(() => debts.id),
    amount: integer("amount").notNull(),
    method: text("method").notNull(),
    status: text("status").notNull(),
    reference: text("reference"),
    fileId: text("file_id").references(() => files.id),
    day: text("day").notNull(),
    createdAt: text("created_at").notNull(),
    verifiedAt: text("verified_at"),
    note: text("note").notNull().default(""),
  },
  (t) => [
    check("payment_positive", sql`${t.amount} > 0`),
    check(
      "payment_target",
      sql`(${t.orderId} IS NOT NULL AND ${t.debtId} IS NULL) OR (${t.orderId} IS NULL AND ${t.debtId} IS NOT NULL)`,
    ),
    uniqueIndex("verified_gcash_reference")
      .on(t.reference)
      .where(
        sql`${t.method} = 'gcash' AND ${t.status} = 'verified' AND ${t.reference} IS NOT NULL`,
      ),
  ],
);
export const refunds = sqliteTable(
  "refunds",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id),
    amount: integer("amount").notNull(),
    method: text("method").notNull(),
    day: text("day").notNull(),
    createdAt: text("created_at").notNull(),
    reference: text("reference"),
  },
  (t) => [check("refund_positive", sql`${t.amount} > 0`)],
);
export const moneyEntries = sqliteTable(
  "money_entries",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    category: text("category").notNull(),
    amount: integer("amount").notNull(),
    method: text("method").notNull(),
    note: text("note").notNull().default(""),
    day: text("day").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [check("money_positive", sql`${t.amount} > 0`)],
);
export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id),
    sender: text("sender").notNull(),
    body: text("body").notNull().default(""),
    fileId: text("file_id").references(() => files.id),
    orderId: text("order_id").references(() => orders.id),
    createdAt: text("created_at").notNull(),
    readAt: text("read_at"),
  },
  (t) => [index("messages_customer").on(t.customerId)],
);
export const closeouts = sqliteTable("closeouts", {
  day: text("day").primaryKey(),
  openingCash: integer("opening_cash").notNull(),
  actualCash: integer("actual_cash").notNull(),
  expectedCash: integer("expected_cash").notNull(),
  note: text("note").notNull().default(""),
  createdAt: text("created_at").notNull(),
});
export const audit = sqliteTable("audit", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  action: text("action").notNull(),
  target: text("target").notNull(),
  detail: text("detail").notNull().default(""),
  createdAt: text("created_at").notNull(),
});
