import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "@/lib/db/schema";
import { seedCatalog } from "@/lib/db/seed";

export type Db = Database.Database;

/**
 * Opens (creating if needed) a SQLite database, applies the schema and seeds
 * the catalog on first use. This is why the app needs no setup step.
 */
export function openDatabase(path: string): Db {
  if (path !== ":memory:") {
    mkdirSync(dirname(resolve(path)), { recursive: true });
  }
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  seedCatalog(db);
  return db;
}

// One connection per server process. It is kept on globalThis so that the dev
// server's hot reload reuses it instead of opening a new handle on every edit.
const globalForDb = globalThis as typeof globalThis & {
  __jadeadornDb?: Db;
};

export function getDb(): Db {
  globalForDb.__jadeadornDb ??= openDatabase(
    process.env.DATABASE_PATH ?? "data/store.db",
  );
  return globalForDb.__jadeadornDb;
}
