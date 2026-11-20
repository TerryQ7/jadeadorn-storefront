// Deletes the local SQLite database. The app recreates and reseeds it on the
// next request, so this is a quick way back to a clean demo.
//
// Usage: npm run db:reset   (stop the dev server first)

import { rmSync } from "node:fs";

const path = process.env.DATABASE_PATH ?? "data/store.db";
for (const suffix of ["", "-wal", "-shm"]) {
  rmSync(path + suffix, { force: true });
}
console.log(`Removed ${path}. It will be recreated on the next request.`);
