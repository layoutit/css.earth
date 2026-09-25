import { parseLabModelJson } from '../../resources/model-paths.ts';
/** Copy a pinned rectangular float32 density window without interpolation or normalization. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { copyDensityWindow } from '@cssearth/bake/volume/node';

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
  const recipe = parseLabModelJson(recipeBytes.toString()) as WindowRecipe;
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
  const {outputDimensions,raw,encoded,cellSizeKpc,sourceWindowBoundsKpc,translatedBoundsKpc,sampleValidation,minimum,maximum,sum,nonzero} = copyDensityWindow(source,{dimensions,boundsMin,boundsMax,cellMin,cellMax,translation,level:recipe.output.level});

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
