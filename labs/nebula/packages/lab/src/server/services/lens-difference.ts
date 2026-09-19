/**
 * Where one baked image lens paints too dark or too bright against its own image, as a prepared PNG.
 *
 * Per footprint pixel of the model's projection grid: Δ = render luminance ÷ delivery factor − source
 * luminance, in 8-bit levels. Source and render are exactly the pairs the levels measurement compares
 * (`lensLevelPairs`: pinned, verified rasters, footprint mask, sky pedestal removed, resampled through both
 * tangent bounds), so the map and the Levels panel can never disagree about what they compare.
 *
 * The map is written in the lens image's own frame (its tangent bounds), the frame the prepared
 * original-image overlay covers, so the lab places it with that overlay's registered transform unchanged.
 */
import sharp from 'sharp';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PreparedReconstruction } from '../../features/reconstruction/reconstruction-types.ts';
import { lensLevelPairs, loadLensLevelGrid, type Bounds, type LensLevelGrid, type LensLevelMaterial } from './lens-levels.ts';

/**
 * Analytic front-projection light ÷ delivered-bank light, per footprint pixel, at the delivered alpha 1–3
 * texels. Measured on horalek-widefield: a browser capture of the delivered bank means 53.5 levels per
 * footprint pixel against the analytic projection's 61.0 (lens-levels round, α p50/p90 2/7, α1–3 share 0.67;
 * nebula-lab skill "Matching a lens to its image", caution one). 61.0 / 53.5 = 1.140. Without it the whole
 * map reads red by ~12%.
 */
export const DELIVERY_FACTOR = 61.0 / 53.5;
/** |Δ| at or below this many levels is agreement and stays transparent. */
export const AGREEMENT_TOLERANCE = 6;
/** The colour scale saturates at ±this many levels. */
export const DIFFERENCE_RANGE = 64;
/** Rec. 709 luma weights, applied to the 8-bit channel levels. */
const LUMA = [.2126, .7152, .0722] as const;
const TOO_DARK = [[150, 190, 255], [30, 90, 255]] as const, TOO_BRIGHT = [[255, 175, 150], [235, 40, 25]] as const;
const SWATCH_LEVELS = [-DIFFERENCE_RANGE, -35, -AGREEMENT_TOLERANCE - 1, 0, AGREEMENT_TOLERANCE + 1, 35, DIFFERENCE_RANGE];
const rgbaCss = ([r, g, b, a]: number[]) => `rgba(${r},${g},${b},${+(a! / 255).toFixed(3)})`;

export interface LensDifference {
  schema: 'cssearth-nebula-lens-difference@1';
  resultId: string; imageId: string;
  /** Output raster size; it spans the lens image's tangent bounds, like the original-image overlay. */
  width: number; height: number;
  rangeLevels: number; toleranceLevels: number;
  deliveryFactor: number; deliveryNote: string;
  footprintPixels: number;
  /** Footprint shares, in percent. */
  agreePercent: number; tooDarkPercent: number; tooBrightPercent: number;
  meanSignedDelta: number;
  /** The ramp itself, sampled at signed levels, so a legend draws exactly the colours the map uses. */
  swatches: { levels: number; rgba: string }[];
  note: string;
}

/**
 * Signed luminance difference per grid pixel; NaN outside the footprint. `deliveryFactor` 1 compares the raw
 * analytic projection.
 */
export function differenceField(grid: LensLevelGrid, material: LensLevelMaterial, deliveryFactor = DELIVERY_FACTOR): Float64Array {
  if (!(deliveryFactor > 0)) throw new TypeError('Delivery factor must be positive.');
  const pairs = lensLevelPairs(grid, material), field = new Float64Array(grid.width * grid.height).fill(NaN);
  pairs.covered.forEach((p, k) => {
    let render = 0, source = 0;
    for (let c = 0; c < 3; c++) { render += LUMA[c] * pairs.render[k * 3 + c]!; source += LUMA[c] * pairs.source[k * 3 + c]!; }
    field[p] = render / deliveryFactor - source;
  });
  return field;
}

/** One RGBA pixel of the diverging ramp: blue too dark, red too bright, transparent inside the tolerance. */
export function differenceColour(delta: number, tolerance = AGREEMENT_TOLERANCE, range = DIFFERENCE_RANGE): [number, number, number, number] {
  if (!Number.isFinite(delta) || Math.abs(delta) <= tolerance) return [0, 0, 0, 0];
  const t = Math.min(1, (Math.abs(delta) - tolerance) / Math.max(1e-9, range - tolerance)), [from, to] = delta < 0 ? TOO_DARK : TOO_BRIGHT;
  return [0, 1, 2].map(c => Math.round(from[c]! + (to[c]! - from[c]!) * t)).concat(Math.round(110 + 145 * t)) as [number, number, number, number];
}

