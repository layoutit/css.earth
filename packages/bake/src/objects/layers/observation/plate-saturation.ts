/** Saturated stars of a scanned photographic plate, measured from the plate scan itself.
 *
 * A Schmidt plate saturates: the brightest stars lose their peak and keep a flat core with a broad photographic
 * halo that survives star removal. Those pixels are neither galaxy light nor zero, so they are reported as no
 * coverage. Saturation is found from the data, by the flat top a point spread function cannot produce, and the
 * halo is grown until the ring median reaches the plate's own measured background.
 *
 * Plate-to-plate background steps are NOT corrected here; see the plate background note in
 * `docs/color-preparation.md` for what the pinned inputs do and do not allow. */
import { median } from '@cssearth/core';

export const DSS_SATURATION_REFERENCE = 'https://archive.stsci.edu/dss/index.html';

/** Declared before any measurement; every threshold is reported with the result. */
export const PLATE_PREPARATION = Object.freeze({
  /** Candidate cores come from this percentile of the plate's own finite values. */
  corePercentile: 99.9,
  /** A core counts as flat where at least half of a ring stays within this fraction of the peak. */
  plateauFraction: 0.98,
  /** A point spread function cannot stay flat this far out at 9 arcsecond sampling. */
  minimumPlateauRadius: 2,
  /** A flat top that never ends inside this radius is not a star; a flat field is not saturation. */
  maximumPlateauRadius: 32,
  /** The halo ends where the ring median falls within this many robust deviations of the local background. */
  haloContrast: 5,
  /** Bounds the halo of one star, in pixels. */
  maximumHaloRadius: 120,
});

const ringMedian = (plane: Float32Array, width: number, height: number, cx: number, cy: number, radius: number) => {
  const values: number[] = [];
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    if (Math.round(Math.hypot(dx, dy)) !== radius) continue;
    const x = cx + dx, y = cy + dy;
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const value = plane[y * width + x]!;
    if (Number.isFinite(value)) values.push(value);
  }
  return values.length ? median(values) : NaN;
};

export interface SaturatedStar { readonly x: number; readonly y: number; readonly peak: number; readonly plateauRadius: number; readonly maskedRadius: number; readonly maskedPixels: number }

/** Flat-cored stars and their halos become no-coverage in place; the plane keeps every other measurement. */
export function maskSaturatedStars(plane: Float32Array, width: number, height: number) {
  const finite = plane.filter(Number.isFinite).sort();
  if (!finite.length) throw new Error('A plate band has no observed pixels.');
  const candidate = finite[Math.floor(PLATE_PREPARATION.corePercentile / 100 * (finite.length - 1))]!;
  const background = finite[Math.floor(0.5 * (finite.length - 1))]!;
  const spread = median(Array.from(finite.subarray(0, finite.length - 1), value => Math.abs(value - background))) || 1;
  const stars: SaturatedStar[] = [];
  const guard = PLATE_PREPARATION.minimumPlateauRadius + 2;
  for (let y = guard; y < height - guard; y++) for (let x = guard; x < width - guard; x++) {
    const peak = plane[y * width + x]!;
    // A saturated core is a bounded island well above the plate background, not a flat field.
    if (!(peak >= candidate) || !(peak > background + PLATE_PREPARATION.haloContrast * spread)) continue;
    let local = true;
    for (let dy = -guard; dy <= guard && local; dy++) for (let dx = -guard; dx <= guard; dx++)
      if (plane[(y + dy) * width + x + dx]! > peak) { local = false; break; }
    if (!local) continue;
    // A saturated core is flat: a ring at this radius still sits within plateauFraction of the peak.
    let plateau = 0;
    for (let radius = 1; radius <= PLATE_PREPARATION.maximumPlateauRadius; radius++) {
      const ring = ringMedian(plane, width, height, x, y, radius);
      if (!(ring >= peak * PLATE_PREPARATION.plateauFraction)) break;
      plateau = radius;
    }
    if (plateau < PLATE_PREPARATION.minimumPlateauRadius || plateau >= PLATE_PREPARATION.maximumPlateauRadius) continue;
    // The halo ends where the ring median reaches the plate background; the local background is measured far out.
    let masked = plateau;
    for (let radius = plateau + 1; radius <= PLATE_PREPARATION.maximumHaloRadius; radius++) {
      const ring = ringMedian(plane, width, height, x, y, radius);
      if (!Number.isFinite(ring) || ring <= background + PLATE_PREPARATION.haloContrast * spread) break;
      masked = radius;
    }
    stars.push({ x, y, peak, plateauRadius: plateau, maskedRadius: masked, maskedPixels: 0 });
  }
  const measured: SaturatedStar[] = [];
  let maskedPixels = 0;
  for (const star of stars) {
    let count = 0;
    for (let dy = -star.maskedRadius; dy <= star.maskedRadius; dy++) for (let dx = -star.maskedRadius; dx <= star.maskedRadius; dx++) {
      if (dx * dx + dy * dy > star.maskedRadius * star.maskedRadius) continue;
      const x = star.x + dx, y = star.y + dy;
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const pixel = y * width + x;
      if (Number.isFinite(plane[pixel]!)) { plane[pixel] = NaN; count++; }
    }
    maskedPixels += count;
    measured.push({ ...star, maskedPixels: count });
  }
  return { stars: measured, maskedPixels, coreThreshold: candidate, background, backgroundSpread: spread,
    method: 'Saturated cores are found by the flat top a point spread function cannot produce, then grown to where the ring median reaches the measured plate background. Masked pixels are reported as no coverage, never as zero.',
    settings: PLATE_PREPARATION, reference: DSS_SATURATION_REFERENCE };
}
