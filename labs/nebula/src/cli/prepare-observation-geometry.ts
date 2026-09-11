/** Explicit geometric hypothesis detection from the existing, verified starless structure rasters. */
import { createHash } from 'node:crypto';
import { readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import sharp from 'sharp';
import { readStructureCatalogue, readReviewMap } from '../alignment/observations-ui/structures-model.js';
import { detectShapes, type DetectionSettings } from '../reconstruction/geometry/detect-shapes.js';

const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Expected a geometry preparation record.');
  return value as Record<string, unknown>;
};
const text = (value: unknown): string => {
  if (typeof value !== 'string' || !value) throw new TypeError('Expected geometry preparation text.');
  return value;
};
function bounded(value: unknown, fallback: number, min: number, max: number, integer = false): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))
    throw new TypeError('Invalid or unbounded geometry detection setting.');
  return value;
}
const [recipePath, extra] = process.argv.slice(2);
if (!recipePath || extra) throw new TypeError('Usage: prepare-observation-geometry <recipe.json>');
const recipeBytes = await readFile(recipePath), recipe = object(JSON.parse(recipeBytes.toString()));
if (recipe.schema !== 'cssearth-observation-geometry-recipe@1') throw new TypeError('Unsupported geometry recipe.');
const values = recipe.settings === undefined ? {} : object(recipe.settings);
if (Object.keys(values).some(key => !['iterations', 'seed', 'minRadiusFraction', 'maxCandidates'].includes(key)))
  throw new TypeError('Unknown geometry detection setting.');
const settings: DetectionSettings = {
  iterations: bounded(values.iterations, 24000, 100, 200_000, true),
  seed: bounded(values.seed, 7293, 0, 0xffffffff, true),
  minRadiusFraction: bounded(values.minRadiusFraction, .07, .02, .4),
  maxCandidates: bounded(values.maxCandidates, 12, 1, 32, true),
};
const cataloguePath = resolve(text(recipe.structureCatalogue));
const catalogueBytes = await readFile(cataloguePath), rawCatalogue = object(JSON.parse(catalogueBytes.toString()));
const catalogue = readStructureCatalogue(rawCatalogue);
if (!Array.isArray(rawCatalogue.images)) throw new TypeError('Missing structure images.');
const rawImages = rawCatalogue.images.map(object);
// Geometry is an additive attachment. Exclude previous attachments from its input identity,
// while retaining every original catalogue field so repeat runs do not recursively invalidate it.
const structureInput = { ...rawCatalogue, images: rawImages.map(image => {
  const { geometry: _previousGeometry, ...source } = image;
  return source;
}) };
const structureCatalogueSha256 = sha(Buffer.from(JSON.stringify(structureInput)));
const sourceRoot = resolve('labs/nebula/src');
const geometryRoot = resolve(sourceRoot, 'reconstruction/geometry');
const geometryFiles = (await readdir(geometryRoot, { recursive: true }))
  .filter(file => file.endsWith('.ts') && !file.endsWith('.test.ts'))
  .map(file => `reconstruction/geometry/${file}`);
const implementationPaths = [...new Set([
  'cli/prepare-observation-geometry.ts', 'alignment/observations-ui/structures-model.ts',
  ...geometryFiles,
])].sort();
const implementation = await Promise.all(implementationPaths.map(async path =>
  ({ path: `labs/nebula/src/${path}`, sha256: sha(await readFile(resolve(sourceRoot, path))) })));
