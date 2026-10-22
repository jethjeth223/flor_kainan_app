import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

// Real API use cases and real PostgreSQL, with identity and Storage replaced
// only inside Node's test module loader. Production has no test-login bypass.
const db = await PGlite.create();
const sql = readdirSync("supabase/migrations")
  .filter(
    (f) =>
      f.endsWith(".sql") &&
      !f.endsWith("_private_file_storage.sql") &&
      !f.endsWith("_android_app_releases.sql"),
  )
  .sort()
  .map((f) => readFileSync("supabase/migrations/" + f, "utf8"))
  .join("\n");
await db.exec(
  "CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;BEGIN;" +
    sql +
    "COMMIT;",
);
let identity = null;
mock.module(new URL("../lib/supabase/server.ts", import.meta.url).href, {
  namedExports: { currentUser: async () => identity },
});
const objects = new Map();
mock.module(new URL("../lib/supabase/storage.ts", import.meta.url).href, {
  namedExports: {
    storage: {
      put: async (k, data) => objects.set(k, new Blob([data])),
      get: async (k) => objects.get(k) || null,
      delete: async (k) => objects.delete(k),
    },
  },
});
class Pool {
  async connect() {
    return {
      query: async (sql, values) => {
        const r = await db.query(sql, values);
        return { ...r, rowCount: r.affectedRows ?? r.rows.length };
      },
      release: () => {},
    };
  }
}
mock.module("pg", { namedExports: { Pool } });
process.env.DATABASE_URL = "postgresql://test:test@localhost/test";
process.env.FLOR_OWNER_EMAIL = "flor@example.test";
process.env.APP_URL = "http://kainan.test";
const { action, snapshot, apiError, getFile } =
  await import("../lib/server.ts");
const owner = {
  userId: randomUUID(),
  email: "flor@example.test",
  displayName: "Flor",
  fullName: "Flor",
};
const buyer = {
  userId: randomUUID(),
  email: "buyer@example.test",
  displayName: "Buyer",
  fullName: "Buyer",
};
const stranger = {
  userId: randomUUID(),
  email: "stranger@example.test",
  displayName: "Stranger",
  fullName: "Stranger",
};
const request = (path, body) =>
  new Request("http://kainan.test" + path, {
    method: body ? "POST" : "GET",
    headers: body
      ? { "Content-Type": "application/json", origin: "http://kainan.test" }
      : {},
    body: body ? JSON.stringify(body) : undefined,
  });
async function post(body, user = owner) {
  identity = user;
  try {
    const r = await action(request("/api/action", body));
    return { status: r.status, data: await r.json() };
  } catch (e) {
    const r = await apiError(e);
    return { status: r.status, data: await r.json() };
  }
}
async function snap(user) {
  identity = user;
  return snapshot(request("/api/snapshot"));
}
test("API transactions, setup authorization, customer isolation and reports", async (t) => {
  t.after(() => db.close());
  assert.equal((await post({ action: "setup" }, null)).status, 401);
  assert.equal((await post({ action: "setup" }, buyer)).status, 403);
  assert.equal((await post({ action: "setup", demo: true })).status, 200);
  const initial = await snap(owner);
  assert.equal(initial.role, "owner");
  assert.ok(initial.menu.length > 0);
  assert.equal(typeof initial.stats.sales, "number");
  const anonymous = await snap(null);
  assert.equal(anonymous.role, "anonymous");
  assert.equal(anonymous.customers.length, 0);
  assert.equal(anonymous.payments.length, 0);
  assert.equal(anonymous.settings.owner_id, "");
  assert.equal(
    (
      await post(
        { action: "profile", name: "Buyer Test", phone: "09123456789" },
        buyer,
      )
    ).status,
    200,
  );
  const customer = await snap(buyer);
  assert.equal(customer.role, "customer");
  assert.equal(customer.customers.length, 0);
  const messageId = randomUUID();
  assert.equal(
    (
      await post(
        { action: "message", requestId: messageId, body: "Hello Flor" },
        buyer,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await post(
        { action: "message", requestId: messageId, body: "Hello Flor" },
        buyer,
      )
    ).status,
    200,
  );
  assert.equal((await snap(buyer)).messages.length, 1);
  assert.equal((await snap(stranger)).messages.length, 0);
  assert.equal(
    (
      await post(
        { action: "readMessages", customerId: customer.customerId },
        stranger,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await post(
        {
          action: "money",
          requestId: randomUUID(),
          kind: "expense",
          category: "Rice",
          amount: 1000,
          method: "cash",
          day: initial.today,
        },
        buyer,
      )
    ).status,
    403,
  );
  const entryId = randomUUID();
  assert.equal(
    (
      await post({
        action: "money",
        requestId: entryId,
        kind: "capital",
        category: "Owner",
        amount: 10000,
        method: "cash",
        day: initial.today,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await post({
        action: "money",
        requestId: entryId,
        kind: "capital",
        category: "Owner",
        amount: 10000,
        method: "cash",
        day: initial.today,
      })
    ).status,
    200,
  );
  const after = await snap(owner);
  assert.equal(after.stats.capital, initial.stats.capital + 10000);
  assert.equal(after.stats.sales, initial.stats.sales);
  const dish = after.menu.find(
    (m) => m.enabled && m.capacity - m.reserved - m.sold - m.waste > 0,
  );
  const saleId = randomUUID();
  const sale = {
    action: "order",
    requestId: saleId,
    day: after.today,
    pickupTime: after.settings.pickup_start,
    items: [{ id: dish.id, quantity: 1 }],
    expectedTotal: dish.price,
    walkin: true,
    cash: dish.price,
  };
  assert.equal((await post(sale)).status, 200);
  assert.equal((await post(sale)).status, 200);
  const sold = await snap(owner);
  assert.equal(sold.stats.sales, initial.stats.sales + dish.price);
  assert.equal(sold.orders.filter((o) => o.id === saleId).length, 1);
  assert.equal(sold.orders.find((o) => o.id === saleId).status, "picked_up");
  assert.equal((await snap(stranger)).orders.length, 0);
  // Storage authorization is independent of a caller knowing the file UUID.
  await db.exec(
    "BEGIN; SET LOCAL ROLE kainan_server; SET LOCAL search_path=kainan,pg_catalog;",
  );
  await db.query(
    "INSERT INTO files(id,customer_id,key,mime,name,size) VALUES ('private-test',$1,'proof','image/png','proof.png',1)",
    [customer.customerId],
  );
  await db.exec("COMMIT");
  objects.set("proof", new Blob([new Uint8Array([1])]));
  identity = stranger;
  await assert.rejects(getFile("private-test"), /private/);
  identity = buyer;
  assert.equal((await getFile("private-test")).status, 200);
  const cross = request("/api/action", { action: "setup" });
  cross.headers.set("origin", "https://attacker.test");
  identity = owner;
  await assert.rejects(action(cross), /use this app/);
});
