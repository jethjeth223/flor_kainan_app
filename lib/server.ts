import { currentUser } from "./supabase/server";
import { appOrigin } from "./app-origin";
import { database, withTransaction } from "./postgres";
import { storage } from "./supabase/storage";
import { z } from "zod";
import { manilaDay, shiftDay, transitions } from "./domain";
import type {
  Snapshot,
  Settings,
  Order,
  Customer,
  Payment,
  MenuItem,
} from "./types";

class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const id = z.string().min(1).max(100);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const parsed = new Date(v + "T00:00:00Z");
    return (
      !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === v
    );
  }, "Invalid date");
const amount = z.number().int().min(1).max(100_000_000);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const method = z.enum(["cash", "gcash"]);
function db() {
  return database;
}
function q(sql: string, ...values: any[]) {
  return db()
    .prepare(sql)
    .bind(...values);
}
async function all<T = any>(sql: string, ...values: any[]): Promise<T[]> {
  return (await q(sql, ...values).all<T>()).results;
}
async function first<T = any>(
  sql: string,
  ...values: any[]
): Promise<T | null> {
  return q(sql, ...values).first<T>();
}
function log(userId: string, action: string, target: string, detail = "") {
  return q(
    "INSERT INTO audit (id,user_id,action,target,detail,created_at) VALUES (?,?,?,?,?,?)",
    uuid(),
    userId,
    action,
    target,
    detail,
    now(),
  );
}
const paidSql =
  "COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.order_id=o.id AND p.status='verified'),0)";
const debtPaidSql =
  "COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.debt_id=d.id AND p.status='verified'),0)";
async function context() {
  const user = await currentUser();
  const settings = await first<Settings>("SELECT * FROM settings WHERE id=1");
  const owner = !!(user && settings?.owner_id === user.userId);
  const customer = user
    ? await first<Customer>(
        "SELECT * FROM customers WHERE user_id=?",
        user.userId,
      )
    : null;
  return { user, settings, owner, customer };
}
type Context = Awaited<ReturnType<typeof context>>;
function owner(c: Context) {
  if (!c.user) throw new AppError("Please sign in first.", 401);
  if (!c.owner) throw new AppError("Only Flor can do this.", 403);
  return c.user;
}
function signed(c: Context) {
  if (!c.user) throw new AppError("Please sign in first.", 401);
  return c.user;
}
async function openDay(day: string) {
  if (await first("SELECT day FROM closeouts WHERE day=?", day))
    throw new AppError(
      "This day is closed. Reopen it in Pera before making changes.",
      409,
    );
}
async function getOrder(orderId: string, c: Context) {
  const o = await first<Order>(
    `SELECT o.*, ${paidSql} paid FROM orders o WHERE o.id=?`,
    orderId,
  );
  if (!o) throw new AppError("Order not found.", 404);
  if (!c.owner && o.user_id !== c.user?.userId)
    throw new AppError("This order is private.", 403);
  return o;
}
async function checkFile(
  fileId: string | null | undefined,
  customerId: string | null,
) {
  if (!fileId) return;
  const f = await first(
    "SELECT * FROM files WHERE id=? AND customer_id=?",
    fileId,
    customerId,
  );
  if (!f)
    throw new AppError("This image does not belong to this customer.", 403);
}
async function ensureCustomer(c: Context, name?: string, phone?: string) {
  const u = signed(c);
  if (c.customer) return c.customer;
  const customerId = uuid();
  await q(
    "INSERT OR IGNORE INTO customers (id,user_id,name,phone) VALUES (?,?,?,?)",
    customerId,
    u.userId,
    name || u.fullName || u.email.split("@")[0],
    phone || "",
  ).run();
  return (await first<Customer>(
    "SELECT * FROM customers WHERE user_id=?",
    u.userId,
  ))!;
}
function assertOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expectedOrigin = appOrigin(request);
  if (origin && origin !== expectedOrigin)
    throw new AppError("Please use this app to submit changes.", 403);
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new AppError("Cross-site requests are not allowed.", 403);
}
export async function apiError(error: unknown) {
  if (error instanceof z.ZodError)
    return Response.json(
      {
        error: error.issues
          .map((x) => `${x.path.join(".") || "Input"}: ${x.message}`)
          .join("; "),
      },
      { status: 400 },
    );
  if (error instanceof AppError)
    return Response.json({ error: error.message }, { status: error.status });
  const msg = error instanceof Error ? error.message : String(error);
  const known: [RegExp, string][] = [
    [
      /Insufficient portions|stock_nonnegative/,
      "Not enough portions remain. Refresh the menu and try again.",
    ],
    [
      /Unpaid balance/,
      "Record the remaining payment, or select a customer and allow utang.",
    ],
    [
      /Day is closed/,
      "This day is closed. Reopen it before recording changes.",
    ],
    [/Overpayment/, "That payment is larger than the remaining balance."],
    [
      /verified_gcash_reference|payments.reference/,
      "This GCash reference has already been recorded.",
    ],
    [
      /Invalid order transition/,
      "This order has changed. Refresh and try again.",
    ],
    [
      /Refund exceeds/,
      "That refund is larger than the amount still owed back.",
    ],
    [
      /UNIQUE constraint failed|duplicate key value/,
      "This entry was already saved. Refresh to see it.",
    ],
    [
      /CHECK constraint failed|violates check constraint/,
      "Please check the amounts and quantities.",
    ],
  ];
  const match = known.find(([rx]) => rx.test(msg));
  if (!match) console.error("Application request failed:", msg);
  return Response.json(
    { error: match?.[1] || "We could not save this. Please try again." },
    { status: match ? 409 : 500 },
  );
}

