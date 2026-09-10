import { parseLabModelJson } from '../utils/model-paths.js';
/** Frozen-image benchmark. No named-region masks, depth assignment or runtime baking. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import sharp from 'sharp';
import { decomposeStructures } from '../reconstruction/structure-wavelets.js';
import type { StructureRegion, WaveletSettings } from '../reconstruction/structure-wavelets.js';
import { digest, readBenchmarkImage, writeMethodProducts } from '../reconstruction/benchmark-products.js';
import type { BenchmarkImage, BenchmarkMethod, ComponentMaps } from '../reconstruction/benchmark-products.js';

interface Recipe {
  schema: 'cssearth-structure-benchmark-recipe@1'; id: string; title: string;
  input: { path: string; sha256: string; width: number; height: number; conversion: string; name?: string;
    crop: { left: number; top: number; width: number; height: number };
    original: { path: string; sha256: string; publisherUrl: string; credit: string; license: string } };
  outputDirectory: string; cacheDirectory: string; medianSize: number; wavelets: WaveletSettings;
  waveletSensitivity?: { significanceSigma: number }; residualDisplayRange: number;
  getsf?: Record<string, unknown>;
}
interface GetsfImport {
  sourceSha256: string; width: number; height: number;
  maps: { diffuse: string; compact: string; elongated: string };
  note: string; metrics?: Record<string, number | string>; provenance: string;
}

function structureOverlay(image: BenchmarkImage, catalog: StructureRegion[]) {
  const out = Buffer.from(image.rgb), labels = new Int32Array(image.luminance.length);
  const palette = { compact: [255, 215, 85], elongated: [85, 220, 245], diffuse: [220, 130, 230] };
  // One original-coordinate label plane per scale; shared boundaries never bridge separate regions.
  for (const scale of [...new Set(catalog.map(item => item.scale))]) {
    labels.fill(-1);
    for (let index = 0; index < catalog.length; index++) {
      const region = catalog[index]!;
      if (region.scale === scale) for (const pixel of region.support) labels[pixel] = index;
    }
    for (let pixel = 0; pixel < labels.length; pixel++) {
      const index = labels[pixel]!;
      if (index < 0) continue;
      const x = pixel % image.width, y = Math.floor(pixel / image.width);
      if (x > 0 && x < image.width - 1 && y > 0 && y < image.height - 1 &&
        [pixel - 1, pixel + 1, pixel - image.width, pixel + image.width].every(p => labels[p] === index)) continue;
      out.set(palette[catalog[index]!.morphology], 3 * pixel);
    }
  }
  return out;
}

function supportRuns(support: Uint32Array) {
  const runs: number[] = [];
  let start = -1, previous = -2;
  for (const pixel of support) {
    if (pixel !== previous + 1) {
      if (start >= 0) runs.push(start, previous - start + 1);
      start = pixel;
    }
    previous = pixel;
  }
  if (start >= 0) runs.push(start, previous - start + 1);
  return runs;
}

async function importGetsf(path: string, recipe: Recipe, image: BenchmarkImage) {
  const data: GetsfImport = parseLabModelJson(await readFile(path, 'utf8'));
  if (data.sourceSha256 !== recipe.input.sha256 || data.width !== image.width || data.height !== image.height)
    throw new Error('getsf import must use the identical frozen source and dimensions.');
  const maps: ComponentMaps = { diffuse: new Float32Array(image.luminance.length), compact: new Float32Array(image.luminance.length),
    elongated: new Float32Array(image.luminance.length), residual: new Float32Array(image.luminance.length) };
  const inputs: Record<string, { path: string; sha256: string }> = {};
  for (const key of ['diffuse', 'compact', 'elongated'] as const) {
    const bytes = await readFile(data.maps[key]);
    if (bytes.length !== image.luminance.length * 4) throw new Error(`getsf ${key}: unexpected raw map size.`);
    for (let p = 0; p < image.luminance.length; p++) maps[key][p] = bytes.readFloatLE(p * 4);
    inputs[key] = { path: data.maps[key], sha256: digest(bytes) };
  }
  for (let p = 0; p < image.luminance.length; p++) maps.residual[p] = image.luminance[p]! -
    maps.diffuse[p]! - maps.compact[p]! - maps.elongated[p]!;
  const provenanceBytes = await readFile(data.provenance);
  await mkdir(resolve(recipe.outputDirectory, 'getsf'), { recursive: true });
  await writeFile(resolve(recipe.outputDirectory, 'getsf/import-receipt.json'), JSON.stringify({
    importSha256: digest(await readFile(path)), sourceSha256: data.sourceSha256, inputs,
    provenanceSha256: digest(provenanceBytes), provenance: parseLabModelJson(provenanceBytes.toString()),
  }, null, 2) + '\n');
  return writeMethodProducts({ ...recipe, id: 'getsf', name: 'getsf · official extraction', note: data.note,
    residualRange: recipe.residualDisplayRange, image, maps, metrics: data.metrics });
}

const [recipePath, ...args] = process.argv.slice(2);
if (!recipePath || args.some(arg => arg !== '--refresh-source' && !arg.startsWith('--getsf-import=')))
  throw new TypeError('Usage: prepare-structures <recipe.json> [--refresh-source] [--getsf-import=<receipt.json>]');
const recipeBytes = await readFile(recipePath), recipe: Recipe = parseLabModelJson(recipeBytes.toString());
if (recipe.schema !== 'cssearth-structure-benchmark-recipe@1') throw new Error('Unsupported structure benchmark recipe.');
if (!Number.isInteger(recipe.medianSize) || recipe.medianSize < 3 || recipe.medianSize % 2 !== 1)
  throw new Error('Median size must be an odd integer of at least3.');
await Promise.all([mkdir(recipe.outputDirectory, { recursive: true }), mkdir(recipe.cacheDirectory, { recursive: true })]);
if (args.includes('--refresh-source')) {
  const bytes = await readFile(recipe.input.original.path);
  if (digest(bytes) !== recipe.input.original.sha256) throw new Error('Original TIFF source pin differs.');
  const png = await sharp(bytes).rotate().extract(recipe.input.crop).removeAlpha().toColourspace('srgb').png().toBuffer();
  if (digest(png) !== recipe.input.sha256) throw new Error('Regenerated native crop pin differs.');
  await writeFile(recipe.input.path, png);
}
const image = await readBenchmarkImage(recipe.input.path, recipe.input.sha256, recipe.input.width, recipe.input.height);
const common = { outputDirectory: recipe.outputDirectory, cacheDirectory: recipe.cacheDirectory,
  image, residualRange: recipe.residualDisplayRange };
const started = performance.now(), result = decomposeStructures(image.luminance, image.width, image.height, recipe.wavelets);
console.log(`STRUCTURE_ANALYSIS_READY: ${result.catalog.length} scale regions in ${((performance.now() - started) / 1000).toFixed(1)}s`);
const catalog = result.catalog.map(({ support, ...region }) => ({ ...region, supportRuns: supportRuns(support) }));
const catalogBytes = gzipSync(JSON.stringify({ schema: 'cssearth-structure-catalog@1', width: image.width, height: image.height,
  coordinates: 'Zero-based source crop pixels, x right and y down. Supports encoded as [start,length] raster runs.',
  interpretation: 'Regions in wavelet coefficient planes; cross-scale parents describe detected overlap, not confirmed physical objects.', catalog }), { level: 9 });
const methods: BenchmarkMethod[] = [await writeMethodProducts({ ...common, id: 'wavelets', name: 'Starlet · automatic regions',
  note: 'Independent B3-starlet prototype with connected regions and covariance morphology. Not a DAWIS implementation. No manual region masks.',
  maps: result.components, overlay: structureOverlay(image, result.catalog), metrics: {
    'Detected scale regions': result.catalog.length,
    'Compact regions': result.catalog.filter(item => item.morphology === 'compact').length,
    'Elongated regions': result.catalog.filter(item => item.morphology === 'elongated').length,
    'Diffuse regions': result.catalog.filter(item => item.morphology === 'diffuse').length,
    'Hierarchy links': result.catalog.filter(item => item.parentId).length,
    'Wavelet thresholds': result.diagnostics.thresholdByScale.map(value => value.toPrecision(3)).join(', '),
  } })];
await writeFile(resolve(recipe.outputDirectory, 'wavelets/catalog.json.gz'), catalogBytes);

if (recipe.waveletSensitivity) {
  const settings = { ...recipe.wavelets, significanceSigma: recipe.waveletSensitivity.significanceSigma };
  const sensitivity = decomposeStructures(image.luminance, image.width, image.height, settings);
  methods.push(await writeMethodProducts({ ...common, id: 'wavelets-sensitivity', name: 'Starlet · lower threshold',
    note: `Controlled sensitivity run: only the threshold multiplier changes from ${recipe.wavelets.significanceSigma} to ${settings.significanceSigma}. The estimated scale is a display-texture proxy, not calibrated noise.`,
    maps: sensitivity.components, overlay: structureOverlay(image, sensitivity.catalog), metrics: {
      'Detected scale regions': sensitivity.catalog.length,
      'Compact regions': sensitivity.catalog.filter(item => item.morphology === 'compact').length,
      'Elongated regions': sensitivity.catalog.filter(item => item.morphology === 'elongated').length,
      'Diffuse regions': sensitivity.catalog.filter(item => item.morphology === 'diffuse').length,
      'Hierarchy links': sensitivity.catalog.filter(item => item.parentId).length,
      'Wavelet thresholds': sensitivity.diagnostics.thresholdByScale.map(value => value.toPrecision(3)).join(', '),
    } }));
  await writeFile(resolve(recipe.outputDirectory, 'wavelets-sensitivity/catalog.json.gz'), gzipSync(JSON.stringify({
    schema: 'cssearth-structure-catalog@1', width: image.width, height: image.height, settings,
    diagnostics: sensitivity.diagnostics,
    coordinates: 'Zero-based source crop pixels, x right and y down. Supports encoded as [start,length] raster runs.',
    interpretation: 'Scale-plane regions, not confirmed physical objects.',
    catalog: sensitivity.catalog.map(({ support, ...region }) => ({ ...region, supportRuns: supportRuns(support) })),
  }), { level: 9 }));
}

// Exact current median kernel, without the old support mask/sky subtraction: isolate separation from region selection.
const medianRgb = await sharp(image.rgb, { raw: { width: image.width, height: image.height, channels: 3 } })
  .median(recipe.medianSize).raw().toBuffer();
const median: ComponentMaps = { diffuse: new Float32Array(image.luminance.length), compact: new Float32Array(image.luminance.length),
  elongated: new Float32Array(image.luminance.length), residual: new Float32Array(image.luminance.length) };
for (let p = 0; p < image.luminance.length; p++) {
  median.diffuse[p] = (.2126 * medianRgb[3 * p]! + .7152 * medianRgb[3 * p + 1]! + .0722 * medianRgb[3 * p + 2]!) / 255;
  median.compact[p] = Math.max(0, image.luminance[p]! - median.diffuse[p]!);
  median.residual[p] = image.luminance[p]! - median.diffuse[p]! - median.compact[p]!;
}
methods.push(await writeMethodProducts({ ...common, id: 'median', name: 'Median · separation control', maps: median,
  note: `${recipe.medianSize}×${recipe.medianSize} RGB median kernel from the existing pipeline. Sky subtraction and support masking disabled for the shared crop. No filament detector.` }));
const getsfArgument = args.find(arg => arg.startsWith('--getsf-import='));
if (getsfArgument) methods.push(await importGetsf(getsfArgument.slice('--getsf-import='.length), recipe, image));
else {
  const statusPath = resolve(recipe.outputDirectory, 'getsf/status.json');
  const bytes = await readFile(statusPath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
    return null;
  });
  const attempt = bytes ? parseLabModelJson(bytes.toString()) : null;
  const matches = recipe.getsf !== undefined && attempt?.sourceSha256 === recipe.input.sha256 &&
    attempt?.getsfParametersSha256 === digest(JSON.stringify(recipe.getsf)) && typeof attempt?.summary === 'string';
  methods.push({ id: 'getsf', name: 'getsf · official extraction', status: 'unavailable', panels: [],
    note: matches ? attempt.summary :
      'This bake has no verified getsf import. Run the local research comparator and rebuild with --getsf-import; no substitute result is shown.',
    ...(matches ? { metrics: attempt.metrics } : {}) });
}

const codePaths = ['cli/prepare-structures.ts', 'reconstruction/benchmark-products.ts', 'reconstruction/structure-wavelets.ts'];
const codePins = Object.fromEntries(await Promise.all(codePaths.map(async name =>
  [`labs/nebula/src/${name}`, digest(await readFile(`labs/nebula/src/${name}`))])));
const manifest = { schema: 'cssearth-structure-benchmark@1', title: recipe.title,
    source: { imagePath: 'source.png', name: recipe.input.name ?? recipe.title, widthPx: image.width, heightPx: image.height,
    description: recipe.input.conversion, credit: recipe.input.original.credit, sourcePageUrl: recipe.input.original.publisherUrl },
  methods, metadata: { source: recipe.input.original.publisherUrl,
    crop: `Native ${image.width}×${image.height} pixels; original origin (${recipe.input.crop.left}, ${recipe.input.crop.top}). No resampling.`,
    limitations: ['All quantities use display sRGB, not calibrated photometry or measured gas density.',
      'Compact/filament labels describe morphology; they do not distinguish foreground stars from intrinsic knots.',
      'Residuals must remain accounted for. Exact reconstruction alone cannot validate a decomposition.',
      'This experiment compares automatic 2D extraction. No new 3D depth model has been baked.'] },
  provenance: { recipePath, recipeSha256: digest(recipeBytes), input: recipe.input, codePins,
    catalogSha256: digest(catalogBytes), settings: recipe.wavelets, diagnostics: result.diagnostics } };
await writeFile(resolve(recipe.outputDirectory, 'benchmark.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`STRUCTURE_BENCHMARK_COMPLETE: ${recipe.outputDirectory}/benchmark.json`);
