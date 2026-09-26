import { hapkeRoughness } from './roughness.ts';
/**
 * The Hapke bidirectional reflectance model, configurable to the formulation a
 * published parameter set was fitted with. The isotropic multiple scattering
 * approximation (IMSA) uses the 1981 or the 2002 H-function approximation. The
 * shadow-hiding opposition effect follows Hapke (1986) and the coherent
 * backscatter effect Hapke (2002); a porosity factor K follows Hapke (2008).
 * The particle phase function is one- or two-term Henyey-Greenstein or two-term
 * Legendre. Macroscopic roughness (Hapke 1984) enters through effective cosines
 * and a shadowing function (roughness.mts). Returns the radiance factor
 * I/F = π r. Angles are in radians.
 */
export type HFunctionApproximation = 'hapke-1981' | 'hapke-2002';

export type ParticlePhaseFunction =
  /** p = (1 - ξ²) / (1 + 2 ξ cos g + ξ²)^1.5 with phase angle g; ξ < 0 scatters backward. */
  | { readonly form: 'henyey-greenstein'; readonly asymmetry: number }
  /** Hapke (2012) eq. 6.7: p = (1 + c)/2 · (1 - b²)/(1 - 2b cos g + b²)^1.5 + (1 - c)/2 · (1 - b²)/(1 + 2b cos g + b²)^1.5; c > 0 weights the backward lobe. */
  | { readonly form: 'double-henyey-greenstein'; readonly b: number; readonly c: number }
  /** p = 1 + b cos g + c (1.5 cos² g - 0.5). */
  | { readonly form: 'legendre'; readonly b: number; readonly c: number }
  /** ISIS HapkeHen: p = (1 - c)(1 - b²)/(1 + b² + 2b cos g)^1.5 + c (1 - b²)/(1 + b² - 2b cos g)^1.5, b in (-1, 1), c in [0, 1]; c = (1 + c_Hapke2012)/2. */
  | { readonly form: 'isis-henyey-greenstein'; readonly b: number; readonly c: number };

export interface HapkeModel {
  readonly family: 'hapke';
  /** Single-scattering albedo w. */
  readonly singleScatteringAlbedo: number;
  readonly hFunction: HFunctionApproximation;
  readonly phaseFunction: ParticlePhaseFunction;
  /** Shadow-hiding opposition effect: amplitude B_S0 and angular width h_S. */
  readonly shadowHiding?: { readonly amplitude: number; readonly width: number };
  /** Coherent backscatter opposition effect: amplitude B_C0 and angular width h_C. */
  readonly coherentBackscatter?: { readonly amplitude: number; readonly width: number };
  /** Mean macroscopic roughness slope θ̄ in radians; zero or absent for a smooth surface. */
  readonly roughness?: number;
  /** Porosity factor K (Hapke 2008); 1 or absent for the classical model. */
  readonly porosity?: number;
}

export function hFunction(x: number, w: number, approximation: HFunctionApproximation): number {
  const gamma = Math.sqrt(1 - w);
  if (approximation === 'hapke-1981') return (1 + 2 * x) / (1 + 2 * gamma * x);
  if (x <= 0) return 1;
  const r0 = (1 - gamma) / (1 + gamma);
  return 1 / (1 - w * x * (r0 + (1 - 2 * r0 * x) / 2 * Math.log((1 + x) / x)));
}

export function particlePhase(model: ParticlePhaseFunction, phase: number): number {
  const cosine = Math.cos(phase);
  switch (model.form) {
    case 'henyey-greenstein': { const x = model.asymmetry; return (1 - x * x) / (1 + 2 * x * cosine + x * x) ** 1.5; }
    case 'double-henyey-greenstein': {
      const { b, c } = model, numerator = 1 - b * b;
      return (1 + c) / 2 * numerator / (1 - 2 * b * cosine + b * b) ** 1.5 + (1 - c) / 2 * numerator / (1 + 2 * b * cosine + b * b) ** 1.5;
    }
    case 'legendre': return 1 + model.b * cosine + model.c * (1.5 * cosine * cosine - 0.5);
    case 'isis-henyey-greenstein': {
      const { b, c } = model, hgs = b * b;
      return (1 - c) * (1 - hgs) / (1 + hgs + 2 * b * cosine) ** 1.5 + c * (1 - hgs) / (1 + hgs - 2 * b * cosine) ** 1.5;
    }
  }
}

