/** Explicit 2D structure preparation after accepted observation alignment and native star separation. */
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { readObservationStructureRecipe, readStructureObservations, loadObservationDiffuse } from '../../server/workflows/emission-inference/observation-structure-source.ts';
import { writeStructureInspection, workingRasterToFrame } from '../../server/workflows/emission-inference/structure-inspection.ts';
import { objectScratch } from '../../resources/model-paths.ts';

const [recipePath, extra] = process.argv.slice(2);
if (!recipePath || extra) throw new TypeError('Usage: prepare-observation-structures <recipe.json>');
const config = readObservationStructureRecipe(JSON.parse(await readFile(recipePath, 'utf8')));
const inputs = await readStructureObservations(config.observationRecipe, config.observationCatalogue);
const directory = resolve(objectScratch(inputs.recipe.id, 'observations', inputs.recipe.id, 'structures'));
await mkdir(directory, { recursive: true });
// One run directory per image and extraction; earlier runs stay readable by the viewers that opened them.
const run = `analysis-${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}`;
const images = [], started = performance.now();
for (const image of inputs.observations.images) {
  console.log(`OBSERVATION_STRUCTURE_SOURCE ${image.id}; cached native ${image.source.stellarTreatment === 'preserve' ? 'preserved map' : 'NOX'} only`);
  const input = await loadObservationDiffuse(inputs.recipe, image, config.workingWidth);
  const analysisInputs = { recipe: recipePath, observationRecipe: config.observationRecipe, observationCatalogue: config.observationCatalogue,
    source: input.sourcePath, native: input.native, settings: config.settings, dimensions: { width: input.width, height: input.height } };
  const parent = resolve(directory, image.id);
  const destination = resolve(parent, run), staging = resolve(parent, `.staging-${process.pid}`);
  await mkdir(staging, { recursive: true });
  const inspection = await writeStructureInspection(staging, input.rgb, input.width, input.height, config.settings);
  // Wall-clock performance is logged, never written into the map.
  const { seconds, ...stableInspection } = inspection;
  const map = { schema: 'cssearth-observation-structure-map@1', id: image.id, ...stableInspection,
    width: input.width, height: input.height, nativeWidth: input.source.width, nativeHeight: input.source.height,
    imageToFrame: image.imageToFrame,
    workingImageToFrame: workingRasterToFrame(image.imageToFrame, input.source.width, input.source.height, input.width, input.height),
    source: { ...input.source, path: input.sourcePath, nativeRemoval: input.native },
    analysisInputs,
    warnings: [input.source.stellarTreatment === 'preserve' ? 'Star removal is not applicable: compact structural emission and any foreground stars remain; residual is identically zero.' : 'NOX left some bright stellar cores/halos; compact nebular knots may also enter the stellar residual.',
      'These are projected display-image candidates, not a nebular density field, measured emission-line flux, or recovered 3D shapes.',
      'Region masks from different scales overlap; selecting a candidate does not assign shared depth or physical membership.',
      'The full downloaded frame is retained. Coverage remains limited to the original observation.'] };
  await writeFile(resolve(staging, 'map.json'), JSON.stringify(map, null, 2) + '\n');
  await rename(staging, destination);
  images.push({ id: image.id, label: image.label, sourceUrl: input.source.url,
    credit: input.source.credit, page: input.source.page, nativeWidth: input.source.width, nativeHeight: input.source.height,
    width: input.width, height: input.height, imageToFrame: image.imageToFrame,
    directory: relative(process.cwd(), destination) });
  console.log(`OBSERVATION_STRUCTURE_READY ${image.id}; regions=${inspection.regions.length}; atlases=${inspection.atlases.length}; analysisSeconds=${seconds.toFixed(2)}; maxError=${inspection.metrics.reconstructionMaxError}`);
}
const catalogue = { schema: 'cssearth-observation-structures@1', id: inputs.recipe.id, frame: inputs.observations.frame, images,
  provenance: { recipePath, observationRecipe: config.observationRecipe, observationCatalogue: config.observationCatalogue,
    nativeRemovalPerformed: false, depthInferencePerformed: false } };
const temporary = resolve(directory, `catalogue-${process.pid}.pending`);
await writeFile(temporary, JSON.stringify(catalogue, null, 2) + '\n');
await rename(temporary, resolve(directory, 'catalogue.json'));
console.log(`OBSERVATION_STRUCTURES_COMPLETE ${relative(process.cwd(), directory)}/catalogue.json; images=${images.length}; seconds=${((performance.now() - started) / 1000).toFixed(2)}; NOX_RUNS=0; VOLUMES=0`);
