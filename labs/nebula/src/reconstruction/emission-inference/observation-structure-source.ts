/** Read-only input closure for observation analysis. This boundary never acquires sources or runs NOX. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import sharp from 'sharp';
import { readObservations, type Observation } from '../../alignment/observations-ui/model.js';
import { readObservationRecipe, type ObservationRecipe } from '../../alignment/observations/recipe.js';
import { nativeStarless } from './native-source.js';
import type { WaveletSettings } from '../structure-wavelets.js';

const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Expected structure recipe record.');
  return value as Record<string, unknown>;
};
const text = (value: unknown): string => { if (typeof value !== 'string' || !value) throw new TypeError('Expected structure recipe text.'); return value; };
const finite = (value: unknown): number => { if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Expected finite structure setting.'); return value; };
export function readObservationStructureRecipe(value: unknown) {
  const row = object(value), wavelets = object(row.wavelets), width = finite(row.workingWidth), connectivity = finite(wavelets.connectivity);
  if (row.schema !== 'cssearth-observation-structure-recipe@1' || !Number.isInteger(width) || width < 64 || width > 1024 || (connectivity !== 4 && connectivity !== 8))
    throw new TypeError('Unsupported or unbounded observation structure recipe.');
  const settings: WaveletSettings = { scales: finite(wavelets.scales), significanceSigma: finite(wavelets.significanceSigma),
    compactMaxScale: finite(wavelets.compactMaxScale), elongatedAxisRatio: finite(wavelets.elongatedAxisRatio), minRegionPixels: finite(wavelets.minRegionPixels), connectivity };
  return { workingWidth: width, observationRecipe: text(row.observationRecipe), observationCatalogue: text(row.observationCatalogue), settings };
}
export async function readStructureObservations(observationRecipePath: string, cataloguePath: string) {
  const recipeBytes = await readFile(observationRecipePath), recipe = readObservationRecipe(JSON.parse(recipeBytes.toString()));
  const catalogueBytes = await readFile(cataloguePath), raw: unknown = JSON.parse(catalogueBytes.toString()), observations = readObservations(raw);
  const provenance = object(object(raw).provenance);
  if (provenance.recipeSha256 !== sha(recipeBytes) || observations.id !== recipe.id || JSON.stringify(observations.frame) !== JSON.stringify(recipe.frame) ||
    observations.images.length !== recipe.images.length) throw new Error('Prepared observation catalogue differs from its current source recipe. Re-align explicitly first.');
  for (const image of observations.images) {
    const source = recipe.images.find(source => source.id === image.id);
    if (!source || image.source.sha256 !== source.sha256 || image.source.width !== source.width || image.source.height !== source.height ||
      image.registration.status !== 'verified' || !image.layers.diffuse || !image.layers.stars) throw new Error(`${image.id}: verified alignment and completed native separation required.`);
  }
  return { observations, recipe, catalogueSha256: sha(catalogueBytes), observationRecipeSha256: sha(recipeBytes) };
}
export async function loadObservationDiffuse(recipe: ObservationRecipe, image: Observation, workingWidth: number) {
  const source = recipe.images.find(source => source.id === image.id);
  if (!source) throw new Error('Unknown observation source.');
  const directory = resolve('.local/nebula-lab/observations', recipe.id), sourcePath = resolve(directory, 'sources', `${source.id}.tif`);
  const sourceBytes = await readFile(sourcePath);
  if (sha(sourceBytes) !== source.sha256) throw new Error(`${source.id}: original source changed.`);
  const dimensions: [number, number] = [source.width, source.height];
  const native = await nativeStarless(sourceBytes, dimensions,
    { ...recipe.nativeRemoval, directory: relative(process.cwd(), resolve(directory, source.id, 'native-nox')) }, { allowProcessing: false });
  const width = Math.min(workingWidth, source.width), height = Math.round(width * source.height / source.width);
  if (width * height > 1_000_000) throw new Error('Lower workingWidth for this tall source; analysis is bounded to one million pixels.');
  const rgb = await sharp(native.pixels, { raw: { width: source.width, height: source.height, channels: 3 } })
    .resize(width, height, { fit: 'fill', kernel: 'lanczos3' }).raw().toBuffer();
  return { rgb, width, height, source, native: native.provenance, sourcePath: relative(process.cwd(), sourcePath) };
}
