import { implementationPins } from '@cssearth/nebula-lab/server/implementation';
/** Explicit offline first stage of the nebula compiler. No volume or UI-side processing. */
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { nativeStarless } from '../../server/workflows/emission-inference/native-source.ts';
import { analyzeStructureMap, colorStructureLayer, structureLayers } from '@cssearth/nebula-reconstruction/evidence/structure-map';
import type { WaveletSettings } from '@cssearth/nebula-reconstruction/evidence/wavelets';

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Recipe object required.');
  return value as Record<string, unknown>;
};
const text = (value: unknown): string => { if (typeof value !== 'string' || !value) throw new TypeError('Recipe text required.'); return value; };
const number = (value: unknown): number => { if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Finite recipe number required.'); return value; };
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const json = (path: string, value: unknown) => writeFile(path, JSON.stringify(value, null, 2) + '\n');
const [recipePath, extra] = process.argv.slice(2);
if (!recipePath || extra) throw new TypeError('Usage: prepare-nebula-structures <recipe.json>');
const recipeBytes = await readFile(recipePath), recipe = record(JSON.parse(recipeBytes.toString()));
if (recipe.schema !== 'cssearth-nebula-structure-recipe@1') throw new TypeError('Unsupported structure recipe.');
const id = text(recipe.id), width = number(recipe.workingWidth);
if (!/^[a-z0-9-]+$/.test(id) || !Number.isInteger(width) || width < 64 || width > 1024) throw new TypeError('Bounded id/working raster required.');
const sourceRecipePath = text(recipe.sourceRecipe), sourceRecipeBytes = await readFile(sourceRecipePath);
const sourceRecipe = record(JSON.parse(sourceRecipeBytes.toString())), source = record(sourceRecipe.source);
const removal = record(sourceRecipe.nativeRemoval), model = record(removal.model);
const sourceSha = text(source.sha256), sourceUrl = text(source.url), nativeWidth = number(source.width), nativeHeight = number(source.height);
if (!/^[a-f0-9]{64}$/.test(sourceSha) || !/^https:\/\//.test(sourceUrl)) throw new TypeError('Pinned HTTPS source required.');
const cache = resolve('.local/nebula-lab/planetary'), originalPath = resolve(cache, `${sourceSha}.jpg`);
await mkdir(cache, { recursive: true });
let original: Buffer;
try { original = await readFile(originalPath); }
catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`Source acquisition failed: ${response.status}`);
  original = Buffer.from(await response.arrayBuffer());
  if (sha(original) !== sourceSha) throw new Error('Source hash differs.');
  await writeFile(originalPath, original);
}
if (sha(original) !== sourceSha) throw new Error('Source hash differs.');
const separated = await nativeStarless(original, [nativeWidth, nativeHeight], {
  directory: text(removal.directory),
  model: { path: text(model.path) },
});
const height = Math.round(width * nativeHeight / nativeWidth), dimensions = { width, height };
const image = await sharp(separated.pixels, { raw: { width: nativeWidth, height: nativeHeight, channels: 3 } })
  .resize(width, height, { fit: 'fill', kernel: 'lanczos3' }).raw().toBuffer();
const wavelets = record(recipe.wavelets), connectivity = number(wavelets.connectivity);
if (connectivity !== 4 && connectivity !== 8) throw new TypeError('Connectivity must be 4 or 8.');
const settings: WaveletSettings = { scales: number(wavelets.scales), significanceSigma: number(wavelets.significanceSigma),
  compactMaxScale: number(wavelets.compactMaxScale), elongatedAxisRatio: number(wavelets.elongatedAxisRatio),
  minRegionPixels: number(wavelets.minRegionPixels), connectivity };
