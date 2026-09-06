import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, rename, statfs } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PREPARED_EARTH_SCENE as scene } from '../runtime/preparedScene.mjs';
import { PREPARED_EARTH_CITY_PAGES as fine } from '../runtime/preparedCityPages.mjs';
import { readWorldCoverCatalog } from './city/worldcover-catalog.mjs';
import { planGlobalCoarse, coarseSourceAddress, COARSE_PREPARATION_LIMITS } from './city/coarse-plan.mjs';
import { acquireCoarseInputs } from './city/coarse-inputs.mjs';
import { prepareCoarseRelease } from './city/coarse-release.mjs';

const root = new URL('../../../../', import.meta.url);
const { values } = parseArgs({ options: {
  phase: { type: 'string', default: 'plan' },
  'seed-manifest': { type: 'string', multiple: true, default: [] },
  offline: { type: 'boolean', default: false },
} });
assert.ok(['plan', 'acquire', 'prepare'].includes(values.phase), 'Expected --phase=plan, --phase=acquire or --phase=prepare');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const catalog = await readWorldCoverCatalog();
const sources = [
  'src/planets/earth/runtime/preparedScene.mjs',
  'src/planets/earth/tools/city/coarse-plan.mjs',
  'src/planets/earth/tools/city/coarse-page.mjs',
  'src/planets/earth/tools/city/coarse-replacements.mjs',
  'src/planets/earth/tools/city/page-geometry.mjs',
  'src/planets/earth/tools/city/worldcover-catalog.mjs',
  'src/planets/earth/tools/city/wmts-page-geometry.mjs',
  'src/planets/earth/tools/city/wmts-polar-geometry.mjs',
  'src/planets/earth/tools/city/wms-page-geometry.mjs',
  'src/platform/projective-surface-raster.mjs',
];
const sourceHashes = Object.fromEntries(await Promise.all(sources.map(async file => [file, hash(await readFile(new URL(file, root)))])));
const tile = fine.initialLayer.url;
const template = tile.replace(/\/\d+\/\d+\/\d+\.png$/, '/{z}/{x}/{y}.png');
assert.notEqual(template, tile, 'Prepared WMTS provider URL changed');
assert.ok(typeof template === 'string' && template.includes('{z}') && template.includes('{x}') && template.includes('{y}'), 'Prepared imagery URL template');
const inputs = { schema: 'cssearth-global-coarse-inputs@1', sourceHashes,
  sourceInventorySha256: catalog.pin.expectedSha256, fineGeometryVersion: fine.geometryVersion,
  fineRootsSha256: hash(JSON.stringify(fine.roots)), template, regularLevel: 2, polarLevel: 6 };
const version = hash(JSON.stringify(inputs)).slice(0, 16), directory = new URL(`.local/coarse-global/${version}/`, root);
await mkdir(directory, { recursive: true });
const disk = await statfs(fileURLToPath(directory));
assert.ok(disk.bavail * disk.bsize >= COARSE_PREPARATION_LIMITS.minimumFreeBytes, 'Coarse preparation free-space reserve');
if (values.phase !== 'plan') {
  const plan = JSON.parse(await readFile(new URL('plan.json', directory)));
  assert.equal(plan.version, version);
  assert.deepEqual(plan.inputs, inputs, 'Source plan changed');
  assert.deepEqual(plan.source, plan.sourceKeys.map(key => coarseSourceAddress(key, template)), 'Planned source addresses changed');
  assert.deepEqual(plan.limits, COARSE_PREPARATION_LIMITS, 'Preparation limits changed');
  if (values.phase === 'acquire') {
    await acquireCoarseInputs({ plan, directory, offline: values.offline,
      seedManifests: values['seed-manifest'].map(file => pathToFileURL(resolve(file))),
      onProgress: async stats => console.log(JSON.stringify({ version, phase: 'acquire', ...stats })),
    });
  } else {
    await prepareCoarseRelease({ plan, directory, scene, fine, project: root,
      onProgress: async stats => console.log(JSON.stringify({ phase: 'prepare', ...stats })),
    });
  }
  process.exit(0);
}
await writeFile(new URL('inputs.json', directory), JSON.stringify(inputs, null, 2) + '\n');
let cached = [];
try { const checkpoint = JSON.parse(await readFile(new URL('plan.pending.json', directory))); assert.equal(checkpoint.version, version); cached = checkpoint.pages; }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const start = Date.now();
console.log(JSON.stringify({ version, directory: directory.pathname, restoredPages: cached.length, phase: values.phase, acquisition: false }));
const plan = await planGlobalCoarse({ scene, catalog: catalog.entries, cached, onProgress: async progress => {
  const info = { version, plannedPages: progress.pages.length, queued: progress.queued, sourceImages: progress.sourceImages, elapsedSeconds: (Date.now() - start) / 1000 };
  await writeFile(new URL('plan.pending.json.part', directory), JSON.stringify({ version, pages: progress.pages }));
  await rename(new URL('plan.pending.json.part', directory), new URL('plan.pending.json', directory));
  console.log(JSON.stringify(info));
} });
for (const [file, expected] of Object.entries(sourceHashes)) assert.equal(hash(await readFile(new URL(file, root))), expected, 'Planning source changed');
const result = { schema: 'cssearth-global-coarse-plan@1', version, inputs, ...plan,
  source: plan.sourceKeys.map(key => coarseSourceAddress(key, template)),
  qualification: 'Global prepared-face coverage planned against the pinned source inventory. No imagery has been acquired or runtime release integrated by this phase.' };
await writeFile(new URL('plan.json.part', directory), JSON.stringify(result));
await rename(new URL('plan.json.part', directory), new URL('plan.json', directory));
console.log(JSON.stringify({ version, directory: directory.pathname, roots: result.rootCount, pages: result.pages.length,
  empty: result.pages.filter(page => page.empty).length, sourceImages: result.source.length,
  sourceLevels: [...new Set(result.source.map(source => source.zoom))].sort((a, b) => a - b), complete: true }));
