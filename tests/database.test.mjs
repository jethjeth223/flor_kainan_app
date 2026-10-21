import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import {
  manilaDay,
  shiftDay,
  money,
  available,
  paymentLabel,
} from "../lib/domain.ts";
const migration = readdirSync(new URL("../drizzle/", import.meta.url))
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(new URL("../drizzle/" + f, import.meta.url), "utf8"))
  .join("\n");
function kitchen(capacity = 5) {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON;" + migration);
  db.exec(
    "INSERT INTO customers(id,name) VALUES ('c','Suki');INSERT INTO foods(id,name,price) VALUES ('f','Adobo',10000);INSERT INTO menu_days(day,published) VALUES ('2026-10-22',1),('2026-10-23',1);INSERT INTO menu_items(id,day,food_id,name,serving,price,capacity) VALUES ('m','2026-10-22','f','Adobo','1 serving',10000," +
      capacity +
      ");",
  );
  return db;
}
function order(
  db,
  id,
  qty = 1,
  { customer = "c", day = "2026-10-22", menu = "m", price = 10000 } = {},
) {
  db.prepare(
    "INSERT INTO orders(id,customer_id,customer_name,day,total,created_at) VALUES (?,?,'Suki',?,?,'2026-10-22T02:00:00Z')",
  ).run(id, customer, day, qty * price);
  db.prepare(
    "INSERT INTO order_items(id,order_id,menu_item_id,name,serving,price,quantity) VALUES (?,?,?,'Adobo','1 serving',?,?)",
  ).run(id + "-line", id, menu, price, qty);
}
function status(db, id, status, credit = 0) {
  db.prepare(
    "UPDATE orders SET status=?,credit=?,fulfilled_day=day,fulfilled_at=created_at WHERE id=?",
  ).run(status, credit, id);
}
function pay(
  db,
  id,
  orderId,
  value,
  { method = "cash", status = "verified", ref = null, day = "2026-10-22" } = {},
) {
  db.prepare(
    "INSERT INTO payments(id,order_id,amount,method,status,reference,day,created_at) VALUES (?,?,?,?,?,?,?,'2026-10-22T02:00:00Z')",
  ).run(id, orderId, value, method, status, ref, day);
}
const stock = (db) => db.prepare("SELECT * FROM menu_items WHERE id='m'").get();
test("pending requests do not reserve; preorders and walk-ins consume the same stock", () => {
  const db = kitchen(3);
  order(db, "pre", 2);
  assert.equal(stock(db).reserved, 0);
  status(db, "pre", "accepted");
  assert.equal(stock(db).reserved, 2);
  order(db, "walk", 1);
  status(db, "walk", "accepted");
  pay(db, "p", "walk", 10000);
  status(db, "walk", "picked_up");
  assert.equal(stock(db).sold, 1);
  assert.equal(available(stock(db)), 0);
  order(db, "late", 1);
  assert.throws(() => status(db, "late", "accepted"), /Insufficient portions/);
  assert.equal(stock(db).reserved, 2);
});
test("a multi-dish order cannot partially reserve when one dish runs out", () => {
  const db = kitchen(2);
  db.exec(
    "INSERT INTO foods(id,name,price) VALUES ('f2','Rice',1000);INSERT INTO menu_items(id,day,food_id,name,serving,price,capacity) VALUES ('m2','2026-10-22','f2','Rice','1 cup',1000,0)",
  );
  order(db, "o");
  db.exec(
    "INSERT INTO order_items(id,order_id,menu_item_id,name,serving,price,quantity) VALUES ('rice-line','o','m2','Rice','1 cup',1000,1);UPDATE orders SET total=11000 WHERE id='o'",
  );
  assert.throws(() => status(db, "o", "accepted"), /Insufficient portions/);
  assert.equal(stock(db).reserved, 0);
});
test("payment, pickup, and named-customer credit remain separate", () => {
  const db = kitchen();
  order(db, "o");
  status(db, "o", "accepted");
  pay(db, "p", "o", 6000);
  assert.throws(() => status(db, "o", "picked_up"), /Unpaid balance/);
  status(db, "o", "picked_up", 1);
  assert.equal(
    db
      .prepare(
        "SELECT total-(SELECT SUM(amount) FROM payments WHERE order_id='o' AND status='verified') balance FROM orders WHERE id='o'",
      )
      .get().balance,
    4000,
  );
  pay(db, "repay", "o", 4000);
  assert.equal(
    db
      .prepare("SELECT SUM(total) sales FROM orders WHERE status='picked_up'")
      .get().sales,
    10000,
  );
  assert.equal(
    db
      .prepare(
        "SELECT SUM(amount) collected FROM payments WHERE status='verified'",
      )
      .get().collected,
    10000,
  );
});
test("an anonymous walk-in cannot be released on credit", () => {
  const db = kitchen();
  order(db, "o", 1, { customer: null });
  status(db, "o", "accepted");
  assert.throws(() => status(db, "o", "picked_up", 1), /Unpaid balance/);
});
test("proof stays unverified and duplicate GCash references cannot be credited twice", () => {
  const db = kitchen();
  order(db, "o");
  status(db, "o", "accepted");
  pay(db, "proof", "o", 10000, {
    method: "gcash",
    status: "pending",
    ref: "REF-1",
  });
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM payments WHERE status='verified'").get()
      .n,
    0,
  );
  db.exec("UPDATE payments SET status='verified' WHERE id='proof'");
  order(db, "o2");
  status(db, "o2", "accepted");
  assert.throws(
    () => pay(db, "duplicate", "o2", 10000, { method: "gcash", ref: "REF-1" }),
    /UNIQUE/,
  );
  assert.throws(
    () => db.exec("UPDATE payments SET status='rejected' WHERE id='proof'"),
    /immutable/,
  );
});
test("concurrent-looking payment proofs cannot overpay a balance when verified", () => {
  const db = kitchen();
  order(db, "o");
  status(db, "o", "accepted");
  pay(db, "p1", "o", 8000, { method: "gcash", status: "pending", ref: "A" });
  pay(db, "p2", "o", 8000, { method: "gcash", status: "pending", ref: "B" });
  db.exec("UPDATE payments SET status='verified' WHERE id='p1'");
  assert.throws(
    () => db.exec("UPDATE payments SET status='verified' WHERE id='p2'"),
    /Overpayment/,
  );
  assert.throws(() => pay(db, "cash", "o", 3000), /Overpayment/);
});
test("closed days reject cash entries, payment changes, and fulfillment", () => {
  const db = kitchen();
  order(db, "o");
  status(db, "o", "accepted");
  db.exec(
    "INSERT INTO closeouts(day,opening_cash,actual_cash,expected_cash,created_at) VALUES ('2026-10-22',0,0,0,'now')",
  );
  assert.throws(() => pay(db, "p", "o", 10000), /Day is closed/);
  assert.throws(() => status(db, "o", "picked_up", 1), /Day is closed/);
  assert.throws(
    () =>
      db.exec(
        "INSERT INTO money_entries(id,kind,category,amount,method,day,created_at) VALUES ('e','expense','Rice',5000,'cash','2026-10-22','now')",
      ),
    /Day is closed/,
  );
});
test("cancellation releases stock only when explicitly returned, otherwise marks it unavailable", () => {
  const db = kitchen();
  order(db, "a", 2);
  status(db, "a", "accepted");
  db.exec("UPDATE orders SET restock=0,status='cancelled' WHERE id='a'");
  assert.equal(stock(db).reserved, 0);
  assert.equal(stock(db).waste, 2);
  assert.equal(available(stock(db)), 3);
  order(db, "b", 2);
  status(db, "b", "accepted");
  db.exec("UPDATE orders SET restock=1,status='cancelled' WHERE id='b'");
  assert.equal(available(stock(db)), 3);
});
test("refunds are separate, bounded, and do not imply an automatic transfer", () => {
  const db = kitchen();
  order(db, "o");
  status(db, "o", "accepted");
  pay(db, "p", "o", 10000);
  status(db, "o", "cancelled");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM refunds").get().n, 0);
  db.exec(
    "INSERT INTO refunds(id,order_id,amount,method,day,created_at) VALUES ('r','o',6000,'cash','2026-10-22','now')",
  );
  assert.throws(
    () =>
      db.exec(
        "INSERT INTO refunds(id,order_id,amount,method,day,created_at) VALUES ('r2','o',5000,'cash','2026-10-22','now')",
      ),
    /Refund exceeds/,
  );
});
test("tomorrow’s advance payment is collected today without becoming today’s food sale", () => {
  const db = kitchen();
  db.exec(
    "INSERT INTO menu_items(id,day,food_id,name,serving,price,capacity) VALUES ('tm','2026-10-23','f','Adobo','1 serving',10000,5)",
  );
  order(db, "o", 1, { day: "2026-10-23", menu: "tm" });
  status(db, "o", "accepted");
  pay(db, "advance", "o", 10000);
  assert.equal(
    db
      .prepare(
        "SELECT COALESCE(SUM(total),0) total FROM orders WHERE status='picked_up' AND fulfilled_day='2026-10-22'",
      )
      .get().total,
    0,
  );
  assert.equal(
    db
      .prepare(
        "SELECT SUM(amount) total FROM payments WHERE day='2026-10-22' AND status='verified'",
      )
      .get().total,
    10000,
  );
});
test("order prices survive later catalog/menu price changes", () => {
  const db = kitchen();
  order(db, "o");
  status(db, "o", "accepted");
  db.exec(
    "UPDATE foods SET price=15000 WHERE id='f';UPDATE menu_items SET price=15000 WHERE id='m'",
  );
  assert.equal(
    db.prepare("SELECT price FROM order_items WHERE order_id='o'").get().price,
    10000,
  );
  assert.equal(
    db.prepare("SELECT total FROM orders WHERE id='o'").get().total,
    10000,
  );
});
test("a failed transactional walk-in leaves neither payment nor reserved stock", () => {
  const db = kitchen(0);
  db.exec("BEGIN");
  try {
    order(db, "o");
    status(db, "o", "accepted");
    pay(db, "p", "o", 10000);
    db.exec("COMMIT");
    assert.fail("should not commit");
  } catch {
    db.exec("ROLLBACK");
  }
  assert.equal(db.prepare("SELECT COUNT(*) n FROM orders").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM payments").get().n, 0);
  assert.equal(stock(db).reserved, 0);
});
test("opening debt repayments and owner capital never create a food sale", () => {
  const db = kitchen();
  db.exec(
    "INSERT INTO debts(id,customer_id,amount,day) VALUES ('d','c',10000,'2026-10-01');INSERT INTO payments(id,debt_id,amount,method,status,day,created_at) VALUES ('p','d',4000,'cash','verified','2026-10-22','now');INSERT INTO money_entries(id,kind,category,amount,method,day,created_at) VALUES ('c','capital','Puhunan',100000,'cash','2026-10-22','now')",
  );
  assert.equal(db.prepare("SELECT COUNT(*) n FROM orders").get().n, 0);
  assert.equal(
    db
      .prepare(
        "SELECT amount-(SELECT SUM(amount) FROM payments WHERE debt_id='d' AND status='verified') remaining FROM debts WHERE id='d'",
      )
      .get().remaining,
    6000,
  );
});
test("Manila dates, month boundaries, and payment labels are consistent", () => {
  assert.equal(manilaDay(new Date("2026-10-21T16:00:00Z")), "2026-10-22");
  assert.equal(shiftDay("2026-10-31", 1), "2026-11-01");
  assert.equal(paymentLabel(10000, 6000), "Partially paid");
  assert.equal(paymentLabel(10000, 0, 10000), "For verification");
  assert.equal(paymentLabel(10000, 10000), "Paid");
  assert.equal(money(10000), "₱100");
});
