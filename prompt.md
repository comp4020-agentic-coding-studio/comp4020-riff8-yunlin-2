# Prompt: visual and responsive redesign of Colophon

You are running this unattended, start to finish, with nobody here to
answer questions. Make reasonable calls yourself and keep going.

Read first, in this order: `README.md`, `CLAUDE.md`, `PROCESS.md`,
`docs/decisions/0001-presence-sidebar.md`, `src/render.ts`, `src/client.js`,
`public/styles.css`, and the live site at
https://comp4020-riff8-yunlin-2.fly.dev/. Also look at `public/scroll.avif`
directly — it is the real painting and the only source of truth for what
the scroll actually looks like. The harness rules in `CLAUDE.md` are
non-negotiable and override anything below if they ever conflict: no
accounts, no editing/deleting colophons or renaming/deleting scrolls, no
silent truncation (320 chars per colophon, 80 per scroll title — reject,
don't truncate), no second escaping routine, no new meaning for `--seal`
beyond "this colophon is yours", presence stays glyph-only and per the
existing ADR, the JS-off path must keep working, every user string still
goes through `escapeHtml`.

## What this task is

This is a **visual and responsive layout redesign**, not a feature change
or a rewrite. Keep the existing stack, routes, data model, and all
documented behavior. Make the site read like a considered, contemporary
museum digital exhibit: quiet, clear, precise — something that lets a
visitor naturally move through "look at the painting → read the margin →
leave a line." Keep the paper/ink/vermilion-seal theme, but avoid both a
generic antique-template look and a generic SaaS-page look.

Three reference images are provided in `reference image/` at the repo
root: `computer1.png` (desktop, first screen), `computer2.png` (mobile,
full scrolled page), `computer2.png` is actually desktop continuation —
see exact mapping below:

- `reference image/computer1.png` — desktop first screen, target viewport
  **1920×1080**. Shows the overall composition: header, title block, the
  horizontal scroll viewer, caption, the two-column colophons/presence
  area below.
- `reference image/computer2.png` — **mobile**, full long page, target
  viewport **390×844**, shown as one continuous vertical capture (header
  through the submit button) — use this to see how the sections stack on
  a phone.
- `reference image/mobile.png` — a second **desktop** full-page capture,
  useful for seeing how "Here now" and "Colophons" relate to each other
  below the fold and confirming the two-column relationship from
  `computer1.png`.

(The three filenames don't neatly match their content — judge each image
by what it actually shows, not its filename, and treat the breakdown
above as the authoritative mapping.)

## How to use the reference images

The references are **compositions**, not assets — build them with real
HTML/CSS against the real data, don't try to drop in the images
themselves. The painting fragment, seal glyphs, and sample colophon text
visible in the references may have been altered by image generation.
**The real painting at `public/scroll.avif`, the real database content,
and the existing seal logic in `src/seal.ts`/`src/presence.ts` are the
source of truth.** Do not carry any invented colophon text, invented
seal glyphs, invented date, or invented painting details from the
reference images into the actual product. Where the three images
disagree on a detail, follow this prompt's written requirements and the
app's existing real behavior.

## Product behavior to preserve exactly

1. The home scroll is the real Wang Yi, *Portrait of Yang Zhuxi*
   handscroll; a visitor can browse the actual painting horizontally.
2. `/scrolls` lists every scroll and lets a visitor start a new blank one
   by title; a blank scroll's page uses the same visual system as the
   real painting's page.
3. Colophons render oldest-to-newest by write time, are never editable
   or deletable, and a new colophon appears live for everyone else with
   that scroll open.
4. A visitor is anonymous, identified only by a single-glyph seal tied
   to their browser; "Here now" shows only the seals currently on that
   scroll.
5. No accounts, avatars, likes, replies, rankings, visitor counts, image
   uploads, or activity feed. The no-JavaScript read/submit path must
   keep working.
6. The `/readme/` page (the piece's own written description) keeps its
   existing content.

This is a layout/visual change: prefer targeted edits to the existing
server-rendered markup (`render.ts`) and CSS (`public/styles.css`) over
rewriting the stack, and do not change the data model, route semantics,
or the behaviors above. If a reference image implies a new interactive
control the current code doesn't have (e.g. left/right arrows or a
scroll-thumbnail navigator — both appear in the references), only add it
if it can be made genuinely operable, keyboard-usable, and non-disruptive
to the existing horizontal scroll; otherwise replace it with a clear
"scroll/swipe horizontally" hint instead of a fake-looking control.

## Visual system

- Base palette: soft paper white around `#F7F3EA`; primary ink text
  around `#24231F`; secondary text around `#746D63`; hairline dividers
  around `#D8D0C2`; vermilion seal/primary-action color around `#A3402D`.
  Check real contrast, don't just eyeball it.
- Type: a serif with scroll/manuscript character but good legibility for
  headings and colophon text; a restrained sans-serif for nav, captions,
  dates, and form controls. Establish a clear type scale and line-height
  hierarchy rather than relying on browser defaults.
- Favor open composition, whitespace, hairlines, and the painting itself
  over decoration. Avoid default blue/purple link colors, card-everywhere
  layouts, heavy drop shadows, gradient buttons, or overdone antique
  textures.
- The current slow-drifting background text of past colophons competes
  with the foreground content. Remove it or reduce it drastically so the
  scroll itself is the one large visual focus on the page.
- Keep the existing single-glyph seal system; "your colophon" and "you
  are here" should be easy to recognize, but don't render every seal as
  the same high-saturation decoration.

## Page layout

### Main scroll page, desktop 1920×1080 (see `reference image/computer1.png`)

- Widen the page container and horizontal margins to suit a wide
  screen — `public/styles.css` currently caps `body` at `max-width:
  46rem` (around line 19), which reads as a narrow text column on a
  1920px display. Use a wider container sized for an art presentation,
  while keeping colophon body text at a comfortable reading measure
  (don't let colophon paragraphs themselves stretch full-width).
- Header: a simple `Colophon` wordmark plus `All scrolls` and `About`
  nav, as in the reference. First screen has a clear title (`Colophon`)
  and one short subtitle line (e.g. "A shared margin on one painting.")
  — no extra decorative badges or tags.
  - This exact header/title/subtitle pattern repeats across every page
    (`/scrolls`, `/readme/`, blank scrolls) — treat it as the shared
    masthead, not something unique to the home scroll.
- The real handscroll is the hero: a horizontally scrollable viewport
  roughly 1500px wide by 320–440px tall. **The source painting is an
  extremely long handscroll (on the order of 15:1).** Show a real,
  readable section of it at a time — never squeeze the entire scroll
  into one viewport, and never stretch or distort it into a different
  aspect ratio. Preserve the painting's true proportions, provide a
  clear horizontal-browse affordance (the reference shows a "Scroll to
  explore" caption with left/right arrows, plus a thin overview strip
  below the viewport with a highlighted box marking the current visible
  section — build this overview strip only if you can make the
  highlighted window real and accurate to actual scroll position, not
  decorative), and a caption with the real attribution ("Wang Yi ·
  Portrait of Yang Zhuxi · 1363" — pull this from existing data, don't
  hardcode a duplicate copy if render.ts already has it elsewhere).
- Below the scroll viewer, the colophon reading area begins. Left side:
  chronological colophons, each with clear visual separation between
  seal glyph, body text, and date (the reference shows the seal in a
  small bordered square to the left of the text). Right side, narrower
  column: `Here now` presence. On a 1080px-tall first screen there's no
  need to force the full form or every colophon above the fold.
- `Add yours` sits below the colophon reading flow, with a moderate-width
  input area, a clear "this is permanent" notice before submission, and
  a vermilion primary submit button.

### Main scroll page, standard phone 390×844 (see `reference image/computer2.png`)

- Simplify the header but keep `All scrolls` easy to reach; the title
  block must not push the scroll viewer too far down the page.
- The scroll viewport scrolls/swipes horizontally; **only the painting
  viewport scrolls horizontally — the page itself must never overflow
  horizontally.** Touch affordance and a scroll hint (the reference
  shows "Swipe to explore" with a dot-progress indicator and the same
  thin overview strip) should be clear; captions and controls must never
  cover the painting.
- `Here now` moves from a sidebar to a compact horizontal row placed
  right after the scroll viewer and its caption (see reference: seal
  glyphs in a row, with a hairline divider above and below); colophons
  render in a single column below that; `Add yours` comes after the
  colophons, matching the reference's section order: scroll → caption →
  Here now → Colophons → Add yours.
- All text, seals, inputs, and buttons must be legible and tappable at
  390px width, with adequately sized touch targets.
- The mobile reference is a long-page concept capturing the full scroll
  of the page, not a mandate to cram everything above the first 844px.

### `/scrolls` and `/readme/`

- Rebuild `/scrolls` in the same visual system as a clean "scroll
  directory": each row led by title, with colophon count as secondary
  information, not a default `<ul>`/`<ol>` look, and no invented cover
  art. The "start a new scroll" form is its own restrained section; the
  no-rename/no-delete notice must be visible before submission.
- A blank scroll (no colophons yet) should still read as "paper waiting
  for ink," sharing the same frame, caption style, and colophon layout
  language as the real painting's scroll page — just without a painting
  viewport that has nothing to show, or with an appropriately empty/
  minimal treatment of that space.
- `/readme/` stays an article-style read: sensible line length for body
  copy, a clear heading scale, and legible quote/link styling — do not
  turn it into a marketing page.

## Acceptance checklist

1. Check the real site in an actual browser (start the dev server / use
   the `run` skill if available) at **1920×1080** and **390×844**, plus
   one intermediate width (e.g. ~1024px or ~768px) to confirm there's no
   jarring breakpoint collapse between the two.
2. Take real screenshots at both target viewports and compare them
   against the three reference images.
3. Confirm the home page, `/scrolls`, a blank scroll, and `/readme/` all
   share one coherent visual system.
4. Confirm the real painting is fully browsable horizontally and is
   never stretched or distorted.
5. Confirm the mobile page has no horizontal overflow anywhere.
6. Confirm links, forms, live colophon arrival, live presence, keyboard
   focus order/visibility, and the no-JavaScript baseline path (view a
   scroll and submit a colophon via a plain form, JS disabled) all still
   work.
7. Run the existing test suite (check `package.json` / `PROCESS.md` for
   the command, likely `pnpm test` via vitest) and report pass/fail.
8. In your final summary, explicitly call out anything from the
   reference images you did **not** carry into the implementation —
   especially any image-generated fake seals, fake colophon text, fake
   dates, or distortions of the real painting's proportions — and why.

## Out of scope

- Any feature, route, or data-model change beyond what's needed to
  restyle and relayout existing pages.
- Anything in `README.md`'s "what I chose not to build" section.
- Changing the 320/80 character limits or how they're enforced.
- Changing presence semantics (still glyph-only, per-scroll, in-memory)
  beyond how `Here now` is visually presented.

## When done

Report which files you changed, the full test results, and attach actual
screenshots of both target viewports alongside a short note on where
your implementation differs from the reference compositions and why.

Delete this file (`prompt.md`) in your last commit, per `CLAUDE.md`. Keep
`reference image/` in the repo history (don't delete it) since it
documents the design brief this redesign was built against.
