import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import {
  root,
  openLedger,
  loadRows,
  loadProposals,
  slice,
  tsv,
  object,
  array,
  string,
  number,
} from "./model.mts";
const db = openLedger();
assert.equal(db.prepare("PRAGMA integrity_check").get()?.integrity_check, "ok");
assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
function evidence(id: string): unknown {
  const row = db.prepare("SELECT content FROM evidence WHERE id=?").get(id);
  assert.ok(row?.content instanceof Uint8Array, "Missing evidence " + id);
  return JSON.parse(Buffer.from(row.content).toString("utf8"));
}
for (const r of db.prepare("SELECT id,content,sha256 FROM evidence").all()) {
  assert.ok(r.content instanceof Uint8Array);
  assert.equal(
    createHash("sha256").update(r.content).digest("hex"),
    r.sha256,
    String(r.id),
  );
}
const rows = loadRows(),
  inventory = loadRows("inventory"),
  plans = loadProposals();
const perSource = (table: string) =>
  Object.fromEntries(
    db
      .prepare(`SELECT source,count(*) n FROM ${table} GROUP BY source`)
      .all()
      .map((r) => [string(r.source), number(r.n)]),
  );
const counts = perSource("datasets"),
  listings = perSource("inventory");
assert.deepEqual(counts, {
  darts: 360,
  opus: 549,
  pds: 189,
  photojournal: 2593,
  umd: 3880,
  usgs: 1643,
});
// Listings that repeat datasets live in `inventory`, never in `datasets` (apply-structure.mts).
assert.deepEqual(listings, {
  "darts-collections": 46,
  "darts-index": 2,
  "opus-geometry": 221,
  "opus-volumes": 990,
  "umd-holdings": 5110,
});
const receipt = object(evidence("opus:receipt")),
  total = number(receipt.totalRecords);
const opus = rows.filter((r) => r.source === "opus"),
  volumes = inventory.filter((r) => r.source === "opus-volumes");
