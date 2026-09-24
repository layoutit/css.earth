/** Regenerating a body the tool made, without losing what a person wrote.
 *
 * Every generated package keeps the spec it was made from in `source/preparation/new-object.json` (a star's entry without its
 * planets, or a `{ "host", "planets" | "companions" }` addition for one hosted body), with the order it was given. `new-object
 * --refresh <id>...` reads those specs back and generates again from the archives as they are today, then writes the result over the
 * package under these rules:
 *
 * - **Refused:** a package with no stored spec (made by hand), or one a person extended with lenses the tool does not make (a
 *   Doppler map, a resolved image): regenerating would drop them.
 * - **Kept:** the reader card or introduction when a person rewrote it (it differs from what the stored spec drafted and carries no
 *   TODO); the README once a person has written it (it no longer carries the draft's line or a TODO), whole; the investigation ledger.
 * - **Removed:** source files the old manifest declared that the new generation no longer uses (a cross-check spectrum a better
 *   route replaced).
 * - **Written:** everything else the tool owns.
 *
 * Nothing is compared by hash: the stored spec is the record of what the tool wrote, and the rules above read text. */
import { readFile, rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HostedSpec, StarSpec } from './spec.mts';
import type { PackageFiles } from './lens.mts';

export const STORED_SPEC = 'source/preparation/new-object.json';
const TODO = 'TODO(new-object)';

/** The document entry that declares the stored spec in the body's manifest. */
export const storedSpecDocument = { path: 'preparation/new-object.json', sourceBinding: { kind: 'local', reason: 'The spec telescope new-object generated this package from, with the order it was given; `telescope new-object --refresh` regenerates from it.' } };

/** A star's stored spec: the entry without its planets and companions, which keep their own. */
export const storedStarSpec = (spec: StarSpec, order: number) => `${JSON.stringify({ ...spec, order, planets: [], companions: [] }, null, 2)}\n`;
/** A hosted body's stored spec: a host addition holding only it, without the parser's `kind`. */
export function storedHostedSpec(spec: HostedSpec, hostId: string, order: number) {
  const { kind, ...entry } = spec;
  return `${JSON.stringify({ host: hostId, [kind === 'companion' ? 'companions' : 'planets']: [{ ...entry, order }] }, null, 2)}\n`;
}

/** The spec file that regenerates `ids`: their stored entries, additions to one host merged. */
export async function refreshSpec(root: string, ids: readonly string[]) {
  const stars: Record<string, unknown>[] = [], additions = new Map<string, { host: string; planets: unknown[]; companions: unknown[] }>();
  for (const id of ids) {
    const text = await readFile(resolve(root, 'src/objects', id, STORED_SPEC), 'utf8').catch(() => null);
    if (text === null) throw new Error(`${id}: no ${STORED_SPEC}; it was not made by new-object, so there is nothing to regenerate it from.`);
    const entry = JSON.parse(text) as Record<string, unknown>;
    if (typeof entry.host !== 'string') { stars.push(entry); continue; }
    const addition = additions.get(entry.host) ?? { host: entry.host, planets: [], companions: [] };
    addition.planets.push(...(entry.planets as unknown[] ?? [])); addition.companions.push(...(entry.companions as unknown[] ?? []));
    additions.set(entry.host, addition);
  }
  return { stars: [...stars, ...additions.values()] };
}

const exists = (path: string) => stat(path).then(() => true, () => false);
/** Apply the refresh rules to a freshly generated package against the one on disk. Returns what was kept and what the caller must
 * delete; throws when the package may not be regenerated. */
export async function mergeRefresh(files: PackageFiles, id: string, root: string) {
  const o = resolve(root, 'src/objects', id), rel = `src/objects/${id}`;
  const storedText = await readFile(resolve(o, STORED_SPEC), 'utf8').catch(() => null);
  if (storedText === null) throw new Error(`${id}: no ${STORED_SPEC}, so it was made by hand; refresh only regenerates what new-object made.`);
  const stored = JSON.parse(storedText) as { text?: { card?: string; introduction?: string }; planets?: { text?: { card?: string; introduction?: string } }[]; companions?: { text?: { card?: string; introduction?: string } }[] };
  const previousText = stored.text ?? stored.planets?.[0]?.text ?? stored.companions?.[0]?.text;
  const read = async (path: string) => JSON.parse(await readFile(resolve(root, path), 'utf8')) as Record<string, any>;
  // A person's lenses are the tool's to keep, not to drop.
  const oldLenses = ((await read(`${rel}/source/content/object.json`)).lenses?.controls ?? []).map((control: { id: string }) => control.id) as string[];
  const newLenses = (JSON.parse(String(files.get(`${rel}/source/content/object.json`))).lenses?.controls ?? []).map((control: { id: string }) => control.id) as string[];
  const extra = oldLenses.filter(lens => !newLenses.includes(lens) && !['shape', 'color', 'thermal', 'infrared'].includes(lens));
  if (extra.length) throw new Error(`${id}: it has lenses the tool does not make (${extra.join(', ')}); a refresh would drop them. Update it by hand.`);
  const kept: string[] = [];
  // Reader text: a person's card or introduction stays.
  const oldText = await read(`${rel}/text.json`), newText = JSON.parse(String(files.get(`${rel}/text.json`)));
  for (const key of ['card', 'introduction'] as const) {
    const current = String(oldText[key]?.text ?? '');
    if (current && !current.includes(TODO) && current !== previousText?.[key]) { newText[key] = oldText[key]; kept.push(`text.json ${key}`); }
  }
  files.set(`${rel}/text.json`, `${JSON.stringify(newText, null, 2)}\n`);
  // README: regenerated while it is still the tool's draft; once a person has written it, kept whole, and the numbers in it are theirs
  // to check against the regenerated package.
  const readme = await readFile(resolve(o, 'README.md'), 'utf8').catch(() => null);
  if (readme !== null && !readme.includes('This account was drafted from') && !readme.includes(TODO)) { files.delete(`${rel}/README.md`); kept.push('README.md (a person wrote it; check its numbers)'); }
  // The ledger is a person's record.
  if (await exists(resolve(o, 'investigations.json'))) { files.delete(`${rel}/investigations.json`); kept.push('investigations.json'); }
  // Source files the old manifest declared and the new one does not.
  const declared = (manifest: Record<string, any>) => [...(manifest.inputs ?? []), ...(manifest.documents ?? []), ...(manifest.generatedIntermediates ?? [])].map((entry: { path: string }) => entry.path);
  const now = new Set(declared(JSON.parse(String(files.get(`${rel}/source/manifest.json`)))));
  const stale = declared(await read(`${rel}/source/manifest.json`)).filter(path => !now.has(path)).map(path => `${rel}/source/${path}`);
  return { kept, stale };
}

/** Delete what a refresh left stale. */
export async function removeStale(root: string, paths: readonly string[]) {
  for (const path of paths) await rm(resolve(root, path), { force: true });
}
