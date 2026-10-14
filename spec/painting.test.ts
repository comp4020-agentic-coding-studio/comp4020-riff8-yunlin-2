import { readFileSync } from "node:fs";
import { expect, inject, it } from "vitest";

// The home scroll shows the real painting at its true proportions: three
// tiles of one 6677×454 scan, laid edge to edge at a shared height. If a
// tile's declared width/height ever disagree with the file itself, the
// browser stretches it, so this reads each AVIF's own size (its `ispe` box)
// and checks the markup against it, and that the tiles share one height.
const baseUrl = inject("baseUrl");

function avifSize(path: string): [number, number] {
  const bytes = readFileSync(path);
  const at = bytes.indexOf("ispe");
  expect(at, `${path} has no ispe box`).toBeGreaterThan(-1);
  return [bytes.readUInt32BE(at + 8), bytes.readUInt32BE(at + 12)];
}

it("each painting tile is declared at its file's own size, all one height", async () => {
  const html = await (await fetch(new URL("/", baseUrl))).text();
  const track = html.slice(html.indexOf('<div class="scroll-track">'), html.indexOf("</div>", html.indexOf('<div class="scroll-track">')));
  const tiles = [...track.matchAll(/<img src="\/public\/([\w.-]+)" width="(\d+)" height="(\d+)"/g)];
  expect(tiles.length).toBe(3);
  const heights = new Set<number>();
  for (const [, file, width, height] of tiles) {
    expect(avifSize(`public/${file}`)).toEqual([Number(width), Number(height)]);
    heights.add(Number(height));
  }
  expect(heights.size).toBe(1);
});

it("the tiles are shown at full height with width following, never a fixed width", () => {
  const css = readFileSync("public/styles.css", "utf8");
  const rule = css.match(/\.scroll-track img\s*\{([^}]*)\}/)![1]!;
  expect(rule).toMatch(/height:\s*100%/);
  expect(rule).toMatch(/width:\s*auto/);
  expect(rule).not.toMatch(/object-fit/);
});