export async function snapshot(request: Request): Promise<Snapshot> {
  return withTransaction(() => readSnapshot(request), true);
}
async function readSnapshot(request: Request): Promise<Snapshot> {
  const c = await context();
  const url = new URL(request.url);
  const today = manilaDay();
  const day = date.parse(url.searchParams.get("day") || today);
  const from = date.parse(url.searchParams.get("from") || day),
    to = date.parse(url.searchParams.get("to") || day);
  if (from > to) throw new AppError("Start date must be before end date.");
  const base: any = {
    canSetup:
      !!c.user &&
      !!process.env.FLOR_OWNER_EMAIL &&
      c.user.email.toLowerCase() ===
        process.env.FLOR_OWNER_EMAIL.trim().toLowerCase(),
    user: c.user
      ? { id: c.user.userId, name: c.user.displayName, email: c.user.email }
      : null,
    role: c.owner ? "owner" : c.user ? "customer" : "anonymous",
    customerId: c.customer?.id || null,
    settings: c.settings
      ? { ...c.settings, owner_id: c.owner ? c.settings.owner_id : "" }
      : null,
    today,
    day,
    published: false,
    menu: [],
    foods: [],
    orders: [],
    customers: [],
    payments: [],
    debts: [],
    messages: [],
    entries: [],
    closeout: null,
    stats: {
      sales: 0,
      cash: 0,
      gcash: 0,
      expenses: 0,
      capital: 0,
      withdrawals: 0,
      debt: 0,
      refunds: 0,
      pendingOrders: 0,
      readyOrders: 0,
      portions: 0,
    },
    recent: [],
  };
  if (!c.settings) return base;
  const published = await first(
    "SELECT published FROM menu_days WHERE day=?",
    day,
  );
  base.published = !!published?.published;
  if (c.owner || base.published)
    base.menu = await all<MenuItem>(
      `SELECT m.*, f.image,f.category,f.description FROM menu_items m JOIN foods f ON f.id=m.food_id WHERE m.day=? ${c.owner ? "" : "AND m.enabled=1"} ORDER BY f.category,m.name`,
      day,
    );
  if (c.owner)
    base.foods = await all("SELECT * FROM foods ORDER BY archived,name");
  if (!c.user) return base;
  const scope = c.owner ? "" : "WHERE o.user_id=?";
  const args = c.owner ? [] : [c.user.userId];
  // A small shop's active ledger is fetched together. Aggregate reports and exports
  // query the entire database independently, so totals do not depend on UI filters.
  base.orders = await all<Order>(
    `SELECT o.*, ${paidSql} paid, COALESCE((SELECT SUM(amount) FROM payments WHERE order_id=o.id AND status='pending'),0) pending, COALESCE((SELECT SUM(amount) FROM refunds WHERE order_id=o.id),0) refunded FROM orders o ${scope} ORDER BY o.created_at DESC LIMIT 500`,
    ...args,
  );
  const lines = await all(
    `SELECT i.* FROM order_items i JOIN orders o ON o.id=i.order_id ${scope}`,
    ...args,
  );
  base.orders = base.orders.map((o: Order) => ({
    ...o,
    items: lines.filter((i) => i.order_id === o.id),
  }));
  if (c.owner) {
    base.customers = await all(
      `SELECT c.*, COALESCE((SELECT SUM(o.total-${paidSql}) FROM orders o WHERE o.customer_id=c.id AND o.status='picked_up' AND o.credit=1),0) + COALESCE((SELECT SUM(d.amount-${debtPaidSql}) FROM debts d WHERE d.customer_id=c.id),0) balance FROM customers c ORDER BY c.name`,
    );
    base.debts = await all(
      `SELECT d.*, ${debtPaidSql} paid FROM debts d ORDER BY d.day DESC`,
    );
    base.payments = await all(
      "SELECT p.*, COALESCE(o.customer_name,c.name) customer_name FROM payments p LEFT JOIN orders o ON o.id=p.order_id LEFT JOIN debts d ON d.id=p.debt_id LEFT JOIN customers c ON c.id=d.customer_id ORDER BY p.created_at DESC LIMIT 500",
    );
    base.entries = await all(
      "SELECT * FROM money_entries WHERE day BETWEEN ? AND ? ORDER BY created_at DESC",
      from,
      to,
    );
    base.messages = await all(
      "SELECT * FROM messages ORDER BY created_at DESC LIMIT 500",
    );
    base.closeout = await first("SELECT * FROM closeouts WHERE day=?", day);
    const s = await first(
      `SELECT
      COALESCE((SELECT SUM(total) FROM orders WHERE status='picked_up' AND fulfilled_day BETWEEN ?1 AND ?2),0) sales,
      COALESCE((SELECT SUM(amount) FROM payments WHERE status='verified' AND method='cash' AND day BETWEEN ?1 AND ?2),0) cash,
      COALESCE((SELECT SUM(amount) FROM payments WHERE status='verified' AND method='gcash' AND day BETWEEN ?1 AND ?2),0) gcash,
      COALESCE((SELECT SUM(amount) FROM money_entries WHERE kind='expense' AND day BETWEEN ?1 AND ?2),0) expenses,
      COALESCE((SELECT SUM(amount) FROM money_entries WHERE kind='capital' AND day BETWEEN ?1 AND ?2),0) capital,
      COALESCE((SELECT SUM(amount) FROM money_entries WHERE kind='withdrawal' AND day BETWEEN ?1 AND ?2),0) withdrawals,
      COALESCE((SELECT SUM(amount) FROM refunds WHERE day BETWEEN ?1 AND ?2),0) refunds`,
      from,
      to,
    );
    base.stats = {
      ...base.stats,
      ...s,
      debt: base.customers.reduce((n: number, x: Customer) => n + x.balance, 0),
      pendingOrders: base.orders.filter(
        (o: Order) => o.day === day && o.status === "pending",
      ).length,
      readyOrders: base.orders.filter(
        (o: Order) => o.day === day && o.status === "ready",
      ).length,
      portions: base.menu
        .filter((m: MenuItem) => m.enabled)
        .reduce(
          (n: number, m: MenuItem) =>
            n + m.capacity - m.reserved - m.sold - m.waste,
          0,
        ),
    };
    base.recent = await all(
      "SELECT fulfilled_day AS day,SUM(total) AS amount FROM orders WHERE status='picked_up' AND fulfilled_day BETWEEN ? AND ? GROUP BY fulfilled_day",
      shiftDay(day, -6),
      day,
    );
  } else if (c.customer) {
    base.payments = await all(
      "SELECT p.* FROM payments p JOIN orders o ON o.id=p.order_id WHERE o.user_id=? ORDER BY p.created_at DESC",
      c.user.userId,
    );
    base.messages = await all(
      "SELECT * FROM messages WHERE customer_id=? ORDER BY created_at DESC LIMIT 200",
      c.customer.id,
    );
  }
  return base;
}

