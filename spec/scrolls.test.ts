import { expect, inject, it } from "vitest";
import { DEFAULT_SLUG } from "../src/schema.ts";

// Many scrolls, each its own room: what's written in one never shows in
// another, `/` is the default scroll rather than a second implementation, and
// a scroll's address is derived from its title without ever failing on a
// collision.
const baseUrl = inject("baseUrl");
const unique = (): string => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function startScroll(title: string): Promise<Response> {
  return fetch(new URL("/scrolls", baseUrl), {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ title }).toString(),
  });
}

async function newScroll(title: string): Promise<string> {
  const res = await startScroll(title);
  expect(res.status).toBe(303);
  return res.headers.get("location")!;
}

async function writeTo(path: string, body: string): Promise<Response> {
  const action = path === "/" ? "/colophons" : `${path}/colophons`;
  return fetch(new URL(action, baseUrl), {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ body }).toString(),
  });
}

const page = async (path: string): Promise<string> => (await fetch(new URL(path, baseUrl))).text();

it("a colophon written in one scroll appears only in that scroll", async () => {
  const run = unique();
  const a = await newScroll(`Room A ${run}`);
  const b = await newScroll(`Room B ${run}`);
  expect(a).not.toBe(b);

  expect((await writeTo(a, `only-in-a-${run}`)).headers.get("location")).toBe(a);
  expect((await writeTo(b, `only-in-b-${run}`)).headers.get("location")).toBe(b);

  const pageA = await page(a);
  const pageB = await page(b);
  expect(pageA).toContain(`only-in-a-${run}`);
  expect(pageA).not.toContain(`only-in-b-${run}`);
  expect(pageB).toContain(`only-in-b-${run}`);
  expect(pageB).not.toContain(`only-in-a-${run}`);
  expect(await page("/")).not.toContain(`only-in-a-${run}`);
});

it("/ and /scroll/<default slug> are the same scroll", async () => {
  const marker = `default-${unique()}`;
  await writeTo("/", marker);
  expect(await page(`/scroll/${DEFAULT_SLUG}`)).toContain(marker);

  const res = await writeTo(`/scroll/${DEFAULT_SLUG}`, `${marker}-again`);
  expect(res.headers.get("location")).toBe("/");
  expect(await page("/")).toContain(`${marker}-again`);
});

it("derives a URL-safe slug from the title and suffixes a collision rather than failing", async () => {
  const run = unique();
  const first = await newScroll(`  Évening <Rain>, ${run}!  `);
  expect(first).toBe(`/scroll/evening-rain-${run}`);
  const second = await newScroll(`Evening rain ${run}`);
  expect(second).toBe(`/scroll/evening-rain-${run}-2`);

  const html = await page(second);
  expect(html).toContain(`<h1>Evening rain ${run}</h1>`);
  expect(await page(first)).toContain(`<h1>Évening &lt;Rain&gt;, ${run}!</h1>`);
});

it("rejects an empty or over-long title instead of creating a scroll", async () => {
  expect((await startScroll("   ")).headers.get("location")).toBe("/scrolls?error=empty");
  expect((await startScroll("x".repeat(81))).headers.get("location")).toBe("/scrolls?error=long");
  expect(await page("/scrolls")).not.toContain("x".repeat(81));
});

it("lists every scroll in the lobby with its colophon count, linked from /", async () => {
  const run = unique();
  const path = await newScroll(`Counted ${run}`);
  await writeTo(path, "one");
  await writeTo(path, "two");

  const lobby = await page("/scrolls");
  const at = lobby.indexOf(`href="${path}"`);
  expect(at).toBeGreaterThan(-1);
  expect(lobby.slice(at, lobby.indexOf("</li>", at))).toContain("2 colophons");
  expect(lobby).toContain('href="/"');
  expect(await page("/")).toContain('href="/scrolls"');
});

it("a new scroll shows an honest blank placeholder, not the painting", async () => {
  const html = await page(await newScroll(`Blank ${unique()}`));
  expect(html).toContain('class="scroll-blank"');
  expect(html).toContain("unmarked scroll");
  expect(html).not.toContain("scroll.avif");
  expect(html).not.toContain("<h1>Colophon</h1>");
});

it("an unknown scroll is a 404, not a fresh room", async () => {
  const res = await fetch(new URL(`/scroll/never-started-${unique()}`, baseUrl));
  expect(res.status).toBe(404);
});
