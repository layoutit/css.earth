// Entry script: node packages/bake/cli/astronomy-data-collect-trek.mts [--dry-run]. Collects NASA Solar System Treks map
// products into the ledger; the work is in @cssearth/bake/sources.
/**
 * Each Trek portal lists its layers through TrekServices searchItems. A product with a category (Imagery, Topography,
 * Gravity, ...) is a map layer: one `datasets` row, source `trek`, with the full record in details_json. Items without a
 * category are single observations (Titan's VIMS cubes and ISS frames): they are counted per portal and instrument in
 * one `inventory` row each, source `trek-observations`, like OPUS slices. Requests run one at a time. TREK_CACHE names
 * a folder of saved pages, so a rerun does not fetch them again.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { DatabaseSync } from "node:sqlite";
import { databasePath } from "@cssearth/bake/sources";

const PORTALS: Record<string, string> = { // Trek portal -> the body its layers show
  moon: "Moon", mars: "Mars", mercury: "Mercury", venus: "Venus", vesta: "Vesta", ceres: "Ceres",
  titan: "Titan", europa: "Europa", ganymede: "Ganymede", io: "Io", enceladus: "Enceladus",
  phobos: "Phobos", ryugu: "Ryugu",
};
const ROWS = 500;
const dry = process.argv.includes("--dry-run");
const now = new Date().toISOString().slice(0, 19) + "+00:00";
const cache = process.env.TREK_CACHE;

type Doc = Record<string, unknown>;
type Response = { docs: Doc[]; numFound: number };

function record(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError(`${where}: expected an object.`);
  return value as Record<string, unknown>;
}
// JSON.rawJSON is in Node 22 and later but not in this project's TypeScript lib yet.
declare global { interface JSON { rawJSON(text: string): unknown } }
if (typeof JSON.rawJSON !== "function") throw new Error("collect-trek.mts needs JSON.rawJSON (Node 22 or later).");
// Keep each number's original digits: Trek's `_version_` is a 64-bit integer that JavaScript would round, and a
// resolution written 1435.0 reads "1435.0" in the reason, as it always has.
const numberText = new WeakMap<object, Map<string, string>>();
function keepNumberText(this: object, key: string, value: unknown, context?: { source?: string }): unknown {
  if (typeof value === "number" && context?.source !== undefined && context.source !== String(value)) {
    const texts = numberText.get(this) ?? new Map<string, string>();
    texts.set(key, context.source);
    numberText.set(this, texts);
  }
  return value;
}
function writeNumberText(this: object, key: string, value: unknown): unknown {
  const text = numberText.get(this)?.get(key);
  return text === undefined ? value : JSON.rawJSON(text);
}
// The reasons were first written by Python, which prints a JSON float as repr does: 1435.0, 0.00033, 1e-05.
function pythonNumber(value: number, source: string | undefined): string {
  const float = source === undefined ? !Number.isInteger(value) : /[.eE]/.test(source);
  if (!float) return source ?? String(value);
  const [mantissa, exponentText] = value.toExponential().split("e") as [string, string];
  const exponent = Number(exponentText);
  if (exponent >= -4 && exponent < 16) {
    const fixed = String(value);
    return fixed.includes(".") ? fixed : `${fixed}.0`;
  }
  return `${mantissa}e${exponent < 0 ? "-" : "+"}${String(Math.abs(exponent)).padStart(2, "0")}`;
}
// A shallow copy keeps the original's number texts; nested objects are shared and keep their own.
function withNumberText<T extends object>(original: object, copy: T): T {
  const texts = numberText.get(original);
  if (texts) numberText.set(copy, texts);
  return copy;
}
function response(body: string, where: string): Response {
  const outer = record(JSON.parse(body, keepNumberText), where), inner = record(outer.response, `${where}.response`);
  if (!Array.isArray(inner.docs) || typeof inner.numFound !== "number") throw new TypeError(`${where}: response has no docs and numFound.`);
  return { docs: inner.docs.map((doc, i) => record(doc, `${where}.docs[${i}]`)), numFound: inner.numFound };
}

async function page(portal: string, start: number): Promise<Response> {
  const path = cache ? join(cache, `${portal}-${start}.json`) : undefined;
  if (path && existsSync(path)) return response(readFileSync(path, "utf8"), path);
  const url = `https://trek.nasa.gov/${portal}/TrekServices/ws/index/eq/searchItems?start=${start}&rows=${ROWS}&key=*`;
  for (let attempt = 0; ; attempt++) {
    const t = performance.now();
    try {
      const reply = await fetch(url, { signal: AbortSignal.timeout(45_000) });
      if (!reply.ok) throw new Error(`HTTP ${reply.status}`);
      const body = await reply.text();
      console.log(`  ${portal} start=${start}: ${body.length.toLocaleString("en-US")} bytes in ${((performance.now() - t) / 1000).toFixed(1)}s`);
      if (path && cache) { mkdirSync(cache, { recursive: true }); writeFileSync(path, body); }
      return response(body, url);
    } catch (error) { // a slow page is retried, then reported
      console.log(`  ${portal} start=${start}: attempt ${attempt + 1} failed after ${((performance.now() - t) / 1000).toFixed(1)}s (${String(error)})`);
      if (attempt === 2) throw new Error(`Trek ${portal} start=${start}: ${String(error)}`);
      await sleep(3000);
    }
  }
}

function size(doc: Doc): number | undefined {
  const raw = doc.fileSize, value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "number" && value > 0 ? value : undefined;
}
const flat = (value: unknown): string => Array.isArray(value) ? value.map(String).join(", ") : value === undefined || value === null ? "" : String(value);

const products: [string, string, Doc][] = [], observations = new Map<string, number>();
const key = (portal: string, instrument: string) => `${portal}\u0000${instrument}`;
for (const [portal, body] of Object.entries(PORTALS)) {
  let start = 0, seen = 0, found = 0;
  // Titan lists 130,000 single observations after its maps: stop paging once three pages in a row hold no map.
  let emptyPages = 0;
  for (;;) {
    const reply = await page(portal, start);
    if (!reply.docs.length) break;
    let mapsHere = 0;
    for (const doc of reply.docs) {
      if (doc.itemType !== "product") continue;
      seen++;
      // A map layer has a category, or is global, or is served as a mosaic (Titan's and Ceres's maps carry no category).
      const services = Array.isArray(doc.serviceTypes) ? doc.serviceTypes : [];
      if (doc.productCat1 || doc.coverage === "Global" || services.includes("Mosaic")) {
        mapsHere++;
        products.push([portal, body, doc]);
      } else {
        const k = key(portal, flat(doc.instrument) || "unstated");
        observations.set(k, (observations.get(k) ?? 0) + 1);
      }
    }
    found += mapsHere;
    start += ROWS;
    emptyPages = mapsHere ? 0 : emptyPages + 1;
    if (start >= reply.numFound || (portal === "titan" && emptyPages >= 3)) break;
    await sleep(500);
  }
  console.log(`${portal}: ${found} map products, ${seen - found} observations read`);
}

// Titan: the facet totals give every observation, not just the pages read.
const facetReply = record(await (await fetch("https://trek.nasa.gov/titan/TrekServices/ws/index/eq/searchItems?start=0&rows=0&key=*",
  { signal: AbortSignal.timeout(120_000) })).json(), "Titan facets");
const facetFields = record(record(facetReply.facet_counts ?? {}, "facet_counts").facet_fields ?? {}, "facet_fields");
const facet = Array.isArray(facetFields.instrument) ? facetFields.instrument : [];
const titanMaps = new Map<string, number>();
for (const [portal, , doc] of products) {
  if (portal !== "titan") continue;
  const name = flat(doc.instrument) || "unstated";
  titanMaps.set(name, (titanMaps.get(name) ?? 0) + 1);
}
for (let i = 0; i + 1 < facet.length; i += 2) {
  const name = String(facet[i]), n = Number(facet[i + 1]);
  observations.set(key("titan", name), n - (titanMaps.get(name) ?? 0));
}

type LedgerRow = { source: string; id: string; title: string; target: string; instrument: string; record_count: number;
  decision: string; reason: string; url: string; details_json: string; family?: string };
function row(portal: string, body: string, doc: Doc): LedgerRow {
  const category = [doc.productCat1, doc.productCat2, doc.productCat3].filter(Boolean).map(flat).join(" / ") || "map layer";
  const resolution = doc.resolution, extent = flat(doc.coverage) || (doc.bbox ? `bbox ${flat(doc.bbox)}` : "extent unstated");
  const parts = [`Trek ${portal} ${category}`, extent === "Global" || extent === "Regional" ? extent.toLowerCase() : extent];
  if (resolution) parts.push(`${typeof resolution === "number" ? pythonNumber(resolution, numberText.get(doc)?.get("resolution")) : flat(resolution)} degrees per pixel`);
  if (doc.RASTER_TYPE) parts.push(flat(doc.RASTER_TYPE));
  const bytes = size(doc);
  if (bytes) parts.push(`${bytes.toLocaleString("en-US")} bytes`);
  const label = flat(doc.productLabel);
  if (!label) throw new TypeError(`Trek ${portal}: a product has no productLabel (${JSON.stringify(doc.title)}).`);
  return {
    source: "trek", id: `${portal}/${label}`, title: flat(doc.title) || label, target: body,
    instrument: flat(doc.instrument), record_count: 1,
    decision: doc.coverage === "Global" ? "global-layer" : "regional-layer",
    reason: parts.join(", ") + ".",
    url: `https://trek.nasa.gov/tiles/${body.replaceAll(" ", "")}/EQ/${label}/1.0.0/WMTSCapabilities.xml`,
    details_json: JSON.stringify(withNumberText(doc, { ...doc, portal, retrievedAt: now }), writeNumberText),
    family: `${portal}/${label}`,
  };
}

const rows = new Map<string, LedgerRow>();
for (const [portal, body, doc] of products) {
  const r = row(portal, body, doc);
  rows.set(r.id, r); // a label listed twice keeps one row
}
const inventory: LedgerRow[] = [...observations].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).filter(([, n]) => n > 0).map(([k, n]) => {
  const [portal, instrument] = k.split("\u0000") as [string, string];
  return {
    source: "trek-observations", id: `${portal}/${instrument}`, title: `${PORTALS[portal]} ${instrument} single observations on Trek`,
    target: PORTALS[portal]!, instrument, record_count: n, decision: "observation-inventory",
    reason: `Trek ${portal} lists ${n.toLocaleString("en-US")} single ${instrument} observations (image cubes or frames), not map layers; counted, not listed.`,
    url: `https://trek.nasa.gov/${portal}/`, details_json: JSON.stringify({ portal, retrievedAt: now }),
  };
});
console.log(JSON.stringify({ map_products: rows.size, global: [...rows.values()].filter(r => r.decision === "global-layer").length,
  observation_rows: inventory.length, observations: inventory.reduce((sum, r) => sum + r.record_count, 0) }, null, 1));
if (dry) process.exit(0);

const db = new DatabaseSync(databasePath);
db.exec("PRAGMA foreign_keys=ON");
db.exec("BEGIN");
try {
  db.exec("DELETE FROM dataset_bodies WHERE source='trek'");
  db.exec("DELETE FROM dataset_instruments WHERE source='trek'");
  db.exec("DELETE FROM datasets WHERE source='trek'");
  db.exec("DELETE FROM inventory WHERE source='trek-observations'");
  const dataset = db.prepare(`INSERT INTO datasets (source,id,title,target,instrument,record_count,decision,reason,url,details_json,family)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  for (const r of rows.values()) dataset.run(r.source, r.id, r.title, r.target, r.instrument, r.record_count, r.decision, r.reason, r.url, r.details_json, r.family ?? "");
  const listing = db.prepare("INSERT INTO inventory (source,id,title,target,instrument,record_count,decision,reason,url,details_json) VALUES (?,?,?,?,?,?,?,?,?,?)");
  for (const r of inventory) listing.run(r.source, r.id, r.title, r.target, r.instrument, r.record_count, r.decision, r.reason, r.url, r.details_json);
  db.prepare("DELETE FROM ledger_log WHERE operation = ?").run("trek");
  db.prepare("INSERT INTO ledger_log (at, operation, detail) VALUES (?,?,?)").run(now.slice(0, 10), "trek",
    "NASA Solar System Treks: every portal's searchItems listing. Products with a category are map layers (datasets, source trek, " +
    "decision global-layer or regional-layer, reason from the record's category, extent, resolution, raster type and size). " +
    "Uncategorised items are single observations, counted per portal and instrument in inventory (trek-observations).");
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}
console.log("written");
