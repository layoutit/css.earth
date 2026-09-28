// Entry script: node packages/bake/cli/astronomy-data-build-instruments.mts [--dry-run]. Builds missions, instruments and
// dataset_instruments in the ledger from each archive's own instrument fields; the work is in @cssearth/bake/sources.
import { DatabaseSync } from "node:sqlite";
import { databasePath } from "@cssearth/bake/sources";

const dry = process.argv.includes("--dry-run");
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
// Python's str.capitalize, str.title and str.isupper, which the archive-name rules were written against.
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
const title = (s: string) => s.toLowerCase().replace(/(^|[^a-zA-Z])([a-z])/g, (_, before: string, letter: string) => before + letter.toUpperCase());
const isUpper = (s: string) => s.toUpperCase() === s && s.toLowerCase() !== s;
const stripParens = (s: string) => s.replace(/\s*\([^()]+\)/g, "").trim() || s;

// ---------- missions
type Mission = { name: string; aliases: Set<string>; kind: string };
const missions = new Map<string, Mission>();
const ALIAS: Record<string, string> = { // the same mission under another archive's name
  "voyager-program": "voyager", "voyager-1": "voyager", "voyager-2": "voyager", vg2: "voyager",
  "hubble-space-telescope": "hubble", hst: "hubble", "new-horizons": "new-horizons",
  "near-shoemaker": "near", "cassini-huygens": "cassini", "galileo-orbiter": "galileo", go: "galileo",
  "mars-reconnaissance-orbiter": "mro", "lunar-reconnaissance-orbiter": "lro", "mars-global-surveyor": "mgs",
  "mars-exploration-rover": "mer", "mars-science-laboratory": "msl", stardust: "stardust", sdu: "stardust",
  huygens: "cassini", epoxi: "deep-impact", "deep-impact-epoxi": "deep-impact",
  mex: "mars-express", "viking-orbiter": "viking", // Huygens is Cassini's probe; EPOXI is Deep Impact's extended mission
};
const midOf = (name: string) => ALIAS[slug(name)] ?? slug(name);
function mission(name: string, kind = "spacecraft", aliases: readonly string[] = []): string {
  const mid = midOf(name);
  let m = missions.get(mid);
  if (!m) missions.set(mid, m = { name, aliases: new Set(), kind });
  for (const a of aliases) if (a && a !== m.name) m.aliases.add(a);
  return mid;
}

// Maryland PDS3 dataset ids start with the spacecraft or observatory code.
const UMD_MISSION: Record<string, string> = {
  ro: "Rosetta", rl: "Rosetta", ro_rl: "Rosetta", dif: "Deep Impact", dii: "Deep Impact", di: "Deep Impact",
  di_ear: "Earth-based observatories", di_iras: "IRAS", gio: "Giotto", sdu: "Stardust", stardust: "Stardust",
  vega1: "Vega 1", vega2: "Vega 2", ihw: "International Halley Watch", ice: "International Cometary Explorer",
  go: "Galileo", ds1: "Deep Space 1", con: "CONTOUR", phb2: "Phobos 2", soho: "SOHO", sakig: "Sakigake",
  suisei: "Suisei", vg2: "Voyager", hst: "Hubble", irtf: "IRTF", eso: "European Southern Observatory",
  oao: "Okayama Astrophysical Observatory", mssso: "Mount Stromlo and Siding Spring Observatories",
  iue: "International Ultraviolet Explorer", ear: "Earth-based observatories", msx: "MSX", brrison: "BRRISON",
  nh: "New Horizons",
};
// Maryland PDS4 bundles name their mission first in the bundle id ("pds4-lucy.leisa", "pds4-epoxi_mri").
const PDS4_MISSION: Record<string, string> = { epoxi: "Deep Impact", nh: "New Horizons", lucy: "Lucy", dart: "DART", ro: "Rosetta" };
const OBSERVATORIES = new Set(["Earth-based observatories", "European Southern Observatory", "Okayama Astrophysical Observatory",
  "Mount Stromlo and Siding Spring Observatories", "IRTF", "International Halley Watch"]);
