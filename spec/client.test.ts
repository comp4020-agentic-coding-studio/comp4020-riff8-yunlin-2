import { JSDOM } from "jsdom";
import { expect, inject, it } from "vitest";

// Runs the client script the app actually serves, inside the page the app
// actually serves, with the window's fetch pointed at the running app under
// one visitor's cookie. A second visitor writes; the first visitor's page has
// to grow the new colophon with no reload.
const baseUrl = inject("baseUrl");
const unique = (): string => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

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

async function write(path: string, body: string, cookie: string): Promise<void> {
  await fetch(new URL(`${path}/colophons`, baseUrl), {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
    body: new URLSearchParams({ body }).toString(),
  });
}

// Loads `path` as `cookie` and runs its inline script. `failFirst` makes the
// first n polls reject, as a dropped connection would.
async function openPage(path: string, cookie: string, failFirst = 0): Promise<{ dom: JSDOM; calls: string[] }> {
  const html = await (await fetch(new URL(path, baseUrl), { headers: { Cookie: cookie } })).text();
  const script = html.match(/<script>([\s\S]*?)<\/script>/)![1]!;
  const dom = new JSDOM(html.replace(/<script>[\s\S]*?<\/script>/, ""), {
    url: new URL(path, baseUrl).href,
    runScripts: "outside-only",
  });
  const calls: string[] = [];
  let failures = failFirst;
  Object.assign(dom.window, {
    fetch: async (input: string, init?: RequestInit) => {
      calls.push(input);
      if (failures-- > 0) throw new TypeError("network down");
      const headers = { ...(init?.headers as Record<string, string>), Cookie: cookie };
      return fetch(new URL(input, baseUrl), { ...init, headers });
    },
  });
  dom.window.eval(script);
  return { dom, calls };
}

async function until(check: () => boolean, ms = 6000): Promise<void> {
  const deadline = Date.now() + ms;
  while (!check()) {
    if (Date.now() > deadline) throw new Error("timed out waiting");
    await new Promise((r) => setTimeout(r, 100));
  }
}

it("a colophon written elsewhere appears on an open page without a reload", async () => {
  const run = unique();
  const path = await newScroll(`Client ${run}`);
  const reader = await visitor();
  const author = await visitor();
  const { dom } = await openPage(path, reader);
  const doc = dom.window.document;
  expect(doc.querySelector(".empty-note")).not.toBeNull();

  await write(path, `<i>live</i> ${run}`, author);
  await until(() => doc.querySelectorAll(".colophon").length === 1);

  const entry = doc.querySelector(".colophon")!;
  expect(entry.querySelector(".colophon-body")!.textContent).toBe(`<i>live</i> ${run}`);
  expect(entry.querySelector("i")).toBeNull();
  expect(entry.classList.contains("colophon--mine")).toBe(false);
  expect(doc.querySelector(".empty-note")).toBeNull();

  // and it isn't appended a second time on later polls
  await new Promise((r) => setTimeout(r, 2300));
  expect(doc.querySelectorAll(".colophon")).toHaveLength(1);
  dom.window.close();
});

it("keeps polling after a failed poll instead of giving up", async () => {
  const run = unique();
  const path = await newScroll(`Retry ${run}`);
  const reader = await visitor();
  const { dom, calls } = await openPage(path, reader, 2);
  await write(path, `after-failure-${run}`, await visitor());
  await until(() => dom.window.document.querySelectorAll(".colophon").length === 1);
  expect(calls.length).toBeGreaterThanOrEqual(3);
  dom.window.close();
});

it("shows the sidebar of seals on this scroll, yours marked, only once the script runs", async () => {
  const path = await newScroll(`Sidebar ${unique()}`);
  const reader = await visitor();
  const other = await visitor();
  await fetch(new URL(`${path}/live?since=0`, baseUrl), { headers: { Cookie: other } });

  const { dom } = await openPage(path, reader);
  const doc = dom.window.document;
  const sidebar = doc.querySelector<HTMLElement>("aside.presence")!;
  expect(sidebar.hidden).toBe(true);
  expect(sidebar.getAttribute("aria-label")).toBeTruthy();

  await until(() => doc.querySelectorAll(".presence-list li").length === 2);
  expect(sidebar.hidden).toBe(false);
  const items = [...doc.querySelectorAll(".presence-list li")];
  expect(items[0]!.textContent).toContain("you");
  expect(items[1]!.textContent).not.toContain("you");
  dom.window.close();
});

it("polls once straight away, so the sidebar doesn't wait a full tick to appear", async () => {
  const path = await newScroll(`Prompt ${unique()}`);
  const { dom, calls } = await openPage(path, await visitor());
  await new Promise((r) => setTimeout(r, 300));
  expect(calls).toHaveLength(1);
  dom.window.close();
});
