import { readFileSync } from "node:fs";
import { expect, inject, it } from "vitest";

// The ink drift behind a scroll: its own recent colophons only, escaped
// through the same escapeHtml, cut short for display only, hidden from
// assistive tech, still under reduced motion, absent on an empty scroll,
// and never in the seal colour.
const baseUrl = inject("baseUrl");
const unique = (): string => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const css = readFileSync("public/styles.css", "utf8");

async function newScroll(title: string): Promise<string> {
  const res = await fetch(new URL("/scrolls", baseUrl), {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ title }).toString(),
  });
  return res.headers.get("location")!;
}

async function write(path: string, body: string): Promise<void> {
  await fetch(new URL(`${path}/colophons`, baseUrl), {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ body }).toString(),
  });
}

function drift(html: string): string {
  const at = html.indexOf('<div class="ink-drift"');
  if (at === -1) return "";
  return html.slice(at, html.indexOf("<header", at));
}

const page = async (path: string): Promise<string> => (await fetch(new URL(path, baseUrl))).text();

it("an empty scroll has no drift at all", async () => {
  expect(drift(await page(await newScroll(`Empty drift ${unique()}`)))).toBe("");
});

it("drifts this scroll's own ink, escaped, truncated, and hidden from assistive tech", async () => {
  const run = unique();
  const here = await newScroll(`Drift here ${run}`);
  const there = await newScroll(`Drift there ${run}`);
  const long = `long-${run} ${"brush ".repeat(30)}END-OF-LONG`;
  await write(here, `<script>alert(1)</script> ${run}`);
  await write(here, long);
  await write(there, `elsewhere-${run}`);

  const band = drift(await page(here));
  expect(band).toContain('aria-hidden="true"');
  expect(band).toContain(`&lt;script&gt;alert(1)&lt;/script&gt; ${run}`);
  expect(band).not.toContain("<script>");
  expect(band).toContain(`long-${run}`);
  expect(band).not.toContain("END-OF-LONG");
  expect(band).toContain("…");
  expect(band).not.toContain(`elsewhere-${run}`);

  // display-only: the real list still has every word
  expect(await page(here)).toContain("END-OF-LONG");
});

it("never takes pointer events, freezes under reduced motion, and never uses --seal", () => {
  const rule = (selector: string): string => css.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`))![1]!;
  expect(rule("\\.ink-drift")).toMatch(/pointer-events:\s*none/);
  const reduced = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/)![1]!;
  expect(reduced).toMatch(/\.ink-drift-row\s*\{\s*animation:\s*none/);
  for (const [, body] of css.matchAll(/\.ink-drift[\w-]*(?:\s+\w+)?\s*\{([^}]*)\}/g)) {
    expect(body).not.toContain("--seal");
  }
});