// Instrument codes Maryland's Rosetta, New Horizons and Deep Impact rows use.
const CODES: Record<string, string> = {
  RSI: "Radio Science Investigation", OSINAC: "OSIRIS Narrow Angle Camera", OSIWAC: "OSIRIS Wide Angle Camera",
  OSIRIS: "OSIRIS", NAVCAM: "Navigation Camera", RPCICA: "RPC Ion Composition Analyser", ROMAP: "ROMAP",
  VIRTIS: "VIRTIS", ALICE: "Alice ultraviolet spectrometer", RPCMAG: "RPC Magnetometer", RPCLAP: "RPC Langmuir Probe",
  CONSERT: "CONSERT", MIRO: "MIRO", ROSINA: "ROSINA", MIDAS: "MIDAS", RPCIES: "RPC Ion and Electron Sensor",
  RPCMIP: "RPC Mutual Impedance Probe", LORRI: "Long Range Reconnaissance Imager",
  MVIC: "Multispectral Visible Imaging Camera", LEISA: "Linear Etalon Imaging Spectral Array", MRI: "Medium Resolution Instrument",
  HRIV: "High Resolution Instrument visible CCD", REX: "Radio Science Experiment", HRII: "High Resolution Instrument infrared spectrometer",
  GIADA: "GIADA", PTOLEMY: "Ptolemy", SESAME: "SESAME", MUPUS: "MUPUS", COSAC: "COSAC", ITS: "Impactor Targeting Sensor",
  COSIMA: "COSIMA",
};
const OPUS_SPACECRAFT = ["New Horizons", "Cassini", "Voyager", "Galileo", "Hubble"];

type Instrument = { mission_id: string; name: string; acronym: string };
let links: [string, string, string, string][] = []; // source, id, instrument key, name in source
const instruments = new Map<string, Instrument>();
function instrument(mid: string, name: string, acronym: string, raw: string, source: string, id: string): void {
  const key = `${mid}/${slug(acronym || name)}`;
  let known = instruments.get(key);
  if (!known) instruments.set(key, known = { mission_id: mid, name, acronym });
  // Keep the fullest name an archive gives ("Long range reconnaissance imager" over "LORRI").
  if (name.length > known.name.length && known.name.toUpperCase() === (known.acronym || "").toUpperCase()) known.name = name;
  links.push([source, id, key, raw]);
}

type Details = { metadata?: { keywords?: unknown }; mission?: unknown };
function details(json: string, where: string): Details {
  const value: unknown = JSON.parse(json);
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError(`${where}: details_json is not an object.`);
  return value as Details;
}
function keywords(d: Details, kind: string): string[] {
  const all = Array.isArray(d.metadata?.keywords) ? d.metadata.keywords : [];
  return all.filter((k): k is string => typeof k === "string" && k.startsWith(kind + ":")).map(k => k.slice(k.indexOf(":") + 1));
}
const parts = (raw: string) => raw.split(";").map(p => p.trim()).filter(Boolean);
const acronymOf = (name: string) => [...name.matchAll(/\(([^()]+)\)/g)].map(m => m[1]).join("/");
const missionText = (d: Details) => typeof d.mission === "string" ? d.mission : "";

type Row = { source: string; id: string; title: string; instrument: string; details_json: string };
const db = new DatabaseSync(databasePath, { readOnly: dry });
db.exec("PRAGMA foreign_keys=ON");
const rows = db.prepare("SELECT source, id, title, instrument, details_json FROM datasets").all() as Row[];

