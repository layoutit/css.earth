// Matches the targets the ledger's sources name to cssEarth's own bodies. A target first matches a body cssEarth
// catalogues: a record in packages/astronomy/data/bodies, a moon in site/source/moon-catalogues.json, or an object
// package in src/objects. Sources spell one body many ways ("67P/Churyumov-Gerasimenko 1 (1969 R1)", "(4) Vesta",
// "alp CMa (Sirius)", "S/2004 S 12", "Saturn rings"), so every alias in the name is tried. A target that matches nothing
// is kept under its own name, and its kind comes from its designation (a numbered minor planet, a comet or a star
// designation); names that follow none are fields and phenomena, such as solar wind or a calibration lamp.
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { bodiesOf } from "../model.mts";

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

const greek = "alf|alp|bet|gam|del|eps|zet|eta|the|iot|kap|lam|mu|nu|ksi|xi|omi|pi|rho|sig|tau|ups|phi|chi|psi|ome";
// Kind from a designation's form, read on the source's own spelling.
export function kindOfDesignation(raw: string): string {
  const name = raw.trim().replace(/^\*\s+/, "");
  if (/^\(\d+\)\s/.test(name) || /^\d{4}\s[A-Z]{2}\d*$/i.test(name)) return "asteroid";
  if (/^(\d+[PDI]|[CPDXI])\//i.test(name)) return "comet";
  if (/^S\/\d{4}/i.test(name)) return "satellite";
  if (
    /^\*\s/.test(raw.trim()) ||
    /^(HD|HIP|HR|GJ|Gliese|BD|TYC|SAO|2MASS|WASP|HAT-P|TrES|XO|Kepler|KELT|TOI)[\s-]?[+-]?\d/i.test(name) ||
    new RegExp(`^(${greek})\\.?\\d?\\s+[A-Za-z]{3}\\b`, "i").test(name) ||
    /^\d{1,3}\s+[A-Z][a-z]{2}(\s[A-Z])?$/.test(name)
  )
    return "star";
  if (/^(NGC|IC|M|Messier)\s?\d+\b/i.test(name) || /nebula|nebura|\bcloud\b|galax|cluster|\bsnr\b|supernova|\bregion\b|quasar|pulsar/i.test(name))
    return "deep-sky";
  return "field";
}

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
      if (provisional) names.set(provisional.toLowerCase(), id);
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
  for (const [id, record] of known) if (record.name) names.set(record.name.toLowerCase(), id);

  const exists = (id: string) => known.has(id) || packages.has(id);
  function match(token: string): string {
    const aliases = [token];
    // "(sirius)", "[(2060) chiron]": names given in parentheses or brackets.
    for (const m of token.matchAll(/[([]+([^()[\]]+)[)\]]+/g)) aliases.push(...bodiesOf(m[1]));
    const bare = token.replace(/\s*[([].*$/, "").trim();
    aliases.push(bare);
    const comet = /^(\d+[pdi])\//.exec(token);
    if (comet) aliases.push("comet-" + comet[1]);
    const rings = /^(.+?) rings?$/.exec(token);
    if (rings) aliases.push(rings[1]);
    for (const a of aliases) {
      if (!a) continue;
      for (const id of [a, a.replaceAll(/[\s/]+/g, "-"), "comet-" + a, names.get(a) ?? ""]) if (id && exists(id)) return id;
    }
    return "";
  }
  const cache = new Map<string, Body | null>();
  // One source target, in the source's spelling, as a body; null when it names nothing ("+6 more").
  function body(raw: string): Body | null {
    const hit = cache.get(raw);
    if (hit !== undefined) return hit;
    const [token] = bodiesOf(raw);
    let found: Body | null = null;
    if (token) {
      const id = match(token);
      const record = known.get(id);
      const label = raw.trim().replace(/^\(\d+\)\s*/, "").replace(/^\*\s+/, "");
      found = id
        ? { key: id, label: record?.name || label, kind: record?.kind ?? "", parent: record && !roots.has(record.parent) ? record.parent : "", object: packages.has(id) ? id : "", catalogued: true }
        : { key: token, label, kind: kindOfDesignation(raw), parent: "", object: "", catalogued: false };
    }
    cache.set(raw, found);
    return found;
  }
  const parentOf = (key: string) => known.get(key)?.parent ?? "";
  return { body, parentOf, known };
}
