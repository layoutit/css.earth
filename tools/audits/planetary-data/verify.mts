import { readFile, readdir, stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import {
  root,
  json,
  object,
  array,
  string,
  number,
  loadRows,
  slice,
  tsv,
} from "./model.mts";
const opus = object(await json("evidence/opus.json")),
  prior = object(await json("evidence/previous-audits.json")),
  receipt = object(opus.receipt),
  targets = array(opus.rows).map(object),
  volumes = array(opus.volumes).map(object),
  total = number(receipt.totalRecords);
const sum = (r: Record<string, unknown>[]) =>
  r.reduce((s, r) => {
    const n = number(r.count);
    assert.ok(Number.isSafeInteger(n) && n > 0);
    return s + n;
  }, 0);
assert.equal(sum(targets), total);
assert.equal(sum(volumes), total);
assert.equal(new Set(targets.map((r) => string(r.id))).size, targets.length);
assert.equal(
  new Set(volumes.map((r) => string(r.instrument) + "/" + string(r.bundleid)))
    .size,
  volumes.length,
);
assert.equal(
  new Set(volumes.map((r) => string(r.bundleid))).size,
  number(receipt.distinctVolumes),
);
const facets = object(object(object(opus.global).instrument).mults);
assert.equal(Object.keys(facets).length, number(receipt.instrumentCount));
for (const [instrument, count] of Object.entries(facets)) {
  assert.equal(
    sum(targets.filter((r) => r.instrument === instrument)),
    number(count),
  );
  assert.equal(
    sum(volumes.filter((r) => r.instrument === instrument)),
    number(count),
  );
}
const plans = [
    ...array(prior.proposals).map(object),
    ...array(await json("opus-proposals.json")).map(object),
  ],
  numbers = new Set(plans.map((p) => string(p.id).split("-")[0]));
assert.equal(numbers.size, plans.length);
for (const row of targets) {
  assert.ok(string(row.reason).length > 20);
  const samples = array(row.samples).map(object);
  assert.equal(samples.length, Math.min(2, number(row.count)));
  for (const s of samples) {
    assert.equal(s.instrument, row.instrument);
    assert.equal(s.target, row.target);
    assert.ok(string(s.opusid));
  }
  for (const p of array(row.proposals).map(string))
    assert.ok(numbers.has(p), "Dangling OPUS proposal " + p);
}
for (const source of ["photojournal", "pdsBundles", "usgs"])
  for (const v of array(prior[source])) {
    const r = object(v);
    for (const p of array(r.proposalIds).map(string))
      assert.ok(
        plans.some((plan) => plan.id === p),
        "Dangling earlier proposal " + p,
      );
  }
assert.equal(array(prior.photojournal).length, 717);
assert.equal(array(prior.pdsBundles).length, 189);
assert.equal(array(prior.usgs).length, 1643);
let labels = 0;
for (const v of array(opus.labelReceipts)) {
  const r = object(v),
    file = string(r.file);
  assert.match(file, /^[a-z0-9-]+\.(lbl|xml)$/);
  const bytes = await readFile(root + "/evidence/labels/" + file);
  assert.equal(bytes.length, number(r.bytes));
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    string(r.sha256),
  );
  labels++;
}
assert.equal(labels, 23);
const rows = await loadRows();
const mimas = slice(
  rows,
  new URLSearchParams({ source: "opus", target: "Mimas" }),
);
assert.equal(mimas.length, 6);
assert.equal(
  mimas.reduce((s, r) => s + r.count, 0),
  9987,
);
const europa = slice(
  rows,
  new URLSearchParams({ source: "photojournal", target: "europa" }),
);
assert.ok(europa.length > 0);
assert.ok(
  europa.every(
    (r) =>
      r.source === "photojournal" && r.target.split(/;\s*/).includes("europa"),
  ),
);
const ring = slice(
  rows,
  new URLSearchParams({ source: "opus", proposal: "97" }),
);
assert.ok(ring.length > 10);
assert.ok(ring.every((r) => r.target === "Uranus Rings"));
assert.throws(() => slice(rows, new URLSearchParams({ invented: "value" })));
assert.equal(tsv(mimas).trimEnd().split("\n").length, mimas.length + 1);
assert.ok(
  tsv([{ ...mimas[0], reason: '=HYPERLINK("x")' }]).includes("'=HYPERLINK"),
);
const exported = JSON.parse(JSON.stringify(mimas));
assert.deepEqual(exported, mimas);
const files: string[] = [];
async function walk(path: string) {
  for (const ent of await readdir(path, { withFileTypes: true })) {
    if (ent.isDirectory()) await walk(path + "/" + ent.name);
    else if (ent.name.endsWith(".md")) files.push(path + "/" + ent.name);
  }
}
await walk(root);
let links = 0;
for (const file of files) {
  const contents = await readFile(file, "utf8");
  for (const match of contents.matchAll(/\]\(([^)]+)\)/g)) {
    const link = match[1].split("#")[0];
    if (!link || /^[a-z][a-z0-9+.-]*:/i.test(link)) continue;
    const target = resolve(dirname(file), decodeURIComponent(link));
    assert.ok(
      (await stat(target)).isFile(),
      "Missing Markdown target " + target,
    );
    links++;
  }
}
console.log(
  JSON.stringify(
    {
      totalRecords: total,
      targetSlices: targets.length,
      volumeEntries: volumes.length,
      instrumentPartitions: Object.keys(facets).length,
      labelsVerified: labels,
      proposalCount: plans.length,
      markdownFiles: files.length,
      localMarkdownLinks: links,
      mimasSliceRows: mimas.length,
      mimasRecords: 9987,
      uranusRingSlices: ring.length,
      allAuditSliceRows: rows.length,
    },
    null,
    2,
  ),
);
