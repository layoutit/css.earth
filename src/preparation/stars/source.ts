import { readCatalog } from '@cssearth/catalog';
import type { Catalog } from '@cssearth/catalog';
import type { PreparedStar, Rgb, StarsRecipe } from './types.js';
import { verifiedBytes } from '../volume/source.js';
import { catalogueColor, nearestColor } from './color.js';
function column(catalogue: Catalog, name: string): Float32Array {
  const value = catalogue.numeric(name);
  if (!(value instanceof Float32Array)) throw new TypeError(`Star ${name} column must be float32.`);
  return value;
}
export async function loadStarSource(sourceDirectory: string, recipe: StarsRecipe, colors: readonly Rgb[]) {
  const bytes = await verifiedBytes(sourceDirectory, recipe.catalogue);
  const catalogue = readCatalog(Uint8Array.from(bytes).buffer);
  if (catalogue.count !== recipe.catalogue.count) throw new TypeError('Star catalogue count does not match its source pin.');
  const positions = column(catalogue, 'posPc'), magnitudes = column(catalogue, 'absMag'), temperatures = column(catalogue, 'teffK'), colorIndices = column(catalogue, 'colorIndexBv'), names = catalogue.strings('name');
  if (positions.length !== catalogue.count*3 || [magnitudes.length,temperatures.length,colorIndices.length,names.length].some(length => length !== catalogue.count)) throw new TypeError('Star catalogue column lengths disagree.');
  const stars: PreparedStar[] = [];
  for (let i = 0; i < catalogue.count; i++) {
    const x = positions[i*3]!, y = positions[i*3+1]!, z = positions[i*3+2]!, absoluteMagnitude = magnitudes[i]!;
    if (![x,y,z,absoluteMagnitude].every(Number.isFinite) || !(Math.hypot(x,y,z) > 0)) throw new TypeError(`Star source row ${i} has no finite spatial/luminosity state.`);
    stars.push({ id: `${recipe.catalogue.idPrefix}:${i}`, positionUnits: [x,y,z], absoluteMagnitude,
      colorIndex: nearestColor(catalogueColor(temperatures[i]!, colorIndices[i]!), colors), name: names[i] || null, coverageAnchor: false });
  }
  const provenanceBytes = await verifiedBytes(sourceDirectory, recipe.provenance);
  await verifiedBytes(sourceDirectory, recipe.license);
  const provenance: unknown = JSON.parse(provenanceBytes.toString('utf8'));
  return { stars: applyCoverageAnchors(stars, recipe.coverage.faceDivisions), provenance, catalogueMetadata: catalogue.meta };
}

/** One real brightest apparent star in every deterministic all-sky cube cell. */
function applyCoverageAnchors(stars: readonly PreparedStar[], divisions: number): PreparedStar[] {
  const best = Array<number>(6 * divisions * divisions).fill(-1), magnitude = Array<number>(best.length).fill(Infinity);
  for (let index = 0; index < stars.length; index++) {
    const star = stars[index]!, [x, y, z] = star.positionUnits, cell = coverageCell(x, y, z, divisions), distance = Math.hypot(x, y, z);
    const apparent = star.absoluteMagnitude + 5 * Math.log10(distance) - 5;
    if (cell >= 0 && apparent < magnitude[cell]!) { magnitude[cell] = apparent; best[cell] = index; }
  }
  const anchors = new Set(best.filter(index => index >= 0));
  return stars.map((star, index) => anchors.has(index) ? { ...star, coverageAnchor: true } : star);
}

function coverageCell(x: number, y: number, z: number, divisions: number): number {
  const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z), dominant = Math.max(ax, ay, az);
  if (!(dominant > 0)) return -1;
  let face: number, u: number, v: number;
  if (ax >= ay && ax >= az) { face = x >= 0 ? 0 : 1; u = (x >= 0 ? -z : z) / dominant; v = y / dominant; }
  else if (ay >= az) { face = y >= 0 ? 2 : 3; u = x / dominant; v = (y >= 0 ? -z : z) / dominant; }
  else { face = z >= 0 ? 4 : 5; u = (z >= 0 ? x : -x) / dominant; v = y / dominant; }
  const coordinate = (value: number) => Math.min(divisions - 1, Math.max(0, Math.floor((value + 1) * divisions / 2)));
  return face * divisions * divisions + coordinate(v) * divisions + coordinate(u);
}
