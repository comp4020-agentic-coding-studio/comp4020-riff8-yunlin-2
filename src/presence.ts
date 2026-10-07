// Who is on each scroll right now, per docs/decisions/0001-presence-sidebar.md.
// In memory only: a heartbeat is a live poll, and a token that hasn't polled
// a scroll within `timeoutMs` is no longer on it. Keyed by scroll first, so
// one scroll's list can never include someone who only polled another.
export interface Presence {
  beat(scrollId: number, token: string): void;
  present(scrollId: number): string[];
}

export function createPresence(timeoutMs: number, now: () => number = Date.now): Presence {
  const scrolls = new Map<number, Map<string, number>>();

  return {
    beat(scrollId, token) {
      let seen = scrolls.get(scrollId);
      if (!seen) scrolls.set(scrollId, (seen = new Map()));
      seen.set(token, now());
    },

    // Tokens, in the order they arrived, after dropping anyone timed out.
    // A scroll nobody is on any more is forgotten entirely.
    present(scrollId) {
      const seen = scrolls.get(scrollId);
      if (!seen) return [];
      const cutoff = now() - timeoutMs;
      for (const [token, at] of seen) if (at < cutoff) seen.delete(token);
      if (seen.size === 0) scrolls.delete(scrollId);
      return [...seen.keys()];
    },
  };
}
