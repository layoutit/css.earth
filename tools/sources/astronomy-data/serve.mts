import { createServer, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { stripTypeScriptTypes } from "node:module";
import { root, loadRows, loadProposals, type Row } from "./model.mts";
import { bodyCatalogue, type Body } from "./viewer/catalogue.mts";
import type {
  ViewerData,
  ViewerRow,
  ViewerProposal,
} from "./viewer/shape.mts";
// The ledger viewer: one page (viewer/index.html, viewer/app.mts) over one read-only data endpoint. Exports and
// filtered slices stay with slice.mts.
const rows = loadRows();
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
    source: r.source,
    id: r.id,
    title: r.title,
    target: r.target,
    bodies: [],
    instrument: r.instrument,
    decision: r.decision,
    reason: r.reason,
    url: r.url,
    thumbnail,
    size: largest?.size ?? "",
    date: field(r.details, "date"),
  };
}
// PDS4 and Maryland rows shorten their target text ("…; +6 more") but keep every target in details.targets.
function targetsOf(r: Row): string[] {
  const d = r.details;
  const all = d && typeof d === "object" && "targets" in d && Array.isArray(d.targets) ? d.targets.filter((t): t is string => typeof t === "string") : [];
  return all.length ? all : r.target.split(";");
}
const catalogue = await bodyCatalogue(resolve(root, "../../.."));
const bodies: ViewerData["catalogue"] = {};
const labels: Record<string, string> = { several: "Several bodies" };
const add = (b: Body) => {
  bodies[b.key] = { kind: b.kind, parent: b.parent, object: b.object, catalogued: b.catalogued };
  labels[b.key] ??= b.label;
  // A parent the ledger never names still needs its own row to hold its moons.
  if (b.parent && !bodies[b.parent]) {
    const up = catalogue.known.get(b.parent);
    bodies[b.parent] = { kind: up?.kind ?? "", parent: "", object: "", catalogued: true };
    labels[b.parent] ??= up?.name || b.parent;
  }
};
// The Photojournal tags a moon's images with its planet too; such a record counts for the moon.
function ownBodies(r: Row): string[] {
  const found = targetsOf(r).map(catalogue.body).filter((b): b is Body => !!b);
  found.forEach(add);
  const keys = [...new Set(found.map((b) => b.key))];
  if (r.source !== "photojournal") return keys;
  const parents = new Set(keys.map(catalogue.parentOf));
  const kept = keys.filter((k) => !parents.has(k));
  return kept.length ? kept : keys;
}
const listedRows = rows.map((r) => ({ ...listed(r), bodies: ownBodies(r) }));
const markdown = await readFile(root + "/PROPOSALS.md", "utf8");
const proposals: ViewerProposal[] = loadProposals().map((p) => {
  const writeup = markdown.split("\n## P" + p.id + "\n")[1]?.split("\n## P")[0]?.trim();
  if (!writeup) throw Error(`PROPOSALS.md has no writeup for P${p.id}`);
  // Bodies from the "Content owners:" line, else from the title ("Moon and Mercury: …") when cssEarth knows them;
  // "Asteroids: …" and the like go under "several".
  const owners = [...(/^Content owners: (.*)$/m.exec(writeup)?.[1] ?? "").matchAll(/\[([^\]]+)\]\(/g)].map((m) => m[1]);
  const titled = p.title.split(":")[0].split(/,\s*|\s+and\s+/);
  const found = (owners.length ? owners : titled).map(catalogue.body).filter((b): b is Body => !!b && b.catalogued);
  found.forEach(add);
  return {
    id: p.id,
    title: p.title,
    status: p.status,
    priority: p.priority,
    nextStep: p.next_step,
    blocker: p.blocker,
    prUrl: p.pr_url,
    bodies: found.length ? [...new Set(found.map((b) => b.key))] : ["several"],
    writeup: writeup.replace(/^### .*\n+/, ""),
  };
});
bodies.several = { kind: "cross-body", parent: "", object: "", catalogued: true };
const data: ViewerData = { rows: listedRows, proposals, sources, labels, catalogue: bodies };
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
