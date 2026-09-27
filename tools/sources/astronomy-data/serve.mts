import { createServer, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { root, loadRows, openLedger, string, type Row } from "./model.mts";
import type {
  ViewerData,
  ViewerRow,
} from "./viewer/shape.mts";
// The ledger viewer: one page (viewer/index.html, viewer/app.mts) over one read-only data endpoint. Exports and
// filtered slices stay with slice.mts.
const rows = loadRows();
const sources = [
  ["opus", "OPUS"],
  ["photojournal", "Photojournal"],
  ["pds", "PSI PDS4"],
  ["usgs", "USGS"],
  ["umd", "Maryland"],
  ["darts", "DARTS"],
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
    source: r.source,
    id: r.id,
    title: r.title,
    target: r.target,
    bodies: [],
    instrument: r.instrument,
    count: r.count,
    url: r.url,
    thumbnail,
    size: largest?.size ?? "",
    date: field(r.details, "date"),
  };
}
// Bodies and their dataset links come from the ledger's `bodies` and `dataset_bodies` tables (apply-structure.mts).
const db = openLedger();
const catalogue: ViewerData["catalogue"] = {};
const labels: Record<string, string> = {};
for (const b of db.prepare("SELECT * FROM bodies").all()) {
  const id = string(b.id);
  catalogue[id] = { kind: string(b.kind), parent: string(b.parent), object: string(b.cssearth_object), catalogued: b.catalogued === 1 };
  labels[id] = string(b.name);
}
// A Photojournal tag of a parent body is not that body's data, so the page lists only `target` links.
const linked = new Map<string, string[]>();
for (const l of db.prepare("SELECT source,dataset_id,body_id FROM dataset_bodies WHERE role='target'").all()) {
  const key = string(l.source) + "\0" + string(l.dataset_id);
  linked.set(key, [...(linked.get(key) ?? []), string(l.body_id)]);
}
db.close();
const listedRows = rows.map((r) => ({ ...listed(r), bodies: linked.get(r.source + "\0" + r.id) ?? [] }));
const data: ViewerData = { rows: listedRows, sources, labels, catalogue };
const page = await readFile(root + "/viewer/index.html", "utf8");
const script = stripTypeScriptTypes(await readFile(root + "/viewer/app.mts", "utf8"));
const json = JSON.stringify(data);
function send(res: ServerResponse, type: string, body: string, headers: Record<string, string> = {}) {
  res.writeHead(200, { "Content-Type": type + "; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(body);
}
const port = Number(process.env.PORT ?? 4319);
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw Error("Invalid port");
createServer((req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/")
      return send(res, "text/html", page, {
        "Content-Security-Policy":
          "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; img-src https://assets.science.nasa.gov https://astrogeology.usgs.gov; base-uri 'none'; form-action 'none'",
      });
    if (url.pathname === "/app.js") return send(res, "text/javascript", script);
    if (url.pathname === "/api/data") return send(res, "application/json", json);
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  } catch (error) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(error instanceof Error ? error.message : "Invalid request");
  }
}).listen(port, "127.0.0.1", () => console.log("Ledger: http://127.0.0.1:" + port + "/"));
