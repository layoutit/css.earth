// Matches the targets the ledger's sources name to cssEarth's own bodies; apply-structure.mts stores the result in the
// ledger's `bodies` and `dataset_bodies` tables. A target first matches a body cssEarth
// catalogues: a record in packages/astronomy/data/bodies, a moon in site/source/moon-catalogues.json, or an object
// package in src/objects. Sources spell one body many ways ("67P/Churyumov-Gerasimenko 1 (1969 R1)", "(4) Vesta",
// "alp CMa (Sirius)", "S/2004 S 12", "Saturn rings"), so every alias in the name is tried. A target that matches nothing
// is kept under its own name, and its kind comes from its designation (a numbered minor planet, a comet or a star
// designation) or its meaning: a calibration or engineering target, the space environment, a sky region, a group of
// bodies, or a sample named by a laboratory or meteorite row.
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { bodiesOf } from "./model.mts";

export type Body = { key: string; label: string; kind: string; parent: string; object: string; catalogued: boolean };
type Known = { kind: string; parent: string; name: string };

const text = (value: unknown, key: string): string =>
  value && typeof value === "object" && key in value && typeof (value as Record<string, unknown>)[key] === "string"
    ? String((value as Record<string, unknown>)[key])
    : "";
const list = (value: unknown, key: string): unknown[] =>
  value && typeof value === "object" && key in value && Array.isArray((value as Record<string, unknown>)[key]) ? ((value as Record<string, unknown>)[key] as unknown[]) : [];

// The Sun and Sgr A* are the roots of the Solar System and the Galaxy; nesting under them would fold nearly every row
// into two groups, so their children stay at the top level.
const roots = new Set(["sun", "sgr-a-star"]);

const greek =
  "alf|alp|alpha|bet|beta|gam|gamma|del|delta|eps|epsilon|zet|zeta|eta|the|theta|iot|iota|kap|kappa|lam|lambda|mu|nu|ksi|xi|omi|omicron|pi|rho|sig|sigma|tau|ups|upsilon|phi|chi|psi|ome|omega";