/** Hapke (1986) shadow-hiding factor 1 + B_S0 / (1 + tan(g/2) / h_S). */
export const shadowHidingFactor = (phase: number, term?: { amplitude: number; width: number }) =>
  term ? 1 + term.amplitude / (1 + Math.tan(phase / 2) / term.width) : 1;

/** Hapke (2002) coherent backscatter factor 1 + B_C0 · B_C(g), with B_C(0) = 1. */
export function coherentBackscatterFactor(phase: number, term?: { amplitude: number; width: number }) {
  if (!term) return 1;
  // (1 - e^-z) / z through expm1, exact to rounding near zero phase where the difference form cancels.
  const z = Math.tan(phase / 2) / term.width, ratio = z === 0 ? 1 : -Math.expm1(-z) / z;
  return 1 + term.amplitude * (1 + ratio) / (2 * (1 + z) ** 2);
}


/**
 * Radiance factor of the IMSA Hapke model:
 * I/F = K (w/4) μ0e / (μ0e + μe) · [p(g) B_SH(g) + H(μ0e/K) H(μe/K) - 1] · B_CB(g) · S,
 * with the effective cosines and shadowing S of Hapke (1984) roughness for θ̄ > 0 (roughness.mts).
 */
export function hapkeRadianceFactor(model: HapkeModel, mu0: number, mu: number, phase: number): number {
  const w = model.singleScatteringAlbedo, k = model.porosity ?? 1, theta = model.roughness ?? 0;
  if (!(mu0 > 0) || !(mu > 0)) return 0;
  const { mu0e, mue, shadowing } = theta > 0 ? hapkeRoughness(mu0, mu, phase, theta) : { mu0e: mu0, mue: mu, shadowing: 1 };
  const single = particlePhase(model.phaseFunction, phase) * shadowHidingFactor(phase, model.shadowHiding);
  const multiple = hFunction(mu0e / k, w, model.hFunction) * hFunction(mue / k, w, model.hFunction) - 1;
  return k * w / 4 * mu0e / (mu0e + mue) * (single + multiple) * coherentBackscatterFactor(phase, model.coherentBackscatter) * shadowing;
}

export function assertHapkeModel(model: HapkeModel): HapkeModel {
  const w = model.singleScatteringAlbedo, p = model.phaseFunction;
  const bad = (message: string) => { throw new TypeError(`Invalid Hapke model: ${message}.`); };
  if (model.family !== 'hapke') bad('family must be hapke');
  if (!(w > 0 && w <= 1)) bad('single-scattering albedo must lie in (0, 1]');
  if (model.hFunction !== 'hapke-1981' && model.hFunction !== 'hapke-2002') bad('unknown H-function approximation');
  if (p.form === 'henyey-greenstein' ? !(Math.abs(p.asymmetry) < 1) : p.form === 'double-henyey-greenstein' ? !(p.b >= 0 && p.b < 1 && Math.abs(p.c) <= 1)
    : p.form === 'legendre' ? !(Number.isFinite(p.b) && Number.isFinite(p.c)) : p.form === 'isis-henyey-greenstein' ? !(Math.abs(p.b) < 1 && p.c >= 0 && p.c <= 1) : true) bad('invalid particle phase function');
  for (const term of [model.shadowHiding, model.coherentBackscatter]) if (term && !(term.amplitude >= 0 && term.width > 0)) bad('opposition terms need a non-negative amplitude and a positive width');
  if (model.roughness !== undefined && !(model.roughness >= 0 && model.roughness < Math.PI / 2)) bad('roughness must lie in [0, 90°)');
  if (model.porosity !== undefined && !(model.porosity >= 1)) bad('porosity factor K must be at least 1');
  return model;
}
