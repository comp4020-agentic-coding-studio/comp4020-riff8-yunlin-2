// Progressive enhancement, inlined into every scroll page by renderScroll.
// Without it the page is the plain server-rendered scroll and form it always
// was; with it, colophons others write in this scroll arrive without a
// reload. Polls the scroll's one live endpoint about once a second.
(() => {
  const main = document.querySelector("main[data-live]");
  const list = document.querySelector(".colophon-list");
  if (!main || !list) return;

  const endpoint = main.dataset.live;
  let since = Number(list.dataset.since) || 0;

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

  async function poll() {
    try {
      const res = await fetch(`${endpoint}?since=${since}`, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
      if (res.ok) {
        const data = await res.json();
        append(data.colophons);
      }
    } catch {
      // offline, a deploy restarting, a dropped request: the next tick retries
    }
    setTimeout(poll, 900 + Math.random() * 200);
  }

  setTimeout(poll, 900 + Math.random() * 200);
})();
