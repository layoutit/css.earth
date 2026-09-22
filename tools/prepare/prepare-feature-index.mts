import { sha256 } from '../../src/platform/sha256.mts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SCENE_OBJECTS } from '../../site/objects.mts';
import { record } from '../../site/browser-types.mts';
import { normalizeDestinationQuery } from '../../site/destination-search.mts';

/** One search index over every body's prepared named features, so a feature can be found
 * from any page. Each body's catalogue stays the byte-verified source; the index carries
 * only names, search keys and the identity needed to navigate and select. */
export const FEATURE_INDEX_SCHEMA = 'cssearth-prepared-feature-index@2';
export const FEATURE_INDEX_URL = '/features/index.json';

interface IndexedFeature { readonly objectId: string; readonly id: string; readonly name: string; readonly type: string; readonly diameterKm: number; readonly searchNames: readonly string[]; readonly searchContext: string; }
/** One body's places as a table of [catalogue id, name, region and country]. */
interface PlaceTable { readonly objectId: string; readonly type: string; readonly rows: readonly (readonly [string, string, string])[]; }
/** The most populous places a body contributes to the index (Earth: population 124,449 and above). The index is read on
 * the first keystroke on every page: these add 221 KB (78 KB compressed); all 34,135 cities would add 1.5 MB. The body's
 * own catalogue keeps every place and alternate name, and searches them while that body is on screen. */
export const INDEXED_PLACES_PER_BODY = 5000;

/** A place and a named feature of the same settlement (Natural Earth's Buenos Aires and GeoNames' Buenos Aires): same
 * search name, within this distance. The named feature is kept; it already has a label on the body. */
const SAME_SETTLEMENT_KM = 50;
interface Settlement { readonly name: string; readonly latitudeDeg: number; readonly longitudeDeg: number; }
function greatCircleKm(a: Settlement, b: Settlement, radiusKm: number) {
  const rad = Math.PI / 180, dLat = (b.latitudeDeg - a.latitudeDeg) * rad, dLon = (b.longitudeDeg - a.longitudeDeg) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitudeDeg * rad) * Math.cos(b.latitudeDeg * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * radiusKm * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A body's prepared places (Earth's GeoNames cities) are named features of that body too, selected as `city-<id>`. The
 * catalogue is ordered by population, so the index takes its head, leaving out places the body's named features already
 * carry. */
