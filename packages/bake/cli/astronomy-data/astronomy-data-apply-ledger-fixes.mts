// Apply reviewed collector output to the ledger in one transaction.
//
//   node packages/bake/cli/astronomy-data-apply-ledger-fixes.mts [--dry-run]
//
// Reads the scratch output of astronomy-data-collect-photojournal.mts, astronomy-data-collect-usgs-files.mts and
// astronomy-data-collect-targets.mts and:
// - adds the Photojournal map entries the first title list missed, each with a decision and a reason built from its own
//   evidence (photojournal-review.ts), and records every Photojournal row's files, pixel sizes and caption phrases;
// - records each USGS product's files and replaces the two copied screen reasons with what that product's page offers;
// - fills the target an archive label states, and records why a row has none.
// Decisions already made on existing rows are kept; PIA24027, the Enceladus infrared mosaic, is now an input (PR #857).
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { array, object, string, databasePath, reviewPhotojournal, checkoutRoot, type PhotojournalEntry } from "@cssearth/bake/sources/astronomy-data";

const dry = process.argv.includes("--dry-run");
const read = async (path: string) => object(JSON.parse(await readFile(resolve(checkoutRoot, path), "utf8")));
const photojournal = await read(`${process.env.PHOTOJOURNAL_WORK_DIR ?? "output/photojournal-refresh"}/photojournal-maps.json`);
const usgsFiles = await read(`${process.env.USGS_WORK_DIR ?? "output/usgs-files"}/usgs-files.json`);
const usgs = object(usgsFiles.products), collections = object(usgsFiles.collections ?? {});
const targets = object((await read(`${process.env.TARGETS_WORK_DIR ?? "output/ledger-targets"}/targets.json`)).rows);

const db = new DatabaseSync(databasePath);
db.exec("PRAGMA foreign_keys=ON");
const counts = { photojournalAdded: 0, photojournalUpdated: 0, photojournalSkippedNoPia: 0, usgsFiles: 0, usgsReopened: 0, targetsFilled: 0, targetsExplained: 0 };
const details = (source: string, id: string) => object(JSON.parse(string(db.prepare("SELECT details_json FROM datasets WHERE source=? AND id=?").get(source, id)?.details_json)));
const setDetails = (source: string, id: string, value: object) => db.prepare("UPDATE datasets SET details_json=? WHERE source=? AND id=?").run(JSON.stringify(value), source, id);
const kinds = (files: { name: string; kind: string }[]) => {
  const by = (kind: string) => files.filter((f) => f.kind === kind).map((f) => f.name);
  const parts = [["raster", "georeferenced raster"], ["document", "document"], ["preview", "preview image"], ["other", "other file"]]
    .map(([kind, label]) => { const names = by(kind!); return names.length ? `${names.length} ${label}${names.length > 1 ? "s" : ""} (${names.slice(0, 4).join(", ")}${names.length > 4 ? ", …" : ""})` : ""; })
    .filter(Boolean);
  return parts.length ? parts.join("; ") : "no downloadable file";
};

