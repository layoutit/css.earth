/** Explicit geometric hypothesis detection from the existing starless structure rasters. */
import { readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import sharp from 'sharp';
import { readStructureCatalogue, readReviewMap } from '../../features/observations/models/structures-model.ts';
import { detectShapes } from '@cssearth/nebula-reconstruction/evidence/geometry/detect-shapes';
import { readDetectionSettings } from '@cssearth/nebula-reconstruction/evidence/geometry/settings';

const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Expected a geometry preparation record.');
  return value as Record<string, unknown>;
};
const text = (value: unknown): string => {
  if (typeof value !== 'string' || !value) throw new TypeError('Expected geometry preparation text.');
  return value;
};
const [recipePath, extra] = process.argv.slice(2);
if (!recipePath || extra) throw new TypeError('Usage: prepare-observation-geometry <recipe.json>');
const recipe = object(JSON.parse(await readFile(recipePath, 'utf8')));
if (recipe.schema !== 'cssearth-observation-geometry-recipe@1') throw new TypeError('Unsupported geometry recipe.');
const settings = readDetectionSettings(recipe.settings);
const cataloguePath = resolve(text(recipe.structureCatalogue));
const catalogueBytes = await readFile(cataloguePath), rawCatalogue = object(JSON.parse(catalogueBytes.toString()));
const catalogue = readStructureCatalogue(rawCatalogue);
if (!Array.isArray(rawCatalogue.images)) throw new TypeError('Missing structure images.');
const rawImages = rawCatalogue.images.map(object);
// Geometry is an additive attachment: each image's prepared `geometry.json` sits in its structure analysis run.
const images = [], started = performance.now();
for (const image of catalogue.images) {
  const sourceEntry = rawImages.find(entry => entry.id === image.id);
  if (!sourceEntry) throw new Error(`Missing original catalogue entry for ${image.id}.`);
  const map = readReviewMap(JSON.parse(await readFile(resolve(image.directory, 'map.json'), 'utf8')), image);
  const panel = map.panels.find(item => item.id === 'source');
  if (!panel) throw new Error(`${image.id}: structure map ${image.directory}/map.json has no source panel.`);
  const sourceBytes = await readFile(resolve(image.directory, panel.file));
  const decoded = await sharp(sourceBytes).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  if (decoded.info.width !== image.width || decoded.info.height !== image.height || decoded.info.channels !== 3 ||
      decoded.data.length !== image.width * image.height * 3 || image.width * image.height > 1_000_000)
    throw new Error(`${image.id}: source raster dimensions do not match its map or exceed the working limit.`);
  const inputs = { recipe: recipePath, structureCatalogue: text(recipe.structureCatalogue), mapDirectory: image.directory,
    sourcePanel: panel.file, width: image.width, height: image.height, settings };
  const imageStarted = performance.now();
  console.log(`OBSERVATION_GEOMETRY_SOURCE ${image.id}; cached structure source; NOX_RUNS=0`);
  const detected = detectShapes(decoded.data, image.width, image.height, settings);
  const geometry = { schema: 'cssearth-observation-geometry@1', imageId: image.id,
    mapDirectory: image.directory, width: image.width, height: image.height,
    imageToFrame: image.imageToFrame, ...detected,
    provenance: { inputs, nativeRemovalPerformed: false, structureExtractionPerformed: false,
      depthInferencePerformed: false,
      coordinates: 'Working raster pixel edges; use the unchanged source working-to-native transform before imageToFrame.',
      interpretation: 'Automatically fitted projected hypotheses. Supported arcs are evidence; gaps are extrapolation. Scores are not probabilities. No recovered 3D geometry or measured density.' } };
  const file = 'geometry.json', destination = resolve(image.directory, file);
  await writeFile(`${destination}.pending`, JSON.stringify(geometry, null, 2) + '\n'); await rename(`${destination}.pending`, destination);
  images.push({ ...sourceEntry, geometry: { file } });
  console.log(`OBSERVATION_GEOMETRY_READY ${image.id}; candidates=${detected.candidates.length}; groups=${detected.groups.length}; seconds=${((performance.now() - imageStarted) / 1000).toFixed(2)}`);
}
// Keep the old catalogue live until every source is complete; never overwrite concurrent extraction.
if (!(await readFile(cataloguePath)).equals(catalogueBytes)) throw new Error('Structure catalogue changed during geometry preparation. Rerun against its new inputs.');
const pending = resolve(dirname(cataloguePath), `.geometry-catalogue-${process.pid}.pending`);
await writeFile(pending, JSON.stringify({ ...rawCatalogue, images }, null, 2) + '\n');
await rename(pending, cataloguePath);
console.log(`OBSERVATION_GEOMETRY_COMPLETE ${relative(process.cwd(), cataloguePath)}; images=${images.length}; seconds=${((performance.now() - started) / 1000).toFixed(2)}; NOX_RUNS=0; STRUCTURE_EXTRACTIONS=0; VOLUMES=0`);
