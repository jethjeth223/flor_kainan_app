import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { Miniflare } from "miniflare";
import { DatabaseSync } from "node:sqlite";
import { validatedRestoreSql } from "../scripts/backup-tools.mjs";
const base = "http://kainan.test";
// Dispatch directly to an isolated production Worker. This avoids Wrangler's
// development proxy and never touches the preview or production databases.
let mf;
function workerModules(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? workerModules(join(directory, entry.name))
      : /\.m?js$/.test(entry.name)
        ? [{ type: "ESModule", path: resolve(directory, entry.name) }]
        : [],
  );
}
const identity = (user) => ({
  "oai-authenticated-user-id": user,
  "oai-authenticated-user-email": user + "@sites.test",
  "oai-authenticated-user-full-name": user,
});
async function call(
  path,
  {
    user = "local_seedy",
    body,
    method = body ? "POST" : "GET",
    headers = {},
  } = {},
) {
  const request = new Request(base + path, {
    method,
    headers: {
      ...(user ? identity(user) : {}),
      ...(body && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...headers,
    },
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const r = await mf.dispatchFetch(request.url, {
    method: request.method,
    headers: Object.fromEntries(request.headers),
    body: ["GET", "HEAD"].includes(method)
      ? undefined
      : await request.arrayBuffer(),
  });
  const type = r.headers.get("content-type") || "";
  return {
    status: r.status,
    data: type.includes("json") ? await r.json() : await r.text(),
  };
}
const post = (body, user) => call("/api/action", { body, user });
test(
  "real Worker API: authorization, atomic acceptance, idempotency, money, uploads and exports",
  {},
  async (t) => {
    const entry = resolve("dist/server/index.js");
    const modules = workerModules("dist/server");
    modules.sort((a, b) => (a.path === entry ? -1 : b.path === entry ? 1 : 0));
    mf = new Miniflare({
      modules,
      modulesRoot: resolve("dist/server"),
      compatibilityDate: "2026-05-15",
      compatibilityFlags: ["nodejs_compat"],
      d1Databases: ["DB"],
      r2Buckets: ["BUCKET"],
      cf: false,
    });
    t.after(() => mf?.dispose());
    const database = await mf.getD1Database("DB");
    for (const file of readdirSync("drizzle")
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      const sql = readFileSync("drizzle/" + file, "utf8");
      await database.batch(
        sql
          .split("--> statement-breakpoint")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => database.prepare(s)),
      );
    }
    assert.equal((await post({ action: "setup", demo: true })).status, 200);
    const before = await call("/api/snapshot");
    assert.equal(before.status, 200);
    assert.equal(before.data.role, "owner");
    assert.equal(
      before.data.settings.demo,
      1,
      "Use only a fictional sample shop for API tests",
    );
    const day = before.data.today,
      token = randomUUID().slice(0, 8),
      a = "test-a-" + token,
      b = "test-b-" + token;
    const settings = before.data.settings;
    const saveSettings = (s) =>
      post({
        action: "settings",
        shopName: s.shop_name,
        location: s.location,
        pickupStart: s.pickup_start,
        pickupEnd: s.pickup_end,
        cutoff: s.cutoff,
        gcashName: s.gcash_name,
        gcashNumber: s.gcash_number,
        notice: s.notice,
      });
    await saveSettings({
      ...settings,
      pickup_start: "00:00",
      pickup_end: "23:59",
      cutoff: "23:59",
    });
    try {
      assert.equal(
        (
          await post(
            {
              action: "money",
              requestId: randomUUID(),
              kind: "capital",
              category: "Test",
              amount: 100,
              method: "cash",
              day,
            },
            null,
          )
        ).status,
        401,
      );
      for (const user of [a, b]) {
        const result = await post(
          {
            action: "profile",
            name: "Test Buyer " + user,
            phone: "09000000000",
          },
          user,
        );
        assert.equal(result.status, 200, JSON.stringify(result.data));
      }
      assert.equal(
        (
          await post(
            {
              action: "money",
              requestId: randomUUID(),
              kind: "capital",
              category: "Test",
              amount: 100,
              method: "cash",
              day,
            },
            a,
          )
        ).status,
        403,
      );
      const cross = await call("/api/action", {
        user: a,
        body: { action: "profile", name: "Test", phone: "09000000000" },
        headers: { origin: "https://other.example" },
      });
      assert.equal(cross.status, 403);
      const foodId = randomUUID(),
        foodName = "API test dish " + token;
      assert.equal(
        (
          await post({
            action: "food",
            id: foodId,
            name: foodName,
            description: "Fictional API test meal",
            category: "Ulam",
            serving: "1 serving",
            price: 10000,
            day,
          })
        ).status,
        200,
      );
      let snap = (await call("/api/snapshot")).data;
      const menu = snap.menu.find((m) => m.food_id === foodId);
      assert.ok(menu);
      assert.equal(
        (
          await post({
            action: "menuItem",
            id: menu.id,
            capacity: 1,
            price: 10000,
            enabled: true,
          })
        ).status,
        200,
      );
      const ids = [randomUUID(), randomUUID()];
      for (let i = 0; i < 2; i++) {
        const payload = {
          action: "order",
          requestId: ids[i],
          day,
          pickupTime: "12:00",
          expectedTotal: 10000,
          items: [{ id: menu.id, quantity: 1 }],
        };
        assert.equal((await post(payload, i ? a : b)).status, 200);
        assert.equal((await post(payload, i ? a : b)).status, 200);
      }
      assert.equal(
        (
          await post(
            { action: "orderStatus", id: ids[0], status: "accepted" },
            a,
          )
        ).status,
        403,
      );
      const accepted = await Promise.all(
        ids.map((id) =>
          post({ action: "orderStatus", id, status: "accepted" }),
        ),
      );
      assert.deepEqual(accepted.map((r) => r.status).sort(), [200, 409]);
      const winner = ids[accepted.findIndex((r) => r.status === 200)],
        winnerUser = winner === ids[0] ? b : a,
        otherUser = winnerUser === a ? b : a,
        loser = ids.find((id) => id !== winner);
      let buyer = (await call("/api/snapshot", { user: winnerUser })).data;
      assert.equal(buyer.orders.length, 1);
      assert.equal(buyer.customers.length, 0);
      assert.equal(buyer.payments.length, 0);
      assert.equal(buyer.settings.owner_id, "");
      assert.equal(
        (
          await post(
            { action: "orderStatus", id: winner, status: "cancelled" },
            otherUser,
          )
        ).status,
        403,
      );
      const payId = randomUUID();
      assert.equal(
        (
          await post({
            action: "payment",
            requestId: payId,
            orderId: winner,
            amount: 6000,
            method: "cash",
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await post({
            action: "payment",
            requestId: payId,
            orderId: winner,
            amount: 6000,
            method: "cash",
          })
        ).status,
        200,
      );
      assert.equal(
        (await post({ action: "orderStatus", id: winner, status: "picked_up" }))
          .status,
        409,
      );
      assert.equal(
        (
          await post({
            action: "orderStatus",
            id: winner,
            status: "picked_up",
            credit: true,
          })
        ).status,
        200,
      );
      let after = (await call("/api/snapshot")).data;
      assert.equal(after.stats.sales - before.data.stats.sales, 10000);
      assert.equal(after.stats.debt - before.data.stats.debt, 4000);
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1eEAAAAASUVORK5CYII=",
        "base64",
      );
      const form = new FormData();
      form.set(
        "file",
        new Blob([png], { type: "image/png" }),
        "test-payment.png",
      );
      const upload = await call("/api/upload", {
        user: winnerUser,
        body: form,
      });
      assert.equal(upload.status, 200);
      const fileId = upload.data.id;
      assert.equal(
        (await call("/api/files/" + fileId, { user: otherUser })).status,
        403,
      );
      assert.equal(
        (await call("/api/files/" + fileId, { user: null })).status,
        401,
      );
      const proofId = randomUUID(),
        reference = "TEST-" + token;
      assert.equal(
        (
          await post(
            {
              action: "payment",
              requestId: proofId,
              orderId: winner,
              amount: 4000,
              method: "gcash",
              reference,
              fileId,
            },
            winnerUser,
          )
        ).status,
        200,
      );
      after = (await call("/api/snapshot")).data;
      assert.equal(
        after.stats.debt - before.data.stats.debt,
        4000,
        "Screenshot must not reduce debt",
      );
      assert.equal(
        (await post({ action: "verifyPayment", id: proofId, verified: true }))
          .status,
        200,
      );
      after = (await call("/api/snapshot")).data;
      assert.equal(
        after.stats.sales - before.data.stats.sales,
        10000,
        "Repayment must not become another sale",
      );
      assert.equal(after.stats.debt - before.data.stats.debt, 0);
      assert.equal(
        (
          await post({
            action: "menuItem",
            id: menu.id,
            capacity: 2,
            price: 10000,
            enabled: true,
          })
        ).status,
        200,
      );
      assert.equal(
        (await post({ action: "orderStatus", id: loser, status: "accepted" }))
          .status,
        200,
      );
      assert.equal(
        (
          await post({
            action: "payment",
            requestId: randomUUID(),
            orderId: loser,
            amount: 10000,
            method: "gcash",
            reference,
          })
        ).status,
        409,
      );
      const messageId = randomUUID();
      assert.equal(
        (
          await post(
            {
              action: "message",
              requestId: messageId,
              body: "Fictional test message",
              fileId,
            },
            winnerUser,
          )
        ).status,
        200,
      );
      const other = (await call("/api/snapshot", { user: otherUser })).data;
      assert.equal(
        other.messages.some((m) => m.id === messageId),
        false,
      );
      const foodForm = new FormData();
      foodForm.set(
        "file",
        new Blob([png], { type: "image/png" }),
        "test-food.png",
      );
      foodForm.set("purpose", "food");
      assert.equal(
        (await call("/api/upload", { user: otherUser, body: foodForm })).status,
        403,
      );
      const exportResult = await call("/api/export?type=payments");
      assert.equal(exportResult.status, 200);
      assert.ok(exportResult.data.includes(reference.toUpperCase()));
      assert.equal(
        (await call("/api/export?type=backup", { user: otherUser })).status,
        403,
      );
      const backup = await call("/api/export?type=backup");
      assert.equal(backup.status, 200);
      assert.equal(backup.data.format, "flors-kainan-backup-v1");
      assert.ok(backup.data.orders.some((o) => o.id === winner));
      const recovered = new DatabaseSync(":memory:");
      try {
        recovered.exec(validatedRestoreSql(backup.data));
        assert.equal(
          recovered.prepare("SELECT COUNT(*) n FROM orders").get().n,
          backup.data.orders.length,
        );
        assert.equal(
          recovered.prepare("SELECT total FROM orders WHERE id=?").get(winner)
            .total,
          10000,
        );
      } finally {
        recovered.close();
      }
      assert.equal(
        (
          await post({
            action: "orderStatus",
            id: loser,
            status: "cancelled",
            restock: true,
          })
        ).status,
        200,
      );
      const publicFood = new FormData();
      publicFood.set(
        "file",
        new Blob([png], { type: "image/png" }),
        "food.png",
      );
      publicFood.set("purpose", "food");
      const uploadedFood = await call("/api/upload", { body: publicFood });
      assert.equal(uploadedFood.status, 200);
      assert.equal(
        (await post({ action: "resetDemo", confirmation: "START FRESH" }))
          .status,
        200,
      );
      const fresh = (await call("/api/snapshot")).data;
      assert.equal(fresh.orders.length, 0);
      assert.equal(fresh.settings.demo, 0);
      assert.ok(fresh.foods.length > 0);
      assert.equal(
        (await call("/api/files/" + uploadedFood.data.id, { user: null }))
          .status,
        200,
        "Food catalog images survive sample reset",
      );
    } finally {
      await mf.dispose();
      mf = undefined;
    }
  },
);
