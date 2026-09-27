// Give the ledger a data structure a query can rely on, in one transaction.
//
//   node tools/sources/astronomy-data/apply-structure.mts [--dry-run]
//
// - Moves the listings that repeat datasets out of `datasets` into `inventory`, with their proposal links: OPUS volumes
//   and geometry (the same 1,627,081 observations as `opus`, split two other ways), Maryland holdings (directory
//   listings of Maryland datasets), and DARTS collections and indexes (containers).
// - Rebuilds `bodies` and `dataset_bodies` from each dataset's full target list (details.targets when a source shortened
//   the target text) through bodies.mts: every body keyed by its cssEarth id when cssEarth catalogues it, otherwise by
//   its own name with a kind read from its designation. A Photojournal tag of a tagged body's parent is role `parent`.
// - Sets `datasets.family`. Maryland archives Rosetta per tracking pass and per mission phase (1,660 rows are one RSI
//   gravity series), so its rows group by title without the session date, mission phase and version; every other
//   archive already lists one row per dataset, so each row is its own family.
// Running it again rebuilds the two body tables and the families.
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { bodiesOf, databasePath, root } from "./model.mts";
import { bodyCatalogue, type Body } from "./bodies.mts";
import { object, string } from "./collect/client.mts";

const dry = process.argv.includes("--dry-run");
// "Rosetta-Orbiter RSI Escort 3 67P Gravity Measurement - 2014-12-14T06:44" and its 1,659 siblings are one series.
function marylandFamily(title: string): string {
  return title
    .replace(/\s+-\s+\d{4}-\d\d-\d\d.*$/, "")
    .replace(/\bMTP\d+\b/g, "")
    .replace(/\b(Prelanding|Escort \d|Extension \d|Comet Escort \d)\b/g, "")
    .replace(/\bv\d+(\.\d+)?\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
const inventorySources = ["opus-volumes", "opus-geometry", "umd-holdings", "darts-collections", "darts-index"];
const catalogue = await bodyCatalogue(resolve(root, "../../.."));
const db = new DatabaseSync(databasePath);
db.exec("PRAGMA foreign_keys=ON");
const counts = { families: 0, inventoryMoved: 0, inventoryLinksMoved: 0, bodies: 0, links: 0, parentLinks: 0, datasetsWithoutBody: 0 };
db.exec("BEGIN");
try {
  db.exec(`CREATE TABLE IF NOT EXISTS inventory(source TEXT NOT NULL,id TEXT NOT NULL,title TEXT NOT NULL,target TEXT NOT NULL,instrument TEXT NOT NULL,record_count INTEGER NOT NULL CHECK(record_count>=0),decision TEXT NOT NULL,reason TEXT NOT NULL,url TEXT NOT NULL,details_json TEXT NOT NULL CHECK(json_valid(details_json)),PRIMARY KEY(source,id)) STRICT;
    CREATE TABLE IF NOT EXISTS inventory_proposals(source TEXT NOT NULL,inventory_id TEXT NOT NULL,proposal_id TEXT NOT NULL REFERENCES proposals(id),PRIMARY KEY(source,inventory_id,proposal_id),FOREIGN KEY(source,inventory_id) REFERENCES inventory(source,id)) STRICT;`);
  const marks = inventorySources.map(() => "?").join(",");
  counts.inventoryMoved = Number(db.prepare(`INSERT INTO inventory SELECT source,id,title,target,instrument,record_count,decision,reason,url,details_json FROM datasets WHERE source IN (${marks})`).run(...inventorySources).changes);
  counts.inventoryLinksMoved = Number(
    db.prepare(`INSERT INTO inventory_proposals SELECT source,dataset_id,proposal_id FROM dataset_proposals WHERE source IN (${marks})`).run(...inventorySources).changes,
  );
  db.prepare(`DELETE FROM dataset_proposals WHERE source IN (${marks})`).run(...inventorySources);
  db.prepare(`DELETE FROM datasets WHERE source IN (${marks})`).run(...inventorySources);

  if (!db.prepare("SELECT 1 FROM pragma_table_info('datasets') WHERE name='family'").get())
    db.exec("ALTER TABLE datasets ADD COLUMN family TEXT NOT NULL DEFAULT ''");
  const setFamily = db.prepare("UPDATE datasets SET family=? WHERE source=? AND id=?");
  for (const r of db.prepare("SELECT source,id,title FROM datasets").all()) {
    const source = string(r.source), id = string(r.id);
    setFamily.run(source === "umd" ? marylandFamily(string(r.title)) : id, source, id);
  }
  counts.families = Number(db.prepare("SELECT count(DISTINCT source||char(0)||family) n FROM datasets").get()?.n);
  db.exec(`DROP TABLE IF EXISTS dataset_bodies; DROP TABLE IF EXISTS bodies;
    CREATE TABLE bodies(id TEXT PRIMARY KEY,name TEXT NOT NULL,kind TEXT NOT NULL,parent TEXT NOT NULL,cssearth_object TEXT NOT NULL,catalogued INTEGER NOT NULL CHECK(catalogued IN (0,1))) STRICT;
    CREATE TABLE dataset_bodies(source TEXT NOT NULL,dataset_id TEXT NOT NULL,body_id TEXT NOT NULL REFERENCES bodies(id),name_in_source TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('target','parent')),PRIMARY KEY(source,dataset_id,body_id),FOREIGN KEY(source,dataset_id) REFERENCES datasets(source,id)) STRICT;`);
  const bodies = new Map<string, Body>();
  // Prefer "Tempel 1" over "TEMPEL 1" over "tempel 1" for a body cssEarth does not name.
  const score = (t: string) => (t !== t.toLowerCase() && t !== t.toUpperCase() ? 2 : t !== t.toLowerCase() ? 1 : 0);
  const keep = (b: Body) => {
    const old = bodies.get(b.key);
    if (!old || (!b.catalogued && score(b.label) > score(old.label))) bodies.set(b.key, b);
    // A parent no dataset names still needs its own row to hold its moons.
    if (b.parent && !bodies.has(b.parent)) {
      const up = catalogue.known.get(b.parent);
      bodies.set(b.parent, { key: b.parent, label: up?.name || b.parent, kind: up?.kind ?? "", parent: "", object: catalogue.objectOf(b.parent), catalogued: true });
    }
  };
  const links: { source: string; id: string; body: string; name: string; role: string }[] = [];
  for (const r of db.prepare("SELECT source,id,title,target,decision,details_json FROM datasets").all()) {
    const source = string(r.source), id = string(r.id), details = object(JSON.parse(string(r.details_json)));
    const full = Array.isArray(details.targets) ? details.targets.filter((t): t is string => typeof t === "string") : [];
    // Meteorite and laboratory rows name samples, not bodies; a comma list names several targets.
    const sample = r.decision === "Laboratory reference" || /\blab\b|laboratory|meteorite/i.test(string(r.title));
    let named = (full.length ? full : string(r.target).split(";")).flatMap((t) => t.split(/,\s*/));
    // USGS titles start with the body ("Moon Kaguya TC Global Mosaic"); use it when the target field names none.
    if (source === "usgs" && !named.some((t) => bodiesOf(t).length)) {
      const words = string(r.title).split(/\s+/);
      const lead = [words.slice(0, 2).join(" "), words[0]].find((w) => catalogue.body(w)?.catalogued);
      if (lead) named = [lead];
    }
    const found = new Map<string, { body: Body; name: string }>();
    for (const name of named) {
      const b = catalogue.body(name, sample);
      if (b && !found.has(b.key)) found.set(b.key, { body: b, name: name.trim() });
    }
    const parents = new Set([...found.keys()].map(catalogue.parentOf).filter(Boolean));
    for (const { body, name } of found.values()) {
      keep(body);
      const role = source === "photojournal" && parents.has(body.key) ? "parent" : "target";
      if (role === "parent") counts.parentLinks++;
      links.push({ source, id, body: body.key, name, role });
    }
    if (!found.size) counts.datasetsWithoutBody++;
  }
  const insertBody = db.prepare("INSERT INTO bodies VALUES (?,?,?,?,?,?)");
  for (const b of bodies.values()) insertBody.run(b.key, b.label, b.kind, b.parent, b.object, b.catalogued ? 1 : 0);
  const insertLink = db.prepare("INSERT INTO dataset_bodies VALUES (?,?,?,?,?)");
  for (const l of links) insertLink.run(l.source, l.id, l.body, l.name, l.role);
  counts.bodies = bodies.size;
  counts.links = links.length;
  db.exec(dry ? "ROLLBACK" : "COMMIT");
} catch (e) {
  db.exec("ROLLBACK");
  throw e;
} finally {
  db.close();
}
console.log(JSON.stringify({ dryRun: dry, ...counts }, null, 1));
