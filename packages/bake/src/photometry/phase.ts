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
  | { readonly family: 'exponential'; readonly slopePerRadian: number }
  /**
   * A quadratic fitted to a phase curve, A = a0 + a1 g + a2 g^2 with g in degrees (Filacchione et al. 2022, eq. 7). a0 is
   * the fit's own extrapolation to zero phase. A polynomial says nothing beyond the phase its data reached, where it can
   * turn negative, so there it is held at its value at `heldBeyondDegrees`.
   */
  | { readonly family: 'quadratic'; readonly constant: number; readonly perDegree: number; readonly perDegreeSquared: number; readonly heldBeyondDegrees: number };

export function phaseValue(model: PhaseModel, phase: number): number {
  if (model.family === 'exponential') return Math.exp(-model.slopePerRadian * phase);
  if (model.family === 'quadratic') { const degrees = Math.min(phase * 180 / Math.PI, model.heldBeyondDegrees); return model.constant + model.perDegree * degrees + model.perDegreeSquared * degrees * degrees; }
  const g = model.asymmetry;
  return (1 + model.amplitude / (1 + Math.tan(phase / 2) / model.width)) * (1 - g * g) / (1 + 2 * g * Math.cos(phase) + g * g) ** 1.5;
}

export const phaseGain = (model: PhaseModel, observedPhase: number, referencePhase: number) => phaseValue(model, referencePhase) / phaseValue(model, observedPhase);

export function assertPhaseModel(model: PhaseModel) {
  if (model.family === 'exponential') {
    if (!(Number.isFinite(model.slopePerRadian) && model.slopePerRadian >= 0)) throw new TypeError(`Exponential phase slope must be finite and non-negative, got ${model.slopePerRadian}.`);
    return model;
  }
  if (model.family === 'quadratic') {
    const { constant, perDegree, perDegreeSquared, heldBeyondDegrees } = model;
    if (![constant, perDegree, perDegreeSquared, heldBeyondDegrees].every(Number.isFinite) || !(heldBeyondDegrees > 0 && heldBeyondDegrees <= 180)) throw new TypeError('Quadratic phase coefficients must be finite, held beyond a phase in (0, 180] degrees.');
    // The curve must stay light from zero phase to where it is held; a quadratic's least value lies at an end or at its vertex.
    const vertex = perDegreeSquared === 0 ? 0 : -perDegree / (2 * perDegreeSquared), at = (degrees: number) => constant + perDegree * degrees + perDegreeSquared * degrees * degrees;
    const least = Math.min(at(0), at(heldBeyondDegrees), vertex > 0 && vertex < heldBeyondDegrees ? at(vertex) : Infinity);
    if (!(least > 0)) throw new TypeError(`Quadratic phase function must be positive from 0 to ${heldBeyondDegrees} degrees, got ${least} at its least.`);
    return model;
  }
  if (model.family !== 'hg-shadow-hiding') throw new TypeError(`Unknown phase function: ${String((model as { family: unknown }).family)}`);
  if (!(Math.abs(model.asymmetry) < 1) || !(model.amplitude >= 0) || !(model.width > 0)) throw new TypeError('Invalid Henyey-Greenstein shadow-hiding parameters.');
  return model;
}
