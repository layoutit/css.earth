import { readFile } from 'node:fs/promises';
import { requireRecord } from '../../../../tools/sources/source-values.mts';
import { requireObjectRuntimeDefinition } from '../../../../tools/contract/object-runtime-contract.mts';

// Optional paging conformance uses the retained prepared city/noise plans.
// The current Earth registry intentionally mounts its fixed global dataset.
const root = new URL('../../../../src/objects/earth/', import.meta.url);
const read = async (path: string) => requireRecord(JSON.parse(await readFile(new URL(path, root), 'utf8')));
const earth = requireObjectRuntimeDefinition(await read('prepared/runtime.json'));
const config = await read('source/preparation/paged-ellipsoid.json');
const [city, noise, places] = await Promise.all(['pages', 'noise', 'places'].map(name => read(`prepared/${name}.json`)));
const [system, carrier] = earth.motionFrame ?? [];
export const earthPagingFixture = { ...earth,
  destinations: { catalog: places, defaultLens: 'normal', statuses: requireRecord(config.destinations).statuses },
  // Bind the optional noise overlay to an existing fixture lens. Retained page
  // imagery, geometry, source pins and budgets stay exactly as prepared.
  pageLayers: [{ id: 'city', plan: city, lensIds: ['normal', 'topography'] },
    { id: 'noise', plan: noise, lensIds: ['topography'] }].map(layer => ({ ...layer,
      plan: { ...layer.plan, lensIds: layer.lensIds, schema: 'cssearth-prepared-map-pages@1', assetPath: config.publicBase },
      carrier, system, className: 'earth-city-page', textureClassName: 'earth-api-texture' })),
};