db.exec("BEGIN");
try {
  const existing = new Set(db.prepare("SELECT id FROM datasets WHERE source='photojournal'").all().map((r) => string(r.id)));
  const seen = new Set<string>();
  for (const value of array(photojournal.entries)) {
    const e = object(value) as unknown as PhotojournalEntry;
    if (!/^PIA\d{5}$/.test(e.pia)) { counts.photojournalSkippedNoPia++; continue; }
    if (seen.has(e.pia)) continue;
    seen.add(e.pia);
    const evidence = { files: e.files, captionPhrases: e.captionPhrases, titleMatch: e.titleMatch, post: e.post };
    if (existing.has(e.pia)) {
      setDetails("photojournal", e.pia, { ...details("photojournal", e.pia), ...evidence });
      counts.photojournalUpdated++;
      continue;
    }
    const { decision, reason } = reviewPhotojournal(e);
    db.prepare("INSERT INTO datasets(source,id,title,target,instrument,record_count,decision,reason,url,details_json) VALUES ('photojournal',?,?,?,?,1,?,?,?,?)")
      .run(e.pia, e.title, e.target, e.instrument, decision, reason, e.page, JSON.stringify({ pia: e.pia, title: e.title, target: e.target,
        mission: e.mission, instrument: e.instrument, page: e.page, date: e.date, selectedBy: e.titleMatch ? "title" : "caption", ...evidence,
        decision, reason, proposalIds: [], ...(e.target ? {} : { targetNote: "The Photojournal tags this entry with no target." }) }));
    counts.photojournalAdded++;
  }
  const enceladus = "Enceladus's Infrared color dataset is this mosaic since PR #857 (https://github.com/layoutit/css.earth/pull/857); src/objects/enceladus/README.md records its seam and fill caveats.";
  db.prepare("UPDATE datasets SET decision='existing-reference', reason=? WHERE source='photojournal' AND id='PIA24027'").run(enceladus);
  setDetails("photojournal", "PIA24027", { ...details("photojournal", "PIA24027"), decision: "existing-reference", reason: enceladus });

  for (const [id, value] of Object.entries(usgs)) {
    const files = array(value).map((f) => object(f) as unknown as { name: string; kind: string; url: string });
    const row = db.prepare("SELECT decision, reason, target FROM datasets WHERE source='usgs' AND id=?").get(id);
    if (!row) continue;
    const memberIds = Array.isArray(collections[id]) ? (collections[id] as unknown[]).map(string) : [];
    const offers = !files.length && memberIds.length ? `no files itself; it is a collection page linking ${memberIds.length} member products (${memberIds.slice(0, 4).join(", ")}${memberIds.length > 4 ? ", …" : ""})` : kinds(files);
    const old = details("usgs", id);
    setDetails("usgs", id, { ...old, files, ...(memberIds.length ? { memberProducts: memberIds } : {}), formatEvidence: `Product page offers ${offers}.`, ...(old.formatEvidence ? { screenFormatEvidence: old.formatEvidence } : {}) });
    counts.usgsFiles++;
    const reason = string(row.reason), rasters = files.filter((f) => f.kind === "raster").map((f) => f.name);
    if (reason.startsWith("The original catalogue screen did not establish a TIFF candidate")) {
      if (rasters.length) {
        db.prepare("UPDATE datasets SET decision='needs-review', reason=? WHERE source='usgs' AND id=?")
          .run(`Product page offers ${rasters.join(", ")}, which the first format screen missed. Not yet compared with ${string(row.target)}'s current inputs.`, id);
        counts.usgsReopened++;
      } else {
        db.prepare("UPDATE datasets SET reason=? WHERE source='usgs' AND id=?").run(`Product page offers ${offers}; no georeferenced raster to read.`, id);
      }
    } else if (reason.startsWith("Mars implementation is excluded by the user")) {
      db.prepare("UPDATE datasets SET reason=? WHERE source='usgs' AND id=?")
        .run(`Mars is outside this audit's requested scope; retained for future Mars work. Product page offers ${offers}.`, id);
    }
  }

  for (const [key, value] of Object.entries(targets)) {
    const [source, id] = key.split("\t") as [string, string], found = object(value), names = array(found.targets).map(string);
    const old = details(source, id);
    if (names.length) {
      const shown = names.slice(0, 12).join("; ") + (names.length > 12 ? `; +${names.length - 12} more` : "");
      db.prepare("UPDATE datasets SET target=? WHERE source=? AND id=?").run(shown, source, id);
      setDetails(source, id, { ...old, targets: names, targetLabel: string(found.label) });
      counts.targetsFilled++;
    } else {
      setDetails(source, id, { ...old, targetNote: string(found.none) });
      counts.targetsExplained++;
    }
  }
  if (dry) db.exec("ROLLBACK"); else db.exec("COMMIT");
} catch (e) {
  db.exec("ROLLBACK");
  throw e;
} finally {
  db.close();
}
console.log(JSON.stringify({ dryRun: dry, ...counts }, null, 1));
