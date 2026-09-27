import { createServer, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import {
  root,
  loadRows,
  loadProposals,
  slice,
  tsv,
  bodiesOf,
  type Row,
} from "./model.mts";
import type {
  ViewerData,
  ViewerRow,
  ViewerProposal,
} from "./viewer/shape.mts";
// The ledger viewer: one page (viewer/index.html, viewer/app.mts) over four read-only endpoints. Search and export go
// through slice(), the same filter rule slice.mts and verify.mts use, so what the page lists is what an export contains.
const rows = loadRows();
const indexOf = new Map(rows.map((r, i) => [r, i]));
const sources = [
  ["opus", "OPUS"],
  ["opus-volumes", "OPUS volumes"],
  ["opus-geometry", "OPUS geometry index"],
  ["photojournal", "Photojournal"],
  ["pds", "PSI PDS4"],
  ["usgs", "USGS"],
  ["umd", "Maryland"],
  ["umd-holdings", "Maryland inventory"],
  ["darts", "DARTS"],
  ["darts-collections", "DARTS collections"],
  ["darts-index", "DARTS indexes"],
].map(([id, label]) => ({ id, label }));
for (const r of rows)
  if (!sources.some((s) => s.id === r.source))
    throw Error(`Row ${r.source}:${r.id} names a source the viewer has no label for`);
type File = { url: string; name: string; mime: string; kind: string; area: number; size: string };
function files(details: unknown): File[] {
  if (!details || typeof details !== "object" || !("files" in details) || !Array.isArray(details.files)) return [];
  return details.files.flatMap((f: unknown) => {
    if (!f || typeof f !== "object" || !("url" in f) || typeof f.url !== "string") return [];
    const text = (k: string) => (k in f && typeof (f as Record<string, unknown>)[k] === "string" ? String((f as Record<string, unknown>)[k]) : "");
    const num = (k: string) => (k in f && typeof (f as Record<string, unknown>)[k] === "number" ? Number((f as Record<string, unknown>)[k]) : 0);
    const width = num("width"), height = num("height");
    return [{ url: f.url, name: text("name") || f.url.split("/").at(-1) || "", mime: text("mime"), kind: text("kind"), area: width * height, size: width && height ? `${width} × ${height} px` : "" }];
  });
}
function field(details: unknown, key: string): string {
  return details && typeof details === "object" && key in details && typeof (details as Record<string, unknown>)[key] === "string"
    ? String((details as Record<string, unknown>)[key])
    : "";
}
function listed(r: Row): ViewerRow {
  const f = files(r.details);
  // Photojournal images resize on request; USGS product pages publish their own thumb.png.
  const jpeg = f.find((x) => x.mime === "image/jpeg");
  const usgs = f.find((x) => x.name === "thumb.png") ?? f.find((x) => x.kind === "preview" && /\.(jpe?g|png)$/i.test(x.name));
  const thumbnail = r.source === "photojournal" && jpeg ? jpeg.url + "?w=320" : r.source === "usgs" && usgs ? usgs.url : "";
  const largest = [...f].sort((a, b) => b.area - a.area)[0];
  return {
    key: r.source + ":" + r.id,
    source: r.source,
    id: r.id,
    title: r.title,
    target: r.target,
    bodies: bodiesOf(r.target),
    instrument: r.instrument,
    count: r.count,
    decision: r.decision,
    reason: r.reason,
    url: r.url,
    proposals: r.proposals,
    thumbnail,
    size: largest?.size ?? "",
    date: field(r.details, "date"),
  };
}
async function proposals(): Promise<ViewerProposal[]> {
  const markdown = await readFile(root + "/PROPOSALS.md", "utf8");
  const linked = new Map<string, number>();
  for (const r of rows) for (const p of r.proposals) linked.set(p, (linked.get(p) ?? 0) + 1);
  return loadProposals().map((p) => {
    const writeup = markdown.split("\n## P" + p.id + "\n")[1]?.split("\n## P")[0]?.trim();
    if (!writeup) throw Error(`PROPOSALS.md has no writeup for P${p.id}`);
    // A writeup names its bodies on its "Content owners:" line; the others name them in the title ("Moon and Mercury: …").
    const owners = /^Content owners: (.*)$/m.exec(writeup)?.[1] ?? "";
    const named = [...owners.matchAll(/\[([^\]]+)\]\(/g)].map((m) => m[1].toLowerCase());
    const titled = p.title.split(":")[0].split(/,\s*|\s+and\s+/).map((t) => t.trim().toLowerCase());
    return {
      id: p.id,
      title: p.title,
      status: p.status,
      priority: p.priority,
      nextStep: p.next_step,
      blocker: p.blocker,
      prUrl: p.pr_url,
      updatedAt: p.updated_at,
      bodies: named.length ? named : titled,
      writeup: writeup.replace(/^### .*\n+/, ""),
      rows: linked.get(p.id) ?? 0,
    };
  });
}
function labels(): Record<string, string> {
  // Sources spell one body differently ("mars", "Mars", "(4) Vesta"); show the capitalised spelling.
  const out: Record<string, string> = {};
  for (const r of rows)
    for (const raw of r.target.split(";")) {
      const label = raw.trim().replace(/^\(\d+\)\s*/, "");
      const [key] = bodiesOf(label);
      if (key && (!out[key] || (out[key] === out[key].toLowerCase() && label !== label.toLowerCase()))) out[key] = label;
    }
  return out;
}
const data: ViewerData = { rows: rows.map(listed), proposals: await proposals(), sources, labels: labels() };
const page = await readFile(root + "/viewer/index.html", "utf8");
const script = stripTypeScriptTypes(await readFile(root + "/viewer/app.mts", "utf8"));
const json = JSON.stringify(data);
function send(res: ServerResponse, type: string, body: string, headers: Record<string, string> = {}) {
  res.writeHead(200, { "Content-Type": type + "; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(body);
}
const port = Number(process.env.PORT ?? 4319);
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw Error("Invalid port");
createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const params = new URLSearchParams(url.searchParams);
    if (url.pathname === "/")
      return send(res, "text/html", page, {
        "Content-Security-Policy":
          "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; img-src https://assets.science.nasa.gov https://astrogeology.usgs.gov; base-uri 'none'; form-action 'none'",
      });
    if (url.pathname === "/app.js") return send(res, "text/javascript", script);
    if (url.pathname === "/api/data") return send(res, "application/json", json);
    if (url.pathname === "/api/doc") {
      const name = params.get("name");
      if (name !== "README.md" && name !== "PROPOSALS.md") throw Error("Unknown document");
      return send(res, "text/markdown", await readFile(root + "/" + name, "utf8"));
    }
    if (url.pathname === "/api/record") {
      const row = rows.find((r) => r.source === params.get("source") && r.id === params.get("id"));
      if (!row) throw Error("Unknown record");
      return send(res, "application/json", JSON.stringify(row));
    }
    if (url.pathname === "/api/match") {
      // Text search reads the whole retained record, as slice() does, so a PIA number or a file name finds its row.
      const found = slice(rows, new URLSearchParams({ q: params.get("q") ?? "" }));
      return send(res, "application/json", JSON.stringify(found.map((r) => indexOf.get(r))));
    }
    if (url.pathname === "/api/export") {
      const format = params.get("format") ?? "json";
      if (format !== "json" && format !== "tsv") throw Error("format must be json or tsv");
      const found = slice(rows, params);
      params.delete("format");
      const attachment = { "Content-Disposition": `attachment; filename="astronomy-data.${format}"` };
      return format === "tsv"
        ? send(res, "text/tab-separated-values", tsv(found), attachment)
        : send(res, "application/json", JSON.stringify({ filters: Object.fromEntries(params), rows: found }, null, 2) + "\n", attachment);
    }
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  } catch (error) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(error instanceof Error ? error.message : "Invalid request");
  }
}).listen(port, "127.0.0.1", () => console.log("Ledger: http://127.0.0.1:" + port + "/"));
