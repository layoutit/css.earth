// Read the targets a record's own archive label states, for ledger rows collected without one.
//
//   TARGETS_WORK_DIR=output/ledger-targets node packages/bake/cli/astronomy-data-collect-targets.mts
//
// PDS4 bundles and collections name their targets in <Target_Identification><name>; PDS3 data sets name theirs as
// TARGET_NAME in catalog/dataset.cat, including non-body values such as CHECKOUT or CALIBRATION, which are kept as stated.
// Rows whose source has no such label (DARTS catalogue entries, Photojournal entries tagged with no target) are listed with
// the reason, never given a guessed target. Collection writes only scratch output.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { batch, object, string, databasePath, checkoutRoot } from "@cssearth/bake/sources/astronomy-data";

const dir = resolve(checkoutRoot, process.env.TARGETS_WORK_DIR ?? "output/ledger-targets");
await mkdir(dir + "/cache", { recursive: true });

async function text(url: string): Promise<string | null> {
  const path = `${dir}/cache/${createHash("sha256").update(url).digest("hex")}.txt`;
  try { return await readFile(path, "utf8"); } catch (e) { if (!(e instanceof Error && "code" in e && e.code === "ENOENT")) throw e; }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (r.status === 404) { await writeFile(path, ""); return null; }
      if (!r.ok) throw Error(`HTTP ${r.status} ${url}`);
      const body = await r.text();
      await writeFile(path, body);
      return body;
    } catch { await new Promise((done) => setTimeout(done, 2000 * (attempt + 1))); }
  }
  return null;
}
export function pds4Targets(xml: string): string[] {
  return [...new Set([...xml.matchAll(/<Target_Identification>[\s\S]*?<name>([^<]+)<\/name>/g)].map((m) => m[1]!.trim()))];
}
export function pds3Targets(cat: string): string[] {
  return [...new Set([...cat.matchAll(/TARGET_NAME\s*=\s*(?:"([^"]+)"|(\S+))/g)].map((m) => (m[1] ?? m[2] ?? "").trim()).filter(Boolean))];
}

const db = new DatabaseSync(databasePath, { readOnly: true });
const rows = db.prepare("SELECT source, id, url, details_json FROM datasets WHERE target IS NULL OR trim(target)='' ORDER BY source, id").all()
  .map((r) => ({ source: string(r.source), id: string(r.id), url: string(r.url), details: object(JSON.parse(string(r.details_json))) }));
db.close();
type Found = { targets: string[]; label: string } | { targets: []; none: string };
const out: Record<string, Found> = {};
await batch(rows, async (row) => {
  const key = `${row.source}\t${row.id}`;
  if (row.source === "pds" && typeof row.details.source === "string") {
    const xml = await text(row.details.source);
    const targets = xml ? pds4Targets(xml) : [];
    out[key] = targets.length ? { targets, label: row.details.source } : { targets: [], none: "The PDS4 bundle label names no Target_Identification." };
  } else if (row.source === "umd") {
    const base = row.url.replace(/\/(?:SUPPORT\/)?dataset\.s?html?$/i, "/");
    const pds4 = /\/holdings\/pds4-/.test(row.url);
    const label = pds4 ? `${base}collection.xml` : `${base}catalog/dataset.cat`;
    const body = await text(label);
    const targets = body ? (pds4 ? pds4Targets(body) : pds3Targets(body)) : [];
    out[key] = targets.length ? { targets, label } : { targets: [], none: `No target in ${pds4 ? "the PDS4 collection label" : "the PDS3 data set catalogue"} (${label}).` };
  } else if (row.source === "photojournal") {
    out[key] = { targets: [], none: "The Photojournal tags this entry with no target." };
  } else if (row.source === "umd-holdings") {
    out[key] = { targets: [], none: "A root directory listing of an archive holding; the listing states no target." };
  } else if (row.source === "darts") {
    out[key] = { targets: [], none: "The DARTS catalogue entry states no target; its keywords name only mission, instrument and field." };
  } else {
    out[key] = { targets: [], none: `The ${row.source} record is a collection or index entry and states no target.` };
  }
}, 3);
await writeFile(`${dir}/targets.json`, JSON.stringify({ retrievedAt: new Date().toISOString(), rows: out }, null, 1) + "\n");
const filled = Object.values(out).filter((f) => f.targets.length).length;
console.log(`${rows.length} rows without a target; ${filled} now have the target their label states; written to ${dir}/targets.json`);
// Collection writes only ignored scratch output. Review before a SQLite transaction.
