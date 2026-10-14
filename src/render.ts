import { readFileSync } from "node:fs";
import { escapeHtml } from "./html.ts";
import { sealGlyph } from "./seal.ts";
import type { Colophon, Scroll, ScrollSummary } from "./db.ts";
import { DEFAULT_SLUG } from "./schema.ts";

const dateFmt = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Australia/Canberra",
});

export const MAX_BODY_LENGTH = 320;

// Read once at boot and inlined, so the page needs no second request and the
// static route keeps serving only the extensions it already allows.
const CLIENT_SCRIPT = readFileSync(new URL("./client.js", import.meta.url), "utf8");

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en-AU">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta
      name="description"
      content="Colophon: shared margins on scrolls, written a line at a time by whoever visits."
    />
    <link rel="icon" href="/public/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/public/styles.css" />
  </head>
  <body>
    ${body}
  </body>
</html>
`;
}

export function colophonEntry(c: Colophon, ownToken: string): string {
  const mine = c.token === ownToken;
  const glyph = sealGlyph(c.token);
  return `<li class="colophon${mine ? " colophon--mine" : ""}" data-id="${c.id}">
        <span class="colophon-seal" aria-hidden="true">${glyph}</span>
        <p class="colophon-body">${escapeHtml(c.body)}</p>
        <p class="colophon-date">${dateFmt.format(new Date(c.created_at))}${mine ? " — yours" : ""}</p>
      </li>`;
}

export const MAX_TITLE_LENGTH = 80;

// Where a scroll lives. The default one is also reachable at
// /scroll/<its slug>, but `/` is its canonical address, so redirects after
// writing land there.
export function scrollPath(scroll: Scroll): string {
  return scroll.slug === DEFAULT_SLUG ? "/" : `/scroll/${encodeURIComponent(scroll.slug)}`;
}

// The painting, as three tiles cut from one 6677×454 scan (each under the
// 2560px image limit) and laid edge to edge, so the viewer can show it at
// full height without upscaling. scroll.avif is the same scan, small, for the
// overview strip.
const PAINTING = {
  artist: "Wang Yi",
  title: "Portrait of Yang Zhuxi",
  year: "1363",
  note: "Ni Zan painted the pine and rock. Palace Museum, Beijing.",
  tiles: [2226, 2226, 2225].map((width, i) => ({ src: `/public/scroll-${i + 1}.avif`, width, height: 454 })),
};

function paintingFigure(): string {
  return `<figure class="scroll-frame">
        <div class="scroll-viewer">
          <div class="scroll-scroller" id="scroller" tabindex="0" role="img" data-start="0.69"
               aria-label="A handscroll painting: Wang Yi's 1363 portrait of Yang Zhuxi standing under a pine, with Ni Zan's rocks and pine, flanked by six and a half centuries of collectors' colophons and seals.">
            <div class="scroll-track">
              ${PAINTING.tiles.map((t) => `<img src="${t.src}" width="${t.width}" height="${t.height}" alt="" />`).join("\n              ")}
            </div>
          </div>
        </div>
        <div class="scroll-controls">
          <div class="scroll-overview" aria-hidden="true">
            <img src="/public/scroll.avif" width="2400" height="163" alt="" />
            <span class="scroll-overview-window" hidden></span>
          </div>
          <p class="scroll-hint">
            <span>Scroll or swipe sideways to explore</span>
            <button type="button" class="scroll-step" data-step="-1" aria-controls="scroller" hidden>
              <span aria-hidden="true">←</span><span class="visually-hidden">Earlier in the scroll (left)</span>
            </button>
            <button type="button" class="scroll-step" data-step="1" aria-controls="scroller" hidden>
              <span aria-hidden="true">→</span><span class="visually-hidden">Further along the scroll (right)</span>
            </button>
          </p>
        </div>
        <figcaption>
          <span class="caption-title">${PAINTING.artist} · <cite>${PAINTING.title}</cite> · ${PAINTING.year}</span>
          <span class="caption-note">${PAINTING.note} The six and a half centuries of colophons
            already written into its margins scroll by with it.</span>
        </figcaption>
      </figure>`;
}

function blankFigure(scroll: Scroll): string {
  return `<figure class="scroll-frame">
        <div class="scroll-blank" role="img"
             aria-label="An unmarked scroll: no painting, only blank paper."></div>
        <figcaption>
          <span class="caption-title">An unmarked scroll · started ${dateFmt.format(new Date(scroll.created_at))}</span>
          <span class="caption-note">There is no painting here, only paper; whatever it becomes
            is written in its margin below.</span>
        </figcaption>
      </figure>`;
}

type Section = "scroll" | "scrolls" | "about" | undefined;

// The masthead every page shares: a wordmark and two links, then the page's
// own title and one line under it.
function siteBar(current: Section): string {
  const link = (href: string, label: string, section: Section): string =>
    `<a href="${href}"${current === section ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<header class="site-bar">
      <a class="wordmark" href="/">Colophon</a>
      <nav aria-label="Site">
        ${link("/scrolls", "All scrolls", "scrolls")}
        ${link("/readme/", "About", "about")}
      </nav>
    </header>`;
}

function titleBlock(title: string, subtitle?: string): string {
  return `<div class="site-header">
      <h1>${title}</h1>
      ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ""}
    </div>`;
}

function footer(ownToken?: string): string {
  const seal = ownToken
    ? `<p>Your seal is <span class="footer-seal">${sealGlyph(ownToken)}</span> on every scroll — remembered by
        your browser, not by a name.</p>`
    : "";
  return `<footer class="site-footer">
      ${seal}
      <p><a href="/scrolls">All scrolls</a> · <a href="/readme/">About Colophon</a></p>
    </footer>`;
}

// The one place a scroll becomes a page, default included.
export function renderScroll(scroll: Scroll, colophons: Colophon[], ownToken: string, error?: string): string {
  const isDefault = scroll.slug === DEFAULT_SLUG;
  const base = `/scroll/${encodeURIComponent(scroll.slug)}`;
  const errorMessage =
    error === "empty"
      ? "A colophon needs at least a few words."
      : error === "long"
        ? `Keep it to ${MAX_BODY_LENGTH} characters — the margin is not infinite.`
        : undefined;
  const lastId = colophons.at(-1)?.id ?? 0;

  const body = `
    ${siteBar(isDefault ? "scroll" : undefined)}
    ${titleBlock(
      isDefault ? "Colophon" : escapeHtml(scroll.title),
      isDefault ? "A shared margin on one painting." : "A shared margin on an unmarked scroll.",
    )}
    <main class="scroll-page" data-live="${base}/live">
      ${isDefault ? paintingFigure() : blankFigure(scroll)}

      <aside class="presence" aria-label="Seals on this scroll now" hidden>
        <h2 class="presence-heading">Here now</h2>
        <ul class="presence-list"></ul>
      </aside>

      <section class="colophons" aria-labelledby="colophons-heading">
        <h2 id="colophons-heading">Colophons</h2>
        <p class="section-note">
          Oldest first, the way a scroll unrolls. Yours is marked once it's here.
        </p>
        <ol class="colophon-list" data-since="${lastId}">
          ${colophons.map((c) => colophonEntry(c, ownToken)).join("\n          ")}
        </ol>
        ${colophons.length === 0 ? `<p class="empty-note">No one has written in the margin yet. The paper is waiting for ink.</p>` : ""}
      </section>

      <section class="write" aria-labelledby="write-heading">
        <h2 id="write-heading">Add yours</h2>
        ${errorMessage ? `<p class="form-error" role="alert">${escapeHtml(errorMessage)}</p>` : ""}
        <form method="post" action="${base}/colophons">
          <label for="body">A line for the margin</label>
          <textarea
            id="body"
            name="body"
            maxlength="${MAX_BODY_LENGTH}"
            rows="4"
            required
            aria-describedby="write-permanent"
          ></textarea>
          <p class="form-note" id="write-permanent">
            Up to ${MAX_BODY_LENGTH} characters, signed with your seal. It is permanent: nothing
            written here can be edited or taken back, the same as ink.
          </p>
          <button type="submit">Write it in</button>
        </form>
      </section>
    </main>
    ${footer(ownToken)}
    <script>
