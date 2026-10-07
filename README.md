# Colophon

Colophon holds scrolls. The first is a real one, Wang Yi's 1363 portrait of
Yang Zhuxi, and it's what opens at `/`; anyone can start another from
[the list of scrolls](/scrolls), which gives them a blank sheet under a title
of their choosing. Under each scroll, in the order they were written, sit the
notes strangers have left in its margin: one line each, no account, no name,
nothing that can be edited or deleted once it's there, and no scroll renamed
or taken down once started. A line written on a scroll appears within about a
second for everyone else who has that scroll open, and a sidebar shows the
seals of whoever is looking at it right now. Behind the page, fragments of
the scroll's own past colophons drift slowly by.

## What good means here

Chinese handscrolls were never finished when the painter set the brush down.
Later owners and admirers kept adding their own inscriptions and seals after
the image, sheet by sheet, so that a scroll only a foot square in its painted
part could grow twenty feet long from six centuries of appended commentary —
the [Met's history of the format](https://www.metmuseum.org/essays/chinese-handscrolls)
calls this "a continuous dialogue" between the work and everyone who has since
sat with it. That is the shape of multi-user, real-time and persistent I
wanted: not a feed, but one object that a small, unhurried stream of people
add to, permanently, leaving a trace the next visitor can actually find.

Scrolls were also, often, read together. A scroll would be unrolled at a
gathering of friends (雅集, an "elegant gathering"), and the seals at its end
are partly a record of who was in the room. So when several people have the
same scroll open at once, they see each other's seals arrive and leave, and
see each other's lines land. Why presence is shown, and what the alternatives
were, is recorded in
[`docs/decisions/0001-presence-sidebar.md`](https://github.com/comp4020-agentic-coding-studio/comp4020-riff8-yunlin-2/blob/main/docs/decisions/0001-presence-sidebar.md).

Three other things I read while deciding what small and good looks like here:

- Robin Sloan's [_An app can be a home-cooked meal_](https://www.robinsloan.com/notes/home-cooked-app/)
  argues the best case for a tiny app is never that it will grow, but that it
  is finished, sovereign and answers only to the few people it was built for.
  This app answers to whoever writes in the margin, not to a growth number.
- [Hundred Rabbits](https://sourcehut.org/blog/2021-12-08-100-rabbits-interview/),
  who build their own software from a sailboat, say "if we can use less
  technology to solve any one task, we will" and prize software that "gets
  smaller over time, that sheds the superfluous" — the whole app is closer
  to a workshop tool built for one particular painting than a platform
  built to hold any painting at all.
- Bernie DeKoven's [_The Well-Played Game_](https://www.deepfun.com/fun-store/the-well-played-game/)
  says a shared act is worth more for the quality of playing it together than
  for any individual score — there is no score here, no likes, nothing to
  win, only the quality of what gets left behind.

## What I chose not to build

No accounts, avatars or profiles: a visitor is only the anonymous seal their
browser is given on first visit, the same glyph on every scroll, the way a
real seal marks presence without disclosing a name. No editing or deleting a
colophon once it's written, and no renaming or deleting a scroll: ink doesn't
come back off the paper. A length limit (320 characters for a line, 80 for a
scroll's title) keeps a visitor considering a line rather than typing a
paragraph. No likes, no replies, no threading, no notifications, no count of
visitors, no image uploads for new scrolls. The live sidebar shows who is
here, not who has been; there's no "what's new since you left" view and no
way to search or rank scrolls by activity.

Everything live is a progressive enhancement. With JavaScript off, a scroll
is still a server-rendered page and a form that posts to the server.

## What's enforced, what's judged

`spec/` checks that a colophon written now is still there on the next
request, that it lands only in the scroll it was written in (on the page and
in that scroll's live feed), that a visitor's own colophons are the ones
marked as theirs, live or on load, and that an empty or over-length line or
title is rejected rather than silently corrupted. It checks that a seal shows
on a scroll's sidebar once it's looking, once however many tabs it has, drops
off after a few quiet seconds, and never shows on a scroll it isn't looking
at; and that the database from before scrolls existed migrates into the
first scroll with every colophon intact and in order. Whether the tone of
what accumulates actually reads like a colophon (considered, brief, worth
adding to a shared object) rather than chat is not something a test can
check; that's for whoever reads the margin to judge.
