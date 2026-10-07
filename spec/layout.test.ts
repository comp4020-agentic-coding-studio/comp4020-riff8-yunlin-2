import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

// A colophon can never be edited or deleted, so a layout bug one body
// triggers is permanent for every future visitor. A single long word with no
// spaces (well within the 320-character limit — a pasted URL, a mashed key,
// anything) has no natural break point: without overflow-wrap, a CSS grid
// column won't shrink below that word's min-content width, so it blew the
// whole page out sideways. Confirmed live before this fix (scrollWidth 2203
// vs an innerWidth of 1280) and after (736, matching the intended 46rem body
// max-width). This greps the actual rule rather than re-deriving a browser
// layout check, the same style as accent.test.ts for a CSS property no
// request-level test can see.
const css = readFileSync("public/styles.css", "utf8");

it(".colophon-body can't be blown out sideways by an unbroken run of text", () => {
  const match = css.match(/\.colophon-body\s*\{([^}]*)\}/);
  expect(match, "expected a .colophon-body rule in styles.css").toBeTruthy();
  expect(match![1]).toMatch(/overflow-wrap\s*:\s*anywhere/);
});

// A scroll's title is just as permanent (scrolls are never renamed) and is
// rendered as the page's h1, so an unbroken 80-character title would do the
// same thing to every visit of that scroll for good.
it("a scroll title in the page heading can't blow the page out sideways either", () => {
  const match = css.match(/\.site-header h1\s*\{([^}]*)\}/);
  expect(match, "expected a .site-header h1 rule in styles.css").toBeTruthy();
  expect(match![1]).toMatch(/overflow-wrap\s*:\s*anywhere/);
});
