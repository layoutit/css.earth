// How a derived corona's density becomes brightness.
//
// At each distance from the star brightness is proportional to density, as light scattered by free electrons is: the gas on
// the sheet, the densest of its distance, takes its own place on a logarithmic density scale, and everything thinner is
// dimmer in proportion. Only the fall-off with distance is compressed. The scale's floor and its two radial fades are the
// ones the Sun's STEREO dataset is shown with (src/objects/sun-cor1-density); its ceiling is raised from 6.5e6 to hold the
// denser gas of active stars, as it is for ε Eridani's published simulation.

export const CORONA_DISPLAY = Object.freeze({
  densityRangePerCm3: [1e5, 1e9] as const,
  innerFadeRadii: [1, 1.16] as const, outerFadeRadii: [2.6, 4] as const,
  /** A line of sight this many stellar radii long at the top of the scale reaches the top alpha. */
  fullScaleColumnRadii: 4.76, topAlpha: 0.9,
});

const smoothstep = (a: number, b: number, t: number) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };

/** A density's place on the logarithmic scale, faded at the star's edge and at the edge of the drawn volume. The star's own
 * sphere is drawn inside one radius, so nothing is. */
export function coronaScaleValue(densityPerCm3: number, radii: number) {
  if (radii < 1) return 0;
  const [low, high] = CORONA_DISPLAY.densityRangePerCm3;
  const scaled = Math.max(0, Math.min(1, (Math.log10(densityPerCm3) - Math.log10(low)) / (Math.log10(high) - Math.log10(low))));
  return scaled * smoothstep(CORONA_DISPLAY.innerFadeRadii[0], CORONA_DISPLAY.innerFadeRadii[1], radii) * (1 - smoothstep(CORONA_DISPLAY.outerFadeRadii[0], CORONA_DISPLAY.outerFadeRadii[1], radii));
}

/** The display value of a density, given the densest gas of its radius: that gas sits on the scale, and thinner gas is
 * dimmer in proportion. */
export const coronaPeakValue = (densityPerCm3: number, peakPerCm3: number, radii: number) => coronaScaleValue(peakPerCm3, radii) * Math.min(1, densityPerCm3 / peakPerCm3);

/** The exposure: the gain a slab baker multiplies the summed display value by. */
export const coronaExposureGain = () => -Math.log(1 - CORONA_DISPLAY.topAlpha) / CORONA_DISPLAY.fullScaleColumnRadii;
