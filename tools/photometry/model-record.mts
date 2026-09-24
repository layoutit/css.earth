/**
 * Photometric model records: a published model transcribed from its source into
 * `source/photometry/<id>.json` and bound in the body's manifest `documents` to
 * its publication record with role `method`, the locator naming the table or
 * equation. Angles are recorded in degrees as the sources print them and
 * converted to radians here; every key is checked, unknown keys are refused.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireRecord, requireString, requireFiniteNumber, requireArray } from '@cssearth/core';
import { assertDiskModel, type DiskModel } from './disk.mts';
import { assertPhaseModel, type PhaseModel } from './phase.mts';
import { assertHapkeModel, type HapkeModel, type ParticlePhaseFunction, type HFunctionApproximation } from './hapke.mts';
import type { PhotometricModel, PhotometricNormalization } from './normalization.mts';

export const PHOTOMETRIC_MODEL_SCHEMA = 'cssearth-photometric-model@1';
const rad = Math.PI / 180;

export interface PhotometricModelRecord {
  readonly id: string;
  readonly instrument: string;
  readonly filter: string;
  /** What the published equations produce; both are proportional, so normalization ratios do not depend on it. */
  readonly quantity: 'radiance-factor' | 'bidirectional-reflectance';
  readonly model: PhotometricModel;
  /** Angular ranges of the data the parameters were fitted to, in degrees. */
  readonly fit: { readonly phaseDegrees: readonly [number, number]; readonly incidenceDegrees?: readonly [number, number]; readonly emissionDegrees?: readonly [number, number] };
}

function strict(value: unknown, allowed: readonly string[], where: string): Record<string, unknown> {
  const record = requireRecord(value, where);
  const unknown = Object.keys(record).filter(key => !allowed.includes(key));
  if (unknown.length) throw new TypeError(`${where} has unknown keys: ${unknown.join(', ')}.`);
  return record;
}
const optional = <T,>(value: unknown, read: (value: unknown) => T) => value === undefined ? undefined : read(value);
function range(value: unknown, where: string, maximum: number): readonly [number, number] {
  const [low, high] = requireArray(value, where).map(entry => requireFiniteNumber(entry, where));
  if (requireArray(value, where).length !== 2 || !(low >= 0 && high > low && high <= maximum)) throw new TypeError(`${where} must be an increasing [minimum, maximum] within [0, ${maximum}].`);
  return [low, high];
}
function oneOf<T extends string>(value: unknown, options: readonly T[], where: string): T {
  const text = requireString(value, where);
  const match = options.find(option => option === text);
  if (!match) throw new TypeError(`${where} must be one of ${options.join(', ')}.`);
  return match;
}

function parseParticlePhase(value: unknown): ParticlePhaseFunction {
  const form = requireString(requireRecord(value, 'phase function').form, 'phase function form');
  if (form === 'henyey-greenstein') { const r = strict(value, ['form', 'asymmetry'], 'phase function'); return { form, asymmetry: requireFiniteNumber(r.asymmetry, 'asymmetry') }; }
  if (form === 'double-henyey-greenstein' || form === 'legendre' || form === 'isis-henyey-greenstein') { const r = strict(value, ['form', 'b', 'c'], 'phase function'); return { form, b: requireFiniteNumber(r.b, 'b'), c: requireFiniteNumber(r.c, 'c') }; }
  throw new TypeError(`Unknown particle phase function: ${form}.`);
}
const parseOpposition = (value: unknown, where: string) => { const r = strict(value, ['amplitude', 'width'], where); return { amplitude: requireFiniteNumber(r.amplitude, `${where} amplitude`), width: requireFiniteNumber(r.width, `${where} width`) }; };

export function parsePhotometricModel(value: unknown): PhotometricModel {
  const family = requireString(requireRecord(value, 'model').family, 'model family');
  if (family === 'hapke') {
    const r = strict(value, ['family', 'singleScatteringAlbedo', 'hFunction', 'phaseFunction', 'shadowHiding', 'coherentBackscatter', 'roughnessDegrees', 'porosity'], 'Hapke model');
    const model: HapkeModel = {
      family, singleScatteringAlbedo: requireFiniteNumber(r.singleScatteringAlbedo, 'single-scattering albedo'),
      hFunction: oneOf<HFunctionApproximation>(r.hFunction, ['hapke-1981', 'hapke-2002'], 'H-function approximation'),
      phaseFunction: parseParticlePhase(r.phaseFunction),
      ...(r.shadowHiding === undefined ? {} : { shadowHiding: parseOpposition(r.shadowHiding, 'shadow hiding') }),
      ...(r.coherentBackscatter === undefined ? {} : { coherentBackscatter: parseOpposition(r.coherentBackscatter, 'coherent backscatter') }),
      ...(r.roughnessDegrees === undefined ? {} : { roughness: requireFiniteNumber(r.roughnessDegrees, 'roughness') * rad }),
      ...(r.porosity === undefined ? {} : { porosity: requireFiniteNumber(r.porosity, 'porosity') }),
    };
    return assertHapkeModel(model);
  }
  if (family === 'separable') {
    const r = strict(value, ['family', 'disk', 'phase'], 'separable model');
    const diskRecord = requireRecord(r.disk, 'disk function'), diskFamily = requireString(diskRecord.family, 'disk family');
    const disk: DiskModel = diskFamily === 'lunar-lambert' ? { family: diskFamily, weight: requireFiniteNumber(strict(r.disk, ['family', 'weight'], 'disk function').weight, 'weight') }
      : diskFamily === 'minnaert' ? (() => { const d = strict(r.disk, ['family', 'coefficient', 'coefficientPerDegree'], 'disk function'); return { family: diskFamily, coefficient: requireFiniteNumber(d.coefficient, 'coefficient'), coefficientPerDegree: requireFiniteNumber(d.coefficientPerDegree ?? 0, 'coefficient per degree') }; })()
      : diskFamily === 'lambert' || diskFamily === 'lommel-seeliger' ? (strict(r.disk, ['family'], 'disk function'), { family: diskFamily })
      : (() => { throw new TypeError(`Unknown disk function: ${diskFamily}.`); })();
    const phase: PhaseModel | undefined = optional(r.phase, value => {
      const p = strict(value, ['family', 'asymmetry', 'amplitude', 'width'], 'phase function');
      return assertPhaseModel({ family: oneOf(p.family, ['hg-shadow-hiding'] as const, 'phase family'), asymmetry: requireFiniteNumber(p.asymmetry, 'asymmetry'), amplitude: requireFiniteNumber(p.amplitude, 'amplitude'), width: requireFiniteNumber(p.width, 'width') });
    });
    return { family, disk: assertDiskModel(disk), ...(phase ? { phase } : {}) };
  }
  throw new TypeError(`Unknown photometric model family: ${family}.`);
}

