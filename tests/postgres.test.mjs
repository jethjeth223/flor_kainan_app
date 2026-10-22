import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { postgresSql } from "../lib/postgres.ts";

const migration = readdirSync("supabase/migrations")
  .filter(
    (f) =>
      f.endsWith(".sql") &&
      !f.endsWith("_private_file_storage.sql") &&
      !f.endsWith("_android_app_releases.sql") &&
      !f.endsWith("_private_chat_broadcasts.sql"),
  )
  .sort()
  .map((f) => readFileSync("supabase/migrations/" + f, "utf8"))
  .join("\n");
const db = await PGlite.create();
await db.exec(
  "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; BEGIN;" +
    migration +
    "COMMIT; SET search_path=kainan,pg_catalog;",
);
const query = (sql, ...values) => db.query(postgresSql(sql), values);
const row = async (sql, ...values) => (await query(sql, ...values)).rows[0];
async function fixture(capacity = 5) {
  await db.exec(
    "TRUNCATE kainan.audit,kainan.closeouts,kainan.customers,kainan.debts,kainan.files,kainan.foods,kainan.menu_days,kainan.menu_items,kainan.orders,kainan.order_items,kainan.payments,kainan.refunds,kainan.messages,kainan.money_entries,kainan.settings CASCADE",
  );
  await db.exec(`INSERT INTO customers(id,name) VALUES ('c','Suki');
   INSERT INTO foods(id,name,price) VALUES ('f','Adobo',10000);
   INSERT INTO menu_days(day,published) VALUES ('2026-10-22',1),('2026-10-23',1);`);
  await query(
    "INSERT INTO menu_items(id,day,food_id,name,serving,price,capacity) VALUES ('m','2026-10-22','f','Adobo','1 serving',10000,?)",
    capacity,
  );
}
async function order(id, qty = 1) {
  await query(
    "INSERT INTO orders(id,customer_id,customer_name,day,total,created_at) VALUES (?,'c','Suki','2026-10-22',?,'2026-10-22T02:00:00Z')",
    id,
    qty * 10000,
  );
  await query(
    "INSERT INTO order_items(id,order_id,menu_item_id,name,serving,price,quantity) VALUES (?,?,'m','Adobo','1 serving',10000,?)",
    id + "-line",
    id,
    qty,
  );
}
const status = (id, status, credit = 0) =>
  query(
    "UPDATE orders SET status=?,credit=?,fulfilled_day=day,fulfilled_at=created_at WHERE id=?",
    status,
    credit,
    id,
  );
const pay = (
  id,
  oid,
  amount,
  method = "cash",
  state = "verified",
  reference = null,
) =>
  query(
    "INSERT INTO payments(id,order_id,amount,method,status,reference,day,created_at) VALUES (?,?,?,?,?,?,'2026-10-22','2026-10-22T02:00:00Z')",
    id,
    oid,
    amount,
    method,
    state,
    reference,
  );
const stock = () => row("SELECT * FROM menu_items WHERE id='m'");

