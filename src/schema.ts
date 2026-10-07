import type { DatabaseSync } from "node:sqlite";

// The scroll that existed before there were scrolls: Wang Yi's painting, the
// one every pre-migration colophon was written under. `/` renders it.
export const DEFAULT_SLUG = "portrait-of-yang-zhuxi";
export const DEFAULT_TITLE = "Wang Yi, Portrait of Yang Zhuxi";

// Runs on every boot, against whatever /data already holds. The Fly volume
// has a colophons table from before scrolls existed, with real rows and no
// scroll_id, and CREATE TABLE IF NOT EXISTS never adds a column to a table
// that's already there — so the column is added by checking table_info, not
// by trusting the CREATE. A fresh database takes the same path: it gets the
// original table, then the same ALTER, so the migration is exercised on every
// local boot rather than only once in production.
export function migrate(db: DatabaseSync): void {
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS colophons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS scrolls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);

    db.prepare(
      `INSERT OR IGNORE INTO scrolls (slug, title, created_at)
       VALUES (?, ?, COALESCE((SELECT MIN(created_at) FROM colophons), ?))`,
    ).run(DEFAULT_SLUG, DEFAULT_TITLE, Date.now());

    const columns = db.prepare("PRAGMA table_info(colophons)").all() as { name: string }[];
    if (!columns.some((c) => c.name === "scroll_id")) {
      db.exec("ALTER TABLE colophons ADD COLUMN scroll_id INTEGER REFERENCES scrolls(id)");
    }

    // Only rows from before the column existed are NULL; every insert since
    // names its scroll, so this is a no-op on every boot after the first.
    db.prepare(
      "UPDATE colophons SET scroll_id = (SELECT id FROM scrolls WHERE slug = ?) WHERE scroll_id IS NULL",
    ).run(DEFAULT_SLUG);

    db.exec("CREATE INDEX IF NOT EXISTS colophons_by_scroll ON colophons (scroll_id, id)");
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