async function preparedPlaces(root: string, objectId: string, settlements: readonly Settlement[], radiusM: number | null): Promise<PlaceTable | null> {
  const pin: unknown = await readFile(resolve(root, 'src/objects', objectId, 'prepared/places.json'), 'utf8').then(JSON.parse, (error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return null; throw error; });
  if (pin === null) return null;
  if (radiusM === null) throw new TypeError(`${objectId}: places need the body's radius.`);
  if (!record(pin) || !Number.isSafeInteger(pin.count)) throw new TypeError(`${objectId}: prepared places descriptor is invalid.`);
  const url = text(pin.url, `${objectId} places url`), bytes = await readFile(resolve(root, 'public', url.replace(/^\//u, '')));
  if (bytes.length !== pin.bytes || sha256(bytes) !== pin.sha256) throw new Error(`${objectId}: the public places catalogue does not match its prepared descriptor; run pnpm prepare:planets.`);
  const catalog: unknown = JSON.parse(bytes.toString('utf8'));
  if (!record(catalog) || !Array.isArray(catalog.places) || catalog.places.length !== pin.count) throw new TypeError(`${objectId}: places catalogue count differs from its descriptor.`);
  const rows: (readonly [string, string, string])[] = [];
  for (const place of catalog.places) {
    if (rows.length === INDEXED_PLACES_PER_BODY) break;
    if (!record(place)) throw new TypeError(`${objectId}: place record is invalid.`);
    const id = place.id;
    if (!(typeof id === 'number' && Number.isSafeInteger(id)) && !(typeof id === 'string' && /^[0-9]+$/u.test(id))) throw new TypeError(`${objectId}: place id is invalid.`);
    const name = text(place.name, 'place name');
    const at = { name: normalizeDestinationQuery(name), latitudeDeg: finite(place.latitude, 'place latitude'), longitudeDeg: finite(place.longitude, 'place longitude') };
    if (settlements.some(settlement => settlement.name === at.name && greatCircleKm(settlement, at, radiusM / 1000) < SAME_SETTLEMENT_KM)) continue;
    rows.push([String(id), name, text(place.context, 'place context')]);
  }
  return { objectId, type: 'City', rows };
}

function text(value: unknown, at: string): string { if (typeof value !== 'string' || !value) throw new TypeError(`${at} must be text.`); return value; }
function finite(value: unknown, at: string): number { if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${at} must be finite.`); return value; }

export async function prepareFeatureIndex({ root = process.cwd() }: { root?: string } = {}) {
  const objects: { id: string; name: string; route: string; count: number; lensIds?: string[] }[] = [];
  const features: IndexedFeature[] = [], places: PlaceTable[] = [];
  for (const object of SCENE_OBJECTS) {
    const descriptor: unknown = await readFile(resolve(root, 'src/objects', object.id, 'prepared/features.json'), 'utf8').then(JSON.parse, (error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return null; throw error; });
    if (descriptor === null) continue;
    if (!record(descriptor) || descriptor.schema !== 'cssearth-prepared-features@1') throw new TypeError(`${object.id}: prepared features descriptor is invalid.`);
    const pins: Record<string, unknown>[] = [descriptor];
    if (descriptor.selection !== undefined) {
      const selection = descriptor.selection;
      if (!record(selection) || !Array.isArray(selection.banks) || !Number.isSafeInteger(selection.count) || Number(selection.count) < 1) throw new TypeError(`${object.id}: feature selection descriptor is invalid.`);
      for (const bank of selection.banks) {
        if (!record(bank)) throw new TypeError(`${object.id}: feature selection bank is invalid.`);
        pins.push(bank);
      }
    }
    const values: unknown[] = [];
    let catalog: Record<string, unknown> | null = null;
    for (const pin of pins) {
      const url = text(pin.url, `${object.id} catalogue url`), file = url.split('/').at(-1)!;
      const bytes = await readFile(resolve(root, 'public/scenes', object.id, file));
      if (bytes.length !== pin.bytes || sha256(bytes) !== pin.sha256) throw new Error(`${object.id}: the public feature catalogue does not match its prepared descriptor; run pnpm prepare:planets.`);
      const part: unknown = JSON.parse(bytes.toString('utf8'));
      if (!record(part) || !Array.isArray(part.features) || part.features.length !== pin.count) throw new TypeError(`${object.id}: feature catalogue count differs from its descriptor.`);
      catalog ??= part;
      values.push(...part.features);
    }
    if (!catalog || descriptor.totalCount !== undefined && descriptor.totalCount !== values.length) throw new TypeError(`${object.id}: total feature catalogue count differs from its descriptor.`);
    if (descriptor.selection !== undefined) values.sort((left, right) => {
      if (!record(left) || !record(right) || !Number.isSafeInteger(left.preparedIndex) || !Number.isSafeInteger(right.preparedIndex)) throw new TypeError(`${object.id}: banked feature order is invalid.`);
      return Number(left.preparedIndex) - Number(right.preparedIndex);
    });
    if (descriptor.selection !== undefined && values.some((value, index) => !record(value) || value.preparedIndex !== index)) {
      throw new TypeError(`${object.id}: banked feature order is incomplete or duplicated.`);
    }
    for (const value of values) {
      if (!record(value) || !Array.isArray(value.searchNames)) throw new TypeError(`${object.id}: feature record is invalid.`);
      features.push({ objectId: object.id, id: text(value.id, 'feature id'), name: text(value.name, 'feature name'), type: text(value.type, 'feature type'), diameterKm: finite(value.diameterKm, 'feature diameter'),
        searchNames: value.searchNames.map(name => text(name, 'feature search name')), searchContext: text(value.searchContext, 'feature search context') });
    }
    // Mission places can belong to one of several shape models. Carry their prepared
    // dataset selection so search never moves to a point on an incompatible model.
    let lensIds: string[] | undefined;
    if (catalog.landmarks !== undefined) {
      const runtime: unknown = JSON.parse(await readFile(resolve(root, 'src/objects', object.id, 'prepared/runtime.json'), 'utf8'));
      if (!record(runtime) || !record(runtime.features) || !Array.isArray(runtime.features.lensIds) || !runtime.features.lensIds.length) throw new TypeError(`${object.id}: landmark datasets are missing.`);
      lensIds = runtime.features.lensIds.map(id => text(id, 'landmark dataset'));
    }
    // Named features that are settlements, to leave their places out of the index.
    const settlements = values.filter((value): value is Record<string, unknown> => record(value) && (value.type === 'Capital' || value.type === 'City'))
      .map(value => ({ name: normalizeDestinationQuery(text(value.name, 'feature name')), latitudeDeg: finite(value.latitudeDeg, 'feature latitude'), longitudeDeg: finite(value.longitudeDeg, 'feature longitude') }));
    const table = await preparedPlaces(root, object.id, settlements, object.worldFrame?.bodyRadiusM ?? null);
    if (table) places.push(table);
    objects.push({ id: object.id, name: object.name, route: object.route, count: values.length + (table?.rows.length ?? 0), ...(lensIds ? { lensIds } : {}) });
  }
  const index = { schema: FEATURE_INDEX_SCHEMA, objects, features, places };
  const encoded = Buffer.from(`${JSON.stringify(index)}\n`);
  await mkdir(resolve(root, 'public/features'), { recursive: true });
  await writeFile(resolve(root, 'public/features/index.json'), encoded);
  const pin = { schema: FEATURE_INDEX_SCHEMA, url: FEATURE_INDEX_URL, bytes: encoded.length, sha256: sha256(encoded), count: features.length + places.reduce((sum, table) => sum + table.rows.length, 0), objects: objects.map(object => object.id) };
  await writeFile(resolve(root, 'site/prepared-feature-index.json'), `${JSON.stringify(pin, null, 2)}\n`);
  return pin;
}

const direct = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (direct) console.log(JSON.stringify(await prepareFeatureIndex()));
