/** Squared visibilities and closure phases an image predicts, and the reduced chi-squared against measured rows. The transform is
 * the optical-interferometry convention: V(u,v) = sum I(x,y) exp(-2 pi i (u alpha + v delta) / lambda) with alpha toward east
 * (decreasing column when east is on the left) and delta toward north (increasing row from the bottom in FITS order). */
import type { SkyImageAxes } from '../../fits/fits-sky.mts';

export interface ImagePlane { readonly width: number; readonly height: number; readonly values: ArrayLike<number>; readonly pixelMas: number; readonly eastLeft: boolean }
const MAS_RAD = Math.PI / 180 / 3.6e6;

/** A reconstruction in FITS order as the transform reads it, with east taken from its stated axes. Rows must run north and pixels
 * must be square, as they are for every reconstruction code this route reads. */
export function reconstructionPlane(image: { readonly width: number; readonly height: number; readonly values: ArrayLike<number>; readonly axes: SkyImageAxes }): ImagePlane {
  const { width, height, values, axes } = image;
  if (!axes.northUp || axes.scale[0] !== axes.scale[1]) throw new TypeError('A reconstruction plane needs rows running north and square pixels.');
  return { width, height, values, pixelMas: axes.scale[0], eastLeft: !axes.eastRight };
}

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

export interface DifferentialPhaseRow { readonly u: number; readonly v: number; readonly phaseOrder: number; readonly channels: readonly { readonly wavelengthMetres: number; readonly phaseDegrees: number; readonly phaseErrorDegrees: number }[] }

/** Chi-squared of an image against differential phases. Each baseline row's residuals (measured minus model, wrapped) are
 * fitted by a polynomial in wavenumber of the row's own order, the terms a differential phase has already removed, and only
 * what that fit leaves counts. A grey image's phase is linear in wavenumber on a baseline, so an order-1 differential phase
 * holds nothing about it: a shifted or mirrored grey image leaves the statistic unchanged. Returns the sum and the degrees of
 * freedom, so rows combine across files. */
export function differentialPhaseChi2(image: ImagePlane, rows: readonly DifferentialPhaseRow[]) {
  let chi2 = 0, freedom = 0;
  for (const row of rows) {
    const terms = row.phaseOrder + 1;
    if (row.channels.length <= terms) continue;
    const x: number[] = [], y: number[] = [], w: number[] = [];
    for (const channel of row.channels) {
      const [re, im] = visibility(image, row.u, row.v, channel.wavelengthMetres);
      x.push(1e-6 / channel.wavelengthMetres); y.push(((channel.phaseDegrees - Math.atan2(im, re) * 180 / Math.PI) % 360 + 540) % 360 - 180); w.push(1 / channel.phaseErrorDegrees ** 2);
    }
    // Weighted least squares for y = c0 + c1 x + ... via the normal equations, solved by Gaussian elimination.
    const normal = Array.from({ length: terms }, () => new Array<number>(terms + 1).fill(0));
    for (let i = 0; i < x.length; i++) for (let a = 0; a < terms; a++) { for (let b = 0; b < terms; b++) normal[a]![b]! += w[i]! * x[i]! ** (a + b); normal[a]![terms]! += w[i]! * y[i]! * x[i]! ** a; }
    for (let a = 0; a < terms; a++) { const pivot = normal[a]![a]!; for (let b = a; b <= terms; b++) normal[a]![b]! /= pivot; for (let c = 0; c < terms; c++) if (c !== a) { const f = normal[c]![a]!; for (let b = a; b <= terms; b++) normal[c]![b]! -= f * normal[a]![b]!; } }
    for (let i = 0; i < x.length; i++) { let fit = 0; for (let a = 0; a < terms; a++) fit += normal[a]![terms]! * x[i]! ** a; chi2 += w[i]! * (y[i]! - fit) ** 2; }
    freedom += x.length - terms;
  }
  return { chi2, freedom, reducedChi2: freedom ? chi2 / freedom : Number.NaN };
}