export function parsePhotometricModelRecord(value: unknown): PhotometricModelRecord {
  const r = strict(value, ['schema', 'id', 'instrument', 'filter', 'quantity', 'model', 'fit'], 'photometric model record');
  if (r.schema !== PHOTOMETRIC_MODEL_SCHEMA) throw new TypeError(`Expected ${PHOTOMETRIC_MODEL_SCHEMA}.`);
  const id = requireString(r.id, 'id');
  if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError(`Invalid photometric model id: ${id}.`);
  const fit = strict(r.fit, ['phaseDegrees', 'incidenceDegrees', 'emissionDegrees'], 'fit');
  return {
    id, instrument: requireString(r.instrument, 'instrument'), filter: requireString(r.filter, 'filter'),
    quantity: oneOf(r.quantity, ['radiance-factor', 'bidirectional-reflectance'] as const, 'quantity'),
    model: parsePhotometricModel(r.model),
    fit: { phaseDegrees: range(fit.phaseDegrees, 'fitted phase', 180),
      ...(fit.incidenceDegrees === undefined ? {} : { incidenceDegrees: range(fit.incidenceDegrees, 'fitted incidence', 90) }),
      ...(fit.emissionDegrees === undefined ? {} : { emissionDegrees: range(fit.emissionDegrees, 'fitted emission', 90) }) },
  };
}

/**
 * A recipe's photometry block in the published-model form:
 * { model: "photometry/<id>.json", referenceDegrees: { incidence, emission, phase },
 *   limits: { maximumIncidenceDegrees, maximumEmissionDegrees, phaseDegrees: [min, max], minimumGain, maximumGain } }.
 * The reference phase must lie within the model's fitted phase range.
 */
export function parsePhotometryReference(value: unknown, record: PhotometricModelRecord): PhotometricNormalization & { readonly modelPath: string; readonly extrapolatesPhase: boolean } {
  const r = strict(value, ['model', 'referenceDegrees', 'limits'], 'photometry'), reference = strict(r.referenceDegrees, ['incidence', 'emission', 'phase'], 'reference geometry');
  const limits = strict(r.limits, ['maximumIncidenceDegrees', 'maximumEmissionDegrees', 'phaseDegrees', 'minimumGain', 'maximumGain'], 'photometry limits');
  const modelPath = requireString(r.model, 'model path');
  if (!/^photometry\/[a-z][a-z0-9-]*\.json$/u.test(modelPath) || modelPath !== `photometry/${record.id}.json`) throw new TypeError(`Photometry must name its model record as photometry/${record.id}.json.`);
  const referenceDegrees = { incidence: requireFiniteNumber(reference.incidence, 'reference incidence'), emission: requireFiniteNumber(reference.emission, 'reference emission'), phase: requireFiniteNumber(reference.phase, 'reference phase') };
  const [fitLow, fitHigh] = record.fit.phaseDegrees;
  if (referenceDegrees.phase < fitLow || referenceDegrees.phase > fitHigh) throw new TypeError(`Reference phase ${referenceDegrees.phase}° lies outside the fitted ${fitLow}–${fitHigh}°.`);
  const phaseDegrees = range(limits.phaseDegrees, 'phase limits', 180);
  return {
    modelPath, model: record.model,
    reference: { incidence: referenceDegrees.incidence * rad, emission: referenceDegrees.emission * rad, phase: referenceDegrees.phase * rad },
    limits: { maximumIncidence: requireFiniteNumber(limits.maximumIncidenceDegrees, 'maximum incidence') * rad, maximumEmission: requireFiniteNumber(limits.maximumEmissionDegrees, 'maximum emission') * rad,
      minimumPhase: phaseDegrees[0] * rad, maximumPhase: phaseDegrees[1] * rad,
      minimumGain: requireFiniteNumber(limits.minimumGain, 'minimum gain'), maximumGain: requireFiniteNumber(limits.maximumGain, 'maximum gain') },
    extrapolatesPhase: phaseDegrees[0] < fitLow || phaseDegrees[1] > fitHigh,
  };
}

export async function loadPhotometricModelRecord(sourceDirectory: string, path: string): Promise<PhotometricModelRecord> {
  return parsePhotometricModelRecord(JSON.parse(await readFile(resolve(sourceDirectory, path), 'utf8')));
}
