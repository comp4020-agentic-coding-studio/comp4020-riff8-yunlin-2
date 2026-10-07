import { expect, inject, it } from "vitest";
import { createPresence } from "../src/presence.ts";
import { sealGlyph } from "../src/seal.ts";

// docs/decisions/0001-presence-sidebar.md: a seal is on a scroll once it
// polls it, once however many times it polls, gone after the timeout, and
// never on a scroll it hasn't polled.
const baseUrl = inject("baseUrl");
const unique = (): string => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

it("tracks presence per scroll with a timeout, on a fake clock", () => {
  let clock = 0;
  const presence = createPresence(5000, () => clock);

  presence.beat(1, "a");
  expect(presence.present(1)).toEqual(["a"]);
  expect(presence.present(2)).toEqual([]);

  clock = 1000;
  presence.beat(1, "a");
  presence.beat(1, "b");
  expect(presence.present(1)).toEqual(["a", "b"]);

  clock = 5999; // a last beat at 1000, so still within 5000ms
  expect(presence.present(1)).toEqual(["a", "b"]);
  presence.beat(2, "a");

  clock = 6001;
  expect(presence.present(1)).toEqual([]);
  expect(presence.present(2)).toEqual(["a"]);

  clock = 11002;
  expect(presence.present(2)).toEqual([]);
});

interface Live {
  present: { glyph: string; you: boolean }[];
}

async function visitor(): Promise<string> {
  return (await fetch(new URL("/scrolls", baseUrl))).headers.get("set-cookie")!.split(";")[0]!;
}

async function newScroll(title: string): Promise<string> {
  const res = await fetch(new URL("/scrolls", baseUrl), {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ title }).toString(),
  });
  return res.headers.get("location")!;
}

async function poll(path: string, cookie: string): Promise<Live & { raw: string }> {
  const res = await fetch(new URL(`${path}/live?since=0`, baseUrl), { headers: { Cookie: cookie } });
  const raw = await res.text();
  return { ...(JSON.parse(raw) as Live), raw };
}

it("lists each visitor once, as a glyph, only on the scroll they're polling", async () => {
  const run = unique();
  const here = await newScroll(`Presence here ${run}`);
  const elsewhere = await newScroll(`Presence elsewhere ${run}`);
  const a = await visitor();
  const b = await visitor();
  const tokenA = a.split("=")[1]!;

  await poll(here, a);
  await poll(here, a); // a second tab, or the next tick
  const seenByB = await poll(here, b);
  expect(seenByB.present).toHaveLength(2);
  expect(seenByB.present.filter((p) => p.you)).toEqual([{ glyph: sealGlyph(b.split("=")[1]!), you: true }]);
  expect(seenByB.present.filter((p) => !p.you)).toEqual([{ glyph: sealGlyph(tokenA), you: false }]);
  expect(seenByB.raw).not.toContain(tokenA);

  const seenElsewhere = await poll(elsewhere, b);
  expect(seenElsewhere.present).toEqual([{ glyph: sealGlyph(b.split("=")[1]!), you: true }]);
});