// Kind from a designation's form or a plain name's meaning, read on the source's own spelling. `sample` marks a target
// named by a laboratory or meteorite row.
export function kindOfDesignation(raw: string, sample = false): string {
  const name = raw.trim().replace(/^\*\s+/, "");
  const t = name.toLowerCase();
  if (/^\(\s*\d+\s*\)\s*\S/.test(name) || /^\d{4}\s[A-Z]{2}\d*$/i.test(name)) return "asteroid";
  if (/^(\d+[PDI]|[CPDXI])\//i.test(name)) return "comet";
  if (/^S\/\d{4}/i.test(name)) return "satellite";
  if (/^(multiple|asteroids?|comets?|planets?|stars?|satellites?|dwarf planets?|system|solar[ _]system|galaxies|etc\.?)\b/.test(t)) return "group";
  if (/calib|^cal(lamp|img)?$|bias|\bdark\b|flat ?field|checkout|maintenance|^cte$|lamp|starfield|\bsky\b|^area \d|acq-|^none$|unknown|unspecified|^unk$|n\/a|^'cold|^other$|background|plaque/.test(t))
    return "calibration";
  if (/plasma|geospace|magnetosphere|gravity ?field|cosmic ray|solar wind|magnetic field|\bdust\b|interstellar[ _](particles|medium|phenomena)|atmosphere|^space( experiments)?$|debri|microbe/.test(t))
    return "environment";
  if (
    /^\*\s/.test(raw.trim()) ||
    /^(HD|HIP|HR|GJ|Gliese|BD|TYC|SAO|2MASS|WASP|HAT-P|TrES|XO|Kepler|KELT|TOI|MOA)[\s-]?[+-]?\d/i.test(name) ||
    new RegExp(`^(${greek})[._]?\\d?\\s*[A-Za-z]{3}\\b`, "i").test(name) ||
    /^\d{1,3}\s+[A-Z][a-z]{2}(\s[A-Z])?$/i.test(name) ||
    /^(landolt|purgathofer)\b|solar analog|^cn leo$|^sco x-1$|^achernar$|^canopus$/.test(t)
  )
    return "star";
  if (
    /^(NGC|IC|M|Messier)\s?\d+\b/i.test(name) ||
    /nebula|nebura|\bcloud\b|galax|cluster|\bsnr\b|supernova|\bregion\b|quasar|pulsar|all-sky|ecliptic ?pole|^nep$|galactic|gamma-ray|^grb$|transients|^agn$|maser|cosmic optical|bulge|pleiades|^orion$|^scorpius$|^taurus$|magellanic|magerllanic/.test(t)
  )
    return "deep-sky";
  if (sample) return "sample";
  return "unidentified";
}

const norm = (s: string) => s.toLowerCase().replace(/[–—]/g, "-").trim();
// Ring abbreviations some archives use ("S-Rings").
const ringPlanets: Record<string, string> = { j: "jupiter", s: "saturn", u: "uranus", n: "neptune" };

export async function bodyCatalogue(repository: string) {
  const packages = new Set(
    (await readdir(resolve(repository, "src/objects"), { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name),
  );
  const known = new Map<string, Known>();
  const names = new Map<string, string>();
  const bodies = resolve(repository, "packages/astronomy/data/bodies");
  for (const file of await readdir(bodies)) {
    if (!file.endsWith(".json")) continue;
    const record: unknown = JSON.parse(await readFile(resolve(bodies, file), "utf8"));
    const id = text(record, "id");
    if (!id) throw Error(`packages/astronomy/data/bodies/${file} has no id`);
    const physical = record && typeof record === "object" && "physical" in record ? record.physical : undefined;
    const satellite = record && typeof record === "object" && "satellite" in record ? record.satellite : undefined;
    known.set(id, { kind: text(record, "classification"), parent: text(satellite, "parent") || text(physical, "parent"), name: text(physical, "name") });
  }
  const moons: unknown = JSON.parse(await readFile(resolve(repository, "site/source/moon-catalogues.json"), "utf8"));
  for (const system of list(moons, "systems")) {
    const planet = text(system, "id");
    for (const moon of list(system, "moons")) {
      const id = text(moon, "id");
      if (!planet || !id) continue;
      if (!known.has(id)) known.set(id, { kind: "satellite", parent: planet, name: text(moon, "name") });
      const provisional = text(moon, "provisionalDesignation");
      if (provisional) names.set(norm(provisional), id);
    }
  }
  // Packages with no body record are sky objects: nebulae, galaxies, clusters, discs and the heliosphere. Their README
  // heading is their name.
  for (const id of packages) {
    if (known.has(id)) continue;
    const files = await readdir(resolve(repository, "src/objects", id));
    if (!files.includes("object.json")) continue;
    const heading = files.includes("README.md") ? /^# (.+)$/m.exec(await readFile(resolve(repository, "src/objects", id, "README.md"), "utf8"))?.[1] ?? "" : "";
    known.set(id, { kind: "deep-sky", parent: "", name: heading.trim() });
  }
  // Comet records carry their designation ("1P/Halley", "96P Machholz 1"); sources often give the name alone.
  for (const [id, record] of known) {
    if (!record.name) continue;
    names.set(norm(record.name), id);
    const short = record.name.replace(/^(\d+[PDI]|[CPDX]\/\d{4}\s\S+)[/\s]+/i, "");
    if (record.kind === "comet" && short !== record.name) names.set(norm(short), id);
  }

  const exists = (id: string) => known.has(id) || packages.has(id);
  function match(token: string): string {
    const aliases = [token];
    // "(sirius)", "[(2060) chiron]": names given in parentheses or brackets.
    for (const m of token.matchAll(/[([]+([^()[\]]+)[)\]]+/g)) aliases.push(...bodiesOf(m[1]));
    const bare = token.replace(/\s*[([].*$/, "").trim();
    aliases.push(bare);
    // "4 Vesta", "(1248 )Jugurtha", "tempel-1", "S-Rings".
    aliases.push(token.replace(/^\(?\s*\d+\s*\)?\s*/, ""), token.replace(/[-_]/g, " "));
    const ring = /^([jsun])-rings?$/.exec(token);
    if (ring) aliases.push(ringPlanets[ring[1]]);
    const comet = /^(\d+[pdi])\//.exec(token);
    if (comet) aliases.push("comet-" + comet[1]);
    const rings = /^(.+?) rings?$/.exec(token);
    if (rings) aliases.push(rings[1]);
    for (const a of aliases) {
      if (!a) continue;
      for (const id of [a, a.replaceAll(/[\s/]+/g, "-"), "comet-" + a, names.get(norm(a)) ?? ""]) if (id && exists(id)) return id;
    }
    return "";
  }
  const cache = new Map<string, Body | null>();
  // One source target, in the source's spelling, as a body; null when it names nothing ("+6 more").
  function body(raw: string, sample = false): Body | null {
    const cacheKey = (sample ? "s:" : "") + raw;
    const hit = cache.get(cacheKey);
    if (hit !== undefined) return hit;
    const [token] = bodiesOf(raw);
    let found: Body | null = null;
    if (token) {
      const id = match(token);
      const record = known.get(id);
      const label = raw.trim().replace(/^\(\d+\)\s*/, "").replace(/^\*\s+/, "");
      found = id
        ? { key: id, label: record?.name || label, kind: record?.kind ?? "", parent: record && !roots.has(record.parent) ? record.parent : "", object: packages.has(id) ? id : "", catalogued: true }
        : { key: token, label, kind: kindOfDesignation(raw, sample), parent: "", object: "", catalogued: false };
    }
    cache.set(cacheKey, found);
    return found;
  }
  const parentOf = (key: string) => known.get(key)?.parent ?? "";
  const objectOf = (id: string) => (packages.has(id) ? id : "");
  return { body, parentOf, objectOf, known };
}
