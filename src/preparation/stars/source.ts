import { STAR_IDS, starAstrometry, starStateKm, PARSEC_KM } from '@cssearth/astronomy';
import { readCatalog } from '@cssearth/catalog';
import type { Catalog } from '@cssearth/catalog';
import type { PreparedStar, Rgb, StarsRecipe } from './types.js';
import { sourceBytes } from '@cssearth/bake/volume/node';
import { catalogueColor, nearestColor } from './color.js';
function column(catalogue: Catalog, name: string): Float32Array {
  const value = catalogue.numeric(name);
  if (!(value instanceof Float32Array)) throw new TypeError(`Star ${name} column must be float32.`);
  return value;
}
export async function loadStarSource(sourceDirectory: string, recipe: StarsRecipe, colors: readonly Rgb[], epochJdTt: number) {
  const bytes = await sourceBytes(sourceDirectory, recipe.catalogue);
  const catalogue = readCatalog(Uint8Array.from(bytes).buffer);
  if (catalogue.count !== recipe.catalogue.count) throw new TypeError('Star catalogue count does not match its source pin.');
  const positions = column(catalogue, 'posPc'), magnitudes = column(catalogue, 'absMag'), temperatures = column(catalogue, 'teffK'), colorIndices = column(catalogue, 'colorIndexBv'), names = catalogue.strings('name');
  if (positions.length !== catalogue.count*3 || [magnitudes.length,temperatures.length,colorIndices.length,names.length].some(length => length !== catalogue.count)) throw new TypeError('Star catalogue column lengths disagree.');
  if (!Number.isFinite(epochJdTt)) throw new TypeError('Star reconciliation requires the scene epoch.');
  const hip = catalogue.numeric('hip');
  if (hip.length !== catalogue.count) throw new TypeError('Hipparcos identity column length disagrees.');
  const detailed = new Map<number, (typeof STAR_IDS)[number]>();
  for (const id of STAR_IDS) {
    const key = starAstrometry(id).hipparcosId;
    if (key === undefined) continue;
    if (detailed.has(key)) throw new TypeError(`Duplicate detailed Hipparcos identity: ${key}`);
    detailed.set(key, id);
  }
  const reconciliations: { bodyId: string; hipparcosId: number; sourceRow: number; originalPositionPc: number[]; positionPc: number[]; originalAbsoluteMagnitude: number; absoluteMagnitude: number; astrometry: ReturnType<typeof starAstrometry> }[] = [];
  const seen = new Set<number>();
  const stars: PreparedStar[] = [];
  for (let i = 0; i < catalogue.count; i++) {
    const x = positions[i*3]!, y = positions[i*3+1]!, z = positions[i*3+2]!, absoluteMagnitude = magnitudes[i]!;
    if (![x,y,z,absoluteMagnitude].every(Number.isFinite) || !(Math.hypot(x,y,z) > 0)) throw new TypeError(`Star source row ${i} has no finite spatial/luminosity state.`);
    const bodyId = detailed.get(hip[i]!);
    let positionUnits: [number, number, number] = [x,y,z], magnitude = absoluteMagnitude;
    if (bodyId !== undefined) {
      if (seen.has(hip[i]!)) throw new TypeError(`Duplicate HYG identity: ${hip[i]}`);
      seen.add(hip[i]!);
      const position = starStateKm(bodyId, epochJdTt).positionKm;
      positionUnits = [Math.fround(position[0] / PARSEC_KM), Math.fround(position[1] / PARSEC_KM), Math.fround(position[2] / PARSEC_KM)];
      // Keep the catalogue's apparent magnitude at the Sun when adopting a different distance.
      magnitude = Math.fround(absoluteMagnitude + 5 * Math.log10(Math.hypot(x,y,z) / Math.hypot(...positionUnits)));
      reconciliations.push({ bodyId, hipparcosId: hip[i]!, sourceRow: i, originalPositionPc: [x,y,z], positionPc: positionUnits,
        originalAbsoluteMagnitude: absoluteMagnitude, absoluteMagnitude: magnitude, astrometry: starAstrometry(bodyId) });
    }
    stars.push({ id: `${recipe.catalogue.idPrefix}:${i}`, positionUnits, absoluteMagnitude: magnitude,
      colorIndex: nearestColor(catalogueColor(temperatures[i]!, colorIndices[i]!), colors), name: names[i] || null, coverageAnchor: false });
  }
  if (seen.size !== detailed.size) throw new TypeError('A detailed Hipparcos identity is absent from the pinned HYG catalogue.');
  const provenanceBytes = await sourceBytes(sourceDirectory, recipe.provenance);
  await sourceBytes(sourceDirectory, recipe.license);
  const provenance: unknown = JSON.parse(provenanceBytes.toString('utf8'));
  return { stars: applyCoverageAnchors(stars, recipe.coverage.faceDivisions), provenance, catalogueMetadata: { ...catalogue.meta, epoch: 'ICRS/J2000.0 equinox and coordinate epoch' }, reconciliation: { sourceEpochDescription: catalogue.meta.epoch, epochJdTt, records: reconciliations, policy: 'Exact HIP identity join to detailed body astrometry; float32 parsec positions; preserve HYG apparent magnitude at the Sun. Unmatched rows remain at their catalogue epoch. The retained GXCT epoch description is legacy: HYG coordinates are J2000.0, not J1991.25.' } };
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
