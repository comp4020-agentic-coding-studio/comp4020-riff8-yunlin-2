import { expect, inject, it } from "vitest";

// addColophon is a single synchronous node:sqlite insert with no read-then-write
// check, unlike crit 7's booking overlap logic — but that's a reasoned claim
// about the code, not a tested one, until real concurrent requests confirm
// nothing about Node's async request handling (readBody's own await, the
// server's event loop) lets two writes corrupt or drop each other. Same
// technique as crit 7's addBooking/cancelBooking concurrency tests: genuinely
// parallel fetches, not sequential awaits, against the app's own running
// server.
const baseUrl = inject("baseUrl");

async function write(body: string): Promise<Response> {
  return fetch(new URL("/colophons", baseUrl), {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ body }).toString(),
  });
}

it("every one of many genuinely concurrent writes lands exactly once", async () => {
  const run = `concurrency-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const n = 30;
  // Trailing "x" stops marker "-1" from substring-matching inside "-10".."-19".
  const markers = Array.from({ length: n }, (_, i) => `${run}-${i}x`);

  const responses = await Promise.all(markers.map((marker) => write(marker)));
  for (const res of responses) expect(res.status).toBe(303);

  // Only the real list counts: the background ink drift repeats fragments.
  const page = await (await fetch(new URL("/", baseUrl))).text();
  const listAt = page.indexOf('<ol class="colophon-list"');
  const text = page.slice(listAt, page.indexOf("</ol>", listAt));
  for (const marker of markers) {
    expect(text.split(marker).length - 1, `expected exactly one "${marker}"`).toBe(1);
  }
});
