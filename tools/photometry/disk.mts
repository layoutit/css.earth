/**
 * Disk functions of the photometric models the pipeline uses, as pure functions
 * of the cosine of incidence `mu0`, the cosine of emission `mu` and the phase
 * angle in radians. Each model's radiance factor is I/F = A(phase) · D(mu0, mu);
 * carrying an observed I/F to a reference geometry multiplies it by
 * D(reference) / D(observed), and by a phase ratio where the model has one
 * (phase.mts). Full models that do not separate, such as Hapke, live in hapke.mts.
 *
 * The arithmetic of each family is the form the pipeline used before this module,
 * so a route moved onto it prepares byte-identical outputs; disk.test.mts holds
 * the library to exact equality with those forms.
 */
export interface DiskGeometry { readonly mu0: number; readonly mu: number; readonly phase: number }

export type DiskModel =
  /** Lambert: D = mu0. */
  | { readonly family: 'lambert' }
  /** Lommel-Seeliger: D = 2 mu0 / (mu0 + mu), equal to 1 at normal incidence and emission. */
  | { readonly family: 'lommel-seeliger' }
  /** ISIS LunarLambert: D = (1 - L) mu0 + 2 L mu0 / (mu0 + mu); L = 0 is Lambert, L = 1 is Lommel-Seeliger. */
  | { readonly family: 'lunar-lambert'; readonly weight: number }
  /** Minnaert with a linear phase dependence: D = mu0^k mu^(k - 1), k = k0 + k1 · phase in degrees. */
  | { readonly family: 'minnaert'; readonly coefficient: number; readonly coefficientPerDegree: number };

export const DISK_FAMILIES = ['lambert', 'lommel-seeliger', 'lunar-lambert', 'minnaert'] as const;

/** Normal incidence and emission at zero phase: the reference at which every disk function above equals 1. */
export const NORMAL_GEOMETRY: DiskGeometry = Object.freeze({ mu0: 1, mu: 1, phase: 0 });

/** Minnaert exponent at a phase angle, in the pipeline's historical arithmetic order. */
export const minnaertExponent = (model: { coefficient: number; coefficientPerDegree: number }, phase: number) =>
  model.coefficient + model.coefficientPerDegree * phase * 180 / Math.PI;

export function diskValue(model: DiskModel, { mu0, mu, phase }: DiskGeometry): number {
  switch (model.family) {
    case 'lambert': return mu0;
    case 'lommel-seeliger': return 2 * mu0 / (mu0 + mu);
    case 'lunar-lambert': return (1 - model.weight) * mu0 + 2 * model.weight * mu0 / (mu0 + mu);
    case 'minnaert': { const k = minnaertExponent(model, phase); return mu0 ** k * mu ** (k - 1); }
  }
}

/**
 * D(reference) / D(observed): the factor that carries an observed radiance factor
 * to the reference geometry. Written per family so a reference at normal incidence
 * and emission reproduces the historical gain bit for bit.
 */
export function diskGain(model: DiskModel, observed: DiskGeometry, reference: DiskGeometry): number {
  switch (model.family) {
    case 'lommel-seeliger': return (observed.mu0 + observed.mu) / (2 * observed.mu0) * diskValue(model, reference);
    case 'minnaert': { const k = minnaertExponent(model, observed.phase); return 1 / (observed.mu0 ** k * observed.mu ** (k - 1)) * diskValue(model, reference); }
    default: return diskValue(model, reference) / diskValue(model, observed);
  }
}

/** Validate a disk model's parameters; the ranges are the physical ones, recipes may narrow them. */
export function assertDiskModel(model: DiskModel) {
  if (!DISK_FAMILIES.includes(model.family)) throw new TypeError(`Unknown disk function: ${String((model as { family: unknown }).family)}`);
  if (model.family === 'lunar-lambert' && !(Number.isFinite(model.weight) && model.weight >= 0 && model.weight <= 1)) throw new TypeError('Lunar-Lambert weight must lie in [0, 1].');
  if (model.family === 'minnaert' && !(Number.isFinite(model.coefficient) && Number.isFinite(model.coefficientPerDegree))) throw new TypeError('Minnaert coefficients must be finite.');
  return model;
}
