/** Authored material controls; never density, geometry, or catalogue settings. */
export interface CloudAppearance { saturation: number; detailStrength: number; detailScale: number; brightness: number; gamma: number; }
export const DEFAULT_CLOUD_APPEARANCE: Readonly<CloudAppearance> = Object.freeze({
  saturation: 1, detailStrength: 0, detailScale: 24, brightness: 1, gamma: 1,
});
export function parseCloudAppearance(value: unknown = DEFAULT_CLOUD_APPEARANCE): CloudAppearance {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !['saturation', 'detailStrength', 'detailScale', 'brightness', 'gamma'].includes(key)))
    throw new TypeError('Invalid cloud appearance settings.');
  // Earlier previews/drafts did not have brightness or gamma; preserve them at neutral tone.
  const item = { brightness: 1, gamma: 1, ...value } as CloudAppearance;
  if (!Number.isFinite(item.saturation) || item.saturation < 0 || item.saturation > 2.5 ||
      !Number.isFinite(item.detailStrength) || item.detailStrength < 0 || item.detailStrength > 2 ||
      !Number.isFinite(item.detailScale) || item.detailScale < 2 || item.detailScale > 128 ||
      !Number.isFinite(item.brightness) || item.brightness < 0 || item.brightness > 2 ||
      !Number.isFinite(item.gamma) || item.gamma < .25 || item.gamma > 3)
    throw new TypeError('Cloud saturation must be 0–250%, detail 0–200%, scale 2–128px, brightness 0–200%, and gamma 0.25–3.');
  return { saturation: item.saturation, detailStrength: item.detailStrength, detailScale: item.detailScale,
    brightness: item.brightness, gamma: item.gamma };
}
export function sameCloudAppearance(a?: CloudAppearance, b?: CloudAppearance) {
  const left = parseCloudAppearance(a), right = parseCloudAppearance(b);
  return left.saturation === right.saturation && left.detailStrength === right.detailStrength && left.detailScale === right.detailScale &&
    left.brightness === right.brightness && left.gamma === right.gamma;
}
