// Progressive enhancement, inlined into every scroll page by renderScroll.
// Without it the page is the plain server-rendered scroll and form it always
// was; with it, colophons others write in this scroll arrive without a
// reload, and the sidebar shows whose seals are on this scroll right now.
// Polls the scroll's one live endpoint about once a second; each poll is
// also this visitor's heartbeat there.
(() => {
  const main = document.querySelector("main[data-live]");
  const list = document.querySelector(".colophon-list");
  if (!main || !list) return;

  const endpoint = main.dataset.live;
  let since = Number(list.dataset.since) || 0;
  const sidebar = document.querySelector(".presence");
  const seals = sidebar?.querySelector(".presence-list");
  let shown = "";

  function append(entries) {
    for (const { id, html } of entries) {
      if (id <= since) continue;
      // html comes from the server's colophonEntry, the same render the page
      // itself uses: every visitor-written string in it has already been
      // through escapeHtml, so parsing it here adds no unescaped text.
      const template = document.createElement("template");
      template.innerHTML = html;
      list.append(template.content);
      since = id;
    }
    if (entries.length > 0) document.querySelector(".empty-note")?.remove();
  }

  // Built with textContent only. Redrawn only when the list changes, so a
  // screen reader isn't handed a fresh list every second.
  function showPresent(present) {
    if (!sidebar || !seals) return;
    const ordered = [...present.filter((p) => p.you), ...present.filter((p) => !p.you)];
    const key = ordered.map((p) => `${p.glyph}${p.you ? "*" : ""}`).join(",");
    sidebar.hidden = false;
    if (key === shown) return;
    shown = key;
    seals.replaceChildren(
      ...ordered.map((p) => {
        const item = document.createElement("li");
        const glyph = document.createElement("span");
        glyph.className = "presence-seal";
        glyph.textContent = p.glyph;
        item.append(glyph);
        if (p.you) {
          const you = document.createElement("span");
          you.className = "presence-you";
          you.textContent = "you";
          item.append(you);
        }
        return item;
      }),
    );
  }

  async function poll() {
    try {
      const res = await fetch(`${endpoint}?since=${since}`, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
      if (res.ok) {
        const data = await res.json();
        append(data.colophons);
        showPresent(data.present);
      }
    } catch {
      // offline, a deploy restarting, a dropped request: the next tick retries
    }
    setTimeout(poll, 900 + Math.random() * 200);
  }

  setTimeout(poll, 900 + Math.random() * 200);
})();
