#!/usr/bin/env node
/** Clean a published map figure into a masked crop for the gridded byte-image observation route.
 *
 *   node packages/bake/authoring/figure-map/clean-figure-map.mts <recipe.json>
 *
 * A published figure draws its measurements inside a labelled longitude/latitude frame and adds annotations
 * (grid lines, ticks, symbols) plus lossy-compression halos around them. Annotation colour cannot separate them from
 * data (a white line blended over pale data is darker than the palest data), so the recipe names each annotation as a
 * measured rectangle including its halo, and the measured background level. Every masked pixel becomes exact black,
 * which an `image-rgb-no-data` observation with `noData: 0` and a `grid` treats as missing. No kept pixel is
 * recoloured, interpolated or filled. The report counts each mask and the sphere fraction the kept pixels cover under
 * the recipe's grid (the same grid the raster recipe declares).
 *
 * Paths are relative to the recipe's directory and may not leave it. */
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

export interface Rectangle { left: number; top: number; width: number; height: number }
export interface FigureMapRecipe {
  schema: 'cssearth-figure-map-clean@1';
  source: string;
  output: string;
  /** The frame interior, in source-figure pixels. */
  crop: Rectangle;
  /** Annotations drawn over the data (lines, ticks, symbols) with their halo, in source-figure pixels, each with the reason it is withheld. */
  rectangles: Array<Rectangle & { reason: string }>;
  /** Pixels whose brightest channel is at most this value are the figure's black background or its halo. */
  background: { maximumChannel: number };
  /** Crop-pixel grid: sample = (east longitude - centerLongitude) * pixelsPerDegree + sampleOffset; line = -latitude * pixelsPerDegree + lineOffset. */
  grid: { centerLongitude: number; pixelsPerDegree: number; sampleOffset: number; lineOffset: number };
}
export interface FigureMapReport {
  width: number; height: number; rectanglePixels: number; backgroundPixels: number;
  keptPixels: number; keptSphereFraction: number;
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`Figure map recipe: ${field} must be an object, got ${JSON.stringify(value)}.`);
  return value as Record<string, unknown>;
}
function integer(value: unknown, field: string, minimum: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) throw new TypeError(`Figure map recipe: ${field} must be an integer >= ${minimum}, got ${JSON.stringify(value)}.`);
  return value;
}
function finite(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`Figure map recipe: ${field} must be a finite number, got ${JSON.stringify(value)}.`);
  return value;
}
function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`Figure map recipe: ${field} must be non-empty text, got ${JSON.stringify(value)}.`);
  return value;
}
function localPath(value: unknown, field: string): string {
  const path = text(value, field);
  if (isAbsolute(path) || path.split(/[\\/]/).includes('..')) throw new TypeError(`Figure map recipe: ${field} must stay inside the recipe directory, got ${JSON.stringify(path)}.`);
  return path;
}
function rectangle(value: unknown, field: string): Rectangle {
  const r = record(value, field);
  return { left: integer(r.left, `${field}.left`, 0), top: integer(r.top, `${field}.top`, 0),
    width: integer(r.width, `${field}.width`, 1), height: integer(r.height, `${field}.height`, 1) };
}

export function parseFigureMapRecipe(value: unknown): FigureMapRecipe {
  const r = record(value, 'recipe');
  if (r.schema !== 'cssearth-figure-map-clean@1') throw new TypeError(`Figure map recipe: schema must be cssearth-figure-map-clean@1, got ${JSON.stringify(r.schema)}.`);
  const background = record(r.background, 'background'), grid = record(r.grid, 'grid');
  if (!Array.isArray(r.rectangles)) throw new TypeError('Figure map recipe: rectangles must be an array.');
  const recipe: FigureMapRecipe = {
    schema: 'cssearth-figure-map-clean@1',
    source: localPath(r.source, 'source'), output: localPath(r.output, 'output'), crop: rectangle(r.crop, 'crop'),
    rectangles: r.rectangles.map((item, index) => ({ ...rectangle(item, `rectangles[${index}]`), reason: text(record(item, `rectangles[${index}]`).reason, `rectangles[${index}].reason`) })),
    background: { maximumChannel: integer(background.maximumChannel, 'background.maximumChannel', 0) },
    grid: { centerLongitude: finite(grid.centerLongitude, 'grid.centerLongitude'), pixelsPerDegree: finite(grid.pixelsPerDegree, 'grid.pixelsPerDegree'),
      sampleOffset: finite(grid.sampleOffset, 'grid.sampleOffset'), lineOffset: finite(grid.lineOffset, 'grid.lineOffset') },
  };
  if (recipe.background.maximumChannel > 254) throw new TypeError(`Figure map recipe: background.maximumChannel must be below 255, got ${recipe.background.maximumChannel}.`);
  if (!(recipe.grid.pixelsPerDegree > 0)) throw new TypeError(`Figure map recipe: grid.pixelsPerDegree must be positive, got ${recipe.grid.pixelsPerDegree}.`);
  if (recipe.source === recipe.output) throw new TypeError('Figure map recipe: output must differ from source.');
  return recipe;
}

