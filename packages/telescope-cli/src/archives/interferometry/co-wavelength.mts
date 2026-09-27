/** Wavelength calibration of a K-band spectrum on the star's own carbon monoxide lines.
 *
 * ESO's AMBER pipeline takes its wavelengths from the P2VM lamp frames, and at high spectral resolution near 2.3 um they land
 * 2.2 nm long against Ohnaka et al. (2019), who calibrated on telluric lines in their calibrator's spectrum. Telluric line lists
 * are not available without registration here, but the cool giants this project images are covered in first-overtone lines of
 * 12CO, whose positions follow from the molecule's constants. The shift that best aligns the star's absorption with those lines
 * is the calibration; a spectrum without CO (a hot calibrator) gives no clear alignment and is refused.
 *
 * Line positions: X¹Σ⁺ 12C16O, v = 2-0, R and P branches up to J = 90, from ωe, ωexe, ωeye, Be, αe, γe and De of Huber and
 * Herzberg (1979). The computed band head is 2.29353 um in vacuum, the laboratory value. Stellar and barycentric radial
 * velocities (tens of km/s, a fraction of a channel at R 12 000) are not removed; they are part of the shift. */

const CO = { we: 2169.81358, wexe: 13.28831, weye: 0.010511, Be: 1.93128087, ae: 0.01750441, ge: 5.49e-7, De: 6.12147e-6 };

/** Vacuum wavelengths, in micrometres, of the 12CO v = 2-0 R and P lines. */
export function coOvertoneLines(maximumJ = 90) {
  const G = (v: number) => CO.we * (v + 0.5) - CO.wexe * (v + 0.5) ** 2 + CO.weye * (v + 0.5) ** 3;
  const B = (v: number) => CO.Be - CO.ae * (v + 0.5) + CO.ge * (v + 0.5) ** 2;
  const F = (v: number, J: number) => B(v) * J * (J + 1) - CO.De * J * J * (J + 1) ** 2;
  const lines: number[] = [];
  for (let J = 0; J < maximumJ; J++) {
    lines.push(1e4 / (G(2) - G(0) + F(2, J + 1) - F(0, J)));
    if (J > 0) lines.push(1e4 / (G(2) - G(0) + F(2, J - 1) - F(0, J)));
  }
  return lines.sort((a, b) => a - b);
}

/** A correlation below this does not identify the CO pattern: measured 0.68 on R Dor and 0.25 on Canopus. */
export const MINIMUM_CO_CORRELATION = 0.5;

/** The shift (file wavelength minus true wavelength, in nm) that best aligns the spectrum's absorption with the CO lines. */
export function measureCoShift(wavelengthsMicrometres: readonly number[], flux: readonly number[], { searchNm = 6, stepNm = 0.02, lineWidthMicrometres = 0.00012 } = {}) {
  if (wavelengthsMicrometres.length !== flux.length || flux.length < 32) throw new RangeError('A CO calibration needs a spectrum of at least 32 channels.');
  // Absorption depth against a running upper envelope over about 30 channels, so the stellar continuum slope drops out.
  const depth = flux.map((value, i) => {
    let envelope = 0;
    for (let k = Math.max(0, i - 15); k < Math.min(flux.length, i + 16); k++) envelope = Math.max(envelope, flux[k]!);
    return envelope > 0 ? 1 - value / envelope : 0;
  });
  const lines = coOvertoneLines(), meanDepth = depth.reduce((sum, value) => sum + value, 0) / depth.length;
  let best = { shiftNm: 0, correlation: -1 };
  for (let shiftNm = -searchNm; shiftNm <= searchNm + 1e-9; shiftNm += stepNm) {
    const model = wavelengthsMicrometres.map(wavelength => {
      const trueWavelength = wavelength - shiftNm * 1e-3;
      let sum = 0;
      for (const line of lines) { const x = (trueWavelength - line) / lineWidthMicrometres; if (Math.abs(x) < 6) sum += Math.exp(-(x * x)); }
      return sum;
    });
    const meanModel = model.reduce((sum, value) => sum + value, 0) / model.length;
    let cross = 0, modelSquares = 0, depthSquares = 0;
    for (let i = 0; i < model.length; i++) { cross += (model[i]! - meanModel) * (depth[i]! - meanDepth); modelSquares += (model[i]! - meanModel) ** 2; depthSquares += (depth[i]! - meanDepth) ** 2; }
    const correlation = cross / Math.sqrt(modelSquares * depthSquares);
    if (correlation > best.correlation) best = { shiftNm: Math.round(shiftNm * 1000) / 1000, correlation };
  }
  return best;
}
