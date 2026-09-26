import type { PreparedCssPointField } from './types.js';

/** Opacity below half an 8-bit step cannot change a composited pixel. Coverage
 * anchors keep their prepared floor and stay shown at any positive luminance. */
export const IMPERCEPTIBLE_LUMINANCE = 0.5 / 255;
export function pointLuminanceVisible(luminance: number, coverageAnchor = false) {
  return coverageAnchor ? luminance > 0 : luminance >= IMPERCEPTIBLE_LUMINANCE;
}

/** Apparent magnitude selects/interpolates prepared exposure samples, not source imagery. */
export function pointPhotometry(payload: Pick<PreparedCssPointField, 'frame' | 'photometry'>, absoluteMagnitude: number, distanceUnits: number, coverageAnchor = false) {
  const distancePc = distanceUnits * payload.frame.metersPerUnit / 3.085677581491367e16;
  const magnitude = absoluteMagnitude + 5 * Math.log10(Math.max(distancePc, Number.MIN_VALUE)) - 5;
  const table = payload.photometry;
  const coordinate = Math.max(0, Math.min(table.samples.length - 1, (magnitude - table.minimumMagnitude) / table.step));
  const index = Math.floor(coordinate), t = coordinate - index;
  const a = table.samples[index], b = table.samples[Math.min(index + 1, table.samples.length - 1)];
  return { magnitude, radiusPx: Math.max(coverageAnchor ? table.minimumRadiusPx : 0, a.radiusPx + (b.radiusPx - a.radiusPx) * t),
    luminance: Math.max(coverageAnchor ? table.floor : 0, a.luminance + (b.luminance - a.luminance) * t) };
}
