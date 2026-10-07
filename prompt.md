# Colophon, live for a room full of people, across many scrolls

This prompt aims at the
[crit 9 brief, "All at once"](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/09-all-at-once/).
It has four pieces, and the agent must deliver all four, in this order —
**(1)** the app grows from one scroll into many, each its own room; **(2)**
colophons arrive live within a scroll; **(3)** a sidebar shows whose seals
are on that scroll right now — this is the crit's required multi-user
decision, recorded as an ADR before it's built; **(4)** a translucent
carousel of a scroll's past ink runs behind it. Part 1 is the foundation the
other three are scoped onto, which is why it comes first even though it's
the most invasive change. At the next crit, several people will open
<https://comp4020-riff8-yunlin-2.fly.dev/> at once, possibly across more than
one scroll, so the live half and the sidebar are what get tested hardest,
but all four ship. Read `README.md` and `CLAUDE.md` first — the harness
rules there stay in force. Nobody is available to answer questions while you
run this, so treat the brief below as complete. Run it to the end in one go,
keep `main` deployable throughout, and delete this file in your last commit.

All four pieces are built on top of the existing server-rendered page. The
core interaction — reading a scroll, writing a colophon — must keep working
exactly as it does today with JavaScript disabled; Parts 2–4 need a script
and degrade to nothing, not to broken, when there isn't one.

## Part 1: many scrolls, not one

The app currently holds one painting and one shared margin. It becomes a
place that holds any number of scrolls, each its own room with its own
colophons, its own live feed, and its own presence — one painting (today's
Wang Yi) stays as the original, and anyone can start a new one.