const started = performance.now();
const result = analyzeStructureMap(image, width, height, settings);
if (result.metrics.reconstructionMaxError > 1e-6) throw new Error('Structure allocation lost input signal.');
const directory = resolve(cache, id), staging = resolve(cache, `${id}-staging-${process.pid}`);
await mkdir(staging, { recursive: true });
async function raster(file: string, bytes: Uint8Array) {
  await sharp(bytes, { raw: { width, height, channels: 3 } }).png().toFile(resolve(staging, file));
}
async function field(file: string, values: Float32Array) {
  const bytes = Buffer.alloc(values.length * 4);
  for (let i = 0; i < values.length; i++) bytes.writeFloatLE(values[i]!, i * 4);
  await writeFile(resolve(staging, file), bytes);
  return { file, sha256: sha(bytes), values: values.length };
}
await raster('source.png', image);
const palette = { diffuse: [.65, .3, .85], arcs: [.1, .9, 1], knots: [1, .8, .15], unassigned: [1, .18, .15] };
const combined = Buffer.alloc(image.length), fields = [];
for (let p = 0; p < width * height; p++) {
  // False-color evidence display, deliberately separate from conserved RGB fields.
  const weights = structureLayers.map(layer => result.fractions[layer][p]! * (layer === 'diffuse' ? 1 : 4));
  const sum = weights.reduce((a, b) => a + b, 0), gain = Math.sqrt(result.luminance[p]!);
  for (let c = 0; c < 3; c++) combined[p * 3 + c] = Math.round(255 * gain * structureLayers.reduce((total, layer, i) =>
    total + palette[layer][c]! * weights[i]!, 0) / Math.max(sum, 1e-30));
}
await raster('combined.png', combined);
for (const layer of structureLayers) {
  const colored = colorStructureLayer(image, result.fractions[layer]);
  const gain = layer === 'diffuse' ? 1 : 4;
  await raster(`${layer}.png`, Uint8Array.from(colored, value => Math.round(Math.min(1, value * gain) * 255)));
  fields.push({ layer, rgb: await field(`${layer}-rgb.f32`, colored), fraction: await field(`${layer}-fraction.f32`, result.fractions[layer]) });
}
const directionField = await field('tangent-radians.f32', result.directions);
const regions = result.regions.map(({ support, ...region }) => {
  const runs: number[] = [];
  for (const pixel of support) {
    const index = runs.length - 2;
    if (index >= 0 && runs[index]! + runs[index + 1]! === pixel) runs[index + 1]!++;
    else runs.push(pixel, 1);
  }
  return { ...region, supportRuns: runs };
});
await json(resolve(staging, 'regions.json'), { schema: 'cssearth-image-structure-graph@1', dimensions,
  interpretation: 'Wavelet scale-plane candidates and overlap links. No inferred common depth, foreground membership or confirmed physical connections.', regions });
const panels = [
  { id: 'source', label: 'Source', file: 'source.png', description: 'Full-frame native NOX separation, resized once. No crop, black-level subtraction or geometric mask.' },
  { id: 'combined', label: 'Combined', file: 'combined.png', description: 'False-color evidence: violet diffuse, cyan ridges, gold compact, red unassigned. Detail weights ×4 and square-root display brightness; not photometry.' },
  { id: 'diffuse', label: 'Diffuse', file: 'diffuse.png', description: 'Broad emission, including the faint outer field; ×1 display. This is not a confirmed halo segmentation.' },
  { id: 'arcs', label: 'Arcs', file: 'arcs.png', description: 'Directional ridge candidates across spatial scales; ×4 display. A projected ridge may be a shell edge or a filament.' },
  { id: 'knots', label: 'Knots', file: 'knots.png', description: 'Fine compact candidates; ×4 display. Some may be residual stars or NOX artifacts.' },
  { id: 'unassigned', label: 'Unassigned', file: 'unassigned.png', description: 'Signal not assigned by the detector, preserved separately; ×4 display.' },
];
await json(resolve(staging, 'structure-map.json'), { schema: 'cssearth-nebula-structure-map@1', dimensions, panels,
  metrics: result.metrics, fields, directionField, seconds: (performance.now() - started) / 1000,
  provenance: { recipePath, recipeSha256: sha(recipeBytes), sourceRecipePath, sourceRecipeSha256: sha(sourceRecipeBytes),
    source, nativeRemoval: separated.provenance, sourceImageSha256: sha(image), settings,
    implementation: (await implementationPins(process.cwd(), ['labs/nebula/packages/lab/src/cli/commands/prepare-nebula-structures.ts'])).map(pin => ({ file: pin.path, sha256: pin.sha256 })) },
  limitations: ['Display RGB, not calibrated emission-line flux or gas density.', 'This stage infers no depth and removes no additional compact sources.',
    'The observed field is preserved; the full astronomical halo extends beyond this photograph.',
    'Exact additive accounting does not establish a correct morphological decomposition.'],
});
try { await rename(directory, `${directory}-previous-${Date.now()}`); }
catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
await rename(staging, directory);
console.log(`NEBULA_STRUCTURES_COMPLETE ${directory}; ${result.metrics.regions} regions; maxError=${result.metrics.reconstructionMaxError}; ${(performance.now() - started).toFixed(0)}ms`);