// Photojournal: learn each instrument's mission from rows that name one mission.
const pjSingle = new Map<string, Map<string, number>>();
for (const r of rows) {
  if (r.source !== "photojournal") continue;
  const ms = [...new Set(parts(missionText(details(r.details_json, `photojournal ${r.id}`))).map(midOf))].sort();
  if (ms.length !== 1) continue;
  for (const i of parts(r.instrument)) {
    const counts = pjSingle.get(i) ?? new Map<string, number>();
    counts.set(ms[0]!, (counts.get(ms[0]!) ?? 0) + 1);
    pjSingle.set(i, counts);
  }
}

const STOP = new Set(["and", "of", "for", "the", "a", "on", "to"]);
// Photojournal mission slugs that are abbreviations; the rest are names ("dawn" is Dawn, "mro" is MRO).
const ACRONYM_MISSIONS = new Set(["mro", "mgs", "lro", "msl", "mer", "srtm", "eos", "near", "aria", "smap", "emit", "ostm", "cowvr", "grfm",
  "bice", "bsgc", "dspse", "modis", "uavsar", "airsar", "glims", "messenger", "spherex", "neowise", "ecostress",
  "grace", "gpm", "iss"]);
/** True when the acronym reads through the name: its first letter starts the first word, and each later letter either
 * continues the current word or starts the next one, leaving at most one word unstarted ("HiRISE" in "high resolution
 * imaging science experiment", "CTX" in "context camera", "CIRS" in "composite infrared spectrometer"). */
