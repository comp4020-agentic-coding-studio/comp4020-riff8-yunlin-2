# 1. Show who is on a scroll right now, as seals, per scroll

- **Status:** accepted
- **Date:** 2026-10-07
- **Decided by:** yunlin's crit agent, working the pod's crit 9 brief
  (`prompt.md`), which asked for this decision to be made
  and recorded before the code

## Context

A scroll is one object (a painting, or a blank sheet someone titled) with its
own margin of colophons. Anyone can start one; nothing on it is ever edited,
renamed or removed. `README.md` commits the app to having no accounts and no
names: a visitor is the anonymous seal their browser is given on first visit,
one glyph drawn from a small pool of words real collectors' seals use, and
that glyph is the same on every scroll they open.

Until now the app has only been asynchronous. You arrive, read what
strangers left over weeks, add a line, and go. Crit 9 makes it live: a
colophon written on a scroll reaches everyone else looking at that scroll
within about a second. At the crit itself a pod of people will have the same
scroll open on their own devices at the same moment, and some of them will
be spread across two or three scrolls.

That moment is different in kind from the asynchronous case. Several people
are in front of the same object at once, and the app has to decide whether
it shows them that. The brief names this as one of its example questions
("whether presence (who else is active) is visible"), and it is the one
that matters most here: the live feed already settles what arrives when,
and append-only colophons leave nothing to contend over when two people
write at once.

Presence is scoped per scroll because that is what "here" means in this
app. Someone reading a different scroll is not in front of this one, any
more than a person in the next gallery is looking at your painting.

## Options

### Chosen: a sidebar of seals, per scroll

Each scroll shows, beside its margin, the seal glyph of every visitor whose
page has asked that scroll for news in the last few seconds. One glyph per
visitor, however many tabs they have on it; nothing else. Your own glyph is
listed with a plain "you" beside it, in ink, not in the seal colour, so the
accent keeps its one meaning.

This is the closest digital equivalent to the thing handscrolls were
actually made for. A scroll was rarely read alone: it was unrolled at a
gathering (雅集, an "elegant gathering"), a few friends bent over the same
arm's length of silk, and the colophons they then wrote often record who
was there that day. The seals at the end of a scroll are a list of people
who once sat in front of it. Showing the seals of the people sitting in
front of it now is the same gesture, in the present tense, and it uses the
one form of identity the app already has rather than inventing a new one.

### Rejected: no presence at all

The strongest reading of `README.md`. It describes "a small, unhurried
stream of people" adding to an object over time, and argues against feeds,
notifications and anything that turns the margin into chat. On that
reading, live arrival of colophons is already a concession, and announcing
who is watching goes further: it invites you to wait for the others to
write, to perform for an audience, to treat the scroll as a room rather
than as paper. A visitor who arrives alone at 3am and finds no one there
loses nothing from presence being absent, but a visitor who sees six seals
may well write something they would not have written alone. Silence about
who else is present is also the most private option: it reveals nothing at
all about when anyone visits, which even an anonymous glyph does a little.
And it costs nothing to build, run or explain.

Rejected because it throws away the one thing a crowded scroll can show
that an asynchronous one can't. When six people really are reading the same
margin together, the live feed without presence makes colophons appear from
nowhere, authored by ghosts; with presence, a new line arrives from one of
the seals you can see. Presence turns the live feed from a notification
mechanism into company, and for a scroll, company is the historical norm,
not the intrusion.

### Rejected: a bare count ("3 here")

Cheaper on the page, and arguably more private: a number reveals even less
than a list of glyphs. Rejected because it flattens the seal back into a
statistic, the very shape `README.md` argues against (no likes, no scores,
nothing that reads as a metric), and because the seal is the only way a
visitor can connect a live colophon to a person in the room with them.

## Decision

Show a sidebar of seals on every scroll, listing the visitors active on that
scroll in the last five seconds.

- Presence rides the live poll: every `GET /scroll/:slug/live` is also a
  heartbeat for the asking seal on that scroll, and its response carries the
  current list. No second channel and no new table; last-seen times live in
  memory, keyed by scroll and token.
- A seal that hasn't polled a scroll for five seconds drops off that
  scroll's list (configurable, `PRESENCE_TIMEOUT_MS`).
- The response lists glyphs, never tokens, one entry per visitor, with a
  flag on the asker's own entry. Two different visitors who happen to draw
  the same glyph both appear, since collapsing them would undercount the
  room.
- The sidebar needs the script; without JavaScript it stays hidden and the
  page is exactly the scroll and form it was.

## Costs accepted

- **A killed tab lingers for up to five seconds.** A tab that closes, crashes
  or loses its connection can't announce it has left; its seal stays listed
  until the timeout passes. A tab sent to the background may also be
  throttled by the browser to fewer polls, and drop off the list while
  technically still open. Both are honest enough for a scroll: presence
  means "looking now", not "has a tab open somewhere".
- **The list is lost on restart.** Presence is in memory, so a deploy or a
  Fly machine stopping empties every sidebar until the next round of polls,
  about a second later.
- **Per-scroll tracking costs memory for little gain at this scale.** One map
  per scroll with a visitor on it, rather than one global map, is slightly
  more memory and bookkeeping than this app's traffic needs. It's worth
  saying plainly that a crit room of a dozen people would be served just as
  well by a single map filtered by scroll; per-scroll keys are kept because
  they match the meaning (presence is a property of a scroll) and make a
  cross-scroll leak structurally impossible, not because the numbers demand
  it.
- **A visit becomes slightly observable.** Anyone on a scroll can see that a
  seal was there at a given moment. The seal is anonymous and the same pool
  of twelve glyphs is shared by everyone, so this reveals presence without
  identity, which is what `README.md` already asks a seal to do.
