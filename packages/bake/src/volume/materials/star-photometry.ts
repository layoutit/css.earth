/** Offline magnitude-to-point preparation; runtime consumes size and opacity. */
export const STAR_PHOTOMETRY = Object.freeze({
  method: 'magnitude-flux-point@1',
  referenceMagnitude: 10,
  referenceDiameterPx: 3.5,
  minimumDiameterPx: .65,
  maximumDiameterPx: 4,
  magnitudeFluxExponent: -.4,
  diameterFluxExponent: .25,
  referenceUrl: 'https://lco.global/spacebook/distance/comparing-magnitudes-different-objects/',
  display: 'Diameter squared × opacity × encoded-RGB luminance follows relative V-band flux until the diameter/opacity ceiling. No faint-star opacity floor.',
  limitation: 'A bounded display-light proxy on an sRGB CSS surface, not calibrated screen radiance or physical stellar diameter.',
});

export function prepareStarPhotometry(magnitude: number, colorCss: string): { sizePx: number; opacity: number } {
  if (!Number.isFinite(magnitude) || !/^#[0-9a-f]{6}$/i.test(colorCss))
    throw new TypeError('Star photometry requires a finite magnitude and RGB color.');
  const rgb = [1, 3, 5].map(start => parseInt(colorCss.slice(start, start + 2), 16) / 255);
  const luminance = .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
  if (!(luminance > 0)) throw new TypeError('A black star cannot carry visible point light.');
  const policy = STAR_PHOTOMETRY;
  const flux = 10 ** (policy.magnitudeFluxExponent * (magnitude - policy.referenceMagnitude));
  if (!Number.isFinite(flux)) throw new TypeError('Star flux exceeds the finite preparation range.');
  const light = policy.referenceDiameterPx ** 2 * flux;
  const nominalSize = Math.max(policy.minimumDiameterPx, policy.referenceDiameterPx * flux ** policy.diameterFluxExponent);
  // A darker display color needs a little more area if full opacity is reached.
  const sizePx = Math.min(policy.maximumDiameterPx, Math.max(nominalSize, Math.sqrt(light / luminance)));
  const opacity = Math.min(1, light / (sizePx ** 2 * luminance));
  return { sizePx, opacity };
}