/**
 * Re-express a projection-grid field in the lens image's frame by nearest grid pixel. When the two bounds are
 * equal (a lens on its own model grid) this is the identity; elsewhere the lens frame keeps the grid's pitch.
 */
export function fieldInLensFrame(field: Float64Array, width: number, height: number, projection: Bounds, lens: Bounds) {
  const span = (b: Bounds, axis: number) => b.max[axis]! - b.min[axis]!;
  const outWidth = Math.max(1, Math.round(width * span(lens, 0) / span(projection, 0)));
  const outHeight = Math.max(1, Math.round(height * span(lens, 1) / span(projection, 1)));
  const out = new Float64Array(outWidth * outHeight).fill(NaN);
  for (let j = 0; j < outHeight; j++) for (let i = 0; i < outWidth; i++) {
    const x = lens.min[0]! + (i + .5) / outWidth * span(lens, 0), y = lens.max[1]! - (j + .5) / outHeight * span(lens, 1);
    const gi = Math.floor((x - projection.min[0]!) / span(projection, 0) * width), gj = Math.floor((projection.max[1]! - y) / span(projection, 1) * height);
    if (gi >= 0 && gj >= 0 && gi < width && gj < height) out[j * outWidth + i] = field[gj * width + gi]!;
  }
  return { field: out, width: outWidth, height: outHeight };
}

/** The map and its legend numbers for one saved finite lens. Read-only. */
export async function lensDifference(root: string, prepared: PreparedReconstruction, options: { deliveryFactor?: number } = {}) {
  const { grid, material, bounds } = await loadLensLevelGrid(root, prepared);
  const deliveryFactor = options.deliveryFactor ?? DELIVERY_FACTOR;
  const onGrid = differenceField(grid, material, deliveryFactor);
  let footprint = 0, dark = 0, bright = 0, sum = 0;
  for (const delta of onGrid) if (Number.isFinite(delta)) {
    footprint++; sum += delta;
    if (delta < -AGREEMENT_TOLERANCE) dark++; else if (delta > AGREEMENT_TOLERANCE) bright++;
  }
  if (!footprint) throw new TypeError('This lens image covers none of the model projection.');
  const framed = fieldInLensFrame(onGrid, grid.width, grid.height, bounds.projection, bounds.lens);
  const rgba = Buffer.alloc(framed.width * framed.height * 4);
  framed.field.forEach((delta, p) => rgba.set(differenceColour(delta), p * 4));
  const png = await sharp(rgba, { raw: { width: framed.width, height: framed.height, channels: 4 } }).png().toBuffer();
  const percent = (value: number) => +(value / footprint * 100).toFixed(2);
  const summary: LensDifference = { schema: 'cssearth-nebula-lens-difference@1', resultId: prepared.resultId, imageId: prepared.imageId,
    width: framed.width, height: framed.height, rangeLevels: DIFFERENCE_RANGE, toleranceLevels: AGREEMENT_TOLERANCE,
    deliveryFactor, deliveryNote: `Render divided by ${deliveryFactor.toFixed(3)}; the default 1.140 = 61.0/53.5 is the analytic projection over a delivered-bank capture per footprint pixel (horalek-widefield).`,
    footprintPixels: footprint, agreePercent: percent(footprint - dark - bright), tooDarkPercent: percent(dark), tooBrightPercent: percent(bright),
    meanSignedDelta: +(sum / footprint).toFixed(2), swatches: SWATCH_LEVELS.map(levels => ({ levels, rgba: rgbaCss(differenceColour(levels)) })),
    note: 'Luminance of the render, corrected for delivery loss, minus this lens’s own sky-removed image. Blue: render too dark. ' +
      'Red: render too bright. Clear: within the tolerance, or outside the image footprint. Only meaningful from the Earth view.' };
  return { png, summary, field: onGrid, grid: { width: grid.width, height: grid.height } };
}

/** GET `?resultId=<lens>` answers the legend JSON; `&format=png` answers the overlay image. Never writes. */
export function lensDifferenceHandler(root: string, read: (resultId: string) => Promise<PreparedReconstruction>) {
  return async (request: IncomingMessage, response: ServerResponse) => {
    try {
      if (request.method !== 'GET') throw new TypeError('The difference map is read-only.');
      const url = new URL(request.url ?? '/', 'http://localhost'), id = url.searchParams.get('resultId') ?? '';
      if (!/^[a-f0-9]{64}$/.test(id)) throw new TypeError('Invalid reconstruction identity.');
      const { png, summary } = await lensDifference(root, await read(id));
      response.setHeader('Cache-Control', 'no-store');
      if (url.searchParams.get('format') === 'png') { response.setHeader('Content-Type', 'image/png'); response.end(png); }
      else { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(summary)); }
    } catch (error) {
      response.statusCode = 400; response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  };
}