export async function action(request: Request) {
  return withTransaction(() => performAction(request));
}
async function performAction(request: Request) {
  assertOrigin(request);
  const c = await context();
  const u = signed(c);
  const input = (await request.json()) as Record<string, unknown>;
  const actionName = z.string().parse(input.action);
  const today = manilaDay();
  const created = now();
  if (actionName === "setup") {
    // A public deployment may only be initialized by the explicitly designated
    // owner, whose email has been confirmed by Supabase Auth.
    if (
      !process.env.FLOR_OWNER_EMAIL ||
      u.email.toLowerCase() !==
        process.env.FLOR_OWNER_EMAIL.trim().toLowerCase()
    )
      throw new AppError(
        "Only Flor’s designated account can open this kitchen.",
        403,
      );
    if (c.settings) throw new AppError("This shop is already set up.", 409);
    const data = z.object({ demo: z.boolean().default(false) }).parse(input);
    await setup(u.userId, data.demo);
    return Response.json({ ok: true });
  }
  if (!c.settings)
    throw new AppError("The owner needs to set up this shop first.", 409);
  if (actionName === "profile") {
    const d = z
      .object({
        name: z.string().trim().min(2).max(80),
        phone: z.string().trim().min(7).max(20),
      })
      .parse(input);
    const customer = await ensureCustomer(c, d.name, d.phone);
    await q(
      "UPDATE customers SET name=?,phone=? WHERE id=?",
      d.name,
      d.phone,
      customer.id,
    ).run();
    return Response.json({ ok: true });
  }
  if (actionName === "order") {
    const d = z
      .object({
        requestId: z.string().uuid(),
        day: date,
        pickupTime: time,
        items: z
          .array(z.object({ id, quantity: z.number().int().min(1).max(500) }))
          .min(1)
          .max(30),
        note: z.string().max(500).default(""),
        expectedTotal: amount,
        walkin: z.boolean().default(false),
        customerId: id.nullable().optional(),
        customerName: z.string().trim().max(80).optional(),
        cash: z.number().int().min(0).max(100_000_000).default(0),
        gcash: z.number().int().min(0).max(100_000_000).default(0),
        reference: z.string().trim().max(100).optional(),
        credit: z.boolean().default(false),
      })
      .parse(input);
    if (
      await first(
        "SELECT id FROM orders WHERE id=? AND user_id=?",
        d.requestId,
        u.userId,
      )
    )
      return Response.json({ ok: true, id: d.requestId });
    if (d.walkin) owner(c);
    if (d.day < today || d.day > shiftDay(today, 1))
      throw new AppError("Choose today or tomorrow for pickup.");
    await openDay(d.day);
    if (
      d.pickupTime < c.settings.pickup_start ||
      d.pickupTime > c.settings.pickup_end
    )
      throw new AppError("Please choose a time within the pickup hours.");
    const menu = await first("SELECT * FROM menu_days WHERE day=?", d.day);
    if (!menu?.published)
      throw new AppError("This menu is not published yet.", 409);
    if (!d.walkin) {
      const localTime = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Manila",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date());
      if (d.day > today && localTime >= c.settings.cutoff)
        throw new AppError(
          "Tomorrow’s preorder cutoff has passed. Please message Flor.",
        );
      if (d.day === today && localTime > c.settings.pickup_end)
        throw new AppError("Pickup hours have ended for today.");
    }
    let customerId: string | null = null,
      customerName = d.customerName || "Walk-in customer";
    if (d.walkin) {
      if (d.customerId) {
        const customer = await first<Customer>(
          "SELECT * FROM customers WHERE id=?",
          d.customerId,
        );
        if (!customer) throw new AppError("Customer not found.");
        customerId = customer.id;
        customerName = customer.name;
      }
    } else {
      const customer = await ensureCustomer(c);
      if (!customer.phone)
        throw new AppError("Please add your name and phone number first.");
      customerId = customer.id;
      customerName = customer.name;
    }
    if (d.walkin && d.day !== today)
      throw new AppError("Walk-in sales must be recorded for today.");
    const ids = new Set(d.items.map((x) => x.id));
    if (ids.size !== d.items.length)
      throw new AppError("Each dish can appear only once.");
    let total = 0;
    const lines: any[] = [];
    for (const item of d.items) {
      const m = await first<MenuItem>(
        "SELECT * FROM menu_items WHERE id=? AND day=? AND enabled=1",
        item.id,
        d.day,
      );
      if (!m)
        throw new AppError("A selected dish is no longer available.", 409);
      total += m.price * item.quantity;
      lines.push({ ...m, quantity: item.quantity });
    }
    if (d.expectedTotal !== total)
      throw new AppError(
        "Prices changed. Refresh and review the order before submitting.",
        409,
      );
    if (d.walkin && d.cash + d.gcash > total)
      throw new AppError(
        "Enter the net payment after change, up to the sale total.",
      );
    if (d.walkin && d.gcash > 0 && !d.reference)
      throw new AppError("Enter the GCash transaction reference.");
    if (d.walkin && d.credit && !customerId)
      throw new AppError("Select a named customer for utang.");
    const batch = [
      q(
        "INSERT INTO orders (id,customer_id,customer_name,user_id,day,pickup_time,source,status,total,credit,note,created_at) VALUES (?,?,?,?,?,?,?,'pending',?,?,?,?)",
        d.requestId,
        customerId,
        customerName,
        u.userId,
        d.day,
        d.pickupTime,
        d.walkin ? "walkin" : "preorder",
        total,
        d.walkin && d.credit ? 1 : 0,
        d.note,
        created,
      ),
    ];
    for (const l of lines)
      batch.push(
        q(
          "INSERT INTO order_items (id,order_id,menu_item_id,name,serving,price,quantity) VALUES (?,?,?,?,?,?,?)",
          uuid(),
          d.requestId,
          l.id,
          l.name,
          l.serving,
          l.price,
          l.quantity,
        ),
      );
    if (d.walkin) {
      batch.push(
        q("UPDATE orders SET status='accepted' WHERE id=?", d.requestId),
      );
      if (d.cash)
        batch.push(
          paymentInsert(
            uuid(),
            d.requestId,
            null,
            d.cash,
            "cash",
            "verified",
            null,
            null,
            today,
            created,
          ),
        );
      if (d.gcash)
        batch.push(
          paymentInsert(
            uuid(),
            d.requestId,
            null,
            d.gcash,
            "gcash",
            "verified",
            d.reference!,
            null,
            today,
            created,
          ),
        );
      batch.push(
        q(
          "UPDATE orders SET status='picked_up',fulfilled_day=?,fulfilled_at=? WHERE id=?",
          today,
          created,
          d.requestId,
        ),
      );
    }
    batch.push(
      log(
        u.userId,
        d.walkin ? "Walk-in sale" : "Preorder requested",
        d.requestId,
      ),
    );
    await db().batch(batch);
    return Response.json({ ok: true, id: d.requestId });
  }
  if (actionName === "orderStatus") {
    const d = z
      .object({
        id,
        status: z.enum([
          "accepted",
          "ready",
          "picked_up",
          "declined",
          "cancelled",
          "no_show",
        ]),
        credit: z.boolean().default(false),
        restock: z.boolean().default(true),
        note: z.string().max(500).optional(),
      })
      .parse(input);
    const o = await getOrder(d.id, c);
    if (!c.owner && !(d.status === "cancelled" && o.status === "pending"))
      throw new AppError("Only Flor can update this order.", 403);
    if (!transitions[o.status]?.includes(d.status))
      throw new AppError(
        "This order has already changed. Refresh to see its status.",
        409,
      );
    await openDay(o.day);
    if (d.status === "picked_up") {
      if (o.day !== today)
        throw new AppError("Food can only be handed over on its pickup date.");
      await openDay(today);
      if (d.credit && !o.customer_id)
        throw new AppError("Select a named customer before allowing utang.");
    }
    const r = await db().batch([
      q(
        "UPDATE orders SET status=?,credit=?,restock=?,fulfilled_day=?,fulfilled_at=?,note=? WHERE id=? AND status=?",
        d.status,
        d.credit ? 1 : o.credit,
        d.restock ? 1 : 0,
        d.status === "picked_up" ? today : null,
        d.status === "picked_up" ? created : null,
        d.note ?? o.note,
        o.id,
        o.status,
      ),
      log(u.userId, "Order " + d.status, o.id),
    ]);
    if (!r[0].meta.changes)
      throw new AppError("This order has already changed.", 409);
    return Response.json({ ok: true });
  }
  if (actionName === "payment") {
    const d = z
      .object({
        requestId: z.string().uuid(),
        orderId: id.nullable().optional(),
        debtId: id.nullable().optional(),
        asProof: z.boolean().default(false),
        amount,
        method,
        reference: z.string().trim().max(100).optional(),
        fileId: id.nullable().optional(),
        note: z.string().max(500).default(""),
      })
      .parse(input);
    if (!!d.orderId === !!d.debtId)
      throw new AppError("Choose one order or debt balance.");
    if (d.debtId) owner(c);
    let customerId: string | null = null;
    if (d.orderId) {
      const o = await getOrder(d.orderId, c);
      customerId = o.customer_id;
      if (!["accepted", "ready", "picked_up"].includes(o.status))
        throw new AppError("Flor must accept the order before payment.");
    } else {
      const debt = await first("SELECT * FROM debts WHERE id=?", d.debtId);
      if (!debt) throw new AppError("Debt record not found.");
      customerId = debt.customer_id;
    }
    await checkFile(d.fileId, customerId);
    if ((!c.owner || d.asProof) && (d.method !== "gcash" || !d.fileId))
      throw new AppError("Attach your GCash payment screenshot.");
    if (d.method === "gcash" && !d.reference)
      throw new AppError("Enter the GCash reference number.");
    await openDay(today);
    if (await first("SELECT id FROM payments WHERE id=?", d.requestId))
      return Response.json({ ok: true });
    await db().batch([
      paymentInsert(
        d.requestId,
        d.orderId || null,
        d.debtId || null,
        d.amount,
        d.method,
        c.owner && !d.asProof ? "verified" : "pending",
        d.reference || null,
        d.fileId || null,
        today,
        created,
        d.note,
      ),
      log(
        u.userId,
        c.owner && !d.asProof ? "Payment received" : "Payment proof submitted",
        d.requestId,
      ),
    ]);
    return Response.json({ ok: true });
  }
  if (actionName === "message") {
    const d = z
      .object({
        requestId: z.string().uuid(),
        customerId: id.optional(),
        body: z.string().trim().max(2000).default(""),
        fileId: id.nullable().optional(),
        orderId: id.nullable().optional(),
      })
      .parse(input);
    if (!d.body && !d.fileId)
      throw new AppError("Write a message or attach an image.");
    const customerId = c.owner ? d.customerId : (await ensureCustomer(c)).id;
    if (!customerId) throw new AppError("Choose a customer.");
    if (!(await first("SELECT id FROM customers WHERE id=?", customerId)))
      throw new AppError("Customer not found.");
    await checkFile(d.fileId, customerId);
    if (d.orderId) {
      const o = await getOrder(d.orderId, c);
      if (o.customer_id !== customerId)
        throw new AppError("This order belongs to a different customer.");
    }
    await q(
      "INSERT OR IGNORE INTO messages (id,customer_id,sender,body,file_id,order_id,created_at) VALUES (?,?,?,?,?,?,?)",
      d.requestId,
      customerId,
      c.owner ? "owner" : "customer",
      d.body,
      d.fileId || null,
      d.orderId || null,
      created,
    ).run();
    return Response.json({ ok: true });
  }
  if (actionName === "readMessages") {
    const d = z.object({ customerId: id }).parse(input);
    if (!c.owner && c.customer?.id !== d.customerId)
      throw new AppError("This conversation is private.", 403);
    await q(
      "UPDATE messages SET read_at=? WHERE customer_id=? AND sender=? AND read_at IS NULL",
      created,
      d.customerId,
      c.owner ? "customer" : "owner",
    ).run();
    return Response.json({ ok: true });
  }
  owner(c);
  if (actionName === "archiveFood") {
    const d = z.object({ id, archived: z.boolean() }).parse(input);
    await db().batch([
      q("UPDATE foods SET archived=? WHERE id=?", d.archived ? 1 : 0, d.id),
      log(u.userId, d.archived ? "Food archived" : "Food restored", d.id),
    ]);
    return Response.json({ ok: true });
  }
  if (actionName === "menuItem") {
    const d = z
      .object({
        id,
        capacity: z.number().int().min(0).max(10000),
        price: amount,
        enabled: z.boolean(),
        waste: z.number().int().min(0).max(10000).optional(),
      })
      .parse(input);
    const m = await first<MenuItem>(
      "SELECT * FROM menu_items WHERE id=?",
      d.id,
    );
    if (!m) throw new AppError("Menu item not found.");
    if (m.day < today) throw new AppError("Past menus are kept as history.");
    await openDay(m.day);
    await db().batch([
      q(
        "UPDATE menu_items SET capacity=?,price=?,enabled=?,waste=? WHERE id=?",
        d.capacity,
        d.price,
        d.enabled ? 1 : 0,
        d.waste ?? m.waste,
        d.id,
      ),
      log(u.userId, "Menu item updated", d.id),
    ]);
    return Response.json({ ok: true });
  }
  if (actionName === "copyMenu") {
    const d = z.object({ day: date, from: date.optional() }).parse(input);
    if (d.day < today || d.day > shiftDay(today, 1))
      throw new AppError("Choose today or tomorrow.");
    await openDay(d.day);
    const batch = [
      q("INSERT OR IGNORE INTO menu_days (day,published) VALUES (?,0)", d.day),
    ];
    const source = d.from
      ? await all<MenuItem>(
          "SELECT m.* FROM menu_items m JOIN foods f ON f.id=m.food_id WHERE m.day=? AND f.archived=0",
          d.from,
        )
      : [];
    const catalog = source.length
      ? source
      : await all<any>(
          "SELECT id food_id,name,serving,price,20 capacity,1 enabled FROM foods WHERE archived=0",
        );
    if (!catalog.length)
      throw new AppError("Add a dish to your food list first.");
    for (const f of catalog)
      batch.push(
        q(
          "INSERT OR IGNORE INTO menu_items (id,day,food_id,name,serving,price,capacity,reserved,sold,waste,enabled) VALUES (?,?,?,?,?,?,?,0,0,0,?)",
          uuid(),
          d.day,
          f.food_id,
          f.name,
          f.serving,
          f.price,
          f.capacity,
          f.enabled,
        ),
      );
    batch.push(log(u.userId, "Menu copied", d.day));
    await db().batch(batch);
    return Response.json({ ok: true });
  }
  if (actionName === "publish") {
    const d = z.object({ day: date, published: z.boolean() }).parse(input);
    if (d.day < today) throw new AppError("Past menus are kept as history.");
    await openDay(d.day);
    if (
      d.published &&
      !(await first(
        "SELECT id FROM menu_items WHERE day=? AND enabled=1 AND capacity>reserved+sold+waste",
        d.day,
      ))
    )
      throw new AppError("Add at least one available dish before publishing.");
    await db().batch([
      q(
        "UPDATE menu_days SET published=? WHERE day=?",
        d.published ? 1 : 0,
        d.day,
      ),
      log(u.userId, d.published ? "Menu published" : "Menu paused", d.day),
    ]);
    return Response.json({ ok: true });
  }
  if (actionName === "food") {
    const d = z
      .object({
        id: id.optional(),
        name: z.string().trim().min(2).max(80),
        description: z.string().max(250).default(""),
        category: z.enum(["Ulam", "Gulay", "Rice & sides", "Merienda"]),
        serving: z.string().trim().min(1).max(60),
        price: amount,
        image: z.string().max(2000).default(""),
        day: date.optional(),
      })
      .parse(input);
    if (
      d.image &&
      !d.image.startsWith("/images/") &&
      !/^\/api\/files\/[a-f0-9-]{36}$/.test(d.image)
    )
      throw new AppError("Use an uploaded food image.");
    if (
      d.image.startsWith("/api/files/") &&
      !(await first(
        "SELECT id FROM files WHERE id=? AND purpose='food'",
        d.image.split("/").pop(),
      ))
    )
      throw new AppError("Food image not found.");
    const foodId = d.id || uuid();
    const batch = [
      q(
        "INSERT INTO foods (id,name,description,category,serving,price,image,archived) VALUES (?,?,?,?,?,?,?,0) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,category=excluded.category,serving=excluded.serving,price=excluded.price,image=excluded.image",
        foodId,
        d.name,
        d.description,
        d.category,
        d.serving,
        d.price,
        d.image,
      ),
    ];
    if (d.day) {
      await openDay(d.day);
      if (d.day < today) throw new AppError("Choose today or a future menu.");
      batch.push(
        q(
          "INSERT OR IGNORE INTO menu_days (day,published) VALUES (?,0)",
          d.day,
        ),
      );
      batch.push(
        q(
          "INSERT OR IGNORE INTO menu_items (id,day,food_id,name,serving,price,capacity,reserved,sold,waste,enabled) VALUES (?,?,?,?,?,?,20,0,0,0,1)",
          uuid(),
          d.day,
          foodId,
          d.name,
          d.serving,
          d.price,
        ),
      );
    }
    batch.push(log(u.userId, "Food saved", foodId));
    await db().batch(batch);
    return Response.json({ ok: true });
  }
  if (actionName === "customer") {
    const d = z
      .object({
        id: id.optional(),
        name: z.string().trim().min(2).max(80),
        phone: z.string().trim().max(20).default(""),
      })
      .parse(input);
    const customerId = d.id || uuid();
    await db().batch([
      q(
        "INSERT INTO customers (id,name,phone) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,phone=excluded.phone",
        customerId,
        d.name,
        d.phone,
      ),
      log(u.userId, "Customer saved", customerId),
    ]);
    return Response.json({ ok: true, id: customerId });
  }
  if (actionName === "openingDebt") {
    const d = z
      .object({
        requestId: z.string().uuid(),
        customerId: id,
        amount,
        day: date,
        note: z.string().trim().min(1).max(500),
      })
      .parse(input);
    if (d.day > today)
      throw new AppError("Opening balances must be dated today or earlier.");
    await db().batch([
      q(
        "INSERT INTO debts (id,customer_id,amount,day,note) VALUES (?,?,?,?,?)",
        d.requestId,
        d.customerId,
        d.amount,
        d.day,
        d.note,
      ),
      log(u.userId, "Opening utang recorded", d.requestId),
    ]);
    return Response.json({ ok: true });
  }
  if (actionName === "money") {
    const d = z
      .object({
        requestId: z.string().uuid(),
        kind: z.enum([
          "expense",
          "capital",
          "withdrawal",
          "transfer_in",
          "transfer_out",
        ]),
        category: z.string().trim().min(1).max(80),
        amount,
        method,
        note: z.string().max(500).default(""),
        day: date,
      })
      .parse(input);
    if (d.day > today)
      throw new AppError("Record money only after it has moved.");
    await openDay(d.day);
    if (await first("SELECT id FROM money_entries WHERE id=?", d.requestId))
      return Response.json({ ok: true });
    await db().batch([
      q(
        "INSERT INTO money_entries (id,kind,category,amount,method,note,day,created_at) VALUES (?,?,?,?,?,?,?,?)",
        d.requestId,
        d.kind,
        d.category,
        d.amount,
        d.method,
        d.note,
        d.day,
        created,
      ),
      log(u.userId, "Money " + d.kind, d.requestId),
    ]);
    return Response.json({ ok: true });
  }
  if (actionName === "verifyPayment") {
    const d = z
      .object({
        id,
        verified: z.boolean(),
        note: z.string().max(500).default(""),
      })
      .parse(input);
    await openDay(today);
    const p = await first<Payment>("SELECT * FROM payments WHERE id=?", d.id);
    if (!p || p.status !== "pending")
      throw new AppError("This payment has already been reviewed.", 409);
    await db().batch([
      q(
        "UPDATE payments SET status=?,day=?,verified_at=?,note=? WHERE id=? AND status='pending'",
        d.verified ? "verified" : "rejected",
        today,
        d.verified ? created : null,
        d.note,
        d.id,
      ),
      log(
        u.userId,
        d.verified ? "GCash received" : "Payment needs correction",
        d.id,
      ),
    ]);
    return Response.json({ ok: true });
  }
  if (actionName === "refund") {
    const d = z
      .object({
        requestId: z.string().uuid(),
        orderId: id,
        amount,
        method,
        reference: z.string().trim().max(100).optional(),
      })
      .parse(input);
    await openDay(today);
    const o = await getOrder(d.orderId, c);
    if (!["cancelled", "declined", "no_show"].includes(o.status))
      throw new AppError(
        "Cancel the uncollected order before recording a refund.",
      );
    if (d.method === "gcash" && !d.reference)
      throw new AppError("Enter the refund transaction reference.");
    await db().batch([
      q(
        "INSERT INTO refunds (id,order_id,amount,method,day,created_at,reference) VALUES (?,?,?,?,?,?,?)",
        d.requestId,
        d.orderId,
        d.amount,
        d.method,
        today,
        created,
        d.reference || null,
      ),
      log(u.userId, "Refund sent", d.requestId),
    ]);
    return Response.json({ ok: true });
  }
  if (actionName === "settings") {
    const d = z
      .object({
        shopName: z.string().trim().min(2).max(80),
        location: z.string().trim().min(3).max(250),
        pickupStart: time,
        pickupEnd: time,
        cutoff: time,
        gcashName: z.string().max(80),
        gcashNumber: z.string().max(20),
        notice: z.string().max(500),
      })
      .parse(input);
    if (d.pickupEnd <= d.pickupStart)
      throw new AppError("Pickup end must be after pickup start.");
    await db().batch([
      q(
        "UPDATE settings SET shop_name=?,location=?,pickup_start=?,pickup_end=?,cutoff=?,gcash_name=?,gcash_number=?,notice=?,configured=1 WHERE id=1",
        d.shopName,
        d.location,
        d.pickupStart,
        d.pickupEnd,
        d.cutoff,
        d.gcashName,
        d.gcashNumber,
        d.notice,
      ),
      log(u.userId, "Shop settings updated", "shop"),
    ]);
    return Response.json({ ok: true });
  }
  if (actionName === "closeDay") {
    const d = z
      .object({
        day: date,
        openingCash: z.number().int().min(0).max(100_000_000),
        actualCash: z.number().int().min(0).max(100_000_000),
        note: z.string().max(500).default(""),
      })
      .parse(input);
    if (d.day > today) throw new AppError("A future day cannot be closed.");
    if (
      await first(
        "SELECT id FROM orders WHERE day=? AND status IN ('pending','accepted','ready')",
        d.day,
      )
    )
      throw new AppError(
        "Resolve pending and uncollected orders before closing the day.",
      );
    await db().batch([
      q(
        `INSERT INTO closeouts (day,opening_cash,actual_cash,expected_cash,note,created_at) SELECT ?1,?2,?3,?2+COALESCE((SELECT SUM(amount) FROM payments WHERE status='verified' AND method='cash' AND day=?1),0)+COALESCE((SELECT SUM(CASE WHEN kind IN ('capital','transfer_in') THEN amount ELSE -amount END) FROM money_entries WHERE method='cash' AND day=?1),0)-COALESCE((SELECT SUM(amount) FROM refunds WHERE method='cash' AND day=?1),0),?4,?5`,
        d.day,
        d.openingCash,
        d.actualCash,
        d.note,
        created,
      ),
      log(u.userId, "Day closed", d.day),
    ]);
    return Response.json({ ok: true });
  }
  if (actionName === "reopenDay") {
    const d = z
      .object({ day: date, reason: z.string().trim().min(5).max(500) })
      .parse(input);
    const previous = await first("SELECT * FROM closeouts WHERE day=?", d.day);
    if (!previous) throw new AppError("This day is already open.", 409);
    await db().batch([
      q("DELETE FROM closeouts WHERE day=?", d.day),
      log(
        u.userId,
        "Day reopened",
        d.day,
        JSON.stringify({ reason: d.reason, previousCloseout: previous }),
      ),
    ]);
    return Response.json({ ok: true });
  }
  if (actionName === "resetDemo") {
    const d = z.object({ confirmation: z.literal("START FRESH") }).parse(input);
    if (!c.settings.demo)
      throw new AppError("Only sample records can be reset.");
    const statements = [
      "messages",
      "payments",
      "refunds",
      "order_items",
      "orders",
      "debts",
      "files",
      "closeouts",
      "money_entries",
      "menu_items",
      "menu_days",
      "customers",
    ].map((t) =>
      q(
        t === "files"
          ? "DELETE FROM files WHERE purpose='chat'"
          : "DELETE FROM " + t,
      ),
    );
    statements.push(
      q("UPDATE settings SET demo=0,configured=0 WHERE id=1"),
      log(u.userId, "Sample shop cleared", "shop", d.confirmation),
    );
    await db().batch(statements);
    return Response.json({ ok: true });
  }
  throw new AppError("Unknown action.", 404);
}

