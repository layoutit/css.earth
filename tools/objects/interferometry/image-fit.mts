/** Squared visibilities and closure phases an image predicts, and the reduced chi-squared against measured rows. The transform is
 * the optical-interferometry convention: V(u,v) = sum I(x,y) exp(-2 pi i (u alpha + v delta) / lambda) with alpha toward east
 * (decreasing column when east is on the left) and delta toward north (increasing row from the bottom in FITS order). */
export interface ImagePlane { readonly width: number; readonly height: number; readonly values: ArrayLike<number>; readonly pixelMas: number; readonly eastLeft: boolean }
const MAS_RAD = Math.PI / 180 / 3.6e6;

/** Complex visibility of the image at a spatial frequency (u, v) in metres and a wavelength in metres. */
export function visibility(image: ImagePlane, u: number, v: number, wavelength: number): [number, number] {
  const { width, height, values, pixelMas, eastLeft } = image, cx = (width - 1) / 2, cy = (height - 1) / 2;
  let re = 0, im = 0, total = 0;
  for (let row = 0; row < height; row++) {
    const delta = (row - cy) * pixelMas * MAS_RAD;
    for (let col = 0; col < width; col++) {
      const value = values[row * width + col];
      if (!(value > 0)) continue;
      const alpha = (eastLeft ? cx - col : col - cx) * pixelMas * MAS_RAD;
      const phase = -2 * Math.PI * (u * alpha + v * delta) / wavelength;
      re += value * Math.cos(phase); im += value * Math.sin(phase); total += value;
    }
  }
  return [re / total, im / total];
}

export interface Vis2Row { readonly u: number; readonly v: number; readonly vis2: number; readonly error: number }
export interface T3Row { readonly u1: number; readonly v1: number; readonly u2: number; readonly v2: number; readonly phaseDegrees: number; readonly errorDegrees: number }

export function fitStatistics(image: ImagePlane, wavelength: number, vis2: readonly Vis2Row[], t3: readonly T3Row[]) {
  let chi2Vis2 = 0;
  for (const row of vis2) { const [re, im] = visibility(image, row.u, row.v, wavelength); chi2Vis2 += ((re * re + im * im - row.vis2) / row.error) ** 2; }
  let chi2T3 = 0;
  for (const row of t3) {
    const a = visibility(image, row.u1, row.v1, wavelength), b = visibility(image, row.u2, row.v2, wavelength), c = visibility(image, row.u1 + row.u2, row.v1 + row.v2, wavelength);
    // Bispectrum V1 V2 conj(V3): its phase is the closure phase.
    const ab: [number, number] = [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
    const abc: [number, number] = [ab[0] * c[0] + ab[1] * c[1], ab[1] * c[0] - ab[0] * c[1]];
    const model = Math.atan2(abc[1], abc[0]) * 180 / Math.PI, residual = ((model - row.phaseDegrees + 540) % 360) - 180;
    chi2T3 += (residual / row.errorDegrees) ** 2;
  }
  return { reducedChi2Vis2: chi2Vis2 / vis2.length, reducedChi2T3: chi2T3 / t3.length, vis2Rows: vis2.length, t3Rows: t3.length };
}
