import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import {
  root,
  loadRows,
  slice,
  tsv,
  json,
  object,
  array,
  string,
} from "./model.mts";
const rows = await loadRows(),
  prior = object(await json("evidence/previous-audits.json")),
  plans = [
    ...array(prior.proposals).map(object),
    ...array(await json("opus-proposals.json")).map(object),
  ];
const esc = (v: unknown) =>
  String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const template = (title: string, body: string) =>
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>:root{color-scheme:dark;font:16px/1.55 system-ui;background:#16181b;color:#e2e5ea}body{max-width:1200px;margin:36px auto;padding:0 24px}h1{font-size:2.2rem;line-height:1.15}h2{font-size:1.1rem}a{color:#a4c9f9}form{display:flex;flex-wrap:wrap;gap:12px;padding:16px 0}label{display:flex;flex-direction:column;gap:4px}input,select,button,textarea{font:inherit;padding:7px;color:inherit;background:#24272d;border:1px solid #5d6670;border-radius:4px}article{border-top:1px solid #42474f;padding:12px 0}.muted{color:#afb7c2}.notice{border-left:3px solid #caaa70;padding-left:14px}pre{white-space:pre-wrap;overflow-wrap:anywhere}textarea{width:100%;height:65vh;box-sizing:border-box}nav{display:flex;gap:14px;flex-wrap:wrap}</style><body><nav><a href="/?source=opus">OPUS</a><a href="/?source=opus-volumes">OPUS volumes</a><a href="/?source=opus-geometry">Geometry index</a><a href="/?source=photojournal">Photojournal</a><a href="/?source=pds">PSI PDS4</a><a href="/?source=usgs">USGS</a><a href="/proposals">110 proposals</a></nav>${body}</body></html>`;
function render(params: URLSearchParams): string {
  if (!params.has("source")) params.set("source", "opus");
  const pageText = params.get("page") ?? "1";
  if (!/^\d+$/.test(pageText)) throw Error("Invalid page");
  const page = Math.max(1, Number(pageText));
  params.delete("page");
  const found = slice(rows, params),
    format = params.get("format");
  if (format === "tsv")
    return template(
      "Audit TSV",
      `<h1>${found.length} exported rows</h1><p>Copy the selected TSV below. These are the complete matching rows, independent of pagination.</p><textarea readonly aria-label="Exported TSV">${esc(tsv(found))}</textarea>`,
    );
  if (format && format !== "json") throw Error("Unknown format");
  const source = params.get("source") ?? "opus",
    within = rows.filter((r) => r.source === source);
  const select = (key: "instrument" | "target" | "decision", label: string) => {
    const options = [
      ...new Set(
        within
          .flatMap((r) =>
            key === "target" ? r.target.split(/;\s*/) : [r[key]],
          )
          .filter(Boolean),
      ),
    ].sort();
    return `<label>${label}<select name="${key}"><option value="">All</option>${options.map((v) => `<option value="${esc(v)}"${params.get(key) === v ? " selected" : ""}>${esc(v)}</option>`).join("")}</select></label>`;
  };
  const link = (updates: Record<string, string>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(updates)) p.set(k, v);
    return "/?" + p;
  };
  const start = (page - 1) * 100,
    shown = found.slice(start, start + 100);
  return template(
    "Planetary data audit",
    `<h1>Planetary data audit</h1><p>OPUS: 1,627,081 records · 40 instruments · 549 target/instrument slices · 985 volumes/bundles</p><p class="notice">Catalogue screening with 23 native product-label checks. Observation records can share an exposure or file. Geometry-index matches overlap and do not prove detection or useful coverage. The 717 Photojournal decisions retain their original individual review.</p><form method="get"><input type="hidden" name="source" value="${esc(source)}"><label>Search<input name="q" value="${esc(params.get("q"))}"></label>${select("instrument", "Instrument")}${select("target", "Target")}${select("decision", "Decision")}<label>Proposal<input name="proposal" value="${esc(params.get("proposal"))}" size="5"></label><button type="submit">Apply filters</button><a href="/?source=${esc(source)}">Clear</a></form><p><strong>${found.length} matching rows</strong> · <a href="${esc(link({ format: "json" }))}">Export JSON</a> · <a href="${esc(link({ format: "tsv" }))}">Copyable TSV</a> · <a href="/README.md">Method and limits</a></p><p class="muted">${found.length ? "Showing " + (start + 1) + "–" + Math.min(start + 100, found.length) : "No matches"}${page > 1 ? ' · <a href="' + esc(link({ page: String(page - 1) })) + '">Previous</a>' : ""}${start + 100 < found.length ? ' · <a href="' + esc(link({ page: String(page + 1) })) + '">Next</a>' : ""}</p>${shown
      .map(
        (r) =>
          `<article><h2><a href="${esc(r.url)}">${esc(r.source === "opus" ? r.instrument + " · " + r.target : r.id)}</a></h2><p class="muted">${esc(r.decision)} · ${r.count.toLocaleString("en-US")} ${r.source.startsWith("opus") ? "OPUS records" : "source entry"}</p><p>${esc(r.reason)}</p><p>${r.proposals
            .map((n) => {
              const p = plans.find((p) => string(p.id).split("-")[0] === n);
              return p
                ? '<a href="/proposals/' +
                    esc(p.id) +
                    '.md">Proposal ' +
                    esc(n) +
                    "</a>"
                : "";
            })
            .join(
              " · ",
            )}</p><details><summary>Retained audit record</summary><pre>${esc(JSON.stringify(r.details, null, 2))}</pre></details></article>`,
      )
      .join("")}`,
  );
}
const port = Number(process.env.PORT ?? 4319);
if (!Number.isSafeInteger(port) || port < 1 || port > 65535)
  throw Error("Invalid port");
createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    let body: string;
    if (
      url.pathname === "/proposals" ||
      url.pathname === "/proposals/index.html"
    ) {
      body = template(
        "Data proposals",
        "<h1>110 data proposals</h1><p>95 earlier proposals, 15 OPUS additions; 27 earlier proposals have OPUS extensions. These are proposed work scopes, not 110 ready datasets.</p>" +
          plans
            .map(
              (p) =>
                '<article><h2><a href="/proposals/' +
                esc(p.id) +
                '.md">' +
                esc(p.id) +
                " · " +
                esc(p.title) +
                "</a></h2><p>" +
                esc(p.phase) +
                " · Priority " +
                esc(p.priority) +
                "</p></article>",
            )
            .join(""),
      );
    } else if (
      /^\/(README\.md|opus-review\.md|photojournal-audit\.md|proposals\/[a-zA-Z0-9-]+\.md)$/.test(
        url.pathname,
      )
    ) {
      body = template(
        "Audit document",
        "<pre>" + esc(await readFile(root + url.pathname, "utf8")) + "</pre>",
      );
    } else if (url.pathname === "/" || url.pathname === "/opus.html") {
      if (url.searchParams.get("format") === "json") {
        const p = new URLSearchParams(url.searchParams);
        p.delete("page");
        if (!p.has("source")) p.set("source", "opus");
        const filtered = slice(rows, p);
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
        });
        res.end(
          JSON.stringify(
            { filters: Object.fromEntries(p), rows: filtered },
            null,
            2,
          ) + "\n",
        );
        return;
      }
      body = render(url.searchParams);
    } else if (
      url.pathname === "/photojournal.html" ||
      url.pathname === "/catalogue.html"
    ) {
      res.writeHead(302, {
        Location:
          "/?source=" +
          (url.pathname === "/photojournal.html" ? "photojournal" : "pds"),
      });
      res.end();
      return;
    } else {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'",
    });
    res.end(body);
  } catch (error) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(error instanceof Error ? error.message : "Invalid request");
  }
}).listen(port, "127.0.0.1", () =>
  console.log("Audit: http://127.0.0.1:" + port + "/?source=opus"),
);
