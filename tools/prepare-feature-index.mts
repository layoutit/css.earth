import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { OBJECTS } from '../site/objects.mts';
import { record } from '../site/browser-types.mts';

/** One search index over every body's prepared named features, so a feature can be found
 * from any page. Each body's catalogue stays the byte-verified source; the index carries
 * only names, search keys and the identity needed to navigate and select. */
export const FEATURE_INDEX_SCHEMA = 'cssearth-prepared-feature-index@1';
export const FEATURE_INDEX_URL = '/features/index.json';

interface IndexedFeature { readonly objectId: string; readonly id: string; readonly name: string; readonly type: string; readonly diameterKm: number; readonly searchNames: readonly string[]; readonly searchContext: string; }

function text(value: unknown, at: string): string { if (typeof value !== 'string' || !value) throw new TypeError(`${at} must be text.`); return value; }
function finite(value: unknown, at: string): number { if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${at} must be finite.`); return value; }

export async function prepareFeatureIndex({ root = process.cwd() }: { root?: string } = {}) {
  const objects: { id: string; name: string; route: string; count: number; lensIds?: string[] }[] = [];
  const features: IndexedFeature[] = [];
  for (const object of OBJECTS) {
    const descriptor: unknown = await readFile(resolve(root, 'src/objects', object.id, 'prepared/features.json'), 'utf8').then(JSON.parse, (error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return null; throw error; });
    if (descriptor === null) continue;
    if (!record(descriptor) || descriptor.schema !== 'cssearth-prepared-features@1') throw new TypeError(`${object.id}: prepared features descriptor is invalid.`);
    const url = text(descriptor.url, `${object.id} catalogue url`), file = url.split('/').at(-1)!;
    const bytes = await readFile(resolve(root, 'public/scenes', object.id, file));
    if (bytes.length !== descriptor.bytes || createHash('sha256').update(bytes).digest('hex') !== descriptor.sha256) throw new Error(`${object.id}: the public feature catalogue does not match its prepared descriptor; run pnpm prepare:planets.`);
    const catalog: unknown = JSON.parse(bytes.toString('utf8'));
    if (!record(catalog) || !Array.isArray(catalog.features) || catalog.features.length !== descriptor.count) throw new TypeError(`${object.id}: feature catalogue count differs from its descriptor.`);
    for (const value of catalog.features as unknown[]) {
      if (!record(value) || !Array.isArray(value.searchNames)) throw new TypeError(`${object.id}: feature record is invalid.`);
      features.push({ objectId: object.id, id: text(value.id, 'feature id'), name: text(value.name, 'feature name'), type: text(value.type, 'feature type'), diameterKm: finite(value.diameterKm, 'feature diameter'),
        searchNames: value.searchNames.map(name => text(name, 'feature search name')), searchContext: text(value.searchContext, 'feature search context') });
    }
    // Mission places can belong to one of several shape models. Carry their prepared
    // dataset selection so search never moves to a point on an incompatible model.
    let lensIds: string[] | undefined;
    if (catalog.landmarks !== undefined) {
      const runtime: unknown = JSON.parse(await readFile(resolve(root, 'src/objects', object.id, 'prepared/runtime.refs.json'), 'utf8'));
      if (!record(runtime) || !record(runtime.features) || !Array.isArray(runtime.features.lensIds) || !runtime.features.lensIds.length) throw new TypeError(`${object.id}: landmark datasets are missing.`);
      lensIds = runtime.features.lensIds.map(id => text(id, 'landmark dataset'));
    }
    objects.push({ id: object.id, name: object.name, route: object.route, count: catalog.features.length, ...(lensIds ? { lensIds } : {}) });
  }
  const index = { schema: FEATURE_INDEX_SCHEMA, objects, features };
  const encoded = Buffer.from(`${JSON.stringify(index)}\n`);
  await mkdir(resolve(root, 'public/features'), { recursive: true });
  await writeFile(resolve(root, 'public/features/index.json'), encoded);
  const pin = { schema: FEATURE_INDEX_SCHEMA, url: FEATURE_INDEX_URL, bytes: encoded.length, sha256: createHash('sha256').update(encoded).digest('hex'), count: features.length, objects: objects.map(object => object.id) };
  await writeFile(resolve(root, 'site/prepared-feature-index.json'), `${JSON.stringify(pin, null, 2)}\n`);
  return pin;
}

const direct = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (direct) console.log(JSON.stringify(await prepareFeatureIndex()));
