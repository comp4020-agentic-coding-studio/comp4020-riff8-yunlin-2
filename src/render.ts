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

function paintingFigure(): string {
  return `<figure class="scroll-frame">
        <div class="scroll-scroller" tabindex="0" role="img"
             aria-label="A handscroll painting: Wang Yi's 1363 portrait of Yang Zhuxi standing under a pine, with Ni Zan's rocks and pine, flanked by six and a half centuries of collectors' colophons and seals.">
          <img src="/public/scroll.avif" alt="" />
        </div>
        <figcaption>
          Wang Yi, <cite>Portrait of Yang Zhuxi</cite>, 1363 — Ni Zan painted the pine and
          rock. Palace Museum, Beijing. Scroll sideways to see the whole thing, including
          six and a half centuries of colophons already written into its margins.
        </figcaption>
      </figure>`;
}

function blankFigure(scroll: Scroll): string {
  return `<figure class="scroll-frame">
        <div class="scroll-blank" role="img"
             aria-label="An unmarked scroll: no painting, only blank paper."></div>
        <figcaption>
          An unmarked scroll, started ${dateFmt.format(new Date(scroll.created_at))}. There is
          no painting here, only paper; whatever it becomes is written in its margin below.
        </figcaption>
      </figure>`;
}

// The one place a scroll becomes a page, default included.
export function renderScroll(scroll: Scroll, colophons: Colophon[], ownToken: string, error?: string): string {
  const isDefault = scroll.slug === DEFAULT_SLUG;
  const path = scrollPath(scroll);
  const base = `/scroll/${encodeURIComponent(scroll.slug)}`;
  const errorMessage =
    error === "empty"
      ? "A colophon needs at least a few words."
      : error === "long"
        ? `Keep it to ${MAX_BODY_LENGTH} characters — the margin is not infinite.`
        : undefined;
  const lastId = colophons.at(-1)?.id ?? 0;

  const body = `
    <header class="site-header">
      ${isDefault ? "" : `<p class="site-name"><a href="/">Colophon</a></p>`}
      <h1>${isDefault ? "Colophon" : escapeHtml(scroll.title)}</h1>
      <p class="kicker">${isDefault ? "a shared margin on one painting" : "a shared margin on an unmarked scroll"}</p>
      <p class="site-nav"><a href="/scrolls">all scrolls</a> · <a href="/readme/">what good means here</a></p>
    </header>
    <main data-scroll="${escapeHtml(scroll.slug)}" data-path="${escapeHtml(path)}">
      ${isDefault ? paintingFigure() : blankFigure(scroll)}

      <section aria-labelledby="colophons-heading">
        <h2 id="colophons-heading">Colophons</h2>
        <p class="section-note">
          Oldest first, the way a scroll unrolls. Yours is marked once it's here — nothing
          you write can be edited or taken back, the same as ink.
        </p>
        <ol class="colophon-list" data-since="${lastId}">
          ${colophons.map((c) => colophonEntry(c, ownToken)).join("\n          ")}
        </ol>
        ${colophons.length === 0 ? `<p class="empty-note">No one has written in the margin yet.</p>` : ""}
      </section>

      <section aria-labelledby="write-heading">
        <h2 id="write-heading">Add yours</h2>
        ${errorMessage ? `<p class="form-error" role="alert">${escapeHtml(errorMessage)}</p>` : ""}
        <form method="post" action="${base}/colophons">
          <label for="body">A line for the margin</label>
          <textarea
            id="body"
            name="body"
            maxlength="${MAX_BODY_LENGTH}"
            rows="3"
            required
          ></textarea>
          <button type="submit">Write it in</button>
        </form>
      </section>
    </main>
    <footer>
      <p>Your seal is <strong>${sealGlyph(ownToken)}</strong> on every scroll — remembered by
        your browser, not by a name. <a href="/readme/">Read more.</a></p>
    </footer>
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
  const count = (n: number): string => (n === 1 ? "1 colophon" : `${n} colophons`);

  const body = `
    <header class="site-header">
      <p class="site-name"><a href="/">Colophon</a></p>
      <h1>All scrolls</h1>
      <p class="kicker">every scroll anyone has started, oldest first</p>
      <p class="site-nav"><a href="/readme/">what good means here</a></p>
    </header>
    <main>
      <section aria-labelledby="scrolls-heading">
        <h2 id="scrolls-heading">Scrolls</h2>
        <ol class="scroll-list">
          ${scrolls
            .map(
              (s) => `<li><a href="${escapeHtml(scrollPath(s))}">${escapeHtml(s.title)}</a>
            <span class="scroll-count">${count(s.colophon_count)}</span></li>`,
            )
            .join("\n          ")}
        </ol>
      </section>

      <section aria-labelledby="start-heading">
        <h2 id="start-heading">Start a scroll</h2>
        <p class="section-note">
          A new scroll is blank paper with a title. Once started it stays, under that title,
          for good — nothing here is renamed or taken down.
        </p>
        ${errorMessage ? `<p class="form-error" role="alert">${escapeHtml(errorMessage)}</p>` : ""}
        <form method="post" action="/scrolls">
          <label for="title">Title</label>
          <input id="title" name="title" type="text" maxlength="${MAX_TITLE_LENGTH}" required />
          <button type="submit">Start it</button>
        </form>
      </section>
    </main>
  `;
  return layout("All scrolls — Colophon", body);
}

export function renderNotFound(): string {
  const body = `
    <header class="site-header">
      <p class="site-name"><a href="/">Colophon</a></p>
      <h1>No such scroll</h1>
    </header>
    <main>
      <p>Nothing has been started at this address. <a href="/scrolls">See every scroll.</a></p>
    </main>
  `;
  return layout("Not found — Colophon", body);
}

export function renderReadme(html: string): string {
  const body = `
    <header class="site-header">
      <h1><a href="/">Colophon</a></h1>
      <p class="kicker">what good means here</p>
    </header>
    <main class="prose">
      ${html}
    </main>
  `;
  return layout("About — Colophon", body);
}