test("PostgreSQL business rules and access boundaries", async (t) => {
  t.after(() => db.close());
  await t.test(
    "bound parameters preserve quoted literals and repeated parameter positions",
    async () => {
      assert.equal(
        postgresSql("SELECT '?',?1,?2,?1,'it''s?'"),
        "SELECT '?',$1,$2,$1,'it''s?'",
      );
      assert.equal(
        (await row("SELECT ?1::int+?1::int total,?2::text name", 4, "Flor"))
          .total,
        8,
      );
    },
  );
  await t.test(
    "shared stock reserves on acceptance and rejects overselling",
    async () => {
      await fixture(3);
      await order("pre", 2);
      assert.equal((await stock()).reserved, 0);
      await status("pre", "accepted");
      await order("walk");
      await status("walk", "accepted");
      await pay("p", "walk", 10000);
      await status("walk", "picked_up");
      assert.equal((await stock()).reserved, 2);
      assert.equal((await stock()).sold, 1);
      await order("late");
      await assert.rejects(status("late", "accepted"), /Insufficient portions/);
    },
  );
  await t.test("multi-dish acceptance is atomic", async () => {
    await fixture();
    await order("o");
    await db.exec(
      "INSERT INTO foods(id,name,price) VALUES ('f2','Rice',1000); INSERT INTO menu_items(id,day,food_id,name,serving,price,capacity) VALUES ('m2','2026-10-22','f2','Rice','1 cup',1000,0); INSERT INTO order_items(id,order_id,menu_item_id,name,serving,price,quantity) VALUES ('i2','o','m2','Rice','1 cup',1000,1); UPDATE orders SET total=11000 WHERE id='o'",
    );
    await assert.rejects(status("o", "accepted"), /Insufficient portions/);
    assert.equal((await stock()).reserved, 0);
  });
  await t.test(
    "partial payment requires named credit at pickup and repayment cannot overpay",
    async () => {
      await fixture();
      await order("o");
      await status("o", "accepted");
      await pay("p", "o", 6000);
      await assert.rejects(status("o", "picked_up"), /Unpaid balance/);
      await status("o", "picked_up", 1);
      await pay("p2", "o", 4000);
      await assert.rejects(pay("p3", "o", 1), /Overpayment/);
    },
  );
  await t.test(
    "GCash proof requires verification and references cannot be reused",
    async () => {
      await fixture();
      await order("o");
      await status("o", "accepted");
      await pay("proof", "o", 10000, "gcash", "pending", " abc ");
      await assert.rejects(status("o", "picked_up"), /Unpaid balance/);
      await query("UPDATE payments SET status='verified' WHERE id='proof'");
      assert.equal(
        (await row("SELECT reference FROM payments WHERE id='proof'"))
          .reference,
        "ABC",
      );
      await assert.rejects(
        query("UPDATE payments SET note='changed' WHERE id='proof'"),
        /immutable/,
      );
      await order("o2");
      await status("o2", "accepted");
      await assert.rejects(
        pay("p2", "o2", 10000, "gcash", "verified", "abc"),
        /verified_gcash_reference/,
      );
      await assert.rejects(
        pay("p3", "o2", 10000, "gcash", "verified", null),
        /reference required/,
      );
    },
  );
  await t.test(
    "cancellation releases stock or records waste and bounds refunds",
    async () => {
      await fixture();
      await order("o");
      await status("o", "accepted");
      await pay("p", "o", 10000);
      await query(
        "UPDATE orders SET status='cancelled',restock=0 WHERE id='o'",
      );
      assert.equal((await stock()).reserved, 0);
      assert.equal((await stock()).waste, 1);
      const refund = (id, value) =>
        query(
          "INSERT INTO refunds(id,order_id,amount,method,day,created_at) VALUES (?,'o',?,'cash','2026-10-22','now')",
          id,
          value,
        );
      await refund("r", 10000);
      await assert.rejects(refund("r2", 1), /Refund exceeds/);
    },
  );
  await t.test(
    "closed days reject money movement and order changes",
    async () => {
      await fixture();
      await order("o");
      await status("o", "accepted");
      await db.exec(
        "INSERT INTO closeouts(day,opening_cash,actual_cash,expected_cash,created_at) VALUES ('2026-10-22',0,0,0,'now')",
      );
      await assert.rejects(pay("p", "o", 10000), /Day is closed/);
      await assert.rejects(status("o", "cancelled"), /Day is closed/);
      await assert.rejects(
        query(
          "INSERT INTO money_entries(id,kind,category,amount,method,day,created_at) VALUES ('e','expense','Rice',500,'cash','2026-10-22','now')",
        ),
        /Day is closed/,
      );
    },
  );
  await t.test(
    "opening utang payments target debts independently of sales",
    async () => {
      await fixture();
      await query(
        "INSERT INTO debts(id,customer_id,amount,day) VALUES ('d','c',10000,'2026-10-22')",
      );
      await query(
        "INSERT INTO payments(id,debt_id,amount,method,status,day,created_at) VALUES ('p','d',4000,'cash','verified','2026-10-22','now')",
      );
      await assert.rejects(
        query(
          "INSERT INTO payments(id,debt_id,amount,method,status,day,created_at) VALUES ('p2','d',6001,'cash','verified','2026-10-22','now')",
        ),
        /Overpayment/,
      );
      assert.equal(
        (await row("SELECT count(*)::int count FROM orders")).count,
        0,
      );
    },
  );
  await t.test("conflict-ignore is idempotent on PostgreSQL", async () => {
    await query(
      "INSERT OR IGNORE INTO customers(id,name) VALUES ('new','One')",
    );
    await query(
      "INSERT OR IGNORE INTO customers(id,name) VALUES ('new','Two')",
    );
    assert.equal(
      (await row("SELECT name FROM customers WHERE id='new'")).name,
      "One",
    );
  });
  await t.test(
    "anonymous and customer roles have no schema access; backend role is restricted",
    async () => {
      for (const role of ["anon", "authenticated", "service_role"]) {
        assert.equal(
          (
            await row(
              "SELECT has_schema_privilege(?, 'kainan','USAGE') allowed",
              role,
            )
          ).allowed,
          false,
        );
      }
      const tables = (
        await query(
          "SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='kainan' AND c.relkind='r'",
        )
      ).rows;
      assert.equal(tables.length, 16);
      assert.ok(tables.every((t) => t.relrowsecurity));
      await db.exec("SET ROLE kainan_server");
      assert.ok(
        (await row("SELECT count(*)::int count FROM customers")).count >= 1,
      );
      await assert.rejects(
        query("CREATE TABLE kainan.unauthorized(id int)"),
        /permission denied/,
      );
      await db.exec("RESET ROLE");
    },
  );
});
