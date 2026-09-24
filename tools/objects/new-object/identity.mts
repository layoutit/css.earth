/** Ids and duplicates: the two decisions a batch cannot take back. An id becomes a URL; a second package for a body already in the
 * universe splits its page, its sources and its search entry in two.
 *
 * **Ids.** A host's id is the slug of the name its planets are called by (the planet name without its letter: "pi Men c" gives
 * pi-men), else of the host name; when that would not start with a letter ("55 Cnc"), of its HD, then HIP, then Gaia DR3 name. A
 * planet's id is its host's id and its letter: joined after a digit (hd-219134b, trappist-1e) and after a hyphen when the host id
 * ends in a letter (pi-men-c, kepler-16ab-b). The display name stays the archive's.
 *
 * **Duplicates.** A star is already in the universe when an existing placed star sits within DUPLICATE_ARCSEC of it at a common
 * epoch, whatever its id or name; a planet or companion when an existing record carries its name. Both are refused with the id that
 * holds them. */
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const DUPLICATE_ARCSEC = 3;
const ID = /^[a-z][a-z0-9-]*$/u;

/** The slug every generated id is made of: lowercase letters, digits and single hyphens. */
export const slug = (name: string) => name.normalize('NFKD').replace(/[̀-ͯ]/gu, '').toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '');

/** A host's id from the name its planets use, its own name, then its catalogue names; the first that starts with a letter. */
export function hostId(names: { readonly planetPrefix?: string; readonly hostname: string; readonly hd?: string; readonly hip?: string; readonly gaiaDr3?: string }): string {
  const candidates = [names.planetPrefix, names.hostname, names.hd, names.hip, names.gaiaDr3].filter((name): name is string => !!name?.trim()).map(slug);
  const id = candidates.find(candidate => ID.test(candidate));
  if (!id) throw new Error(`${names.hostname}: none of its names (${candidates.join(', ')}) gives an id that starts with a letter; give this host a spec by hand.`);
  return id;
}

/** A planet's id: its host's id and its letter, joined after a digit, hyphenated after a letter. */
export function planetId(host: string, letter: string): string {
  if (!ID.test(host)) throw new TypeError(`Host id ${host} is not an id.`);
  const l = letter.trim().toLowerCase();
  if (!/^[a-z]$/u.test(l)) throw new TypeError(`${host}: planet letter ${JSON.stringify(letter)} is not one letter.`);
  return /[0-9]$/u.test(host) ? `${host}${l}` : `${host}-${l}`;
}

/** The planet name without its letter: "pi Men c" gives "pi Men"; undefined when the name does not end in its letter. */
export function planetPrefix(planetName: string, letter: string): string | undefined {
  const match = new RegExp(`^(.*\\S)\\s+${letter.trim()}$`, 'u').exec(planetName.trim());
  return match?.[1];
}

const normal = (name: string) => name.normalize('NFKD').replace(/[̀-ͯ]/gu, '').toLowerCase().replace(/[^a-z0-9]+/gu, '');

interface Placed { readonly id: string; readonly ra: number; readonly dec: number; readonly epoch: number; readonly pmra: number; readonly pmdec: number }
/** What the universe already holds: ids, the normalized names of every record, and where every placed star is. */
export interface Existing { readonly ids: ReadonlySet<string>; readonly names: ReadonlyMap<string, string>; readonly stars: readonly Placed[];
  /** Placed stars by the Gaia DR3 source their position cites, and every package's system name. */
  readonly gaia?: ReadonlyMap<string, string>; readonly systems?: ReadonlyMap<string, string> }

export async function existingBodies(root: string): Promise<Existing> {
  const directory = resolve(root, 'packages/astronomy/data/bodies'), ids = new Set<string>(), names = new Map<string, string>(), stars: Placed[] = [], gaia = new Map<string, string>(), systems = new Map<string, string>();
  for (const name of await readdir(directory)) {
    const body = JSON.parse(await readFile(resolve(directory, name), 'utf8')) as { id: string; physical?: { name?: string }; star?: Record<string, number> & { sources?: { position?: string } } };
    const source = /Gaia DR3 source (\d+)/u.exec(body.star?.sources?.position ?? '')?.[1];
    if (source) gaia.set(source, body.id);
    ids.add(body.id);
    if (body.physical?.name) names.set(normal(body.physical.name), body.id);
    const s = body.star;
    if (s && Number.isFinite(s.rightAscensionDegrees) && Number.isFinite(s.declinationDegrees))
      stars.push({ id: body.id, ra: s.rightAscensionDegrees!, dec: s.declinationDegrees!, epoch: s.positionEpochJulianYear ?? 2016, pmra: s.properMotionRaMasPerYear ?? 0, pmdec: s.properMotionDecMasPerYear ?? 0 });
  }
  for (const name of await readdir(resolve(root, 'src/objects'))) {
    ids.add(name);
    const system = await readFile(resolve(root, 'src/objects', name, 'object.json'), 'utf8').then(text => (JSON.parse(text) as { properties?: { catalog?: { systemName?: string } } }).properties?.catalog?.systemName, () => undefined);
    if (system) systems.set(name, system);
  }
  return { ids, names, stars, gaia, systems };
}

/** The placed star within DUPLICATE_ARCSEC of a position, both moved by their proper motions to the new star's epoch. */
export function duplicateStar(existing: Existing, star: { readonly ra: number; readonly dec: number; readonly epoch: number }, except?: string): string | undefined {
  const rad = Math.PI / 180;
  for (const other of existing.stars) {
    if (other.id === except) continue;
    const years = star.epoch - other.epoch, dec = other.dec + other.pmdec * years / 3.6e6, ra = other.ra + other.pmra * years / 3.6e6 / Math.cos(other.dec * rad);
    const cos = Math.sin(star.dec * rad) * Math.sin(dec * rad) + Math.cos(star.dec * rad) * Math.cos(dec * rad) * Math.cos((star.ra - ra) * rad);
    if (Math.acos(Math.min(1, cos)) / rad * 3600 < DUPLICATE_ARCSEC) return other.id;
  }
  return undefined;
}

/** The record that already carries a body's name, if any (spaces, case, accents and punctuation ignored). */
export const duplicateName = (existing: Existing, name: string, except?: string) => { const id = existing.names.get(normal(name)); return id === except ? undefined : id; };
