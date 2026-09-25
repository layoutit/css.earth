/** How an archive's target names are matched to the objects this repository ships, where two or more archives match the
 * same way. What a proposer or observer typed is not an id: it is reduced to letters and digits, a minor-planet number is
 * kept apart from the name, and a numbered body is never taken for the unnumbered one that shares its name (52 Europa is
 * not Jupiter's moon). Archive-specific matchers (Chandra's names and boxes, Keck's time stamps, JunoCam's slugs,
 * Spitzer's NAIF ids) stay with their archive. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hasErrorCode, isRecord, requireFiniteNumber } from '@cssearth/core';
import { firstSkyPosition } from '../archive-sky-position.mts';
import { REPOSITORY, shippedObjectIds } from './ledger.mts';

/** A target name reduced to letters and digits, so `52_EUROPA`, `52 Europa` and `Europa___ 05-47` compare by their letters. */
export const normaliseTargetName = (name: string) => name.toUpperCase().replace(/[^A-Z0-9]/gu, '');

/** How an archive's observers write a numbered target: Gemini's also end a non-sidereal name in `.eph`. */
export interface NumberedTargetNames { readonly ephemerisSuffix: boolean }

/** An observer's target name split into the parts that identify a body: a minor-planet number in front (`52_EUROPA`), and
 * an ephemeris stamp behind (`-26T0400`, `-3H40`, `-25`), both of which observers add and neither of which is the name. */
export function parseNumberedTarget(name: string, names: NumberedTargetNames) {
  const trimmed = (names.ephemerisSuffix ? name.trim().replace(/\.eph$/iu, '') : name.trim()).replace(/[-_](?:\d{1,2}[TH]\d{2,4}|\d{1,3})$/u, '');
  const compact = normaliseTargetName(trimmed);
  const numbered = /^(\d{1,6})([A-Z].*)$/u.exec(compact);
  return numbered ? { number: Number(numbered[1]), name: numbered[2]! } : { number: null, name: compact };
}

/** The shipped object id a target name refers to, or null. A numbered target takes the id that carries the same number and
 * nothing else; an unnumbered one takes the bare id. Nothing is matched by prefix. */
export function matchNumberedTarget(target: string, shipped: ReadonlySet<string>, names: NumberedTargetNames) {
  const { number, name } = parseNumberedTarget(target, names);
  if (!name) return null;
  if (number === null) return [...shipped].find(id => normaliseTargetName(id) === name) ?? null;
  return [...shipped].find(id => normaliseTargetName(id) === `${name}${number}`) ?? null;
}

/** A shipped object with the names a proposer might have used and, for what does not move, where it is on the sky. */
export interface NamedShippedObject { readonly id: string; readonly names: readonly string[]; readonly position?: { readonly raDeg: number; readonly decDeg: number; readonly radiusDeg: number } }

/** Every object package with its id and display name, and a position for what does not move: a star within half an
 * arcminute, a nebula within a sixth of a degree of the centre its recipe records. `read` is how the archive reads a body
 * record or nebula recipe that may be absent (Hubble treats only a missing file as absent; JWST treats any unreadable one
 * so). */
export async function namedShippedObjects(read: (path: string) => Promise<unknown>, repository = REPOSITORY): Promise<NamedShippedObject[]> {
  const ids = await shippedObjectIds(repository);
  return Promise.all(ids.map(async id => {
    const body = await read(resolve(repository, 'packages/astronomy/data/bodies', `${id}.json`));
    const names = [id], physical = isRecord(body) && isRecord(body.physical) ? body.physical : undefined;
    if (physical && typeof physical.name === 'string') names.push(physical.name);
    if (isRecord(body) && isRecord(body.star))
      return { id, names, position: { raDeg: requireFiniteNumber(body.star.rightAscensionDegrees), decDeg: requireFiniteNumber(body.star.declinationDegrees), radiusDeg: 0.5 / 60 } };
    const nebula = firstSkyPosition(await read(resolve(repository, 'src/objects', id, 'source/nebula.json')));
    return nebula ? { id, names, position: { ...nebula, radiusDeg: 1 / 6 } } : { id, names };
  }));
}

/** A JSON file, or null when it does not exist; any other failure is an error. */
export const readJsonOrNull = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(path, 'utf8').catch(error => { if (hasErrorCode(error, 'ENOENT')) return 'null'; throw error; })) as unknown;

/** 2060 CHIRON and (2060) Chiron name Chiron. */
export const withoutMinorPlanetNumber = (name: string) => name.replace(/^\(?\d+\)?[\s_-]+(?=[A-Za-z])/u, '');

const indexes = { skipping: new WeakMap<readonly NamedShippedObject[], Map<string, string>>(), keeping: new WeakMap<readonly NamedShippedObject[], Map<string, string>>() };
/** Every name a proposer might have written, to the object it names. Dione is Saturn's moon and asteroid 106: a plain name
 * goes to the object whose id is the plain name, and a numbered body is also found with its number (106 DIONE, DIONE-106).
 * An id outranks a display name: HD-189733B is the planet hd-189733b, not the companion star named HD 189733 B.
 * `skipEmptyNames` leaves out a name with no letter or digit (Hubble); JWST indexes it as it is. */
export function targetNameIndex(objects: readonly NamedShippedObject[], skipEmptyNames: boolean): Map<string, string> {
  const cache = skipEmptyNames ? indexes.skipping : indexes.keeping;
  let index = cache.get(objects);
  if (index) return index;
  index = new Map<string, string>();
  const numbered = (id: string) => /-\d+$/u.test(id);
  const ordered = [...objects].sort((a, b) => Number(numbered(a.id)) - Number(numbered(b.id)));
  for (const [rank, object] of [...ordered.map(object => [0, object] as const), ...ordered.map(object => [1, object] as const)]) {
    for (const name of rank === 0 ? [object.id] : object.names) {
      const key = normaliseTargetName(name), counted = !skipEmptyNames || Boolean(key);
      if (counted && !index.has(key)) index.set(key, object.id);
      const number = /-(\d+)$/u.exec(object.id)?.[1];
      if (number && counted) index.set(`${number}${key}`, object.id);
    }
  }
  cache.set(objects, index);
  return index;
}
