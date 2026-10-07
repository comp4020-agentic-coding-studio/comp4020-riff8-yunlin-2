# Brief: let the scroll be unrolled by many hands at once

You are taking Colophon (read `README.md` and `CLAUDE.md` first; the harness
rules there stay in force) to the next brief, **C9 "All at once"**: make it
genuinely real-time, and commit to one deliberate multi-user design decision.
Nobody is available to answer questions while you run, so this brief is meant
to be complete. Run it to the end in one go, keep `main` deployable, and
delete this file in your last commit.

## The decision we are making: presence, and only presence

A visitor who opens the scroll should be able to tell that other hands are on
it right now, and a colophon written by someone else should appear on their
screen within about a second, without a reload.

Concretely:

1. **Live arrival.** When any visitor adds a colophon, every other open
   scroll receives it within ~1s and appends it at the end, in id order, with
   no reload and no scroll-jump for a reader who is further up the page. Use
   Server-Sent Events on a new `GET /events` route; the app is a single Node
   process on one Fly machine, so an in-memory set of open responses is
   enough. No new dependency.
2. **Quiet presence.** Show how many *other* hands are on the scroll right
   now, as a small, low-contrast line of text in the existing typographic
   voice (for example "two other hands are here"). The count is just a number
   derived from open SSE connections: dedupe by seal token so one visitor with
   three tabs counts once, and never show tokens, names, positions, cursors or
   typing state. It must fall to zero cleanly when connections close.
3. **Write the decision down.** Add `docs/adr-presence.md` (an architecture
   decision record). It must argue the choice against the README's own
   definition of good (a scroll, not a feed; no chat; unhurried), name at
   least two rejected alternatives (for example live-streaming entries with
   no presence indicator, and a "someone is writing" signal), and say
   honestly what presence costs us. Someone will be asked to defend the
   rejected option out loud, so make the best case for the loser too. Add a
   short paragraph to `README.md` that revises "What I chose not to build"
   to say real-time and presence are now built, and why this much and no
   more. The README must change in the same commit as the code, per
   `CLAUDE.md`.

## What good looks like

- It still feels like a handscroll. Presence is a whisper, not a dashboard.
  No badges, no avatars, no animation that draws the eye away from reading.
- With JavaScript disabled the app behaves exactly as it does today: the
  scroll renders, the form posts, the colophon appears after the redirect.
  Live updates and the presence line are progressive enhancement only.
  Add a small inline or `public/` script for the `EventSource` client.
- Every colophon pushed over SSE passes through `escapeHtml` before it
  reaches markup, exactly as in the server-rendered path. Prefer sending JSON
  and building the node with `textContent`, or sending already-escaped HTML
  produced by the same render function the page uses. Do not write a second,
  separate rendering path that could drift.
- A colophon that appears live must keep the "this one is yours" marking
  correct for its author's own browser and absent for everyone else's.
- The `--seal` accent keeps its single meaning, "this colophon is yours".
  Presence text must not use it.
- Connection hygiene: send a heartbeat comment every ~25s, remove the
  response from the set on `close`, and cap the number of concurrent SSE
  connections (a few hundred is plenty) so the single small machine cannot be
  exhausted. Over the cap, respond 503 and let the page work without live
  updates.

## Tests

Add spec files, do not just patch code:

- `spec/live.test.ts`: two SSE clients, one writes, the other receives the
  colophon within 2s; a client that never connected still sees it on reload.
- `spec/presence.test.ts`: count goes up when a second seal connects, stays
  the same for a second connection from the same seal, drops after close, and
  never leaks any token in the stream.
- An escaping test that posts `<script>` and `&` bodies and asserts the SSE
  payload is inert.

The existing spec files encode the previous brief. Update them only where the
new behaviour genuinely changes what they assert, and say so in the commit
message. Keep `spec/invariants.test.ts` green and untouched. `pnpm check` must
pass before every push to `main`.

## Leave alone

No accounts, names, avatars, likes, replies, threads or notifications. No
editing or deleting colophons, no auto-truncation. Do not change the 320
character limit, the seal cookie scheme, the database schema, `fly.toml` or
the Dockerfile. Do not touch `PROCESS.md` history or the `agent/` and
`memory/` notes except to follow your normal hand-off routine.

## Finish

Deploy, then confirm the live URL serves the page and that `/events` streams
(`curl -N`). Delete `prompt.md` in your last commit.