const sum = (r: typeof rows) => r.reduce((n, r) => n + r.count, 0);
assert.equal(sum(opus), total);
assert.equal(sum(volumes), total);
const facets = object(object(object(evidence("opus:global")).instrument).mults);
for (const [instrument, count] of Object.entries(facets)) {
  assert.equal(
    sum(opus.filter((r) => r.instrument === instrument)),
    number(count),
  );
  assert.equal(
    sum(volumes.filter((r) => r.instrument === instrument)),
    number(count),
  );
}
const labels = array(evidence("opus:label-receipts")).map(object);
assert.equal(labels.length, 23);
for (const label of labels) {
  const row = db
    .prepare("SELECT * FROM evidence WHERE id=?")
    .get("label:" + string(label.file));
  assert.ok(row?.content instanceof Uint8Array);
  assert.equal(row.content.length, number(label.bytes));
  assert.equal(row.sha256, label.sha256);
  assert.equal(row.url, label.url);
}
const markdown = await readFile(root + "/PROPOSALS.md", "utf8");
assert.equal(plans.length, 131);
assert.equal([...markdown.matchAll(/^## P\d+$/gm)].length, plans.length);
for (const p of plans) {
  assert.ok(markdown.includes("\n## P" + p.id + "\n"));
  assert.ok(p.next_step.trim());
}
for (const r of [...rows, ...inventory]) {
  assert.ok(r.id && r.source && r.reason.length > 15);
  assert.match(r.url, /^https?:\/\//);
  for (const p of r.proposals) assert.ok(plans.some((plan) => plan.id === p));
  // A decision cites something a reader can open: a PR, a file or a record, never a conversation.
  assert.doesNotMatch(r.reason, /\bchat\b|\bconversation\b/i, `${r.source} ${r.id} cites a chat`);
  const d = object(r.details);
  // A row without a target says why: its label names none, or its source records none.
  if (!r.target.trim()) assert.ok(typeof d.targetNote === "string" && d.targetNote.length > 15, `${r.source} ${r.id} has no target and no note`);
  // Every Photojournal row keeps its downloadable files, so a map can be told from a picture without opening the page.
  if (r.source === "photojournal") assert.ok(Array.isArray(d.files), `photojournal ${r.id} records no files`);
  // Every USGS row keeps the files its product page offers; the first screen's copied reasons are replaced per product.
  if (r.source === "usgs") {
    assert.ok(Array.isArray(d.files), `usgs ${r.id} records no files`);
    assert.doesNotMatch(r.reason, /^(The original catalogue screen did not establish|Mars implementation is excluded by the user)/, `usgs ${r.id} keeps a copied screen reason`);
  }
}
const mimas = slice(
  rows,
  new URLSearchParams({ source: "opus", target: "Mimas" }),
);
assert.equal(mimas.length, 6);
assert.equal(sum(mimas), 9987);
const ring = slice(
  rows,
  new URLSearchParams({ source: "opus", proposal: "97" }),
);
assert.ok(ring.length > 10);
assert.ok(ring.every((r) => r.target === "Uranus Rings"));
assert.deepEqual(
  slice(rows, new URLSearchParams({ proposal: "01" })),
  slice(rows, new URLSearchParams({ proposal: "1" })),
);
assert.throws(() => slice(rows, new URLSearchParams({ invented: "value" })));
assert.equal(tsv(mimas).trimEnd().split("\n").length, 7);
assert.ok(
  tsv([{ ...mimas[0], reason: '=HYPERLINK("x")' }]).includes("'=HYPERLINK"),
);
assert.equal(
  rows.filter(
    (r) => r.source === "umd" && r.decision === "unavailable-description",
  ).length,
  2,
);
assert.equal(
  inventory.filter(
    (r) => r.source === "umd-holdings" && r.decision === "unindexed-holding",
  ).length,
  1239,
);
assert.equal(
  rows.find((r) => r.id === "darts:hisaki-exceed-euv-level2")?.decision,
  "qualification-first",
);
assert.equal(
  rows.find((r) => r.id === "darts:akari-fis-image-pointed-fts-x.x")?.decision,
  "not-released",
);
assert.equal(
  rows.find(
    (r) => r.source === "umd" && r.id.startsWith("ro-c-virtis-5-67p-maps"),
  )?.decision,
  "already-used",
);
for (const name of ["README.md", "PROPOSALS.md"]) {
  const content = await readFile(root + "/" + name, "utf8");
  for (const m of content.matchAll(/\]\(([^)]+)\)/g)) {
    const [path, hash] = m[1].split("#");
    if (/^[a-z][a-z0-9+.-]*:/i.test(path)) continue;
    const target = resolve(root, decodeURIComponent(path || name));
    assert.ok((await stat(target)).isFile(), "Missing link " + m[1]);
    if (target === root + "/PROPOSALS.md" && hash?.match(/^p\d+$/))
      assert.ok(markdown.includes("\n## P" + hash.slice(1) + "\n"));
  }
}
// Every dataset that names a target links to at least one body; a dataset without one says why in its record.
const linked = new Set(
  db
    .prepare("SELECT DISTINCT source||char(0)||dataset_id k FROM dataset_bodies")
    .all()
    .map((r) => string(r.k)),
);
for (const r of rows)
  if (!linked.has(r.source + "\0" + r.id))
    assert.ok(typeof object(r.details).targetNote === "string" || !r.target.trim(), `${r.source} ${r.id} names "${r.target}" but links to no body`);
// Every dataset belongs to a family (apply-structure.mts); only Maryland groups several rows into one.
assert.deepEqual(db.prepare("SELECT source,id FROM datasets WHERE family='' LIMIT 1").all(), []);
assert.deepEqual(db.prepare("SELECT DISTINCT source FROM datasets WHERE source<>'umd' AND family<>id").all(), []);
// Instruments hang off missions, links off datasets and instruments (cleanup/instruments.py); only sources that state an
// instrument link to one.
assert.deepEqual(db.prepare("PRAGMA foreign_key_check(instruments)").all(), []);
assert.deepEqual(db.prepare("PRAGMA foreign_key_check(dataset_instruments)").all(), []);
assert.deepEqual(db.prepare("SELECT DISTINCT source FROM dataset_instruments WHERE source IN ('usgs','pds')").all(), []);
assert.ok(number(db.prepare("SELECT count(DISTINCT source||char(0)||dataset_id) n FROM dataset_instruments").get()?.n) > 6000);
// A parent named in `bodies` exists as a body, and only the Photojournal marks parent tags.
assert.deepEqual(db.prepare("SELECT id FROM bodies WHERE parent<>'' AND parent NOT IN (SELECT id FROM bodies)").all(), []);
assert.deepEqual(db.prepare("SELECT DISTINCT source FROM dataset_bodies WHERE role='parent' AND source<>'photojournal'").all(), []);
db.close();
console.log(
  JSON.stringify(
    {
      sources: counts,
      inventory: listings,
      proposals: plans.length,
      nativeLabels: labels.length,
      opusRecords: total,
      mimasRows: mimas.length,
    },
    null,
    2,
  ),
);
