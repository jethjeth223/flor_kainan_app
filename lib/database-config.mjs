import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function databaseConfig() {
  let uri;
  try {
    uri = new URL(process.env.DATABASE_URL);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URI");
  }
  if (!["postgres:", "postgresql:"].includes(uri.protocol))
    throw new Error("DATABASE_URL must be a PostgreSQL URI");
  // pg connection-string SSL parameters can override the ssl object. Always
  // verify the Supabase certificate and hostname with our trusted CA instead.
  for (const key of [
    "sslmode",
    "sslrootcert",
    "sslcert",
    "sslkey",
    "ssl",
    "uselibpqcompat",
  ])
    uri.searchParams.delete(key);
  return {
    connectionString: uri.href,
    ssl: {
      rejectUnauthorized: true,
      ca: readFileSync(
        resolve(process.cwd(), "certs/supabase-root.crt"),
        "utf8",
      ),
    },
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  };
}