const images = [], started = performance.now();
for (const image of catalogue.images) {
  const sourceEntry = rawImages.find(entry => entry.id === image.id);
  if (!sourceEntry) throw new Error(`Missing original catalogue entry for ${image.id}.`);
  const mapBytes = await readFile(resolve(image.directory, 'map.json'));
  if (sha(mapBytes) !== image.mapSha256) throw new Error(`${image.id}: prepared structure map changed.`);
  const rawMap = object(JSON.parse(mapBytes.toString())), map = readReviewMap(rawMap, image);
  if (!Array.isArray(rawMap.panels)) throw new Error(`${image.id}: no prepared source panel.`);
  const rawPanel = rawMap.panels.map(object).find(panel => panel.id === 'source');
  const panel = map.panels.find(item => item.id === 'source');
  if (!panel || !rawPanel || typeof rawPanel.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(rawPanel.sha256))
    throw new Error(`${image.id}: source panel has no immutable image hash.`);
  const sourceBytes = await readFile(resolve(image.directory, panel.file));
  if (sha(sourceBytes) !== rawPanel.sha256) throw new Error(`${image.id}: prepared starless source pixels changed.`);
  const decoded = await sharp(sourceBytes).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  if (decoded.info.width !== image.width || decoded.info.height !== image.height || decoded.info.channels !== 3 ||
      decoded.data.length !== image.width * image.height * 3 || image.width * image.height > 1_000_000)
    throw new Error(`${image.id}: source raster dimensions do not match its map or exceed the working limit.`);
  const identity = { recipeSha256: sha(recipeBytes), structureCatalogueSha256, sourceSha256: image.sourceSha256,
    mapSha256: image.mapSha256, sourcePanelSha256: rawPanel.sha256, width: image.width, height: image.height,
    settings, implementation };
  const identitySha256 = sha(Buffer.from(JSON.stringify(identity)));
  const imageStarted = performance.now();
  console.log(`OBSERVATION_GEOMETRY_SOURCE ${image.id}; verified cached structure source; NOX_RUNS=0`);
  const detected = detectShapes(decoded.data, image.width, image.height, settings);
  const geometry = { schema: 'cssearth-observation-geometry@1', imageId: image.id,
    sourceSha256: image.sourceSha256, mapSha256: image.mapSha256, width: image.width, height: image.height,
    imageToFrame: image.imageToFrame, ...detected,
    provenance: { recipePath, identity, identitySha256, nativeRemovalPerformed: false, structureExtractionPerformed: false,
      depthInferencePerformed: false,
      coordinates: 'Working raster pixel edges; use the unchanged source working-to-native transform before imageToFrame.',
      interpretation: 'Automatically fitted projected hypotheses. Supported arcs are evidence; gaps are extrapolation. Scores are not probabilities. No recovered 3D geometry or measured density.' } };
  const bytes = Buffer.from(JSON.stringify(geometry, null, 2) + '\n');
  const file = `geometry-${identitySha256}.json`, destination = resolve(image.directory, file);
  try { await writeFile(destination, bytes, { flag: 'wx' }); }
  catch (error) {
    if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'EEXIST') throw error;
    if (!(await readFile(destination)).equals(bytes)) throw new Error(`${image.id}: repeated geometry identity produced different bytes.`);
  }
  images.push({ ...sourceEntry, geometry: { file, sha256: sha(bytes) } });
  console.log(`OBSERVATION_GEOMETRY_READY ${image.id}; candidates=${detected.candidates.length}; groups=${detected.groups.length}; seconds=${((performance.now() - imageStarted) / 1000).toFixed(2)}`);
}
// Keep the old catalogue live until every source is complete; never overwrite concurrent extraction.
if (!(await readFile(cataloguePath)).equals(catalogueBytes)) throw new Error('Structure catalogue changed during geometry preparation. Rerun against its new inputs.');
const pending = resolve(dirname(cataloguePath), `.geometry-catalogue-${process.pid}.pending`);
await writeFile(pending, JSON.stringify({ ...rawCatalogue, images }, null, 2) + '\n');
await rename(pending, cataloguePath);
console.log(`OBSERVATION_GEOMETRY_COMPLETE ${relative(process.cwd(), cataloguePath)}; images=${images.length}; seconds=${((performance.now() - started) / 1000).toFixed(2)}; NOX_RUNS=0; STRUCTURE_EXTRACTIONS=0; VOLUMES=0`);
