/**
 * One photometric normalization for every photograph route: a published model,
 * the reference geometry an observation is carried to, and the geometry and gain
 * limits outside which a pixel is withheld rather than corrected. The gain is
 * radianceFactor(reference) / radianceFactor(observed); multiplying an observed
 * I/F by it gives the I/F the same surface would show at the reference geometry.
 */
import { diskGain, diskValue, type DiskModel } from './disk.ts';
import { phaseGain, phaseValue, type PhaseModel } from './phase.ts';
import { hapkeRadianceFactor, type HapkeModel } from './hapke.ts';

export type PhotometricModel =
  /** A disk function times an optional phase function. */
  | { readonly family: 'separable'; readonly disk: DiskModel; readonly phase?: PhaseModel }
  | HapkeModel;

export interface ScatteringAngles { readonly incidence: number; readonly emission: number; readonly phase: number }

export interface PhotometricNormalization {
  readonly model: PhotometricModel;
  /** The geometry every observation is carried to, in radians. */
  readonly reference: ScatteringAngles;
  /** Pixels beyond these angles, outside the phase range, or needing a gain outside [minimumGain, maximumGain], are withheld. */
  readonly limits: {
    readonly maximumIncidence: number; readonly maximumEmission: number;
    readonly minimumPhase: number; readonly maximumPhase: number;
    readonly minimumGain: number; readonly maximumGain: number;
  };
}

/** Radiance factor up to the model's albedo scale for separable models, absolute I/F for Hapke. */
export function radianceFactor(model: PhotometricModel, { incidence, emission, phase }: ScatteringAngles): number {
  // A facet lit at 90° or more receives no light and one seen at 90° or more sends none to the camera; ISIS's models return 0 there too.
  if (!(incidence < Math.PI / 2) || !(emission < Math.PI / 2)) return 0;
  const mu0 = Math.cos(incidence), mu = Math.cos(emission);
  if (model.family === 'hapke') return hapkeRadianceFactor(model, mu0, mu, phase);
  return diskValue(model.disk, { mu0, mu, phase }) * (model.phase ? phaseValue(model.phase, phase) : 1);
}

/** Incidence, emission and phase can meet at one surface point only when |i - e| <= g <= i + e. */
export const possibleGeometry = ({ incidence, emission, phase }: ScatteringAngles, tolerance = 1e-9) =>
  [incidence, emission, phase].every(Number.isFinite) && incidence >= 0 && emission >= 0 && phase >= 0 &&
  phase + tolerance >= Math.abs(incidence - emission) && phase <= incidence + emission + tolerance;

/** Precompute the reference once; the returned function gives a pixel's gain, or null when it is withheld. */
export function createNormalization(normalization: PhotometricNormalization) {
  const { model, reference, limits } = normalization;
  if (![limits.maximumIncidence, limits.maximumEmission].every(angle => angle > 0 && angle < Math.PI / 2) ||
      !(limits.minimumPhase >= 0 && limits.maximumPhase > limits.minimumPhase && limits.maximumPhase < Math.PI) ||
      !(limits.minimumGain > 0 && limits.minimumGain <= 1 && limits.maximumGain >= 1)) throw new TypeError('Invalid photometric normalization limits.');
  if (!possibleGeometry(reference)) throw new TypeError('The reference geometry is not a possible scattering geometry.');
  if (reference.incidence > limits.maximumIncidence || reference.emission > limits.maximumEmission ||
      reference.phase < limits.minimumPhase || reference.phase > limits.maximumPhase) throw new TypeError('The reference geometry lies outside the normalization limits.');
  const referenceMu0 = Math.cos(reference.incidence), referenceMu = Math.cos(reference.emission);
  const referenceValue = model.family === 'hapke' ? hapkeRadianceFactor(model, referenceMu0, referenceMu, reference.phase) : NaN;
  if (model.family === 'hapke' && !(referenceValue > 0)) throw new Error('The reference geometry receives no light under this model.');
  return function gain({ incidence, emission, phase }: ScatteringAngles): number | null {
    if (![incidence, emission, phase].every(Number.isFinite) || incidence < 0 || emission < 0 ||
        phase < limits.minimumPhase || phase > limits.maximumPhase ||
        incidence > limits.maximumIncidence || emission > limits.maximumEmission) return null;
    const mu0 = Math.cos(incidence), mu = Math.cos(emission);
    if (!(mu0 > 0) || !(mu > 0)) return null;
    let value: number;
    if (model.family === 'hapke') value = referenceValue / hapkeRadianceFactor(model, mu0, mu, phase);
    else {
      value = diskGain(model.disk, { mu0, mu, phase }, { mu0: referenceMu0, mu: referenceMu, phase: reference.phase });
      if (model.phase) value *= phaseGain(model.phase, phase, reference.phase);
    }
    return Number.isFinite(value) && value > 0 && value >= limits.minimumGain && value <= limits.maximumGain ? value : null;
  };
}
