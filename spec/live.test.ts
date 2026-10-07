import { expect, inject, it } from "vitest";

// GET /scroll/:slug/live?since=<id> is the one live feed: only that scroll's
// colophons newer than `since`, oldest first, each rendered by the same
// colophonEntry as the page so escaping and "yours" marking can't drift.
const baseUrl = inject("baseUrl");
const unique = (): string => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

interface Live {
  colophons: { id: number; html: string }[];
}

function cookieFrom(res: Response): string {
  return res.headers.get("set-cookie")!.split(";")[0]!;
}

async function visitor(): Promise<string> {
  return cookieFrom(await fetch(new URL("/scrolls", baseUrl)));
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

async function write(path: string, body: string, cookie: string): Promise<void> {
  await fetch(new URL(`${path}/colophons`, baseUrl), {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
    body: new URLSearchParams({ body }).toString(),
  });
}

async function live(path: string, since: number, cookie: string): Promise<Live> {
  const res = await fetch(new URL(`${path}/live?since=${since}`, baseUrl), { headers: { Cookie: cookie } });
  expect(res.status).toBe(200);
  return (await res.json()) as Live;
}

it("returns a new colophon once, marked yours only for its author", async () => {
  const run = unique();
  const path = await newScroll(`Live ${run}`);
  const author = await visitor();
  const reader = await visitor();

  await write(path, `before-${run}`, author);
  const first = await live(path, 0, reader);
  expect(first.colophons).toHaveLength(1);
  const since = first.colophons[0]!.id;

  await write(path, `arrives-<live>-${run}`, author);

  const forReader = await live(path, since, reader);
  expect(forReader.colophons).toHaveLength(1);
  expect(forReader.colophons[0]!.html).toContain(`arrives-&lt;live&gt;-${run}`);
  expect(forReader.colophons[0]!.html).not.toContain("<live>");
  expect(forReader.colophons[0]!.html).not.toContain("yours");
  expect(forReader.colophons[0]!.html).not.toContain("colophon--mine");

  const forAuthor = await live(path, since, author);
  expect(forAuthor.colophons).toHaveLength(1);
  expect(forAuthor.colophons[0]!.html).toContain("colophon--mine");
  expect(forAuthor.colophons[0]!.html).toContain("yours");

  const upToDate = await live(path, forReader.colophons[0]!.id, reader);
  expect(upToDate.colophons).toEqual([]);
});

it("returns new rows oldest first", async () => {
  const run = unique();
  const path = await newScroll(`Order ${run}`);
  const author = await visitor();
  for (const n of [1, 2, 3]) await write(path, `row-${n}-${run}`, author);
  const { colophons } = await live(path, 0, author);
  expect(colophons.map((c) => c.html.match(/row-(\d)/)![1])).toEqual(["1", "2", "3"]);
  expect(colophons.map((c) => c.id)).toEqual([...colophons.map((c) => c.id)].sort((a, b) => a - b));
});

it("never carries one scroll's colophons into another scroll's feed", async () => {
  const run = unique();
  const a = await newScroll(`Feed A ${run}`);
  const b = await newScroll(`Feed B ${run}`);
  const author = await visitor();
  await write(a, `feed-a-${run}`, author);
  await write(b, `feed-b-${run}`, author);

  const feedA = JSON.stringify(await live(a, 0, author));
  const feedB = JSON.stringify(await live(b, 0, author));
  expect(feedA).toContain(`feed-a-${run}`);
  expect(feedA).not.toContain(`feed-b-${run}`);
  expect(feedB).toContain(`feed-b-${run}`);
  expect(feedB).not.toContain(`feed-a-${run}`);
});

it("rejects a since that isn't an id, and 404s an unknown scroll", async () => {
  const path = await newScroll(`Bad since ${unique()}`);
  expect((await fetch(new URL(`${path}/live?since=abc`, baseUrl))).status).toBe(400);
  expect((await fetch(new URL(`${path}/live?since=-1`, baseUrl))).status).toBe(400);
  expect((await fetch(new URL(`/scroll/nowhere-${unique()}/live?since=0`, baseUrl))).status).toBe(404);
});
