import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, expect, it } from "vitest";
import { DEFAULT_SLUG, migrate } from "../src/schema.ts";

// The Fly volume already holds colophons from before scrolls existed: a
// colophons table with real rows and no scroll_id. This seeds exactly that
// shape (the CREATE the pre-scrolls db.ts ran, verbatim) and runs the app's
// own boot migration over it, twice, since it runs on every boot.
let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

function legacyDatabase(): DatabaseSync {
  dir = mkdtempSync(join(tmpdir(), "colophon-migration-"));
  const db = new DatabaseSync(join(dir, "colophon.db"));
  db.exec(`
    CREATE TABLE IF NOT EXISTS colophons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);
  const insert = db.prepare("INSERT INTO colophons (token, body, created_at) VALUES (?, ?, ?)");
  insert.run("a", "the first, from before scrolls", 1000);
  insert.run("b", "the second", 2000);
  insert.run("a", "the third", 3000);
  return db;
}

it("gives every pre-scrolls colophon to one default scroll, in order, idempotently", () => {
  const db = legacyDatabase();
  migrate(db);
  migrate(db);

  const scrolls = db.prepare("SELECT * FROM scrolls").all() as { id: number; slug: string; created_at: number }[];
  expect(scrolls).toHaveLength(1);
  expect(scrolls[0]!.slug).toBe(DEFAULT_SLUG);
  expect(scrolls[0]!.created_at).toBe(1000);

  const rows = db.prepare("SELECT id, scroll_id, body FROM colophons ORDER BY id").all() as {
    id: number;
    scroll_id: number;
    body: string;
  }[];
  expect(rows.map((r) => r.body)).toEqual(["the first, from before scrolls", "the second", "the third"]);
  expect(rows.map((r) => r.id)).toEqual([1, 2, 3]);
  for (const r of rows) expect(r.scroll_id).toBe(scrolls[0]!.id);
  db.close();
});

it("migrates a fresh database to the same shape", () => {
  dir = mkdtempSync(join(tmpdir(), "colophon-migration-"));
  const db = new DatabaseSync(join(dir, "colophon.db"));
  migrate(db);
  const columns = (db.prepare("PRAGMA table_info(colophons)").all() as { name: string }[]).map((c) => c.name);
  expect(columns).toContain("scroll_id");
  expect(db.prepare("SELECT slug FROM scrolls").all()).toEqual([{ slug: DEFAULT_SLUG }]);
  db.close();
});