/** Mask one decoded RGB figure; returns the cropped RGB with masked pixels set to exact black and the counts. */
export function cleanFigure(rgb: Uint8Array, width: number, height: number, recipe: FigureMapRecipe): { rgb: Uint8Array; report: FigureMapReport } {
  const { crop, background, grid } = recipe;
  if (rgb.length !== width * height * 3) throw new RangeError(`Figure has ${rgb.length} bytes, not ${width}x${height} RGB.`);
  if (crop.left + crop.width > width || crop.top + crop.height > height) throw new RangeError(`Crop ${JSON.stringify(crop)} leaves the ${width}x${height} figure.`);
  const out = new Uint8Array(crop.width * crop.height * 3);
  let rectanglePixels = 0, backgroundPixels = 0, keptPixels = 0, keptArea = 0;
  const degrees = Math.PI / 180;
  for (let y = 0; y < crop.height; y++) for (let x = 0; x < crop.width; x++) {
    const fx = crop.left + x, fy = crop.top + y, i = fy * width + fx;
    if (recipe.rectangles.some(r => fx >= r.left && fx < r.left + r.width && fy >= r.top && fy < r.top + r.height)) { rectanglePixels++; continue; }
    if (Math.max(rgb[i * 3]!, rgb[i * 3 + 1]!, rgb[i * 3 + 2]!) <= background.maximumChannel) { backgroundPixels++; continue; }
    out.set(rgb.subarray(i * 3, i * 3 + 3), (y * crop.width + x) * 3);
    keptPixels++;
    // Area of this pixel on the unit sphere, as a fraction of the whole sphere.
    const north = (grid.lineOffset - (y - .5)) / grid.pixelsPerDegree, south = (grid.lineOffset - (y + .5)) / grid.pixelsPerDegree;
    const clamp = (lat: number) => Math.max(-90, Math.min(90, lat));
    keptArea += (1 / grid.pixelsPerDegree) * degrees * (Math.sin(clamp(north) * degrees) - Math.sin(clamp(south) * degrees)) / (4 * Math.PI);
  }
  return { rgb: out, report: { width: crop.width, height: crop.height, rectanglePixels, backgroundPixels, keptPixels, keptSphereFraction: keptArea } };
}

export async function cleanFigureMap(recipePath: string): Promise<FigureMapReport> {
  const recipe = parseFigureMapRecipe(JSON.parse(await readFile(recipePath, 'utf8')));
  const root = dirname(resolve(recipePath)), source = resolve(root, recipe.source), output = resolve(root, recipe.output);
  for (const path of [source, output]) if (relative(root, path).startsWith('..')) throw new TypeError(`Figure map path leaves ${root}: ${path}`);
  const { data, info } = await sharp(source).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 3) throw new TypeError(`${source}: expected three colour channels, got ${info.channels}.`);
  const { rgb, report } = cleanFigure(data, info.width, info.height, recipe);
  await sharp(rgb, { raw: { width: report.width, height: report.height, channels: 3 } }).png({ compressionLevel: 9 }).toFile(output);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const recipePath = process.argv[2];
  if (!recipePath) throw new TypeError('Usage: node packages/bake/authoring/figure-map/clean-figure-map.mts <recipe.json>');
  const report = await cleanFigureMap(recipePath);
  process.stdout.write(`${JSON.stringify(report, null, 1)}\n`);
}
