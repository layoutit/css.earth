/** Display tone values; texture processing runs only in the local preparation server. */
export interface OverlayTone { brightness: number; gamma: number; black: number; white: number }
export const defaultOverlayTone = (): OverlayTone => ({ brightness: 1, gamma: 1, black: 0, white: 1 });
export function updateOverlayTone(current: OverlayTone, patch: Partial<OverlayTone>): OverlayTone {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch) ||
      Object.keys(patch).some(key => !Object.hasOwn(defaultOverlayTone(), key))) throw new TypeError('Unknown tone control.');
  const value = { ...current, ...patch };
  if (Object.values(value).some(item => typeof item !== 'number' || !Number.isFinite(item)) ||
      value.brightness < .1 || value.brightness > 4 || value.gamma < .2 || value.gamma > 4 ||
      value.black < 0 || value.black > .95 || value.white < .05 || value.white > 1 || value.black >= value.white) {
    throw new TypeError('Tone needs brightness 0.1–4, gamma 0.2–4 and ordered black/white levels within 0–1.');
  }
  return value;
}
export const isNeutralOverlayTone = (tone: OverlayTone): boolean =>
  tone.brightness === 1 && tone.gamma === 1 && tone.black === 0 && tone.white === 1;
/** Levels, gamma, then gain in display values. Not calibrated photometry. */
export function overlayToneSample(value: number, tone: OverlayTone): number {
  const normalized = Math.max(0, Math.min(1, (value - tone.black) / (tone.white - tone.black)));
  return Math.min(1, tone.brightness * normalized ** (1 / tone.gamma));
}
