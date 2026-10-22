import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

test("chat trigger addresses only its participants and RLS denies other topics and client sending", async () => {
  const db = await PGlite.create();
  try {
    const sql = readdirSync("supabase/migrations")
      .filter(
        (f) =>
          f.endsWith(".sql") &&
          !/_(private_file_storage|android_app_releases|private_chat_broadcasts|shop_live_updates|activity_notification_triggers|registered_customer_notifications)\.sql$/.test(
            f,
          ),
      )
      .sort()
      .map((f) => readFileSync("supabase/migrations/" + f, "utf8"))
      .join("\n");
    await db.exec(
      "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; BEGIN;" +
        sql +
        "COMMIT;",
    );
    // Model Supabase's existing Realtime API while running our actual trigger/policy SQL.
    await db.exec(`CREATE SCHEMA auth; CREATE SCHEMA realtime;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      CREATE FUNCTION realtime.topic() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('realtime.topic',true) $$;
      CREATE TABLE realtime.messages (topic text, payload jsonb, event text, private boolean, extension text DEFAULT 'broadcast');
      ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA auth,realtime TO authenticated,anon;
      GRANT SELECT,INSERT ON realtime.messages TO authenticated,anon;
      CREATE FUNCTION realtime.send(payload jsonb,event text,topic text,private boolean) RETURNS void LANGUAGE sql AS $$ INSERT INTO realtime.messages(topic,payload,event,private) VALUES ($3,$1,$2,$4) $$;`);
    const broadcast = readdirSync("supabase/migrations").find((f) =>
      f.endsWith("_private_chat_broadcasts.sql"),
    );
    await db.exec(readFileSync("supabase/migrations/" + broadcast, "utf8"));
    const owner = "00000000-0000-4000-8000-000000000001";
    const buyer = "00000000-0000-4000-8000-000000000002";
    await db.exec(
      `INSERT INTO kainan.settings(id,owner_id) VALUES (1,'${owner}'); INSERT INTO kainan.customers(id,user_id,name) VALUES ('c','${buyer}','Buyer');`,
    );
    await db.exec(
      "BEGIN; SET LOCAL ROLE kainan_server; INSERT INTO kainan.messages(id,customer_id,sender,body,created_at) VALUES ('m','c','customer','Hello','2026-10-22T00:00:00Z'); COMMIT;",
    );
    const events = (
      await db.query("SELECT * FROM realtime.messages ORDER BY topic")
    ).rows;
    assert.equal(events.length, 2);
    assert.deepEqual(
      events.map((r) => r.topic),
      [owner, buyer].map((id) => "kainan:user:" + id),
    );
    assert.ok(
      events.every(
        (r) =>
          r.private &&
          r.event === "chat_message" &&
          r.payload.record.id === "m",
      ),
    );
    await db.exec(
      "BEGIN; UPDATE kainan.messages SET read_at='2026-10-22T00:01:00Z' WHERE id='m'; ROLLBACK;",
    );
    assert.equal(
      (await db.query("SELECT count(*)::int n FROM realtime.messages")).rows[0]
        .n,
      2,
    );
    await db.exec(
      `SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${buyer}',false); SELECT set_config('realtime.topic','kainan:user:${buyer}',false);`,
    );
    assert.equal(
      (await db.query("SELECT count(*)::int n FROM realtime.messages")).rows[0]
        .n,
      1,
    );
    await db.exec(
      `SELECT set_config('realtime.topic','kainan:user:${owner}',false)`,
    );
    assert.equal(
      (await db.query("SELECT count(*)::int n FROM realtime.messages")).rows[0]
        .n,
      0,
    );
    await assert.rejects(
      db.exec(
        "INSERT INTO realtime.messages(topic,event,payload,private) VALUES ('forged','chat_message','{}',true)",
      ),
      /row-level security/,
    );
    await db.exec("RESET ROLE; SET ROLE anon");
    assert.equal(
      (await db.query("SELECT count(*)::int n FROM realtime.messages")).rows[0]
        .n,
      0,
    );
    await db.exec("RESET ROLE");
    const live = readdirSync("supabase/migrations").find((f) =>
      f.endsWith("_shop_live_updates.sql"),
    );
    await db.exec(readFileSync("supabase/migrations/" + live, "utf8"));
    await db.exec(
      "DELETE FROM realtime.messages; INSERT INTO kainan.foods(id,name,price) VALUES ('live-dish','Private draft dish',6000)",
    );
    let changes = (await db.query("SELECT * FROM realtime.messages")).rows;
    assert.equal(changes.length, 1);
    assert.equal(changes[0].topic, "kainan:catalog");
    assert.equal(changes[0].private, false);
    assert.deepEqual(changes[0].payload, {});
    await db.exec(`DELETE FROM realtime.messages;
      INSERT INTO kainan.orders(id,customer_id,customer_name,user_id,day,total,created_at)
      VALUES ('live-order','c','Buyer','${buyer}','2026-10-22',6000,'2026-10-22T01:00:00Z');`);
    changes = (await db.query("SELECT * FROM realtime.messages ORDER BY topic"))
      .rows;
    assert.deepEqual(
      changes.map((r) => r.topic),
      [owner, buyer].map((id) => "kainan:user:" + id),
    );
    assert.ok(
      changes.every(
        (r) =>
          r.private &&
          r.event === "shop_changed" &&
          Object.keys(r.payload).length === 0,
      ),
    );
    await db.exec("DELETE FROM realtime.messages");
    await db.exec(
      "BEGIN; UPDATE kainan.foods SET enabled=0 WHERE id='live-dish'; ROLLBACK;",
    );
    assert.equal(
      (await db.query("SELECT count(*)::int n FROM realtime.messages")).rows[0]
        .n,
      0,
    );
    await db.exec(
      "UPDATE kainan.foods SET enabled=1 WHERE id='live-dish'; UPDATE kainan.settings SET catalog_published=0 WHERE id=1",
    );
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int n FROM realtime.messages WHERE topic='kainan:catalog'",
        )
      ).rows[0].n,
      2,
    );
    const notificationTriggers = readdirSync("supabase/migrations").find((f) =>
      f.endsWith("_activity_notification_triggers.sql"),
    );
    await db.exec(
      readFileSync("supabase/migrations/" + notificationTriggers, "utf8"),
    );
    const newcomer = "00000000-0000-4000-8000-000000000003";
    await db.exec(`CREATE TABLE auth.users(id uuid PRIMARY KEY,email_confirmed_at timestamptz,deleted_at timestamptz);
      INSERT INTO auth.users VALUES ('${owner}',now(),null),('${buyer}',now(),null),('${newcomer}',now(),null),('00000000-0000-4000-8000-000000000004',null,null);`);
    const registered = readdirSync("supabase/migrations").find((f) =>
      f.endsWith("_registered_customer_notifications.sql"),
    );
    await db.exec(readFileSync("supabase/migrations/" + registered, "utf8"));
    await db.exec(
      "INSERT INTO kainan.foods(id,name,price) VALUES ('draft-notification','Draft only',6000)",
    );
    let notices = (await db.query("SELECT * FROM kainan.notifications")).rows;
    assert.equal(notices.length, 1);
    assert.equal(notices[0].user_id, owner); // Draft dish names never reach buyers.
    await db.exec(
      "DELETE FROM kainan.notifications; DELETE FROM realtime.messages",
    );
    await db.exec("UPDATE kainan.settings SET catalog_published=1 WHERE id=1");
    notices = (
      await db.query("SELECT * FROM kainan.notifications ORDER BY user_id")
    ).rows;
    assert.deepEqual(
      notices.map((n) => n.user_id),
      [owner, buyer, newcomer],
    );
    assert.ok(notices.every((n) => n.section === "menu"));
    const publicPayloads = (
      await db.query(
        "SELECT payload FROM realtime.messages WHERE private=false",
      )
    ).rows;
    assert.ok(publicPayloads.every((n) => Object.keys(n.payload).length === 0));
    await db.exec(
      "DELETE FROM kainan.notifications; DELETE FROM realtime.messages",
    );
    await db.exec(
      "INSERT INTO kainan.messages(id,customer_id,sender,body,created_at) VALUES ('notify-chat','c','customer','Hello privately','2026-10-22T01:00:00Z')",
    );
    notices = (await db.query("SELECT * FROM kainan.notifications")).rows;
    assert.equal(notices.length, 1);
    assert.equal(notices[0].user_id, owner);
    assert.equal(notices[0].section, "chat");
    await db.exec(
      "DELETE FROM kainan.notifications; DELETE FROM realtime.messages",
    );
    await db.exec(
      "UPDATE kainan.orders SET status='declined' WHERE id='live-order'",
    );
    notices = (
      await db.query("SELECT * FROM kainan.notifications ORDER BY user_id")
    ).rows;
    assert.deepEqual(
      notices.map((n) => n.user_id),
      [owner, buyer],
    );
    assert.ok(notices.every((n) => n.section === "orders"));
    await db.exec(
      "DELETE FROM kainan.notifications; DELETE FROM realtime.messages",
    );
    await db.exec(
      "BEGIN; UPDATE kainan.settings SET catalog_published=0 WHERE id=1; ROLLBACK",
    );
    assert.equal(
      (await db.query("SELECT count(*)::int n FROM kainan.notifications"))
        .rows[0].n,
      0,
    );
    assert.equal(
      (await db.query("SELECT count(*)::int n FROM realtime.messages")).rows[0]
        .n,
      0,
    );
  } finally {
    await db.close();
  }
});