function paymentInsert(
  paymentId: string,
  orderId: string | null,
  debtId: string | null,
  value: number,
  paymentMethod: string,
  status: string,
  reference: string | null,
  fileId: string | null,
  day: string,
  created: string,
  note = "",
) {
  return q(
    "INSERT INTO payments (id,order_id,debt_id,amount,method,status,reference,file_id,day,created_at,verified_at,note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
    paymentId,
    orderId,
    debtId,
    value,
    paymentMethod,
    status,
    reference?.toUpperCase() || null,
    fileId,
    day,
    created,
    status === "verified" ? created : null,
    note,
  );
}

export async function upload(request: Request) {
  assertOrigin(request);
  const c = await context();
  signed(c);
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 5_300_000)
    throw new AppError("Choose an image smaller than 5 MB.");
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 5_000_000)
    throw new AppError("Choose a JPG, PNG, or WebP image up to 5 MB.");
  const purpose = form.get("purpose") === "food" ? "food" : "chat";
  if (purpose === "food") owner(c);
  const customerId =
    purpose === "food"
      ? null
      : c.owner
        ? String(form.get("customerId") || "")
        : (await ensureCustomer(c)).id;
  if (
    purpose !== "food" &&
    !(await first("SELECT id FROM customers WHERE id=?", customerId))
  )
    throw new AppError("Choose a customer first.");
  const data = await file.arrayBuffer();
  const b = new Uint8Array(data);
  let mime = "";
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) mime = "image/jpeg";
  if (b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71)
    mime = "image/png";
  if (
    String.fromCharCode(...b.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...b.slice(8, 12)) === "WEBP"
  )
    mime = "image/webp";
  if (!mime)
    throw new AppError("Only JPG, PNG, and WebP images are supported.");
  const fileId = uuid(),
    key = "private/" + uuid();
  await storage.put(key, data, mime);
  try {
    await q(
      "INSERT INTO files (id,customer_id,purpose,key,mime,name,size) VALUES (?,?,?,?,?,?,?)",
      fileId,
      customerId,
      purpose,
      key,
      mime,
      file.name.slice(0, 150),
      file.size,
    ).run();
  } catch (e) {
    await storage.delete(key);
    throw e;
  }
  return Response.json({ id: fileId, url: "/api/files/" + fileId });
}
export async function getFile(fileId: string): Promise<Response> {
  return withTransaction(() => readFile(fileId), true);
}
async function readFile(fileId: string) {
  const f = await first("SELECT * FROM files WHERE id=?", fileId);
  if (!f) throw new AppError("Image not found.", 404);
  if (f.purpose !== "food") {
    const c = await context();
    signed(c);
    if (!c.owner && f.customer_id !== c.customer?.id)
      throw new AppError("This image is private.", 403);
  }
  const object = await storage.get(f.key);
  if (!object) throw new AppError("Image not found.", 404);
  return new Response(object, {
    headers: {
      "Content-Type": f.mime,
      "Cache-Control":
        f.purpose === "food" ? "public, max-age=3600" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
export async function exportData(request: Request): Promise<Response> {
  return withTransaction(() => readExport(request), true);
}
async function readExport(request: Request) {
  const c = await context();
  owner(c);
  const type = new URL(request.url).searchParams.get("type") || "backup";
  if (type === "backup") {
    const tables = [
      "settings",
      "customers",
      "foods",
      "menu_days",
      "menu_items",
      "orders",
      "order_items",
      "debts",
      "payments",
      "refunds",
      "money_entries",
      "messages",
      "files",
      "closeouts",
      "audit",
    ];
    const data: Record<string, unknown> = {
      format: "flors-kainan-backup-v1",
      exportedAt: now(),
    };
    for (const table of tables)
      data[table] = await all("SELECT * FROM " + table);
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="flors-kainan-${manilaDay()}.json"`,
        "Cache-Control": "no-store",
      },
    });
  }
  const queries: Record<string, string> = {
    sales: "SELECT * FROM orders ORDER BY created_at DESC",
    payments: "SELECT * FROM payments ORDER BY created_at DESC",
    expenses: "SELECT * FROM money_entries ORDER BY day DESC",
    utang: `SELECT c.name,c.phone,d.id,d.day,d.amount,${debtPaidSql} paid FROM debts d JOIN customers c ON c.id=d.customer_id UNION ALL SELECT c.name,c.phone,o.id,o.day,o.total,${paidSql} paid FROM orders o JOIN customers c ON c.id=o.customer_id WHERE o.credit=1 AND o.status='picked_up'`,
    audit: "SELECT * FROM audit ORDER BY created_at DESC",
  };
  if (!queries[type]) throw new AppError("Export not found.", 404);
  const rows = await all(queries[type]);
  const keys = rows[0] ? Object.keys(rows[0]) : [];
  const escape = (v: unknown) =>
    '"' +
    String(v ?? "")
      .replace(/^[=+@\-\t\r]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  const csv =
    "\uFEFF" +
    [
      keys.map(escape).join(","),
      ...rows.map((r) => keys.map((k) => escape(r[k])).join(",")),
    ].join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="flors-${type}-${manilaDay()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

const starterFoods = [
  [
    "adobo",
    "Chicken Adobo",
    "Tender chicken, slowly simmered in soy, vinegar, and garlic.",
    "Ulam",
    "1 serving",
    6500,
    "/images/adobo.jpg",
  ],
  [
    "sinigang",
    "Sinigang na Baboy",
    "Warm, comforting tamarind broth with pork and fresh vegetables.",
    "Ulam",
    "1 serving",
    7500,
    "/images/sinigang.jpg",
  ],
  [
    "pinakbet",
    "Pinakbet",
    "A colorful mix of vegetables, cooked the way home tastes.",
    "Gulay",
    "1 serving",
    4500,
    "/images/pinakbet.jpg",
  ],
  [
    "lumpia",
    "Lumpiang Shanghai",
    "Golden, crunchy little rolls. A family favorite.",
    "Rice & sides",
    "3 pieces",
    3500,
    "/images/lumpia.jpg",
  ],
  [
    "pancit",
    "Pancit Bihon",
    "Stir-fried rice noodles with vegetables and a squeeze of calamansi.",
    "Merienda",
    "1 serving",
    5000,
    "/images/pancit.jpg",
  ],
  [
    "rice",
    "Steamed Rice",
    "Freshly cooked rice. The perfect partner for your ulam.",
    "Rice & sides",
    "1 cup",
    1500,
    "/images/rice.jpg",
  ],
];
async function setup(userId: string, demo: boolean) {
  const today = manilaDay(),
    tomorrow = shiftDay(today, 1);
  const created = now();
  const batch = [
    q(
      "INSERT INTO settings (id,owner_id,demo,configured) VALUES (1,?,?,0)",
      userId,
      demo ? 1 : 0,
    ),
  ];
  for (const f of starterFoods)
    batch.push(
      q(
        "INSERT INTO foods (id,name,description,category,serving,price,image,archived) VALUES (?,?,?,?,?,?,?,0)",
        ...f,
      ),
    );
  if (demo) {
    for (const day of [today, tomorrow]) {
      batch.push(
        q(
          "INSERT INTO menu_days (day,published) VALUES (?,?)",
          day,
          day === today ? 1 : 0,
        ),
      );
      for (const f of starterFoods)
        batch.push(
          q(
            "INSERT INTO menu_items (id,day,food_id,name,serving,price,capacity,reserved,sold,waste,enabled) VALUES (?,?,?,?,?,?,?,0,0,0,1)",
            day + "-" + f[0],
            day,
            f[0],
            f[1],
            f[4],
            f[5],
            f[0] === "rice" ? 50 : 30,
          ),
        );
    }
    const names = [
      "Maria Santos",
      "Carlo Reyes",
      "Ana Dela Cruz",
      "Jun Mendoza",
      "Grace Flores",
    ];
    for (let i = 0; i < names.length; i++)
      batch.push(
        q(
          "INSERT INTO customers (id,name,phone) VALUES (?,?,?)",
          "sample-c" + i,
          names[i],
          "09•• ••• " + (1200 + i),
        ),
      );
    const records = [
      [
        "sample-o1",
        0,
        "pending",
        [
          ["adobo", 2],
          ["rice", 2],
        ],
        0,
        "cash",
      ],
      [
        "sample-o2",
        1,
        "accepted",
        [
          ["sinigang", 2],
          ["rice", 2],
        ],
        18000,
        "gcash",
      ],
      [
        "sample-o3",
        2,
        "ready",
        [
          ["pinakbet", 2],
          ["lumpia", 1],
        ],
        0,
        "cash",
      ],
      [
        "sample-o4",
        3,
        "picked_up",
        [
          ["adobo", 3],
          ["rice", 3],
        ],
        15000,
        "cash",
      ],
      ["sample-o5", 4, "picked_up", [["pancit", 4]], 20000, "gcash"],
      [
        "sample-o6",
        0,
        "picked_up",
        [
          ["sinigang", 2],
          ["rice", 2],
        ],
        18000,
        "cash",
      ],
      ["sample-o7", 1, "pending", [["lumpia", 3]], 0, "cash"],
    ] as const;
    for (const [orderId, ci, status, items, paid, paymentMethod] of records) {
      const total = items.reduce(
        (sum, [foodId, qty]) =>
          sum + Number(starterFoods.find((x) => x[0] === foodId)![5]) * qty,
        0,
      );
      batch.push(
        q(
          "INSERT INTO orders (id,customer_id,customer_name,day,pickup_time,source,status,total,credit,note,created_at) VALUES (?,?,?,?,?,'preorder','pending',?,1,?,?)",
          orderId,
          "sample-c" + ci,
          names[ci],
          today,
          ci === 2 ? "11:30" : "12:00",
          total,
          ci === 0 ? "Less rice po, thank you!" : "",
          created,
        ),
      );
      for (const [foodId, qty] of items) {
        const f = starterFoods.find((x) => x[0] === foodId)!;
        batch.push(
          q(
            "INSERT INTO order_items (id,order_id,menu_item_id,name,serving,price,quantity) VALUES (?,?,?,?,?,?,?)",
            uuid(),
            orderId,
            today + "-" + foodId,
            f[1],
            f[4],
            f[5],
            qty,
          ),
        );
      }
      if (status !== "pending")
        batch.push(
          q("UPDATE orders SET status='accepted' WHERE id=?", orderId),
        );
      if (paid)
        batch.push(
          paymentInsert(
            uuid(),
            orderId,
            null,
            paid,
            paymentMethod,
            "verified",
            paymentMethod === "gcash" ? "SAMPLE-" + orderId : null,
            null,
            today,
            created,
          ),
        );
      if (status === "ready")
        batch.push(q("UPDATE orders SET status='ready' WHERE id=?", orderId));
      if (status === "picked_up")
        batch.push(
          q(
            "UPDATE orders SET status='picked_up',fulfilled_day=?,fulfilled_at=? WHERE id=?",
            today,
            created,
            orderId,
          ),
        );
    }
    batch.push(
      q(
        "INSERT INTO debts (id,customer_id,amount,day,note) VALUES (?,?,?,?,?)",
        "sample-debt",
        "sample-c2",
        12000,
        shiftDay(today, -2),
        "Sample opening balance from notebook",
      ),
    );
    batch.push(
      q(
        "INSERT INTO messages (id,customer_id,sender,body,created_at) VALUES (?,?,?,?,?)",
        uuid(),
        "sample-c0",
        "customer",
        "Hello po! Pwede po bang 12 noon ko kunin ang order? Salamat!",
        created,
      ),
    );
    batch.push(
      q(
        "INSERT INTO messages (id,customer_id,sender,body,created_at) VALUES (?,?,?,?,?)",
        uuid(),
        "sample-c1",
        "customer",
        "Good morning, Flor! Na-send ko na po ang GCash payment.",
        created,
      ),
    );
    batch.push(
      q(
        "INSERT INTO money_entries (id,kind,category,amount,method,note,day,created_at) VALUES (?,?,?,?,?,?,?,?)",
        uuid(),
        "expense",
        "Ingredients",
        42000,
        "cash",
        "Sample: vegetables and meat",
        today,
        created,
      ),
    );
    batch.push(
      q(
        "INSERT INTO money_entries (id,kind,category,amount,method,note,day,created_at) VALUES (?,?,?,?,?,?,?,?)",
        uuid(),
        "capital",
        "Dagdag puhunan",
        100000,
        "cash",
        "Sample: opening cash contribution",
        today,
        created,
      ),
    );
    for (let i = 1; i <= 6; i++) {
      const day = shiftDay(today, -i),
        oid = "sample-history-" + i,
        mid = "sample-menu-" + i,
        qty = 15 + i + (i % 2) * 4,
        total = qty * 6500;
      batch.push(q("INSERT INTO menu_days (day,published) VALUES (?,1)", day));
      batch.push(
        q(
          "INSERT INTO menu_items (id,day,food_id,name,serving,price,capacity) VALUES (?,?,'adobo','Chicken Adobo','1 serving',6500,30)",
          mid,
          day,
        ),
      );
      batch.push(
        q(
          "INSERT INTO orders (id,customer_name,day,source,status,total,created_at) VALUES (?,'Sample walk-in sales',?,'walkin','pending',?,?)",
          oid,
          day,
          total,
          created,
        ),
      );
      batch.push(
        q(
          "INSERT INTO order_items (id,order_id,menu_item_id,name,serving,price,quantity) VALUES (?,?,?,'Chicken Adobo','1 serving',6500,?)",
          uuid(),
          oid,
          mid,
          qty,
        ),
      );
      batch.push(q("UPDATE orders SET status='accepted' WHERE id=?", oid));
      batch.push(
        paymentInsert(
          uuid(),
          oid,
          null,
          total,
          "cash",
          "verified",
          null,
          null,
          day,
          created,
        ),
      );
      batch.push(
        q(
          "UPDATE orders SET status='picked_up',fulfilled_day=?,fulfilled_at=? WHERE id=?",
          day,
          created,
          oid,
        ),
      );
    }
  }
  batch.push(
    log(userId, demo ? "Sample shop started" : "Shop created", "shop"),
  );
  await db().batch(batch);
}
