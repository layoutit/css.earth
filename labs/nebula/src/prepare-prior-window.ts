/** Copy a pinned rectangular float32 density window without interpolation or normalization. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';

type Vec3 = [number, number, number];
interface WindowRecipe {
  schema: 'cssearth-prior-window-recipe@1';
  input: {
    path: string; sha256: string; bytes: number; layout: 'float32-le-x-fastest-density';
    dimensions: Vec3; boundsKpc: { min: Vec3; max: Vec3 };
  };
  cellBounds: { minInclusive: Vec3; maxExclusive: Vec3 };
  /** Output coordinates equal source coordinates minus this translation. */
  translationKpc: Vec3;
  output: { path: string; receiptPath: string; compression: 'gzip'; level: number };
  provenance?: Record<string, unknown>;
  limitations?: string[];
}

const digest = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const triple = (value: unknown, name: string, integers = false): Vec3 => {
  if (!Array.isArray(value) || value.length !== 3 || value.some(item =>
    typeof item !== 'number' || !Number.isFinite(item) || integers && !Number.isInteger(item))) {
    throw new TypeError(`${name} must contain three finite${integers ? ' integer' : ''} values.`);
  }
  return value as Vec3;
};

export async function preparePriorWindow(recipePath: string): Promise<void> {
  const recipeBytes = await readFile(recipePath);
  const recipe = JSON.parse(recipeBytes.toString()) as WindowRecipe;
  if (recipe.schema !== 'cssearth-prior-window-recipe@1') throw new TypeError('Unsupported prior-window recipe.');
  const dimensions = triple(recipe.input?.dimensions, 'input dimensions', true);
  const boundsMin = triple(recipe.input?.boundsKpc?.min, 'input bounds min');
  const boundsMax = triple(recipe.input?.boundsKpc?.max, 'input bounds max');
  const cellMin = triple(recipe.cellBounds?.minInclusive, 'cell minimum', true);
  const cellMax = triple(recipe.cellBounds?.maxExclusive, 'cell maximum', true);
  const translation = triple(recipe.translationKpc, 'translation');
  if (recipe.input.layout !== 'float32-le-x-fastest-density' ||
      dimensions.some(value => value < 1) ||
      boundsMin.some((value, axis) => !(value < boundsMax[axis]!)) ||
      cellMin.some((value, axis) => value < 0 || !(value < cellMax[axis]!) || cellMax[axis]! > dimensions[axis]!)) {
    throw new TypeError('Invalid input layout, dimensions, bounds, or cell window.');
  }
  if (recipe.output?.compression !== 'gzip' || !Number.isInteger(recipe.output.level) ||
      recipe.output.level < 0 || recipe.output.level > 9 ||
      !recipe.output.path || !recipe.output.receiptPath || recipe.output.path === recipe.output.receiptPath) {
    throw new TypeError('Output must declare distinct gzip data and receipt paths with a level from 0 to 9.');
  }

  const source = await readFile(recipe.input.path);
  const expectedBytes = dimensions.reduce((product, value) => product * value, 4);
  if (source.length !== recipe.input.bytes || source.length !== expectedBytes || digest(source) !== recipe.input.sha256) {
    throw new Error('Pinned float32 density source differs in hash, byte length, or dimensions.');
  }
  const outputDimensions = dimensions.map((_, axis) => cellMax[axis]! - cellMin[axis]!) as Vec3;
  const [sourceWidth, sourceHeight] = dimensions;
  const [outputWidth, outputHeight, outputDepth] = outputDimensions;
  const raw = Buffer.alloc(outputWidth * outputHeight * outputDepth * 4);
  for (let z = 0; z < outputDepth; z++) for (let y = 0; y < outputHeight; y++) {
    const sourceIndex = ((z + cellMin[2]) * sourceHeight + y + cellMin[1]) * sourceWidth + cellMin[0];
    const outputIndex = (z * outputHeight + y) * outputWidth;
    source.copy(raw, outputIndex * 4, sourceIndex * 4, (sourceIndex + outputWidth) * 4);
  }

  let minimum = Number.POSITIVE_INFINITY, maximum = Number.NEGATIVE_INFINITY, sum = 0, nonzero = 0;
  for (let index = 0; index < raw.length / 4; index++) {
    const value = raw.readFloatLE(index * 4);
    if (!Number.isFinite(value) || value < 0) throw new Error(`Density cell ${index} is not finite and nonnegative.`);
    minimum = Math.min(minimum, value); maximum = Math.max(maximum, value); sum += value;
    if (value !== 0) nonzero++;
  }
  const cellSizeKpc = dimensions.map((value, axis) => (boundsMax[axis]! - boundsMin[axis]!) / value) as Vec3;
  const sourceWindowBoundsKpc = {
    min: boundsMin.map((value, axis) => value + cellMin[axis]! * cellSizeKpc[axis]!) as Vec3,
    max: boundsMin.map((value, axis) => value + cellMax[axis]! * cellSizeKpc[axis]!) as Vec3,
  };
  const translatedBoundsKpc = {
    min: sourceWindowBoundsKpc.min.map((value, axis) => value - translation[axis]!) as Vec3,
    max: sourceWindowBoundsKpc.max.map((value, axis) => value - translation[axis]!) as Vec3,
  };
  const encoded = gzipSync(raw, { level: recipe.output.level });
  const decoded = gunzipSync(encoded);
  if (!decoded.equals(raw)) throw new Error('Gzip round-trip changed the copied density bytes.');

  const sampleCells = [
    [0, 0, 0],
    [outputWidth - 1, 0, 0],
    [Math.floor(outputWidth / 2), Math.floor(outputHeight / 2), Math.floor(outputDepth / 2)],
    [0, outputHeight - 1, Math.floor(outputDepth / 2)],
    [outputWidth - 1, outputHeight - 1, outputDepth - 1],
  ] as Vec3[];
  const sampleValidation = sampleCells.map(outputCell => {
    const sourceCell = outputCell.map((value, axis) => value + cellMin[axis]!) as Vec3;
    const sourceIndex = (sourceCell[2] * sourceHeight + sourceCell[1]) * sourceWidth + sourceCell[0];
    const outputIndex = (outputCell[2] * outputHeight + outputCell[1]) * outputWidth + outputCell[0];
    const sourceBytes = source.subarray(sourceIndex * 4, sourceIndex * 4 + 4);
    const outputBytes = raw.subarray(outputIndex * 4, outputIndex * 4 + 4);
    if (!sourceBytes.equals(outputBytes)) throw new Error(`Copied sample differs at output cell ${outputCell.join(',')}.`);
    return { sourceCell, outputCell, value: raw.readFloatLE(outputIndex * 4), rawLittleEndianHex: outputBytes.toString('hex') };
  });

  const outputPath = resolve(recipe.output.path), receiptPath = resolve(recipe.output.receiptPath);
  await Promise.all([mkdir(dirname(outputPath), { recursive: true }), mkdir(dirname(receiptPath), { recursive: true })]);
  await writeFile(outputPath, encoded);
  const receipt = {
    schema: 'cssearth-prior-window@1',
    recipe: { path: relative(process.cwd(), resolve(recipePath)), sha256: digest(recipeBytes) },
    source: recipe.input,
    operation: 'Raw little-endian float32 row copy in x-fastest order; no interpolation, arithmetic on values, normalization, or axis reordering.',
    cellBounds: recipe.cellBounds,
    dimensions: outputDimensions,
    cellSizeKpc,
    sourceWindowBoundsKpc,
    translationKpc: translation,
    translationOperation: 'translated output bounds = source window bounds - translationKpc; density values are unchanged.',
    boundsKpc: translatedBoundsKpc,
    output: {
      path: relative(process.cwd(), outputPath),
      sha256: digest(encoded),
      bytes: encoded.length,
      compression: 'gzip',
      compressionLevel: recipe.output.level,
      decodedSha256: digest(raw),
      decodedBytes: raw.length,
      layout: 'float32-le-x-fastest-density',
    },
    statistics: { minimum, maximum, sum, nonzeroCells: nonzero, totalCells: raw.length / 4 },
    sampleValidation,
    provenance: recipe.provenance ?? {},
    limitations: recipe.limitations ?? [],
  };
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(`PRIOR_WINDOW_COMPLETE: ${outputDimensions.join('x')} cells, ${encoded.length} gzip bytes`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [recipePath, extra] = process.argv.slice(2);
  if (!recipePath || extra) throw new TypeError('Usage: prepare-prior-window <recipe.json>');
  await preparePriorWindow(recipePath);
}
