/**
 * Phase functions A(phase) that multiply a separable disk function (disk.mts).
 * Angles in radians. Normalizing to a reference phase multiplies an observed
 * radiance factor by A(reference) / A(observed).
 */
export type PhaseModel =
  /**
   * Single-term Henyey-Greenstein particle phase function with a shadow-hiding
   * opposition term: A = (1 + B0 / (1 + tan(phase / 2) / h)) · (1 - g^2) / (1 + 2 g cos(phase) + g^2)^1.5.
   * Negative g scatters backward. This is the pipeline's historical approximation of
   * a Hapke phase dependence without multiple scattering or roughness; hapke.mts
   * implements the full model.
   */
  | { readonly family: 'hg-shadow-hiding'; readonly asymmetry: number; readonly amplitude: number; readonly width: number }
  /**
   * The Kaasalainen-Shkuratov single-exponential phase function A = e^(-slope · phase), phase in radians: the
   * phase term of Domingue et al. (2016) models KS1 to KS5 (their eqs. 41-44, parameter "l").
   */
  | { readonly family: 'exponential'; readonly slopePerRadian: number };

export function phaseValue(model: PhaseModel, phase: number): number {
  if (model.family === 'exponential') return Math.exp(-model.slopePerRadian * phase);
  const g = model.asymmetry;
  return (1 + model.amplitude / (1 + Math.tan(phase / 2) / model.width)) * (1 - g * g) / (1 + 2 * g * Math.cos(phase) + g * g) ** 1.5;
}

export const phaseGain = (model: PhaseModel, observedPhase: number, referencePhase: number) => phaseValue(model, referencePhase) / phaseValue(model, observedPhase);

export function assertPhaseModel(model: PhaseModel) {
  if (model.family === 'exponential') {
    if (!(Number.isFinite(model.slopePerRadian) && model.slopePerRadian >= 0)) throw new TypeError(`Exponential phase slope must be finite and non-negative, got ${model.slopePerRadian}.`);
    return model;
  }
  if (model.family !== 'hg-shadow-hiding') throw new TypeError(`Unknown phase function: ${String((model as { family: unknown }).family)}`);
  if (!(Math.abs(model.asymmetry) < 1) || !(model.amplitude >= 0) || !(model.width > 0)) throw new TypeError('Invalid Henyey-Greenstein shadow-hiding parameters.');
  return model;
}
