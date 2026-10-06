/** Give stars the tool made the name the order of preference picks (display-name.mts), without regenerating by hand:
 *
 *   node packages/telescope-cli/src/new-object/new-object-cli.mts --rename <star id>...
 *
 * Each star's stored spec (refresh.mts) is read, SIMBAD is asked for the star's designations, and when one is preferred to the name
 * the star has, the stored specs of the star and of the bodies it hosts are rewritten: the name, system, description and drafted
 * card and introduction take the new designation, and the old one becomes an alias of the star. Ids, folders and addresses stay,
 * and so does every cited source line, which names the star as its paper does. `new-object --refresh` then regenerates from the
 * rewritten specs; nothing is generated or baked here. */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireArray, requireRecord } from '@cssearth/core';
import type { Archive } from '../archives/archives.mts';
import { preferredName, PROPER_STEPS, simbadIdentifiers } from '../names/display-name.mts';
import { readIauNames } from '../archives/iau-names.mts';
import { STORED_SPEC } from '../refresh.mts';

type Stored = Record<string, unknown>;
const NAMED = ['name', 'system', 'description'] as const;
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
/** `from` replaced by `to` in an entry's names and drafted text. A designation carries over to the bodies it hosts (HD 1234 b becomes
 * Alpha Ceti b); a name of the star's own does not (WASP-39 b keeps its designation when WASP-39 becomes Malmok), so with `keepHosted`
 * an occurrence followed by a planet or companion letter stays as it is. */
export function renamed(entry: Stored, from: string, to: string, keepHosted = false) {
  const pattern = new RegExp(`${escaped(from)}${keepHosted ? '(?! ?[A-Za-z]\\b)' : ''}`, 'gu'), swap = (text: string) => text.replace(pattern, to);
  for (const key of NAMED) if (typeof entry[key] === 'string') entry[key] = swap(entry[key]);
  if (entry.text !== undefined) {
    const text = requireRecord(entry.text, 'Stored spec text');
    for (const key of ['card', 'introduction'] as const) if (typeof text[key] === 'string') text[key] = swap(text[key]);
  }
}

/** Rewrites the stored specs of `ids` and their hosted bodies; returns one line per star and the ids to refresh. */
export async function renameStars(root: string, ids: readonly string[], archive: Archive) {
  const objects = resolve(root, 'src/objects'), read = async (id: string): Promise<Stored> => {
    const path = resolve(objects, id, STORED_SPEC);
    try { return requireRecord(JSON.parse(await readFile(path, 'utf8')), path); }
    catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') throw error;
      throw new Error(`${path}: cannot read stored spec.`, { cause: error });
    }
  };
  const write = (id: string, spec: Stored) => writeFile(resolve(objects, id, STORED_SPEC), `${JSON.stringify(spec, null, 2)}\n`);
  const lines: string[] = [], refresh: string[] = [];
  // The bodies each star hosts, from their own stored specs.
  const hosted = new Map<string, string[]>();
  // Only an object's folder holds a spec: the guide beside them (src/objects/README.md) is a file.
  for (const { name: id } of (await readdir(objects, { withFileTypes: true })).filter(entry => entry.isDirectory())) {
    const spec = await read(id).catch((error: unknown) => {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
      throw error;
    });
    if (typeof spec?.host === 'string' && ids.includes(spec.host)) hosted.set(spec.host, [...hosted.get(spec.host) ?? [], id]);
  }
  for (const id of ids) {
    const spec = await read(id).catch(() => { throw new Error(`${id}: no stored spec at src/objects/${id}/${STORED_SPEC}; only a star new-object made is renamed.`); });
    if (typeof spec.host === 'string') throw new Error(`${id}: a hosted body takes its star's name; rename ${spec.host}.`);
    const target = typeof spec.target === 'string' ? spec.target : `Gaia DR3 ${String(spec.gaia)}`, base = String(spec.system).replace(/ system$/u, '');
    const identifiers = await simbadIdentifiers(archive, target), preferred = preferredName(identifiers, (await readIauNames()).lookup);
    // A component of a system (Zeta Aquilae A) is renamed as itself; the system it shares keeps its name.
    const old = String(spec.name), from = old === base ? base : old;
    if (!preferred || preferred.name === from) { lines.push(`${id}: keeps ${from} (${identifiers.length ? 'SIMBAD lists no preferred designation' : `SIMBAD does not know ${target}`}).`); continue; }
    const own = PROPER_STEPS.has(preferred.step);
    renamed(spec, from, preferred.name, own);
    spec.aliases = [...new Set([...(Array.isArray(spec.aliases) ? spec.aliases : []), from])];
    // The name changes and nothing else: a star the map does not name stays a dot of the galaxy's bank (`featured` is the spec's own).
    await write(id, spec);
    const renamedHosts = from === base ? hosted.get(id) ?? [] : [];
    for (const hostedId of renamedHosts) {
      const addition = await read(hostedId);
      for (const entry of [...requireArray(addition.planets ?? []), ...requireArray(addition.companions ?? [])]) renamed(requireRecord(entry), base, preferred.name, own);
      await write(hostedId, addition);
    }
    refresh.push(id, ...renamedHosts);
    lines.push(`${id}: ${from} is now ${preferred.name} (${preferred.step}, SIMBAD ${preferred.identifier}); ${from} is an alias.`);
  }
  return { lines, refresh };
}
