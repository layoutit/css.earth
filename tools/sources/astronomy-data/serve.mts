import { createServer, type ServerResponse } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { stripTypeScriptTypes } from "node:module";
import { root, loadRows, loadProposals, bodiesOf, type Row } from "./model.mts";
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
    bodies: bodiesOf(r.target),
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
function targetsOf(r: Row): string {
  const d = r.details;
  const all = d && typeof d === "object" && "targets" in d && Array.isArray(d.targets) ? d.targets.filter((t): t is string => typeof t === "string") : [];
  return all.length ? all.join("; ") : r.target;
}
const recorded = new Set(rows.flatMap((r) => bodiesOf(targetsOf(r))));
async function proposals(): Promise<ViewerProposal[]> {
  const markdown = await readFile(root + "/PROPOSALS.md", "utf8");
  return loadProposals().map((p) => {
    const writeup = markdown.split("\n## P" + p.id + "\n")[1]?.split("\n## P")[0]?.trim();
    if (!writeup) throw Error(`PROPOSALS.md has no writeup for P${p.id}`);
    // A writeup names its bodies on its "Content owners:" line. Otherwise its title may name them ("Moon and Mercury: …"),
    // but only words a record also names count as bodies; "Taxonomy: …" or "Small bodies: …" go under "several".
    const owners = /^Content owners: (.*)$/m.exec(writeup)?.[1] ?? "";
    const named = [...owners.matchAll(/\[([^\]]+)\]\(/g)].map((m) => m[1].toLowerCase());
    const titled = p.title.split(":")[0].split(/,\s*|\s+and\s+/).map((t) => t.trim().toLowerCase()).filter((t) => recorded.has(t));
    return {
      id: p.id,
      title: p.title,
      status: p.status,
      priority: p.priority,
      nextStep: p.next_step,
      blocker: p.blocker,
      prUrl: p.pr_url,
      bodies: named.length ? named : titled.length ? titled : ["several"],
      writeup: writeup.replace(/^### .*\n+/, ""),
    };
  });
}
function labels(): Record<string, string> {
  // Sources spell one body differently ("mars", "MARS", "(4) Vesta").
  const out: Record<string, string> = { several: "Several bodies" };
  for (const r of rows)
    for (const raw of targetsOf(r).split(";")) {
      const label = raw.trim().replace(/^\(\d+\)\s*/, "").replace(/^\*\s+/, "");
      const [key] = bodiesOf(label);
      // Prefer "Tempel 1" over "TEMPEL 1" over "tempel 1".
      const score = (t: string) => (t !== t.toLowerCase() && t !== t.toUpperCase() ? 2 : t !== t.toLowerCase() ? 1 : 0);
      if (key && (!out[key] || score(label) > score(out[key]))) out[key] = label;
    }
  return out;
}
// What cssEarth knows about each body: its kind and parent from packages/astronomy/data/bodies, and whether it has an
// object package. A ledger body matches a record by id, hyphenated name ("3i/atlas" is 3i-atlas) or comet id ("67p"
// is comet-67p).
const repository = resolve(root, "../../..");
const packages = new Set(
  (await readdir(resolve(repository, "src/objects"), { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name),
);
const known = new Map<string, { kind: string; parent: string; name: string }>();
for (const file of await readdir(resolve(repository, "packages/astronomy/data/bodies"))) {
  if (!file.endsWith(".json")) continue;
  const record: unknown = JSON.parse(await readFile(resolve(repository, "packages/astronomy/data/bodies", file), "utf8"));
  const id = field(record, "id");
  if (!id) throw Error(`packages/astronomy/data/bodies/${file} has no id`);
  const physical = record && typeof record === "object" && "physical" in record ? record.physical : undefined;
  const satellite = record && typeof record === "object" && "satellite" in record ? record.satellite : undefined;
  known.set(id, { kind: field(record, "classification"), parent: field(satellite, "parent") || field(physical, "parent"), name: field(physical, "name") });
}
// The Sun and Sgr A* are the roots of the Solar System and the Galaxy; nesting under them would fold nearly every
// row into two groups, so their children stay at the top level.
const roots = new Set(["sun", "sgr-a-star"]);
const catalogue: ViewerData["catalogue"] = {};
const idOf = (token: string) => [token, token.replaceAll(/[\s/]+/g, "-"), "comet-" + token].find((c) => known.has(c) || packages.has(c)) ?? "";
const proposalList = await proposals();
for (const token of [...recorded, ...proposalList.flatMap((p) => p.bodies)]) {
  const id = idOf(token), record = known.get(id);
  const parent = record && !roots.has(record.parent) ? record.parent : "";
  catalogue[token] = { kind: record?.kind ?? "", parent, object: packages.has(id) ? id : "" };
  // A parent the ledger never names still needs its own row to hold its moons.
  if (parent && !catalogue[parent] && !recorded.has(parent)) {
    const up = known.get(parent);
    catalogue[parent] = { kind: up?.kind ?? "", parent: "", object: packages.has(parent) ? parent : "" };
  }
}
// The Photojournal tags a moon's images with its planet too ("earth; moon", "enceladus; saturn"). A record that names a
// body and that body's parent counts for the body, so Earth and Saturn do not collect their moons' pictures.
function ownBodies(r: Row): string[] {
  const tagged = bodiesOf(targetsOf(r));
  if (r.source !== "photojournal") return tagged;
  const parents = new Set(tagged.map((t) => known.get(idOf(t))?.parent).filter(Boolean));
  const kept = tagged.filter((t) => !parents.has(idOf(t)));
  return kept.length ? kept : tagged;
}
const names = labels();
// cssEarth's own name wins over a source's spelling ("EARTH", "earth").
for (const token of Object.keys(catalogue)) {
  const record = known.get(idOf(token));
  if (record?.name) names[token] = record.name;
}
const data: ViewerData = { rows: rows.map((r) => ({ ...listed(r), bodies: ownBodies(r) })), proposals: proposalList, sources, labels: names, catalogue };
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