- Add a `scrolls` table: `id`, `slug` (unique), `title`, `created_at`. Add a
  `scroll_id` column to `colophons`, referencing it. The migration runs on
  every boot (same as today's `CREATE TABLE IF NOT EXISTS`), so make it
  idempotent: check with `PRAGMA table_info` (or equivalent) before adding a
  column to a table that may already exist on the Fly volume with real rows
  in it, insert one default scroll row for the existing painting if it
  doesn't already exist, and backfill every existing colophon's `scroll_id`
  to that default scroll's `id` exactly once. Get this right against data
  that already exists in production, not just a fresh local database — see
  "things to actually check" below.
- Routing: `/scroll/:slug` renders a scroll — the figure (painting or
  placeholder), its colophon list, and its form — using one render function
  for every scroll, default included. `/` is routing sugar for the default
  scroll's slug, not a second implementation: it calls the exact same
  render, post, and live-poll code paths that `/scroll/:slug` does, just
  with the default slug filled in. There is one place that renders a scroll,
  one that accepts a colophon for one, and (from Part 2) one that serves its
  live feed — not two of each for "the" scroll versus "a" scroll.
- Add `/scrolls`, a lobby: a list of every scroll (title, link, and how many
  colophons it holds), and a small creation form — `POST /scrolls` with a
  `title` (trim, reject empty, cap at 80 characters, same spirit as the
  320-character colophon cap). Derive a URL-safe `slug` from the title
  (lowercase, hyphenated, non-alphanumerics stripped); on a collision,
  append a short numeric suffix and retry rather than failing the request.
  Link `/scrolls` from the default scroll's header so it's discoverable.
- A scroll, once created, is never deleted or renamed — the same "nothing
  erased" rule `CLAUDE.md` already holds colophons to now holds scrolls.
- A new scroll has no painting to show. Give it a plain, honest placeholder
  in the same `figure.scroll-frame` slot (a blank parchment-toned panel is
  enough — no image upload, no file storage; that's out of scope) with
  `alt`/`aria-label` text that says it's unmarked rather than pretending to
  be the Wang Yi painting. Its heading is its own title, not "Colophon."
- The 320-character colophon limit, the seal cookie scheme, and the "once
  written, never edited" rule apply identically inside every scroll. A
  visitor's seal glyph is the same glyph in every scroll they visit — the
  token is global, only the colophons it writes are scoped.

## Part 2: colophons arrive live, within a scroll

A colophon someone else writes in a scroll should appear, in that scroll,
on every other open page of that same scroll without a reload — and must
not appear in any other scroll's feed.

- Poll, don't push: once a second (~1000ms, jittered a little), each client
  asks its scroll's endpoint what's new since the last row it saw. Add
  `GET /scroll/:slug/live?since=<id>`, returning only that scroll's
  colophons with `id` greater than `since`, oldest first. An empty poll is a
  normal, cheap response, not an error.
- Reuse the single render path from Part 1 for each new row — no second
  place that turns a colophon into HTML, whether returning rendered
  fragments or JSON built into the DOM with `textContent`, never `innerHTML`
  of unescaped text.
- A colophon appended live carries the correct "yours" marking for its own
  author's browser and no one else's, in that scroll, same as on first load.
- A failed poll retries on the next tick rather than giving up for the rest
  of the session.

## Part 3: a sidebar of who's here, per scroll — the recorded decision

Add a sidebar, on each scroll, listing the seals currently on that scroll —
reusing `sealGlyph`. A visitor present in two scrolls at once (two tabs)
shows up in both sidebars, independently; the two lists never merge. This
directly answers one of the brief's own example questions — "whether
presence (who else is active) is visible" — and is this crit's one
multi-user decision, so it gets an ADR, not just a feature.

**Write `docs/decisions/0001-presence-sidebar.md` before the code that
implements it.** Status, Date, Decided by; Context (what a scroll is, what
"no accounts, no names" already commits this app to, why several
simultaneous visitors on the same scroll make presence worth showing, and
why presence is scoped per scroll rather than site-wide — a visitor on a
different scroll isn't "here"); Options, chosen first, with at least one
honestly argued alternative — for example **no presence at all** (closest
reading of README's "unhurried," but loses the one thing a crowded scroll
can show that an async one can't) or **a bare count instead of glyphs**
(cheaper, but flattens the seal back into a number). Give the rejected
option its strongest case, since the pod will be asked to argue it at the
crit. Then Decision and Costs accepted (at minimum: a stale entry if a tab
is killed rather than closed cleanly, and tracking presence per scroll
rather than globally costing a little more memory for no real benefit at
this scale, which is worth saying plainly rather than skipping).

Implementation, once the ADR is written:

- Fold presence into Part 2's polling trip rather than a second channel:
  each `GET /scroll/:slug/live` call is a heartbeat for the calling seal on
  that scroll. Track last-seen-at per `(scroll_id, token)` in memory — no
  new table. A seal that hasn't polled a given scroll in a few ticks (5s
  default, configurable so a spec doesn't sleep for real) drops off that
  scroll's list. Return the current distinct glyphs for that scroll
  alongside any new colophons.
- No tokens, no identity-linked colours, no names, no count beyond however
  many glyphs are listed, no glyph repeated for one visitor's several tabs
  on the same scroll.
- The sidebar has its own `aria-label`, sits apart from the colophon list
  and the figure, and never overlaps either on a narrow viewport — stacks
  below rather than floats over on small screens.

### What good looks like for Parts 1–3

- A spec creates two scrolls, posts a colophon into each, and asserts each
  scroll's list and live feed contain only their own colophon — never the
  other's.
- A spec posts a colophon, polls `/scroll/:slug/live` from a second client
  with an older `since`, and asserts the new row comes back once with
  correct "mine" marking for each side; an up-to-date `since` gets an empty
  response.
- A presence spec: a token's glyph appears on a scroll after it polls that
  scroll, doesn't duplicate on a second poll, disappears after the timeout
  (advance a fake clock, don't sleep for real), and never appears on a
  different scroll the same token hasn't polled.
- A migration spec: seed a database shaped like today's (no `scrolls` table,
  colophons with no `scroll_id`), run the app's startup migration against
  it, and assert a default scroll now exists and every prior colophon now
  belongs to it, in its original order.
- In a real browser, two scrolls open in two tabs, with a third and fourth
  tab both on one of those two scrolls: colophons and presence only cross
  between the two tabs on the same scroll, never into the other scroll's
  tab. Do this against the deployed Fly URL, not only locally, and say so in
  the commit or `PROCESS.md`.

## Part 4: a carousel of ink, per scroll

Behind a scroll's main content, run a slow, continuous horizontal drift of
short fragments of that scroll's own past colophons — translucent,
low-contrast, clearly secondary to the real list in front of it. Decoration,
not a second feed: it doesn't participate in Parts 2 or 3, no live updates,
no cross-scroll mixing — a scroll's carousel only ever shows fragments
written into that same scroll.

- Render server-side on page load from a bounded, recent sample of that
  scroll's own colophons (~40 is plenty), each fragment escaped through
  `escapeHtml` exactly like the real list, truncated to roughly 60–80
  characters with an ellipsis.
- A CSS animation is enough — must never compete for attention:
  `aria-hidden="true"`, `pointer-events: none`, freeze rather than animate
  under `prefers-reduced-motion`.
- Doesn't need to reflect new colophons live — a per-load sample is fine.
  Not a fifth polling endpoint.
- The `--seal` accent keeps its one meaning ("this colophon is yours"); the
  carousel must not use it or imply ownership of what drifts past.
- A brand-new, empty scroll simply shows no carousel (nothing to drift)
  rather than an empty animated band.

## What carries over unchanged

- No accounts, names, avatars, likes, replies, threads or notifications
  beyond the anonymous seal glyph.
- No editing or deleting a colophon, and no scroll is ever deleted or
  renamed once created. No auto-truncation of what's actually stored —
  truncation in Part 4 is display-only.
- The 320-character limit, the seal cookie scheme, `fly.toml`, and the
  Dockerfile don't change. Presence and the live cursor stay in-memory only;
  the one real schema change is Part 1's `scrolls` table and `scroll_id`
  column, and it must be a real, checked migration, not a fresh-database
  assumption.
- Every place that turns user-submitted text into markup goes through the
  same `escapeHtml` path — no second, hand-rolled escaping routine anywhere
  in Parts 1–4.

## Things to actually check, not assume

- The Fly volume already has colophons from before scrolls existed. Verify
  the migration against a copy of real shape (or a hand-seeded equivalent)
  before trusting it on the deployed volume — `CREATE TABLE IF NOT EXISTS`
  alone will not add a column to a table that already exists without one.
- Update `README.md` to describe the app as it now is — many scrolls, a
  default one among them, real-time arrival and presence within a scroll —
  not left describing a single painting. `spec/invariants.test.ts` checks
  every heading renders at `/readme/`, in order; keep it green.
- Update `CLAUDE.md`'s own rules wherever this brief adds an invariant the
  current wording doesn't cover (escaping now also covers the live endpoint
  and the carousel; "nothing erased" now also covers scrolls, not just
  colophons). Leave the opening block above "Your harness" exactly as it
  is — that's the riff process itself, not this brief.
- `PROCESS.md` gets an entry explaining the presence decision (matching the
  ADR) and, separately, why multiple scrolls were worth the schema change —
  the real cost being the migration, not the feature itself.
- Existing spec files encode the single-scroll brief. Update only what
  genuinely changes under this one (most will need a scroll in scope to run
  against), and say so in the commit message. Keep
  `spec/invariants.test.ts` green and untouched.

## Left open on purpose

Conflict resolution for simultaneous writes isn't a question here —
colophons are append-only inserts with no shared resource to contend over,
so there's no second multi-user decision to make this crit; don't invent
one. Discovering scrolls (search, sorting the lobby by activity, a
trending view) and a returning visitor's "what's new since you left" view
are both real and interesting, but neither is this crit's required
decision — leave them for later rather than half-building them alongside
presence.

## Process

`pnpm check` and `pnpm check:evidence` pass before every commit. Every
commit that changes behaviour carries a `spec/` test that would have failed
without it. Commit the ADR before the code that implements Part 3. Keep
`main` deployable throughout, not just at the end. Delete `prompt.md` in
your last commit.
