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
  | { readonly family: 'minnaert'; readonly coefficient: number; readonly coefficientPerDegree: number }
  /**
   * Lommel-Seeliger plus Lambert with both coefficients linear in phase (Buratti and Veverka 1983; Dhingra et al. 2021,
   * eq. 2 with B = 1 - A): D = A f mu0 / (mu0 + mu) + (1 - A) mu0, A = A0 + A1 · phase and f = f0 + f1 · phase, phase
   * in degrees. f is the surface phase function, so D carries the phase curve and is not 1 at normal geometry. Where
   * the printed line for f falls below zero the lunar term is zero and the Lambert term stands alone.
   */
  | { readonly family: 'lommel-seeliger-lambert'; readonly lunarFraction: number; readonly lunarFractionPerDegree: number; readonly surfacePhase: number; readonly surfacePhasePerDegree: number }
  /**
   * Akimov's parameter-free disk function (Shkuratov et al. 1999, 2011): D = cos(g/2) cos[(pi/(pi - g))(gamma - g/2)]
   * (cos beta)^(g/(pi - g)) / cos gamma, with the photometric longitude gamma = arctan[(mu0 - mu cos g)/(mu sin g)] and
   * latitude beta = arccos(mu / cos gamma). It is 1 over the whole disc at zero phase: no limb darkening under flood light.
   */
  | { readonly family: 'akimov' };

export const DISK_FAMILIES = ['lambert', 'lommel-seeliger', 'lunar-lambert', 'minnaert', 'lommel-seeliger-lambert', 'akimov'] as const;

/** Normal incidence and emission at zero phase: the reference at which every disk function above equals 1, except Lommel-Seeliger plus Lambert, which there gives A0 f0 / 2 + 1 - A0. */
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
    case 'akimov': {
      // At zero phase the longitude is undetermined and the function is 1 for every one.
      if (!(Math.sin(phase) > 1e-12)) return 1;
      const gamma = Math.atan((mu0 - mu * Math.cos(phase)) / (mu * Math.sin(phase))), cosBeta = Math.min(1, mu / Math.cos(gamma)), stretch = Math.PI / (Math.PI - phase);
      // A geometry held at a fitted limit may leave the lit range of longitudes, where the cosine turns negative: no light.
      return Math.max(0, Math.cos(phase / 2) * Math.cos(stretch * (gamma - phase / 2)) * cosBeta ** (phase / (Math.PI - phase)) / Math.cos(gamma));
    }
    case 'lommel-seeliger-lambert': {
      const degrees = phase * 180 / Math.PI, lunar = model.lunarFraction + model.lunarFractionPerDegree * degrees;
      return lunar * Math.max(0, model.surfacePhase + model.surfacePhasePerDegree * degrees) * mu0 / (mu0 + mu) + (1 - lunar) * mu0;
    }
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
  if (model.family === 'lommel-seeliger-lambert') {
    const { lunarFraction, lunarFractionPerDegree, surfacePhase, surfacePhasePerDegree } = model, lunarAt180 = lunarFraction + lunarFractionPerDegree * 180;
    if (![lunarFraction, lunarFractionPerDegree, surfacePhase, surfacePhasePerDegree].every(Number.isFinite)) throw new TypeError('Lommel-Seeliger plus Lambert coefficients must be finite.');
    // Both terms stay light, never negative, only while A lies in [0, 1] at every phase from 0 to 180 degrees.
    if (!(lunarFraction >= 0 && lunarFraction <= 1 && lunarAt180 >= 0 && lunarAt180 <= 1)) throw new TypeError(`Lommel-Seeliger plus Lambert lunar fraction must lie in [0, 1] from 0 to 180 degrees of phase, got ${lunarFraction} to ${lunarAt180}.`);
    if (!(surfacePhase > 0)) throw new TypeError(`Lommel-Seeliger plus Lambert surface phase function must be positive at zero phase, got ${surfacePhase}.`);
  }
  return model;
}
