/** Appearance calibration: only component RGB coefficients and one display curve. */
import type { Basis } from './render.mts';
import { EXTINCTION_RGB } from './model.mts';
import { need, rec, array, numbers, num } from './inputs.mts';
import { type V3 } from './geometry.mts';
export interface YoungColor {
  tint: V3;
  saturation: number;
}
export interface Grade {
  coefficients: V3[];
  dustStrength: number;
  dustTint: V3;
  stretch: number;
  saturation: number;
  score: number;
  youngColor?: YoungColor;
}
export function readGrade(value: unknown): Grade {
  const v = rec(value),
    t = numbers(v.dustTint, 3),
    g: Grade = {
      coefficients: array(v.coefficients).map(v => {
        const a = numbers(v, 3);
        return [a[0], a[1], a[2]];
      }),
      dustStrength: num(v.dustStrength),
      dustTint: [t[0], t[1], t[2]],
      stretch: num(v.stretch),
      saturation: num(v.saturation),
      score: num(v.score),
    };
  if (v.youngColor !== undefined) {
    const m = rec(v.youngColor),
      tint = numbers(m.tint, 3);
    g.youngColor = { tint: [tint[0], tint[1], tint[2]], saturation: num(m.saturation) };
  }
  validateGrade(g);
  return g;
}
export const LUMA: V3 = [0.2126, 0.7152, 0.0722];
export function validateGrade(g: Grade): void {
  need(
    g.coefficients.length === 4 &&
      g.coefficients.every(v => v.length === 3 && v.every(x => Number.isFinite(x) && x >= 0 && x <= 100)),
    'Invalid component RGB grade',
  );
  need(
    g.dustStrength >= 0.01 &&
      g.dustStrength <= 2 &&
      g.dustTint.length === 3 &&
      g.dustTint.every(v => v >= 0.6 && v <= 1.5) &&
      g.dustTint[1] === 1,
    'Dust must remain positive with a V-normalized tint',
  );
  need(g.stretch >= 0 && g.stretch <= 20 && g.saturation >= 0.5 && g.saturation <= 2.5, 'Invalid global display curve');
  if (g.youngColor)
    need(
      g.youngColor.tint.every(v => Number.isFinite(v) && v > 0 && v <= 8) &&
        g.youngColor.tint[1] === 1 &&
        g.youngColor.saturation >= 0.5 &&
        g.youngColor.saturation <= 6,
      'Invalid young-population color material',
    );
}
/** The same global operator acts everywhere; no image coordinates or target pixels enter it. */
export function youngColorRgb(rgb: V3, material: YoungColor): V3 {
  const original = rgb.reduce((a, v, c) => a + v * LUMA[c], 0);
  if (original <= 0) return [0, 0, 0];
  const tinted = rgb.map((v, c) => v * material.tint[c]),
    y = tinted.reduce((a, v, c) => a + v * LUMA[c], 0),
    out = tinted.map(v => Math.max(0, y + (v - y) * material.saturation)),
    after = out.reduce((a, v, c) => a + v * LUMA[c], 0);
  need(after > 0, 'Young color lost positive light');
  return [(out[0] * original) / after, (out[1] * original) / after, (out[2] * original) / after];
}
export function tone(r: number, g: number, b: number, stretch: number, saturation: number): V3 {
  const y = r * LUMA[0] + g * LUMA[1] + b * LUMA[2],
    mapped = stretch < 1e-6 ? y : Math.asinh(stretch * y) / Math.asinh(stretch),
    scale = y > 1e-20 ? mapped / y : 0;
  return [
    Math.max(0, (y + (r - y) * saturation) * scale),
    Math.max(0, (y + (g - y) * saturation) * scale),
    Math.max(0, (y + (b - y) * saturation) * scale),
  ];
}
export function gradedPrediction(basis: Basis, grade: Grade, pixels?: Uint8Array): Float64Array {
  validateGrade(grade);
  need(!pixels || pixels.length === basis.width * basis.height, 'Grade mask dimensions differ');
  const out = new Float64Array(basis.width * basis.height * 3);
  for (let i = 0; i < out.length; i += 3) {
    const rgb: V3 = [0, 0, 0];
    if (pixels && !pixels[i / 3]) continue;
    for (let c = 0; c < 3; c++)
      rgb[c] =
        (basis.planes[0][i + c] + basis.planes[2][i + c]) * grade.coefficients[0][c] +
        basis.planes[1][i + c] * grade.coefficients[1][c] +
        basis.planes[3][i + c] * grade.coefficients[2][c] +
        basis.planes[4][i + c] * grade.coefficients[3][c];
    if (grade.youngColor) {
      const before: V3 = [0, 1, 2].map(c => basis.planes[3][i + c] * grade.coefficients[2][c]) as V3,
        after = youngColorRgb(before, grade.youngColor);
      for (let c = 0; c < 3; c++) rgb[c] += after[c] - before[c];
    }
    const t = tone(...rgb, grade.stretch, grade.saturation);
    for (let c = 0; c < 3; c++) out[i + c] = t[c];
  }
  return out;
}
