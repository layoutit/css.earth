/** The VIR mosaic recipe (vir-mosaic.mts) and the reduced cube header its steps exchange. */
import type { PixelModelKeys } from '@cssearth/spice';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';

export const RECIPE_SCHEMA = 'cssearth-vir-mosaic@1';
export const REDUCED_SCHEMA = 'cssearth-vir-reduced@1';

export interface Continuum { readonly left: readonly [number, number]; readonly right: readonly [number, number] }
export interface BandParameter { readonly id: string; readonly continuum: Continuum; readonly productId: string; readonly image: string; readonly label: string }
/** `fill` phases only contribute where no `primary` phase saw a cell (Frigeri et al. fill HAMO gaps with Survey this way). */
export interface VirPhase { readonly volume: string; readonly role: 'primary' | 'fill'; readonly kernels: readonly string[]; readonly cubes: readonly string[] }
export interface VirRecipe {
  readonly schema: typeof RECIPE_SCHEMA; readonly archive: string; readonly kernelSet: string; readonly commonKernels: readonly string[];
  readonly target: { readonly name: string; readonly naifId: number; readonly bodyFrame: string; readonly referenceRadiusKm: number };
  readonly instrument: { readonly naifId: number; readonly spacecraft: number; readonly pixels: PixelModelKeys };
  readonly phases: readonly VirPhase[];
  readonly bands: { readonly boxcar: number; readonly range: readonly [number, number] };
  readonly policy: { readonly maximumIncidenceDegrees: number; readonly maximumEmissionDegrees: number; readonly stripeNeighbours: number; readonly minimumCellCount: number; readonly minimumGain: number; readonly maximumQuadKm: number; readonly destripeNeighbours: number; readonly minimumColumnPixels: number; readonly maximumColumnGap: number; readonly equalizePixelsPerDegree: number; readonly minimumOverlapCells: number; readonly referencePhaseDegrees: number; readonly outlierModifiedZ: number; readonly seamBoxCells: number };
  readonly output: { readonly pixelsPerDegree: number; readonly latitudeLimitDegrees: number; readonly dataSetId: string; readonly receipt: string };
  readonly parameters: readonly BandParameter[];
}

const pair = (value: unknown, label: string): [number, number] => {
  const list = requireArray(value, label).map((v, i) => requireFiniteNumber(v, `${label}[${i}]`));
  if (list.length !== 2 || !(list[0] <= list[1])) throw new Error(`${label} must be an increasing pair.`);
  return [list[0], list[1]];
};
const strings = (v: unknown, what: string) => requireArray(v, what).map((s, i) => requireString(s, `${what}[${i}]`));

export function parseRecipe(value: unknown): VirRecipe {
  const r = requireRecord(value, 'VIR mosaic recipe');
  if (r.schema !== RECIPE_SCHEMA) throw new Error(`VIR mosaic recipe schema must be ${RECIPE_SCHEMA}.`);
  const n = (record: Record<string, unknown>, key: string) => requireFiniteNumber(record[key], key);
  const target = requireRecord(r.target, 'target'), instrument = requireRecord(r.instrument, 'instrument'), pixels = requireRecord(instrument.pixels, 'pixels');
  const bands = requireRecord(r.bands, 'bands'), policy = requireRecord(r.policy, 'policy'), output = requireRecord(r.output, 'output');
  const focal = requireRecord(pixels.focalLength, 'focalLength'), pitch = requireRecord(pixels.pixelPitch, 'pixelPitch');
  if (focal.unit !== 'mm' || (pitch.unit !== 'micrometre' && pitch.unit !== 'mm')) throw new Error('Unsupported pixel model units.');
  const origin = n(pixels, 'origin');
  if (origin !== 0 && origin !== 1) throw new Error('pixels.origin must be 0 or 1.');
  return {
    schema: RECIPE_SCHEMA, archive: requireString(r.archive, 'archive'), kernelSet: requireString(r.kernelSet, 'kernelSet'), commonKernels: strings(r.commonKernels, 'commonKernels'),
    target: { name: requireString(target.name, 'target.name'), naifId: n(target, 'naifId'), bodyFrame: requireString(target.bodyFrame, 'target.bodyFrame'), referenceRadiusKm: n(target, 'referenceRadiusKm') },
    instrument: { naifId: n(instrument, 'naifId'), spacecraft: n(instrument, 'spacecraft'), pixels: {
      focalLength: { key: requireString(focal.key, 'focalLength.key'), unit: 'mm' }, pixelPitch: { key: requireString(pitch.key, 'pixelPitch.key'), unit: pitch.unit === 'mm' ? 'mm' : 'micrometre' },
      center: requireString(pixels.center, 'center'), boresight: requireString(pixels.boresight, 'boresight'), samples: requireString(pixels.samples, 'samples'),
      lines: requireString(pixels.lines, 'lines'), frame: requireString(pixels.frame, 'frame'), origin, column: requireString(pixels.column, 'column'), row: requireString(pixels.row, 'row') } },
    phases: requireArray(r.phases, 'phases').map((p, i) => { const phase = requireRecord(p, `phase ${i}`), role = phase.role ?? 'primary';
      if (role !== 'primary' && role !== 'fill') throw new Error(`phase ${i}: role must be primary or fill.`);
      return { volume: requireString(phase.volume, 'volume'), role, kernels: strings(phase.kernels, 'kernels'), cubes: strings(phase.cubes, 'cubes') }; }),
    bands: { boxcar: n(bands, 'boxcar'), range: pair(bands.range, 'bands.range') },
    policy: { maximumIncidenceDegrees: n(policy, 'maximumIncidenceDegrees'), maximumEmissionDegrees: n(policy, 'maximumEmissionDegrees'), stripeNeighbours: n(policy, 'stripeNeighbours'), minimumCellCount: n(policy, 'minimumCellCount'), minimumGain: n(policy, 'minimumGain'), maximumQuadKm: n(policy, 'maximumQuadKm'), destripeNeighbours: n(policy, 'destripeNeighbours'), minimumColumnPixels: n(policy, 'minimumColumnPixels'), maximumColumnGap: n(policy, 'maximumColumnGap'), equalizePixelsPerDegree: n(policy, 'equalizePixelsPerDegree'), minimumOverlapCells: n(policy, 'minimumOverlapCells'), referencePhaseDegrees: n(policy, 'referencePhaseDegrees'), outlierModifiedZ: n(policy, 'outlierModifiedZ'), seamBoxCells: n(policy, 'seamBoxCells') },
    output: { pixelsPerDegree: n(output, 'pixelsPerDegree'), latitudeLimitDegrees: n(output, 'latitudeLimitDegrees'), dataSetId: requireString(output.dataSetId, 'dataSetId'), receipt: requireString(output.receipt, 'receipt') },
    parameters: requireArray(r.parameters, 'parameters').map((p, i) => {
      const parameter = requireRecord(p, `parameter ${i}`), continuum = requireRecord(parameter.continuum, 'continuum');
      return { id: requireString(parameter.id, 'id'), productId: requireString(parameter.productId, 'productId'), image: requireString(parameter.image, 'image'), label: requireString(parameter.label, 'label'),
        continuum: { left: pair(continuum.left, 'continuum.left'), right: pair(continuum.right, 'continuum.right') } };
    }),
  };
}

/** One cube's kept bands and geometry. Records are per pixel: lat, lon, cos(incidence), cos(emission), then I/F per kept band. */
export interface Reduced { schema: typeof REDUCED_SCHEMA; product: string; volume: string; lines: number; samples: number; wavelengths: number[][]; kept: number[]; records: number }
