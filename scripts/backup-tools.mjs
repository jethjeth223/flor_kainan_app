import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
const tables = [
  "settings",
  "customers",
  "foods",
  "menu_days",
  "menu_items",
  "orders",
  "order_items",
  "debts",
  "files",
  "payments",
  "refunds",
  "money_entries",
  "messages",
  "closeouts",
  "audit",
];
const schema = () =>
  readdirSync(new URL("../drizzle/", import.meta.url))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) =>
      readFileSync(new URL("../drizzle/" + f, import.meta.url), "utf8"),
    )
    .join("\n");
const quote = (v) =>
  v === null
    ? "NULL"
    : typeof v === "number" && Number.isSafeInteger(v)
      ? String(v)
      : typeof v === "string"
        ? v.includes("\0")
          ? `CAST(X'${Buffer.from(v).toString("hex")}' AS TEXT)`
          : `'${v.replaceAll("'", "''")}'`
        : (() => {
            throw new Error("Backup contains an unsupported value.");
          })();
// Offline recovery only. Validate by rebuilding the complete relational graph
// in an empty database before creating any recovery artifact on disk.
export function validatedRestoreSql(data) {
  if (!data || data.format !== "flors-kainan-backup-v1")
    throw new Error("Unsupported backup format.");
  const db = new DatabaseSync(":memory:");
  const schemaSql = schema();
  try {
    db.exec("PRAGMA foreign_keys=ON;" + schemaSql);
    const triggers = db
      .prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger'")
      .all();
    const commands = ["BEGIN;"];
    for (const trigger of triggers)
      commands.push(`DROP TRIGGER "${trigger.name}";`);
    for (const table of tables) {
      if (!Array.isArray(data[table]))
        throw new Error("Missing backup table: " + table);
      const columns = new Set(
        db
          .prepare(`PRAGMA table_info("${table}")`)
          .all()
          .map((c) => c.name),
      );
      for (const row of data[table]) {
        if (!row || typeof row !== "object" || Array.isArray(row))
          throw new Error("Invalid row in " + table);
        const keys = Object.keys(row);
        if (!keys.length || keys.some((k) => !columns.has(k)))
          throw new Error("Unknown columns in " + table);
        commands.push(
          `INSERT INTO "${table}" (${keys.map((k) => '"' + k + '"').join(",")}) VALUES (${keys.map((k) => quote(row[k])).join(",")});`,
        );
      }
    }
    for (const trigger of triggers) commands.push(trigger.sql + ";");
    commands.push("COMMIT;");
    const content = commands.join("\n");
    db.exec(content);
    if (db.prepare("PRAGMA foreign_key_check").all().length)
      throw new Error("Backup has broken record references.");
    if (db.prepare("PRAGMA integrity_check").get().integrity_check !== "ok")
      throw new Error("Backup failed its integrity check.");
    return "PRAGMA foreign_keys=ON;\n" + schemaSql + "\n" + content;
  } finally {
    db.close();
  }
}
