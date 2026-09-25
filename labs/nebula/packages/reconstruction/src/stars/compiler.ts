import sharp from 'sharp';
import { detectStars } from '@cssearth/nebula-reconstruction/registration/stellar';
import type { CompilerImage } from '../observations/compiler-image.ts';
import { type EmissionFieldModel, createEmissionField, type CompilerStarInput, type CompilerStarMaterial } from '@cssearth/bake/volume';
const fraction = (id: string) => { let hash = 2166136261; for (const c of id) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619); return ((hash >>> 0) + .5) / 4294967296; };
type Point = [number, number];
type Rgb = [number, number, number];
const APERTURE_RADIUS = 6, BACKGROUND_RADIUS = 8;
const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;

/**
 * Positive NOX residual accounting is in encoded RGB display values, not linear-light flux.
 * A disk preserves that aperture's channel sums and peak; the camera supplies its pixel area.
 * Background subtraction and nearest-star ownership prevent diffuse residuals/double counting.
 */
export function createCompilerStarPhotometer(image: CompilerImage, nativePoints: readonly Point[]) {
  const layer = image.stars, sx = layer.width / image.nativeWidth, sy = layer.height / image.nativeHeight;
  const points = nativePoints.map(([x, y]): Point => [x * sx, y * sy]), cells = new Map<string, number[]>();
  const key = (x: number, y: number) => `${Math.floor(x / BACKGROUND_RADIUS)},${Math.floor(y / BACKGROUND_RADIUS)}`;
  points.forEach(([x, y], index) => { const cell = key(x, y); if (!cells.has(cell)) cells.set(cell, []); cells.get(cell)!.push(index); });
  const p0 = image.pixelToSky(0, 0), px = image.pixelToSky(1 / sx, 0), py = image.pixelToSky(0, 1 / sy);
  const pixelAreaUnitsSquared = Math.abs((px[0] - p0[0]) * (py[1] - p0[1]) - (px[1] - p0[1]) * (py[0] - p0[0]));
  if (!(pixelAreaUnitsSquared > 0) || !Number.isFinite(pixelAreaUnitsSquared)) throw new TypeError('Compiler star image scale is invalid.');
  return { measure(index: number) {
    const center = points[index]; if (!center) throw new TypeError('Compiler star aperture needs a detected point.');
    if (center[0] < 0 || center[0] >= layer.width || center[1] < 0 || center[1] >= layer.height) return null;
    const neighbours: number[] = [];
    for (let y = center[1] - BACKGROUND_RADIUS * 2; y <= center[1] + BACKGROUND_RADIUS * 2; y += BACKGROUND_RADIUS)
      for (let x = center[0] - BACKGROUND_RADIUS * 2; x <= center[0] + BACKGROUND_RADIUS * 2; x += BACKGROUND_RADIUS)
        neighbours.push(...cells.get(key(x, y)) ?? []);
    const ring: [number[], number[], number[]] = [[], [], []], aperture: number[] = [];
    for (let y = Math.max(0, Math.floor(center[1] - BACKGROUND_RADIUS)); y < Math.min(layer.height, Math.ceil(center[1] + BACKGROUND_RADIUS)); y++)
      for (let x = Math.max(0, Math.floor(center[0] - BACKGROUND_RADIUS)); x < Math.min(layer.width, Math.ceil(center[0] + BACKGROUND_RADIUS)); x++) {
        const d2 = (x + .5 - center[0]) ** 2 + (y + .5 - center[1]) ** 2;
        if (d2 > BACKGROUND_RADIUS ** 2 || neighbours.some(other => other !== index &&
          ((x + .5 - points[other]![0]) ** 2 + (y + .5 - points[other]![1]) ** 2 < d2 ||
            ((x + .5 - points[other]![0]) ** 2 + (y + .5 - points[other]![1]) ** 2 === d2 && other < index)))) continue;
        const at = (y * layer.width + x) * 3;
        if (d2 <= APERTURE_RADIUS ** 2) aperture.push(at);
        else for (let c = 0; c < 3; c++) ring[c]!.push(layer.data[at + c]!);
      }
    const background = ring.map(median), residualDisplayEnergyRgb: Rgb = [0, 0, 0], originalDisplayEnergyRgb: Rgb = [0, 0, 0];
    const original: Rgb = [0, 0, 0]; let peak = 0, originalPeak = 0;
    for (const at of aperture) {
      const pixel = at / 3, x = pixel % layer.width, y = Math.floor(pixel / layer.width);
      const sky = image.pixelToSky((x + .5) / sx, (y + .5) / sy);
      if (!image.sampleOriginal(...sky, original)) continue;
      for (let c = 0; c < 3; c++) {
        // NOX is additive in the encoded source grid. Never exceed the observed original.
        const residual = Math.max(0, Math.min(original[c]!, layer.data[at + c]!) - background[c]!);
        residualDisplayEnergyRgb[c] += residual / 255;
        originalDisplayEnergyRgb[c] += original[c]! / 255; peak = Math.max(peak, residual / 255);
        originalPeak = Math.max(originalPeak, original[c]! / 255);
      }
    }
    const energy = Math.max(...residualDisplayEnergyRgb);
    if (!(energy > 0) || !(peak > 0)) return null;
    const areaPixels = energy / peak, rgb = residualDisplayEnergyRgb.map(n => Math.floor(255 * n / energy + 1e-10)) as Rgb;
    return { rgb, alpha: peak, diameterUnits: 2 * Math.sqrt(areaPixels * pixelAreaUnitsSquared / Math.PI),
      measurement: { method: 'residual-aperture-display@1', apertureRadiusPx: APERTURE_RADIUS, aperturePixels: aperture.length,
        residualDisplayEnergyRgb, originalDisplayEnergyRgb, pixelAreaUnitsSquared, originalPeakDisplay: originalPeak,
        residualPeakDisplay: peak, backgroundDisplayRgb: background.map(n => n / 255),
        interpretation: 'Encoded RGB display sums after local NOX residual-background subtraction; not calibrated radiance or stellar flux.' } };
  } };
}
/** Project fixed observed positions into another registered source; no redetection or point movement. */
export function compilerStarLensPoints(reference: CompilerImage, lens: CompilerImage, nativePoints: readonly Point[]): Point[] {
  const p0 = lens.pixelToSky(0, 0), px = lens.pixelToSky(1, 0), py = lens.pixelToSky(0, 1);
  const a = px[0] - p0[0], b = px[1] - p0[1], c = py[0] - p0[0], d = py[1] - p0[1], determinant = a * d - b * c;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-15) throw new TypeError('Compiler star lens registration is not invertible.');
  return nativePoints.map(point => {
    const sky = reference.pixelToSky(...point), x = sky[0] - p0[0], y = sky[1] - p0[1];
    return [(x * d - y * c) / determinant, (y * a - x * b) / determinant];
  });
}
/** Keep every bounded residual maximum until measured aperture light selects the catalogue. */
export async function detectCompilerStarCandidates(image: CompilerImage) {
  const workingMaximum = 2048, maximumCandidates = Math.min(image.stars.width * image.stars.height, workingMaximum ** 2);
  const bytes = await sharp(image.stars.data, { raw: { width: image.stars.width, height: image.stars.height, channels: 3 } }).png().toBuffer();
  // The registration detector's default sharp-peak quota can discard broad bright
  // stars before photometry, especially against a nebular background. Its threshold
  // and maxima stay unchanged; this pixel-count bound includes every possible peak.
  return detectStars(bytes, [image.nativeWidth, image.nativeHeight], workingMaximum, maximumCandidates);
}
/** One deterministic conditional depth operator for both reference and union catalogues. */
export function createCompilerStarDepthSampler(model: EmissionFieldModel) {
  const field = createEmissionField(model), count = 128, dz = (field.bounds.max[2] - field.bounds.min[2]) / count;
  const samples = new Float64Array(count), light: [number, number, number] = [0, 0, 0];
  return (id: string, x: number, y: number): number | null => {
    if (x < field.bounds.min[0] || x > field.bounds.max[0] || y < field.bounds.min[1] || y > field.bounds.max[1]) return null;
    let total = 0;
    for (let k = 0; k < count; k++) { field.sampleEmission(x, y, field.bounds.min[2] + (k + .5) * dz, light); samples[k] = light[0]; total += light[0]; }
    if (!(total > 0)) return null;
    const chosen = fraction(id) * total; let cumulative = 0, slot = count - 1;
    for (let k = 0; k < count; k++) { cumulative += samples[k]!; if (cumulative >= chosen) { slot = k; break; } }
    return field.bounds.min[2] + (slot + .5) * dz;
  };
}
/** Observed xy/relative light; conditional z follows the fitted emission column, never image-layer index. */
export async function compilerStars(image: CompilerImage, model: EmissionFieldModel, maximum: number, lenses: readonly CompilerImage[] = [image]): Promise<CompilerStarInput[]> {
  if (!maximum) return [];
  const detected = await detectCompilerStarCandidates(image), depth = createCompilerStarDepthSampler(model), output: CompilerStarInput[] = [];
  const nativePoints = detected.map(star => star.point), photometer = createCompilerStarPhotometer(image, nativePoints);
  if (lenses.length < 1 || lenses.length > 8 || new Set(lenses.map(lens => lens.id)).size !== lenses.length)
    throw new TypeError('Compiler star lenses must have unique configured identities.');
  const lensPhotometers = lenses.map(lens => ({ id: lens.id, photometer: lens.id === image.id ? photometer :
    createCompilerStarPhotometer(lens, compilerStarLensPoints(image, lens, nativePoints)) }));
  // Detection peak measures compactness, not total displayed light: broad bright
  // sources must compete for the budget using their measured residual apertures.
  const ranked = detected.flatMap((star, index) => {
    const measured = photometer.measure(index);
    return measured ? [{ star, index, measured, energy: Math.max(...measured.measurement.residualDisplayEnergyRgb) }] : [];
  }).sort((a, b) => b.energy - a.energy || a.index - b.index);
  for (const { star, index, measured } of ranked) {
    if (output.length >= maximum) break;
    // These are observed field lights with illustrative conditional depths,
    // not confirmed members selected by the nebula's projected brightness.
    const [x, y] = image.pixelToSky(...star.point), id = `${image.id}-${index}`, z = depth(id, x, y);
    if (z === null) continue;
    const materials: Record<string, CompilerStarMaterial> = {};
    for (const lens of lensPhotometers) {
      const light = lens.id === image.id ? measured : lens.photometer.measure(index);
      materials[lens.id] = light ? { rgb: light.rgb, diameterUnits: light.diameterUnits, alpha: light.alpha } :
        { rgb: [0, 0, 0], diameterUnits: measured.diameterUnits, alpha: 0 };
    }
    output.push({ id, positionArcsec: [x, y, z], rgb: measured.rgb, diameterUnits: measured.diameterUnits, alpha: measured.alpha, materials });
  }
  return output;
}
