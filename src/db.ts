import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { migrate } from "./schema.ts";

// /data is the one thing that survives a restart or redeploy (fly.toml mounts
// a volume there). Locally and in CI (which mounts a throwaway /data of its
// own, per checks.yml) it exists too; only a bare local checkout falls back
// to a repo-relative path.
const DB_PATH = process.env.DB_PATH ?? (existsSync("/data") ? "/data/colophon.db" : "./data/colophon.db");
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
migrate(db);

export interface Colophon {
  id: number;
  scroll_id: number;
  token: string;
  body: string;
  created_at: number;
}

export interface Scroll {
  id: number;
  slug: string;
  title: string;
  created_at: number;
}

export interface ScrollSummary extends Scroll {
  colophon_count: number;
}

// A single poll never returns more than this; a client far behind catches up
// over the next few ticks instead of in one enormous response.
const LIVE_BATCH = 100;

const selectScrollBySlug = db.prepare("SELECT * FROM scrolls WHERE slug = ?");
const selectScrolls = db.prepare(`
  SELECT s.*, COUNT(c.id) AS colophon_count
  FROM scrolls s LEFT JOIN colophons c ON c.scroll_id = s.id
  GROUP BY s.id ORDER BY s.created_at ASC, s.id ASC
`);
const insertScroll = db.prepare("INSERT INTO scrolls (slug, title, created_at) VALUES (?, ?, ?)");
const selectColophons = db.prepare("SELECT * FROM colophons WHERE scroll_id = ? ORDER BY id ASC");
const selectSince = db.prepare("SELECT * FROM colophons WHERE scroll_id = ? AND id > ? ORDER BY id ASC LIMIT ?");
const selectRecent = db.prepare("SELECT * FROM colophons WHERE scroll_id = ? ORDER BY id DESC LIMIT ?");
const insertColophon = db.prepare("INSERT INTO colophons (scroll_id, token, body, created_at) VALUES (?, ?, ?, ?)");

export function findScroll(slug: string): Scroll | undefined {
  return selectScrollBySlug.get(slug) as unknown as Scroll | undefined;
}

export function listScrolls(): ScrollSummary[] {
  return selectScrolls.all() as unknown as ScrollSummary[];
}

// Lowercase ASCII letters and digits joined by single hyphens. Accents are
// folded off first (NFKD) so "Été" becomes "ete"; a title with no ASCII
// letters at all (all Chinese, say) still needs a URL, so it falls back to
// "scroll" and the collision suffix tells such scrolls apart.
export function slugify(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "scroll";
}

// node:sqlite is synchronous, so nothing can interleave between the lookup
// and the insert: a collision is always seen, and gets the next free suffix.
export function createScroll(title: string): Scroll {
  const base = slugify(title);
  let slug = base;
  for (let n = 2; findScroll(slug); n++) slug = `${base}-${n}`;
  insertScroll.run(slug, title, Date.now());
  return findScroll(slug)!;
}

export function listColophons(scrollId: number): Colophon[] {
  return selectColophons.all(scrollId) as unknown as Colophon[];
}

export function colophonsSince(scrollId: number, since: number): Colophon[] {
  return selectSince.all(scrollId, since, LIVE_BATCH) as unknown as Colophon[];
}

export function recentColophons(scrollId: number, limit: number): Colophon[] {
  return selectRecent.all(scrollId, limit) as unknown as Colophon[];
}

export function addColophon(scrollId: number, token: string, body: string): void {
  insertColophon.run(scrollId, token, body, Date.now());
}
