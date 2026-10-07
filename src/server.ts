import { createServer } from "node:http";
import { readFile, readFileSync } from "node:fs";
import { extname } from "node:path";
import {
  addColophon,
  colophonsSince,
  createScroll,
  findScroll,
  listColophons,
  listScrolls,
  type Scroll,
} from "./db.ts";
import { DEFAULT_SLUG } from "./schema.ts";
import { sealToken } from "./cookies.ts";
import {
  colophonEntry,
  renderLobby,
  renderNotFound,
  renderReadme,
  renderScroll,
  scrollPath,
  MAX_BODY_LENGTH,
  MAX_TITLE_LENGTH,
} from "./render.ts";
import { renderMarkdown } from "./markdown.ts";

const PORT = Number(process.env.PORT ?? 8080);
const README = readFileSync("README.md", "utf8");

const MIME: Record<string, string> = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

// A URL-encoded 320-character colophon body never comes close to this — it's
// a hard ceiling against a request that skips the form's own maxlength, not a
// tuned limit. Checked as bytes arrive, not after the fact: buffering an
// unbounded body into memory first (whatever a crafted Content-Length or a
// chunked request without one claims) is itself the vulnerability on a
// single-machine deploy with a tight memory ceiling.
const MAX_REQUEST_BODY_BYTES = 16 * 1024;

// Once the cap is crossed, later chunks are read and discarded rather than
// accumulated — costs no memory, since each one is immediately eligible for
// GC — but the stream is still let run to its natural end before responding.
// Destroying the connection early, tried first, raced a still-writing client
// into a raw connection error instead of a clean 413: a declared
// Content-Length is a promise the client already committed to keeping, and
// only reading it out fully guarantees the client's own write has finished
// before it goes to read our response. A stalled or genuinely enormous body
// is bounded by Node's own default request timeout, not by this function.
async function readBody(req: import("node:http").IncomingMessage): Promise<string | undefined> {
  const declared = Number(req.headers["content-length"]);
  let tooLarge = Number.isFinite(declared) && declared > MAX_REQUEST_BODY_BYTES;

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    total += buf.length;
    if (total > MAX_REQUEST_BODY_BYTES) tooLarge = true;
    if (!tooLarge) chunks.push(buf);
  }
  return tooLarge ? undefined : Buffer.concat(chunks).toString("utf8");
}

type Req = import("node:http").IncomingMessage;
type Res = import("node:http").ServerResponse;

function tooLarge(res: Res): void {
  res.writeHead(413, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("payload too large");
}

function notFound(res: Res): void {
  res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
  res.end(renderNotFound());
}

// The one handler that renders a scroll, and the one that accepts a colophon
// for it. `/` and `POST /colophons` are the default scroll's slug filled in,
// not second implementations.
function showScroll(scroll: Scroll, url: URL, token: string, res: Res): void {
  const error = url.searchParams.get("error") ?? undefined;
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(renderScroll(scroll, listColophons(scroll.id), token, error));
}

async function writeColophon(scroll: Scroll, req: Req, token: string, res: Res): Promise<void> {
  const raw = await readBody(req);
  if (raw === undefined) return tooLarge(res);
  const body = (new URLSearchParams(raw).get("body") ?? "").trim();

  let error: string | undefined;
  if (body.length === 0) error = "empty";
  else if (body.length > MAX_BODY_LENGTH) error = "long";

  if (!error) addColophon(scroll.id, token, body);

  const path = scrollPath(scroll);
  res.writeHead(303, { Location: error ? `${path}?error=${error}` : path });
  res.end();
}

// The one place a scroll's live feed is served. Each new colophon goes out
// already rendered by colophonEntry, the same function the page itself uses,
// so its body has been through escapeHtml and its "yours" marking is worked
// out for the browser asking, exactly as on a first load.
function liveFeed(scroll: Scroll, url: URL, token: string, res: Res): void {
  const sinceParam = url.searchParams.get("since") ?? "0";
  if (!/^\d{1,15}$/.test(sinceParam)) {
    res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "since must be a colophon id" }));
    return;
  }
  const colophons = colophonsSince(scroll.id, Number(sinceParam)).map((c) => ({
    id: c.id,
    html: colophonEntry(c, token),
  }));
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify({ colophons }));
}

// /scroll/<slug> and /scroll/<slug>/<rest>. A slug is only ever what slugify
// produces, so anything outside [a-z0-9-] can't name a scroll.
const SCROLL_ROUTE = /^\/scroll\/([a-z0-9-]+)(\/[a-z]+)?$/;

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://internal");
  const { token, setCookie } = sealToken(req.headers.cookie);
  if (setCookie) res.setHeader("Set-Cookie", setCookie);

  if (url.pathname === "/" || url.pathname === "/colophons") {
    const scroll = findScroll(DEFAULT_SLUG)!;
    if (req.method === "GET" && url.pathname === "/") return showScroll(scroll, url, token, res);
    if (req.method === "POST" && url.pathname === "/colophons") return writeColophon(scroll, req, token, res);
  }

  const route = url.pathname.match(SCROLL_ROUTE);
  if (route) {
    const scroll = findScroll(route[1]!);
    if (!scroll) return notFound(res);
    const rest = route[2];
    if (req.method === "GET" && rest === undefined) return showScroll(scroll, url, token, res);
    if (req.method === "POST" && rest === "/colophons") return writeColophon(scroll, req, token, res);
    if (req.method === "GET" && rest === "/live") return liveFeed(scroll, url, token, res);
    return notFound(res);
  }

  if (req.method === "GET" && url.pathname === "/scrolls") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderLobby(listScrolls(), url.searchParams.get("error") ?? undefined));
    return;
  }

  if (req.method === "POST" && url.pathname === "/scrolls") {
    const raw = await readBody(req);
    if (raw === undefined) return tooLarge(res);
    const title = (new URLSearchParams(raw).get("title") ?? "").trim();
    if (title.length === 0 || title.length > MAX_TITLE_LENGTH) {
      res.writeHead(303, { Location: `/scrolls?error=${title.length === 0 ? "empty" : "long"}` });
      res.end();
      return;
    }
    const scroll = createScroll(title);
    res.writeHead(303, { Location: scrollPath(scroll) });
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/readme/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderReadme(renderMarkdown(README)));
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/public/")) {
    const ext = extname(url.pathname);
    const type = MIME[ext];
    if (!type) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    readFile(`.${url.pathname}`, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, { "Content-Type": type });
      res.end(data);
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("not found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`colophon listening on 0.0.0.0:${PORT}`);
});
