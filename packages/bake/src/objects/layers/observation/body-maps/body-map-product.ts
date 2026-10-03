import { parseBodyMapProduct, assertCombinable as checkCombinable, assertProductsCombinable as checkProductsCombinable, formatBodyMapProduct as formatProduct, type BodyMapObservation, type BodyMapGrid, type BodyMapFrame, type BodyMapProduct, type MeasurementDefinition, type CombinationPolicy } from '@cssearth/objects';
import { combineBodyMaps, type BodyMap } from './body-map.ts';
const ARCSEC_PER_RADIAN = 206_264.806_247;

/** Kilometres on the surface that one resolution element spans where the body faces the telescope. It needs the range as
 * well as the angle, and it grows toward the limb as 1 / cos(emission angle); this is its smallest value. */
export function surfaceResolutionKm(observation: Pick<BodyMapObservation, 'rangeKm' | 'angularResolution'>): { readonly majorKm: number; readonly minorKm: number; readonly where: 'sub-observer point' } {
  const km = (arcsec: number) => arcsec / ARCSEC_PER_RADIAN * observation.rangeKm;
  return { majorKm: km(observation.angularResolution.majorArcsec), minorKm: km(observation.angularResolution.minorArcsec), where: 'sub-observer point' };
}

/** How many resolution elements span the body's diameter: below about three, a map has no surface detail to speak of. */
export const resolutionElementsAcrossDisc = (observation: Pick<BodyMapObservation, 'rangeKm' | 'angularResolution'>, radiusKm: number): number =>
  2 * radiusKm / surfaceResolutionKm(observation).majorKm;


/** Read an authored product using the scientific owner's surface-resolution calculation. */
export const readBodyMapProduct = (value: unknown): BodyMapProduct => parseBodyMapProduct(value, surfaceResolutionKm);
export const assertCombinable = (definitions: readonly MeasurementDefinition[], frames: readonly BodyMapFrame[], grids: readonly BodyMapGrid[], observations: readonly BodyMapObservation[], policy: CombinationPolicy): void => checkCombinable(definitions, frames, grids, observations, policy, surfaceResolutionKm);
export const assertProductsCombinable = (products: readonly BodyMapProduct[], policy: CombinationPolicy): void => checkProductsCombinable(products, policy, surfaceResolutionKm);
export const formatBodyMapProduct = (product: BodyMapProduct): string => formatProduct(product, surfaceResolutionKm);

/** One placed map with what it means: what `combineUnderPolicy` takes. `map.facing` says how squarely each cell was seen. */
export interface MeasuredMap { readonly map: BodyMap; readonly definition: MeasurementDefinition; readonly frame: BodyMapFrame; readonly observation: BodyMapObservation }

/** THE way several placed maps become one. It refuses what the maps' meaning does not allow, and then does what the policy
 * says, so the policy a record states is the operation that ran:
 *
 * - `time-invariant` and `same-epoch-only`: the maps measure one thing, so a cell is their mean, each counting by how squarely
 *   it saw the cell (body-map.mts combineBodyMaps).
 * - `mosaic-of-snapshots`: the maps are different moments, so nothing is averaged. A cell keeps the value and the error of the
 *   one snapshot that saw it most squarely, and `chosen` says which. Where snapshots overlap they are still compared, and
 *   the differences are returned, because two moments disagreeing is a measurement and not an error to smooth away. */
export function combineUnderPolicy(inputs: readonly MeasuredMap[], policy: CombinationPolicy, maximumEmissionDegrees: number) {
  if (!inputs.length) throw new RangeError('Nothing to combine.');
  const grid = (map: BodyMap): BodyMapGrid => ({ width: map.width, height: map.height, longitude: 'east-positive-from-0', rows: 'north-to-south' });
  assertCombinable(inputs.map(input => input.definition), inputs.map(input => input.frame), inputs.map(input => grid(input.map)), inputs.map(input => input.observation), policy);
  const averaged = combineBodyMaps(inputs.map(input => input.map), maximumEmissionDegrees);
  if (policy.time.rule !== 'mosaic-of-snapshots') return { ...averaged, chosen: null as Int16Array | null };
  const first = inputs[0]!.map, cells = first.width * first.height, depth = new Float32Array(cells).fill(NaN), error = new Float32Array(cells).fill(NaN), facing = new Float32Array(cells), chosen = new Int16Array(cells).fill(-1);
  let seen = 0, area = 0, total = 0; const edge = Math.cos(maximumEmissionDegrees * Math.PI / 180);
  for (let cell = 0; cell < cells; cell++) {
    const share = Math.cos((90 - (Math.floor(cell / first.width) + 0.5) * 180 / first.height) * Math.PI / 180); total += share;
    // The emission limit asked for here governs, whatever limit each map was placed with: a cell seen more obliquely than that by
    // every snapshot stays unseen and counts toward no coverage.
    inputs.forEach(({ map }, index) => { if (Number.isFinite(map.depth[cell]!) && map.facing![cell]! >= edge && map.facing![cell]! > facing[cell]!) { facing[cell] = map.facing![cell]!; depth[cell] = map.depth[cell]!; error[cell] = map.error[cell]!; chosen[cell] = index; } });
    if (chosen[cell]! >= 0) { seen++; area += share; }
  }
  return { map: { width: first.width, height: first.height, depth, error, seenCells: seen, areaShare: area / total, facing } as BodyMap, overlaps: averaged.overlaps, chosen };
}