function spells(acronym: string, name: string): boolean {
  const a = acronym.toLowerCase().replace(/[^a-z0-9]/g, "");
  const words = (name.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(w => !STOP.has(w));
  if (!a || !words.length || a[0] !== words[0]![0]) return false;
  if (words.length === 1) return a.length >= 3 && words[0]!.startsWith(a);
  const memo = new Map<string, boolean>();
  const go = (ai: number, wi: number, ci: number, started: number): boolean => {
    const k = `${ai},${wi},${ci},${started}`, cached = memo.get(k);
    if (cached !== undefined) return cached;
    let result: boolean;
    if (ai === a.length) result = started >= words.length - 1;
    else {
      const ch = a[ai]!;
      result = false;
      for (const next of [wi + 1, wi + 2]) { // the next word, or the one after it (SHARAD skips "subsurface")
        if (next < words.length && words[next]![0] === ch && go(ai + 1, next, 0, started + 1)) { result = true; break; }
      }
      if (!result) {
        const j = words[wi]!.indexOf(ch, ci + 1);
        result = j >= 0 && go(ai + 1, wi, j, started);
      }
    }
    memo.set(k, result);
    return result;
  };
  return go(1, 0, 0, 1);
}
// Photojournal files the LRO and MESSENGER wide-angle cameras as "wac-narrow-angle-camera".
const PJ_FIX: Record<string, [string, string]> = { "wac-narrow-angle-camera": ["Wide angle camera", "WAC"] };
function pjInstrument(s: string): [string, string] {
  if (PJ_FIX[s]) return PJ_FIX[s];
  const words = s.split("-");
  if (words.length >= 2 && spells(words[0]!, words.slice(1).join(" "))) return [capitalize(words.slice(1).join(" ")), words[0]!.toUpperCase()];
  if (words.length >= 3 && spells(words.at(-1)!, words.slice(0, -1).join(" "))) return [capitalize(words.slice(0, -1).join(" ")), words.at(-1)!.toUpperCase()];
  return [capitalize(words.join(" ")), ""];
}

const unresolved = new Map<string, number>();
const miss = (reason: string) => unresolved.set(reason, (unresolved.get(reason) ?? 0) + 1);
const umdPrefixes = Object.keys(UMD_MISSION).sort((x, y) => y.length - x.length);
const splitTrek = (v: unknown) => (typeof v === "string" ? v : "").split(/,\s*(?:and\s+)?|\s+and\s+|;/).map(x => x.trim()).filter(Boolean);
for (const r of rows) {
  const { source: src, id, instrument: raw } = r;
  const d = details(r.details_json, `${src} ${id}`);
  if (src === "opus") {
    const craft = OPUS_SPACECRAFT.find(p => raw.startsWith(p + " "));
    if (craft) {
      const mid = mission(craft), name = raw.slice(craft.length + 1);
      instrument(mid, name, name, raw, src, id);
    } else { // a ground or airborne telescope is its own facility
      instrument(mission(raw, "observatory"), raw, "", raw, src, id);
    }
  } else if (src === "darts") {
    const names = keywords(d, "mission");
    if (!names.length) { miss("darts: no mission keyword"); continue; }
    const first = names[0]!;
    const mid = mission(isUpper(first) && first.length > 5 ? title(first) : first, "spacecraft", names.slice(1));
    const listed = keywords(d, "instrument");
    for (const i of listed.length ? listed : parts(raw)) instrument(mid, stripParens(i), acronymOf(i), i, src, id);
  } else if (src === "umd") {
    const code = id.split("/")[0]!.toLowerCase();
    const prefix = umdPrefixes.find(p => code.startsWith(p + "-") || code.startsWith(p + "_"));
    if (!raw) continue;
    const bundle = /^pds4-([a-z0-9]+)/.exec(code);
    let name: string;
    if (prefix === undefined && bundle) name = PDS4_MISSION[bundle[1]!] ?? bundle[1]!.toUpperCase();
    else if (prefix === undefined && r.title.startsWith("New Horizons")) name = "New Horizons";
    else if (prefix === undefined) { miss("umd: no mission code"); continue; }
    else name = UMD_MISSION[prefix]!;
    const mid = mission(name, OBSERVATORIES.has(name) ? "observatory" : "spacecraft");
    let codes = parts(raw);
    // "OSINAC; OSIRIS" is the NAC of the OSIRIS suite: keep the specific camera.
    if (codes.length > 1 && codes.includes("OSIRIS")) codes = codes.filter(c => c !== "OSIRIS");
    for (const c of codes) instrument(mid, CODES[c] ?? c, c, raw, src, id);
  } else if (src === "trek") {
    // Trek names mission and instrument in its own fields, sometimes several at once ("Lunar Reconnaissance Orbiter
    // and Kaguya", "LOLA and TC"): split both and pair them by position when the counts match.
    const ms = splitTrek(d.mission).filter(m => m.toLowerCase() !== "mixed").map(m => m.replace(/^(Apollo)(\d)/, "$1 $2"));
    const insts = splitTrek(raw);
    if (!ms.length || !insts.length) { if (insts.length) miss("trek: instrument without mission"); continue; }
    insts.forEach((i, n) => {
      const mid = mission(ms.length === insts.length ? ms[n]! : ms[0]!);
      const short = isUpper(i) && i.length <= 8;
      instrument(mid, short ? CODES[i] ?? i : stripParens(i), acronymOf(i) || (short ? i : ""), raw, src, id);
    });
  } else if (src === "photojournal") {
    const ms = [...new Set(parts(missionText(d)).map(midOf))].sort();
    for (const i of parts(raw)) {
      let m: string | undefined;
      if (ms.length === 1) m = ms[0];
      else {
        // The mission this instrument flies on in single-mission rows, among the missions this row names: the most
        // rows, then the later mission id, as Python's max over (count, id) pairs chose.
        const seen = [...(pjSingle.get(i) ?? new Map<string, number>())].filter(([x]) => ms.includes(x));
        m = seen.sort(([xa, na], [xb, nb]) => nb - na || (xb < xa ? -1 : xb > xa ? 1 : 0))[0]?.[0];
      }
      if (!m) { miss("photojournal: several missions, instrument never seen with one"); continue; }
      const [name, acronym] = pjInstrument(i);
      const missionName = m.split("-").map(w => ACRONYM_MISSIONS.has(w) ? w.toUpperCase() : capitalize(w)).join(" ");
      instrument(mission(missionName), name, acronym, i, src, id);
    }
  }
}

// One instrument, two archives: "Cassini ISS" (OPUS) and "imaging-science-subsystem" (Photojournal). Within a mission, a
// name without an acronym that another instrument's acronym spells is that instrument.
const merged = new Map<string, string>(), byMission = new Map<string, Map<string, string>>();
for (const [k, v] of instruments) {
  if (!v.acronym) continue;
  const acronyms = byMission.get(v.mission_id) ?? new Map<string, string>();
  acronyms.set(v.acronym.toLowerCase().replace(/[^a-z0-9]/g, ""), k);
  byMission.set(v.mission_id, acronyms);
}
for (const [k, v] of [...instruments]) {
  if (v.acronym) continue;
  const target = [...(byMission.get(v.mission_id) ?? [])].find(([a]) => spells(a, v.name))?.[1];
  if (!target || target === k) continue;
  merged.set(k, target);
  const t = instruments.get(target)!;
  if (t.name === t.acronym) t.name = v.name;
  instruments.delete(k);
}
links = links.map(([s, i, k, raw]) => [s, i, merged.get(k) ?? k, raw]);
console.log(JSON.stringify({ missions: missions.size, instruments: instruments.size, links: links.length,
  datasets_linked: new Set(links.map(([s, i]) => `${s}\u0000${i}`)).size, merged: merged.size,
  unresolved: Object.fromEntries(unresolved) }, null, 1));
if (dry) process.exit(0);

db.exec("BEGIN");
try {
  for (const t of ["dataset_instruments", "instruments", "missions"]) db.exec(`DROP TABLE IF EXISTS ${t}`);
  db.exec(`CREATE TABLE "missions" ("id" TEXT PRIMARY KEY, "name" TEXT, "kind" TEXT, "aliases" TEXT)`);
  db.exec(`CREATE TABLE "instruments" ("id" TEXT PRIMARY KEY, "mission_id" TEXT REFERENCES "missions"("id"), "name" TEXT, "acronym" TEXT)`);
  db.exec(`CREATE TABLE dataset_instruments (source TEXT NOT NULL, dataset_id TEXT NOT NULL,
    instrument_id TEXT NOT NULL REFERENCES instruments(id), name_in_source TEXT NOT NULL,
    PRIMARY KEY (source, dataset_id, instrument_id), FOREIGN KEY (source, dataset_id) REFERENCES datasets(source, id))`);
  const addMission = db.prepare("INSERT INTO missions VALUES (?,?,?,?)");
  for (const [k, v] of missions) addMission.run(k, v.name, v.kind, JSON.stringify([...v.aliases].sort()));
  const addInstrument = db.prepare("INSERT INTO instruments VALUES (?,?,?,?)");
  for (const [k, v] of instruments) addInstrument.run(k, v.mission_id, v.name, v.acronym);
  const addLink = db.prepare("INSERT OR IGNORE INTO dataset_instruments VALUES (?,?,?,?)");
  for (const [s, i, k, raw] of links) addLink.run(s, i, k, raw);
  db.exec(`CREATE INDEX "idx_dataset_instruments_instrument_id" ON "dataset_instruments" ("instrument_id")`);
  db.prepare("DELETE FROM ledger_log WHERE operation = ?").run("instruments");
  db.prepare("INSERT INTO ledger_log (at, operation, detail) VALUES (?,?,?)").run(new Date().toISOString().slice(0, 10), "instruments",
    "missions, instruments and dataset_instruments rebuilt from each archive's instrument field: OPUS 'Mission INSTR' " +
    "or a telescope; DARTS mission:/instrument: keywords (first mission name, the rest aliases); Maryland PDS3 id " +
    "prefix for the mission and its instrument codes; Photojournal mission and instrument slugs, a several-mission " +
    "row taking the mission the instrument has in single-mission rows. USGS and PSI PDS4 state no instrument; Trek names mission and instrument in its own fields.");
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}
console.log("written");
