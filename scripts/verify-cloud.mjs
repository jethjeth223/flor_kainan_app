import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { databaseConfig } from "../lib/database-config.mjs";
try {
  process.loadEnvFile(".env.local");
} catch {}

// Never print credentials, URLs containing credentials, or provider error bodies.
try {
  if (!process.argv.includes("--database-only")) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const client = createClient(url, process.env.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false },
    });
    const anon = createClient(
      url,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false } },
    );
    const key = "qa/" + randomUUID() + ".png";
    const image = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=",
      "base64",
    );
    let created = false;
    try {
      const upload = await client.storage
        .from("kainan-files")
        .upload(key, image, { contentType: "image/png" });
      assert.equal(!!upload.error, false, "Storage upload failed");
      created = true;
      const read = await client.storage.from("kainan-files").download(key);
      assert.equal(!!read.error, false, "Private server download failed");
      assert.equal((await read.data.arrayBuffer()).byteLength, image.length);
      const denied = await anon.storage.from("kainan-files").download(key);
      assert.ok(denied.error, "Anonymous download must be denied");
      console.log(
        "PASS: private Storage upload, server download, anonymous denial",
      );
    } finally {
      if (created) {
        const removed = await client.storage.from("kainan-files").remove([key]);
        assert.equal(!!removed.error, false, "Test image cleanup failed");
        console.log("PASS: temporary image removed");
      }
    }
  }
  if (!process.argv.includes("--storage-only")) {
    const uri = new URL(process.env.DATABASE_URL);
    assert.ok(
      ["postgres:", "postgresql:"].includes(uri.protocol),
      "DATABASE_URL needs a PostgreSQL URI",
    );
    const pool = new pg.Pool({ ...databaseConfig(), max: 1 });
    try {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SET LOCAL ROLE kainan_server");
        await client.query("SET LOCAL search_path=kainan,pg_catalog");
        const result = await client.query(
          "SELECT current_user AS role, count(*)::int AS tables FROM information_schema.tables WHERE table_schema='kainan'",
        );
        assert.equal(result.rows[0].role, "kainan_server");
        assert.equal(result.rows[0].tables, 15);
        console.log(
          "PASS: PostgreSQL connection, restricted role, 15 business tables",
        );
        await client.query("ROLLBACK");
      } finally {
        client.release();
      }
    } finally {
      await pool.end();
    }
  }
} catch (error) {
  console.error(
    "Cloud verification failed:",
    error instanceof assert.AssertionError
      ? error.message
      : "Check connection settings and access. Provider code: " +
          (error?.code || "unavailable"),
  );
  process.exitCode = 1;
}
