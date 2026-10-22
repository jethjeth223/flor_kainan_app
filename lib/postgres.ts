import { AsyncLocalStorage } from "node:async_hooks";
import { Pool, type PoolClient } from "pg";
import { databaseConfig } from "./database-config.mjs";

// One pool per server process; no customer identity is stored in the pool.
let pool: Pool | undefined;
const transaction = new AsyncLocalStorage<PoolClient>();
function connectionPool() {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is not configured");
  return (pool ??= new Pool(databaseConfig()));
}

// Port the pilot's bound statements without interpolating values into SQL.
// Handles SQLite's repeated ?1 parameters as well as ordinary ? placeholders.
export function postgresSql(source: string) {
  let index = 0;
  let quoted = false;
  let sql = "";
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === "'") {
      sql += char;
      if (quoted && source[i + 1] === "'") {
        sql += source[++i];
        continue;
      }
      quoted = !quoted;
    } else if (char === "?" && !quoted) {
      const match = source.slice(i + 1).match(/^\d+/)?.[0];
      sql += "$" + (match ? Number(match) : ++index);
      if (match) i += match.length;
    } else sql += char;
  }
  if (/^INSERT OR IGNORE /i.test(sql)) {
    sql =
      sql.replace(/^INSERT OR IGNORE /i, "INSERT ") + " ON CONFLICT DO NOTHING";
  }
  return sql;
}
export class Statement {
  constructor(
    readonly sql: string,
    readonly values: unknown[] = [],
  ) {}
  bind(...values: unknown[]) {
    return new Statement(this.sql, values);
  }
  async all<T = any>(): Promise<{ results: T[]; meta: { changes: number } }> {
    const runner = transaction.getStore();
    if (!runner) return withTransaction(() => this.all<T>());
    const result = await runner.query(postgresSql(this.sql), this.values);
    // pg returns SUM(integer) as int8 text. API money values are integer
    // centavos; refuse unsafe conversion rather than silently losing precision.
    const rows = result.rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => {
          const field = result.fields.find((f) => f.name === key);
          if (
            field &&
            [20, 1700].includes(field.dataTypeID) &&
            value !== null
          ) {
            const number = Number(value);
            if (!Number.isSafeInteger(number))
              throw new Error("Amount exceeds safe integer range");
            return [key, number];
          }
          return [key, value];
        }),
      ),
    );
    return { results: rows as T[], meta: { changes: result.rowCount ?? 0 } };
  }
  async first<T = any>(): Promise<T | null> {
    return (await this.all<T>()).results[0] ?? null;
  }
  async run() {
    return this.all();
  }
}
export const database = {
  prepare: (sql: string) => new Statement(sql),
  batch: (statements: Statement[]) =>
    withTransaction(async () => {
      const results = [];
      for (const statement of statements) results.push(await statement.all());
      return results;
    }),
};

export async function withTransaction<T>(
  work: () => Promise<T>,
  readOnly = false,
): Promise<T> {
  if (transaction.getStore()) return work();
  const client = await connectionPool().connect();
  try {
    await client.query(
      readOnly ? "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY" : "BEGIN",
    );
    // Supavisor may ignore startup options. Set role and schema inside the
    // transaction so pooling cannot silently run a query as postgres.
    await client.query("SET LOCAL ROLE kainan_server");
    await client.query("SET LOCAL search_path=kainan,pg_catalog");
    await client.query("SET LOCAL statement_timeout='15s'");
    // This is a single-shop ledger. Serialize writes across server replicas,
    // including validation reads, closeouts, stock edits, and payment review.
    if (!readOnly)
      await client.query("SELECT pg_advisory_xact_lock(734201982)");
    const result = await transaction.run(client, work);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
