import { test, mock, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

// Real API use cases and real PostgreSQL, with identity and Storage replaced
// only inside Node's test module loader. Production has no test-login bypass.
const db = await PGlite.create();
after(() => db.close());
const sql = readdirSync("supabase/migrations")
  .filter(
    (f) =>
      f.endsWith(".sql") &&
      !f.endsWith("_private_file_storage.sql") &&
      !f.endsWith("_android_app_releases.sql") &&
      !f.endsWith("_private_chat_broadcasts.sql") &&
      !f.endsWith("_shop_live_updates.sql") &&
      !f.endsWith("_activity_notification_triggers.sql") &&
      !f.endsWith("_registered_customer_notifications.sql"),
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
const { action, snapshot, apiError, getFile, upload, exportData } =
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

test("catalog switches, persistent publishing, daily portions and preorder chat stay consistent", async () => {
  await db.exec(
    "UPDATE kainan.settings SET pickup_start='00:00',pickup_end='23:59',cutoff='23:59'",
  );
  const foodId = randomUUID();
  assert.equal(
    (
      await post({
        action: "food",
        id: foodId,
        name: "Test daily dish",
        category: "Ulam",
        serving: "1 serving",
        price: 6000,
      })
    ).status,
    200,
  );
  assert.ok(
    (await snap(owner)).menu.some((m) => m.food_id === foodId && !m.enabled),
  );
  assert.ok(!(await snap(null)).menu.some((m) => m.food_id === foodId));
  assert.equal(
    (
      await post({
        action: "catalogDish",
        id: foodId,
        enabled: true,
        capacity: 12,
        available: 7,
      })
    ).status,
    200,
  );
  assert.equal(
    (await post({ action: "catalogPublish", published: true })).status,
    200,
  );
  const visible = (await snap(buyer)).menu.find((m) => m.food_id === foodId);
  assert.equal(visible.capacity, 7);
  const orderId = randomUUID();
  const preorder = {
    action: "order",
    requestId: orderId,
    day: (await snap(owner)).today,
    pickupTime: "12:00",
    items: [{ id: visible.id, quantity: 2 }],
    expectedTotal: 12000,
    note: "Pickup by J",
  };
  assert.equal((await post(preorder, buyer)).status, 200);
  assert.equal((await post(preorder, buyer)).status, 200);
  for (const who of [owner, buyer]) {
    const messages = (await snap(who)).messages.filter(
      (m) => m.order_id === orderId,
    );
    assert.equal(messages.length, 1);
    assert.match(messages[0].body, /2 × Test daily dish/);
    assert.match(messages[0].body, /Pickup by J/);
  }
  assert.ok(
    !(await snap(stranger)).messages.some((m) => m.order_id === orderId),
  );
  assert.equal(
    (await post({ action: "orderStatus", id: orderId, status: "accepted" }))
      .status,
    200,
  );
  assert.equal(
    (await post({ action: "catalogStock", id: foodId, available: 4 })).status,
    200,
  );
  let current = (await snap(owner)).menu.find((m) => m.food_id === foodId);
  assert.equal(current.reserved, 2);
  assert.equal(current.capacity, 6);
  assert.equal(
    (await post({ action: "catalogStock", id: foodId, refill: true })).status,
    200,
  );
  current = (await snap(owner)).menu.find((m) => m.food_id === foodId);
  assert.equal(current.reserved, 2);
  assert.equal(current.capacity, 14);
  // Creating another order must not undo a refill or change accepted order prices.
  assert.equal(
    (
      await post(
        {
          ...preorder,
          requestId: randomUUID(),
          items: [{ id: current.id, quantity: 1 }],
          expectedTotal: 6000,
        },
        buyer,
      )
    ).status,
    200,
  );
  assert.equal(
    (await snap(owner)).menu.find((m) => m.food_id === foodId).capacity,
    14,
  );
  identity = buyer;
  const tomorrow = new Date(Date.parse(preorder.day + "T00:00:00Z") + 86400000)
    .toISOString()
    .slice(0, 10);
  const next = await snapshot(request("/api/snapshot?day=" + tomorrow));
  const nextDish = next.menu.find((m) => m.food_id === foodId);
  assert.equal(next.published, true);
  assert.equal(nextDish.capacity, 12);
  assert.equal(nextDish.reserved, 0);
  assert.equal(nextDish.sold, 0);
  const futureId = randomUUID();
  assert.equal(
    (
      await post(
        {
          ...preorder,
          requestId: futureId,
          day: tomorrow,
          items: [{ id: nextDish.id, quantity: 2 }],
        },
        buyer,
      )
    ).status,
    200,
  );
  assert.equal(
    (await post({ action: "orderStatus", id: futureId, status: "accepted" }))
      .status,
    200,
  );
  assert.equal(
    (
      await post({
        action: "catalogDish",
        id: foodId,
        enabled: true,
        capacity: 1,
      })
    ).status,
    200,
  );
  identity = buyer;
  const protectedFuture = (
    await snapshot(request("/api/snapshot?day=" + tomorrow))
  ).menu.find((m) => m.food_id === foodId);
  assert.equal(protectedFuture.reserved, 2);
  assert.equal(protectedFuture.capacity, 2); // A lower default cannot erase committed portions.
  assert.equal(
    (await post({ action: "catalogDish", id: foodId, enabled: false })).status,
    200,
  );
  assert.ok(!(await snap(buyer)).menu.some((m) => m.food_id === foodId));
  assert.equal(
    (await post({ ...preorder, requestId: randomUUID() }, buyer)).status,
    409,
  );
  assert.equal(
    (await post({ action: "catalogPublish", published: false })).status,
    200,
  );
  assert.equal((await snap(buyer)).menu.length, 0);
  assert.equal(
    (await snap(owner)).orders.find((o) => o.id === orderId).status,
    "accepted",
  );
  assert.equal(
    (await post({ action: "catalogDish", id: foodId, enabled: true }, stranger))
      .status,
    403,
  );
});

test("profile photo uploads preserve ownership and private chat files stay private", async () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF7sAAAAASUVORK5CYII=",
    "base64",
  );
  async function photo(user, bytes = png) {
    identity = user;
    const form = new FormData();
    form.set("purpose", "avatar");
    form.set("file", new File([bytes], "avatar.png", { type: "image/png" }));
    const r = await upload(
      new Request("http://kainan.test/api/upload", {
        method: "POST",
        headers: { origin: "http://kainan.test" },
        body: form,
      }),
    );
    assert.equal(r.status, 200);
    return r.json();
  }
  const ownerPhoto = await photo(owner);
  const buyerPhoto = await photo(buyer);
  const strangerPhoto = await photo(stranger);
  assert.equal(
    (
      await post(
        {
          action: "profile",
          name: "Buyer",
          phone: "09123456789",
          avatarFileId: strangerPhoto.id,
        },
        buyer,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await post(
        {
          action: "profile",
          name: "Buyer",
          phone: "09123456789",
          avatarFileId: buyerPhoto.id,
        },
        buyer,
      )
    ).status,
    200,
  );
  assert.equal((await snap(buyer)).profile.avatar_file_id, buyerPhoto.id);
  assert.equal(
    (
      await post(
        { action: "profile", name: "Buyer Updated", phone: "09123456789" },
        buyer,
      )
    ).status,
    200,
  );
  assert.equal((await snap(buyer)).profile.avatar_file_id, buyerPhoto.id);
  identity = stranger;
  await assert.rejects(getFile(buyerPhoto.id), /private/);
  identity = buyer;
  assert.equal((await getFile(buyerPhoto.id)).status, 200);
  identity = owner;
  assert.equal((await getFile(buyerPhoto.id)).status, 200);
  assert.equal(
    (await snap(owner)).customers.find((c) => c.user_id === buyer.userId)
      .avatar_file_id,
    buyerPhoto.id,
  );
  assert.equal(
    (
      await post(
        {
          action: "profile",
          name: "Flor",
          phone: "",
          avatarFileId: ownerPhoto.id,
        },
        owner,
      )
    ).status,
    200,
  );
  identity = buyer;
  assert.equal((await getFile(ownerPhoto.id)).status, 200);
  assert.equal((await snap(buyer)).ownerProfile.avatar_file_id, ownerPhoto.id);
  identity = null;
  await assert.rejects(getFile(ownerPhoto.id), /sign in/);
  assert.equal((await snap(null)).ownerProfile, null);
  assert.equal(
    (
      await post(
        {
          action: "profile",
          name: "Buyer",
          phone: "09123456789",
          avatarFileId: null,
        },
        buyer,
      )
    ).status,
    200,
  );
  assert.equal((await snap(buyer)).profile.avatar_file_id, null);
  identity = owner;
  const backup = await (await exportData(request("/api/export"))).json();
  assert.equal(backup.format, "flors-kainan-cloud-backup-v2");
  assert.ok(backup.profiles.some((p) => p.avatar_file_id === ownerPhoto.id));
  await assert.rejects(photo(buyer, Buffer.from("<svg></svg>")), /Only JPG/);
});

test("date lookup includes older orders and notifications remain private with bounded read receipts", async () => {
  const archiveDay = "2024-01-15";
  await db.query(
    `INSERT INTO kainan.orders(id,customer_name,user_id,day,total,created_at)
    SELECT 'recent-bulk-'||n,'Recent buyer',$1,'2026-10-22',6000,'2099-01-01T00:00:00Z' FROM generate_series(1,501) n`,
    [buyer.userId],
  );
  await db.query(
    "INSERT INTO kainan.orders(id,customer_name,user_id,day,total,created_at) VALUES ('archived-target','Buyer',$1,$2,6000,'2024-01-15T00:00:00Z'),('stranger-archive','Stranger',$3,$2,6000,'2024-01-15T00:00:00Z')",
    [buyer.userId, archiveDay, stranger.userId],
  );
  assert.ok(
    !(await snap(owner)).orders.some((o) => o.id === "archived-target"),
  );
  identity = owner;
  const dated = await snapshot(
    request("/api/snapshot?ordersDay=" + archiveDay),
  );
  assert.ok(dated.orders.some((o) => o.id === "archived-target"));
  identity = buyer;
  const privateDated = await snapshot(
    request("/api/snapshot?ordersDay=" + archiveDay),
  );
  assert.ok(privateDated.orders.some((o) => o.id === "archived-target"));
  assert.ok(!privateDated.orders.some((o) => o.id === "stranger-archive"));
  await db.query(
    `INSERT INTO kainan.notifications(id,user_id,section,title,created_at) VALUES
    ('buyer-old',$1,'orders','Order updated','2026-01-01T00:00:00Z'),
    ('buyer-new',$1,'orders','Order updated','2026-01-02T00:00:00Z'),
    ('owner-only',$2,'chat','New message','2026-01-01T00:00:00Z')`,
    [buyer.userId, owner.userId],
  );
  assert.equal((await snap(buyer)).notificationCounts.orders, 2);
  assert.ok(
    !(await snap(buyer)).notifications.some((n) => n.id === "owner-only"),
  );
  assert.equal((await snap(null)).notifications.length, 0);
  assert.equal(
    (
      await post(
        { action: "readNotifications", notificationId: "owner-only" },
        buyer,
      )
    ).status,
    200,
  );
  assert.equal((await snap(owner)).notificationCounts.chat, 1);
  assert.equal(
    (
      await post(
        {
          action: "readNotifications",
          section: "orders",
          through: "2026-01-01T12:00:00Z",
        },
        buyer,
      )
    ).status,
    200,
  );
  const read = await snap(buyer);
  assert.equal(read.notificationCounts.orders, 1);
  assert.ok(read.notifications.find((n) => n.id === "buyer-old").read_at);
  assert.equal(
    read.notifications.find((n) => n.id === "buyer-new").read_at,
    null,
  );
});
