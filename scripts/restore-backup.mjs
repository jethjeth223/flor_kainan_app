import { readFileSync, openSync, closeSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { validatedRestoreSql } from "./backup-tools.mjs";
const [input, output] = process.argv.slice(2);
if (!input || !output)
  throw new Error(
    "Usage: node scripts/restore-backup.mjs backup.json NEW-recovered.sqlite",
  );
const data = JSON.parse(readFileSync(resolve(input), "utf8"));
const sql = validatedRestoreSql(data);
const path = resolve(output);
mkdirSync(dirname(path), { recursive: true });
// Exclusive creation refuses to overwrite any existing file.
closeSync(openSync(path, "wx"));
const db = new DatabaseSync(path);
try {
  db.exec(sql);
  console.log("Validated recovery database created: " + path);
  console.log("Image files must be recovered from private storage separately.");
} finally {
  db.close();
}