${CLIENT_SCRIPT}
    </script>
  `;

  return layout(isDefault ? "Colophon" : `${scroll.title} — Colophon`, body);
}

export function renderLobby(scrolls: ScrollSummary[], error?: string): string {
  const errorMessage =
    error === "empty"
      ? "A new scroll needs a title."
      : error === "long"
        ? `Keep the title to ${MAX_TITLE_LENGTH} characters.`
        : undefined;
  const count = (n: number): string => (n === 0 ? "no colophons yet" : n === 1 ? "1 colophon" : `${n} colophons`);

  const body = `
    ${siteBar("scrolls")}
    ${titleBlock("All scrolls", "Every scroll anyone has started, oldest first.")}
    <main class="lobby">
      <section aria-labelledby="scrolls-heading">
        <h2 id="scrolls-heading" class="visually-hidden">Scrolls</h2>
        <ol class="scroll-list">
          ${scrolls
            .map(
              (s) => `<li><a href="${escapeHtml(scrollPath(s))}">${escapeHtml(s.title)}</a>
            <span class="scroll-meta">${s.slug === DEFAULT_SLUG ? "the painting · " : ""}${count(s.colophon_count)}</span></li>`,
            )
            .join("\n          ")}
        </ol>
      </section>

      <section class="write" aria-labelledby="start-heading">
        <h2 id="start-heading">Start a scroll</h2>
        ${errorMessage ? `<p class="form-error" role="alert">${escapeHtml(errorMessage)}</p>` : ""}
        <form method="post" action="/scrolls">
          <label for="title">Title</label>
          <input id="title" name="title" type="text" maxlength="${MAX_TITLE_LENGTH}" required
                 aria-describedby="start-permanent" />
          <p class="form-note" id="start-permanent">
            A new scroll is blank paper with a title of up to ${MAX_TITLE_LENGTH} characters. Once
            started it stays, under that title, for good: nothing here is renamed or taken down.
          </p>
          <button type="submit">Start it</button>
        </form>
      </section>
    </main>
    ${footer()}
  `;
  return layout("All scrolls — Colophon", body);
}

export function renderNotFound(): string {
  const body = `
    ${siteBar(undefined)}
    ${titleBlock("No such scroll")}
    <main class="prose">
      <p>Nothing has been started at this address. <a href="/scrolls">See every scroll.</a></p>
    </main>
    ${footer()}
  `;
  return layout("Not found — Colophon", body);
}

export function renderReadme(html: string): string {
  const body = `
    ${siteBar("about")}
    <main class="prose">
      ${html}
    </main>
    ${footer()}
  `;
  return layout("About — Colophon", body);
}
