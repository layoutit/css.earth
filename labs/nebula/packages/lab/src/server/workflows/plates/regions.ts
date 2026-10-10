/** Regions drawn on an object's picture: named closed paths in picture pixels, tracked in `source/regions.json` because
 * they are drawn by hand and the bake reads them. The lab's Regions tool and the CLI's `regions` both read and save them
 * here, one save at a time under the object's working-copy lock, each written whole. */
import { isRecord } from '@cssearth/core';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { holdLock, labDirectory, replaceFile } from './working-copy.ts';

export type RegionPoint = [number, number];
export interface PictureRegion { name: string; points: RegionPoint[] }
export interface PictureRegions { picture: string; width: number; height: number; regions: PictureRegion[] }

const NAME = /^[a-z0-9][a-z0-9-]*$/u;
const sourcePath = (root: string, id: string, file: string) => resolve(labDirectory(root, id), '../../source', file);

/** Validates regions from the lab or a file: lower-case unique names, each a closed path of at least three points,
 * kept to a tenth of a pixel. */
export function readRegionList(value: unknown): PictureRegion[] {
  if (!Array.isArray(value)) throw new TypeError('Regions are a list.');
  const names = new Set<string>();
  return value.map((region: unknown) => {
    if (!isRecord(region) || typeof region.name !== 'string' || !NAME.test(region.name) || !Array.isArray(region.points) || region.points.length < 3) throw new TypeError('A region is a lower-case name and at least three points.');
    if (names.has(region.name)) throw new TypeError(`Two regions are named ${region.name}.`);
    names.add(region.name);
    return { name: region.name, points: region.points.map((point: unknown): RegionPoint => {
      if (!Array.isArray(point) || point.length !== 2 || !point.every(v => typeof v === 'number' && Number.isFinite(v))) throw new TypeError('A point is [x, y] in picture pixels.');
      return [Math.round(point[0] * 10) / 10, Math.round(point[1] * 10) / 10];
    }) };
  });
}
async function picture(root: string, id: string) {
  const recipe: unknown = JSON.parse(await readFile(sourcePath(root, id, 'recipe.json'), 'utf8'));
  const source = isRecord(recipe) && isRecord(recipe.source) ? recipe.source : null, size = source?.dimensions;
  if (!source || typeof source.path !== 'string' || !Array.isArray(size) || size.length !== 2 || !size.every(v => Number.isSafeInteger(v) && (v as number) > 0)) throw new TypeError(`src/objects/${id}/source/recipe.json names no picture and its dimensions.`);
  return { path: source.path, width: size[0] as number, height: size[1] as number };
}

/** The object's picture (its path inside `source/`) and its saved regions; none when it has no regions file. */
export async function readRegions(root: string, id: string): Promise<PictureRegions> {
  const { path, width, height } = await picture(root, id);
  const text = await readFile(sourcePath(root, id, 'regions.json'), 'utf8').catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return null; throw error; });
  const saved: unknown = text === null ? null : JSON.parse(text);
  return { picture: path, width, height, regions: saved === null ? [] : readRegionList(isRecord(saved) ? saved.regions : null) };
}
/** Replaces the object's regions with `regions`. */
export function saveRegions(root: string, id: string, regions: unknown): Promise<PictureRegion[]> {
  const list = readRegionList(regions);
  return holdLock(labDirectory(root, id), async () => {
    const { path, width, height } = await picture(root, id);
    await replaceFile(sourcePath(root, id, 'regions.json'), `${JSON.stringify({ schema: 'cssearth-picture-regions@1', picture: path, dimensions: [width, height], regions: list }, null, 2)}\n`);
    return list;
  });
}
