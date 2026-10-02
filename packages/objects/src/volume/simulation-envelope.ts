import type { SkyBounds } from './coordinates.js';
export interface SimulationEnvelopeSettings {
  /** Gaussian sigma, in fit pixels, of the sky-plane smoothing that separates envelope from detail. */
  scalePixels: number;
  /** Share of the smoothed image assigned to the simulation envelope; the rest is left for finite detail. */
  fraction: number;
  /** Minimum gain, as a share of the global image/simulation ratio, wherever the simulation has density. Zero adds no unobserved light. */
  floor: number;
  depthSamples: number;
  /** Image-weighted simulation mass trimmed from each end of the depth range (0.005 keeps 99%). */
  depthTrim: number;
  /**
   * Quantile of the smoothed envelope signal at which its chromaticity reaches half trust, so fainter
   * light keeps proportionally less of its measured color and the rest is neutral. Lower keeps color
   * further out into the halo; higher neutralises more of it. Omitted means the long-standing 0.9.
   */
  chromaHalfSaturationQuantile?: number;
  /**
   * Quantile of each observed channel taken as this image's sky before its chromaticity is measured.
   * The long-standing 0.5 is the median of every covered pixel, which for a body that fills much of its
   * own footprint subtracts real body light, unevenly per channel, and so shifts the hue it reports. A low
   * quantile is the sky of a footprint the body fills. Omitted means the long-standing 0.5.
   */
  chromaSkyQuantile?: number;
  /**
   * Blurred-coverage fraction below which a pixel's chromaticity is fully neutral, ramping to its measured
   * color at twice that fraction. `fitSimulationEnvelope` already tapers its GAIN across the observed
   * footprint edge on exactly this fraction, so unobserved sky does not end in a hard cut; the chromaticity
   * had no such taper and therefore reported a full-strength color from however few covered pixels a
   * boundary pixel has, which the outer annulus displays as false saturated patches. Setting this to the
   * gain's own 0.5 trusts color exactly where the gain carries light. Omitted means no taper.
   */
  chromaCoverageTaper?: number;
}
export function validateEnvelopeSettings(value: unknown): SimulationEnvelopeSettings {
  if (!value || typeof value !== 'object') throw new TypeError('Envelope settings must be an object.');
  const s = value as Record<string, unknown>;
  const { scalePixels, fraction, floor, depthSamples, depthTrim, chromaHalfSaturationQuantile, chromaSkyQuantile, chromaCoverageTaper } = s;
  if (typeof scalePixels !== 'number' || !Number.isFinite(scalePixels) || scalePixels < .5 || scalePixels > 128 ||
    typeof fraction !== 'number' || !Number.isFinite(fraction) || fraction < 0 || fraction > 1 ||
    typeof floor !== 'number' || !Number.isFinite(floor) || floor < 0 || floor > 1 ||
    typeof depthSamples !== 'number' || !Number.isInteger(depthSamples) || depthSamples < 8 || depthSamples > 4096 ||
    typeof depthTrim !== 'number' || !Number.isFinite(depthTrim) || depthTrim < 0 || depthTrim >= .25)
    throw new TypeError('Invalid simulation envelope settings.');
  const bounded = (value: unknown, name: string) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1)
      throw new TypeError(`Envelope ${name} must be in (0,1].`);
    return value;
  };
  const taper = (value: unknown) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value >= 1)
      throw new TypeError('Envelope chroma coverage taper must be in [0,1).');
    return value;
  };
  // Each key is appended only when authored, so an accepted record without them keeps its exact stored bytes.
  return {
    scalePixels, fraction, floor, depthSamples, depthTrim,
    ...(chromaHalfSaturationQuantile === undefined ? {}
      : { chromaHalfSaturationQuantile: bounded(chromaHalfSaturationQuantile, 'chroma half-saturation quantile') }),
    ...(chromaSkyQuantile === undefined ? {} : { chromaSkyQuantile: bounded(chromaSkyQuantile, 'chroma sky quantile') }),
    // A taper of zero means no taper, so unlike the quantiles its range is closed below and open above.
    ...(chromaCoverageTaper === undefined ? {} : { chromaCoverageTaper: taper(chromaCoverageTaper) }),
  };
}

export const SIMULATION_ENVELOPE_SCHEMA = 'cssearth-simulation-envelope@1';
export interface SimulationEnvelopeRecord {
  schema: typeof SIMULATION_ENVELOPE_SCHEMA; settings: SimulationEnvelopeSettings;
  width: number; height: number; bounds: SkyBounds; zRange: [number, number]; gain: number[];
  priorCloud?: unknown;
}
export function readSimulationEnvelopeRecord(value: unknown): SimulationEnvelopeRecord {
  const pair = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && v.every(n => typeof n === 'number' && Number.isFinite(n));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid simulation envelope record.');
  const v = value as Record<string, unknown>, bounds = v.bounds;
  if (v.schema !== SIMULATION_ENVELOPE_SCHEMA || typeof v.width !== 'number' || !Number.isInteger(v.width) || typeof v.height !== 'number' || !Number.isInteger(v.height) ||
      !Array.isArray(v.gain) || v.gain.length !== v.width * v.height || !v.gain.every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0) ||
      !bounds || typeof bounds !== 'object' || Array.isArray(bounds) || !('min' in bounds) || !('max' in bounds) || !pair(bounds.min) || !pair(bounds.max) ||
      bounds.min[0] >= bounds.max[0] || bounds.min[1] >= bounds.max[1] || !pair(v.zRange)) throw new TypeError('Invalid simulation envelope record.');
  return { schema: SIMULATION_ENVELOPE_SCHEMA, settings: validateEnvelopeSettings(v.settings), width: v.width, height: v.height,
    bounds: { min: bounds.min, max: bounds.max }, zRange: v.zRange, gain: v.gain,
    ...(v.priorCloud === undefined ? {} : { priorCloud: v.priorCloud }) };
}
