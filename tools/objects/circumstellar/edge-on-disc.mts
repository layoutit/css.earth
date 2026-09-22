/** An edge-on circumstellar disc seen in a coronagraph image, given depth the way disc-envelope.mts gives a face-on ring depth: a
 * three-dimensional shape is fitted to what was measured and each sky column is spread along it. Nothing is extruded.
 *
 * A ring seen near face-on traces an ellipse whose axes give its geometry. A disc seen edge-on traces a line: its midplane on the
 * sky. So the measurement here is the midplane, not a ridge ellipse:
 *
 * 1. `midplaneGeometry` finds the position angle of the midplane and the star's offset from it. It bins the image along a trial
 *    direction, takes the brightness-weighted height of each bin's vertical profile, fits a line through those heights, and
 *    turns the trial direction by the line's slope until it stops moving. The vertical width of each bin (its brightness-weighted
 *    second moment) and the brightness of each side are reported with it.
 * 2. `registerStarByPlanet` places the star in a coronagraph mosaic from a planet whose orbit is known, where the mosaic's own
 *    pointing is not good enough.
 *
 * The depth is not fitted here. An edge-on image integrates through the whole disc plane, so a shape pushed along each sight
 * line is an extrusion; the lab reconstructs the emission in three dimensions by axial symmetry about the disc's normal
 * (labs/nebula reconstruct-circumstellar), and the author reads that reconstruction.
 *
 * Which side of the midplane tilts toward the observer is a stated convention (`nearSidePositionAngleDeg`), as for the ring. */
import { readFitsFileHdus, readFitsFileRegion } from '../../fits/fits.mts';
import { skyProjection } from '../../fits/fits-sky.mts';
import type { SkyPlane } from './disc-envelope.mts';

const DEG = Math.PI / 180;

export interface MidplaneGeometry {
  /** Position angle of the midplane, degrees east of north, in [0, 180). */
  readonly positionAngleDeg: number;
  /** The star's offset from the fitted midplane, in units, positive toward the position angle + 90 side (west of the midplane for a north-south disc). */
  readonly starOffsetUnits: number;
  /** Bins along the midplane: signed distance from the star along the position angle (positive toward it), the height of the
   * brightness-weighted centre, the brightness-weighted vertical width (one sigma), the bin's peak over the noise. */
  readonly bins: readonly { readonly alongUnits: number; readonly heightUnits: number; readonly widthUnits: number; readonly peakOverNoise: number }[];
  /** Root-mean-square distance of the bin centres from the fitted line, in units. */
  readonly ridgeResidualUnits: number;
  /** The scatter of the position angle over the binnings tried. */
  readonly positionAngleSpreadDeg: number;
  /** Total brightness on each side of the star along the midplane (positive: toward the position angle) and their ratio. */
  readonly sideBrightness: { readonly positive: number; readonly negative: number; readonly ratio: number };
  /** Iterations the direction took to settle. */
  readonly iterations: number;
}

/** Sky-plane coordinates (x west, y north) of a point `along` units toward position angle `pa` and `across` units toward pa + 90. */
const skyBasisOf = (pa: number) => ({ along: [-Math.sin(pa * DEG), Math.cos(pa * DEG)] as const, across: [-Math.cos(pa * DEG), -Math.sin(pa * DEG)] as const });

/** The midplane's direction and the star's offset from it, measured on the image between the inner mask and the outer radius. */
export function midplaneGeometry(sky: SkyPlane, options: { innerMaskUnits: number; outerUnits: number; halfHeightUnits: number; binUnits?: number; minimumPeakOverNoise?: number; initialPositionAngleDeg?: number }): MidplaneGeometry {
  const { size, halfUnits, step, plane, noise } = sky, minimum = options.minimumPeakOverNoise ?? 5;
  const binUnits = options.binUnits ?? 4 * step;
  if (!(options.halfHeightUnits > 0) || !(options.outerUnits > options.innerMaskUnits)) throw new RangeError('The midplane search needs a positive half height and an annulus.');
  // The starting direction: the brightness-weighted principal axis of the annulus, unless one is given.
  let pa = options.initialPositionAngleDeg;
  if (pa === undefined) {
    let sxx = 0, sxy = 0, syy = 0;
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const x = -halfUnits + (i + 0.5) * step, y = -halfUnits + (j + 0.5) * step, r = Math.hypot(x, y), v = plane[j * size + i]!;
      if (!Number.isFinite(v) || v <= 0 || r < options.innerMaskUnits || r >= options.outerUnits) continue;
      sxx += v * x * x; sxy += v * x * y; syy += v * y * y;
    }
    // Principal axis of the second moments; position angle east of north with x west.
    const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    pa = ((Math.atan2(-Math.cos(theta), Math.sin(theta)) / DEG) % 180 + 180) % 180;
  }
  let offset = 0, iterations = 0, result: Omit<MidplaneGeometry, 'positionAngleSpreadDeg' | 'iterations'> | undefined;
  const measure = (direction: number, across0: number, bin: number) => {
    // Each bin along the direction keeps its vertical profile, one sample wide, so its ridge can be found: the height of peak
    // brightness, refined by the parabola through the brightest sample and its neighbours. The ridge follows the main disc; a
    // brightness-weighted centre would be pulled toward a fainter tilted component (Beta Pictoris's secondary disc).
    const levels = Math.ceil(options.halfHeightUnits / step), basis = skyBasisOf(direction);
    const bins = new Map<number, { w: number; wh: number; whh: number; peak: number; total: Float64Array; count: Float64Array }>();
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const x = -halfUnits + (i + 0.5) * step, y = -halfUnits + (j + 0.5) * step, r = Math.hypot(x, y), v = plane[j * size + i]!;
      if (!Number.isFinite(v) || r < options.innerMaskUnits || r >= options.outerUnits) continue;
      const along = x * basis.along[0] + y * basis.along[1], across = x * basis.across[0] + y * basis.across[1] - across0;
      if (Math.abs(across) > options.halfHeightUnits) continue;
      const k = Math.floor(along / bin);
      let entry = bins.get(k);
      if (!entry) bins.set(k, entry = { w: 0, wh: 0, whh: 0, peak: -Infinity, total: new Float64Array(2 * levels + 1), count: new Float64Array(2 * levels + 1) });
      const level = Math.max(0, Math.min(2 * levels, Math.round(across / step) + levels));
      entry.total[level]! += v; entry.count[level]! += 1;
      if (v > 0) { entry.w += v; entry.wh += v * across; entry.whh += v * across * across; entry.peak = Math.max(entry.peak, v); }
    }
    const rows = [...bins].filter(([, e]) => e.w > 0 && e.peak / noise >= minimum).flatMap(([k, e]) => {
      const mean = (level: number) => e.count[level]! > 0 ? e.total[level]! / e.count[level]! : -Infinity;
      let best = -1, top = -Infinity;
      for (let level = 0; level <= 2 * levels; level++) if (mean(level) > top) { top = mean(level); best = level; }
      // A ridge on the strip's edge is not a ridge.
      if (best <= 0 || best >= 2 * levels) return [];
      const before = mean(best - 1), after = mean(best + 1), curvature = before - 2 * top + after;
      const offset = curvature < 0 && Number.isFinite(before) && Number.isFinite(after) ? Math.max(-0.5, Math.min(0.5, (before - after) / (2 * curvature))) : 0;
      const centre = e.wh / e.w, width = Math.sqrt(Math.max(0, e.whh / e.w - centre * centre));
      return [{ alongUnits: (k + 0.5) * bin, heightUnits: (best - levels + offset) * step + across0, widthUnits: width, peakOverNoise: e.peak / noise }];
    }).sort((p, q) => p.alongUnits - q.alongUnits);
    if (rows.length < 6) throw new Error(`The midplane is found in only ${rows.length} bins above ${minimum} times the noise.`);
    // A line through the bin centres: height = c + s * along, weighted by each bin's peak over the noise.
    let sw = 0, sa = 0, sh = 0, saa = 0, sah = 0;
    for (const row of rows) { const w = row.peakOverNoise; sw += w; sa += w * row.alongUnits; sh += w * row.heightUnits; saa += w * row.alongUnits ** 2; sah += w * row.alongUnits * row.heightUnits; }
    const slope = (sw * sah - sa * sh) / (sw * saa - sa * sa), intercept = (sh - slope * sa) / sw;
    const residual = Math.sqrt(rows.reduce((total, row) => total + (row.heightUnits - intercept - slope * row.alongUnits) ** 2, 0) / rows.length);
    let positive = 0, negative = 0;
    for (const [k, e] of bins) { if (k >= 0) positive += e.w; else negative += e.w; }
    return { slope, intercept, rows, residual, positive, negative };
  };
  // A line rising by `slope` toward the across direction (position angle + 90) runs at the direction's position angle plus atan(slope).
  const paOf = (direction: number, slope: number) => ((direction + Math.atan(slope) / DEG) % 180 + 180) % 180;
  // The ridge heights are quantised to the samples, so the direction is turned by half its measured slope each time and
  // settles once a turn is under a twentieth of a degree.
  for (; iterations < 40; iterations++) {
    const m = measure(pa, offset, binUnits);
    const next = paOf(pa, m.slope / 2), nextOffset = m.intercept;
    result = { positionAngleDeg: next, starOffsetUnits: nextOffset, bins: m.rows, ridgeResidualUnits: m.residual, sideBrightness: { positive: m.positive, negative: m.negative, ratio: m.negative > 0 ? m.positive / m.negative : Infinity } };
    const moved = Math.abs(((next - pa) % 180 + 270) % 180 - 90) > 0.05 || Math.abs(nextOffset - offset) > 0.05 * step;
    pa = next; offset = nextOffset;
    if (!moved) break;
  }
  // The spread over binnings: the settled direction re-measured with bins two thirds and one and a half times as long.
  const angles = [binUnits * 2 / 3, binUnits, binUnits * 1.5].map(bin => paOf(pa!, measure(pa!, offset, bin).slope));
  const spread = Math.sqrt(angles.reduce((total, angle) => total + (((angle - pa!) % 180 + 270) % 180 - 90) ** 2, 0) / angles.length);
  return { ...result!, positionAngleSpreadDeg: spread, iterations: iterations + 1 };
}

export interface PlanetRegistration {
  /** The planet's predicted offset from the star at the mosaic's mid-exposure, arcseconds east and north. */
  readonly predictedEastNorthArcsec: readonly [number, number];
  /** Where the mosaic's own WCS puts the target, and where the planet was found, in mosaic pixels. */
  readonly targetPixel: readonly [number, number]; readonly predictedPixel: readonly [number, number]; readonly foundPixel: readonly [number, number];
  /** The peak over the median of the ring around it, and the correction applied to the target position, milliarcseconds east and north. */
  readonly peakOverLocal: number; readonly correctionMas: readonly [number, number];
  /** The star's ICRS position the mosaic is read about. */
  readonly starRaDecDeg: readonly [number, number];
}

/** Where the star is in a coronagraph mosaic, from a planet whose orbit is known: the brightest pixel within `searchArcsec` of
 * the planet's predicted position, refined by the flux-weighted centroid within one PSF full width at half maximum above the
 * median of the ring two to three widths out. The mosaic's WCS is shifted so the planet lands on its prediction, and the star's
 * position in that shifted frame is returned. A coronagraph mosaic's WCS carries the telescope's pointing, which on Beta
 * Pictoris is off by 80 to 90 mas (programme 4758); the planet's orbit is known to a milliarcsecond. */
export async function registerStarByPlanet(mosaic: string, primary: Record<string, unknown>, predictedEastNorthArcsec: readonly [number, number], options: { searchArcsec: number; fwhmArcsec: number; minimumPeakOverLocal?: number }): Promise<PlanetRegistration> {
  const hdus = await readFitsFileHdus(mosaic), sci = hdus.find(hdu => hdu.header.EXTNAME === 'SCI');
  if (!sci) throw new Error(`${mosaic} has no SCI extension.`);
  const [width, height] = sci.dimensions as [number, number];
  const { values } = await readFitsFileRegion(mosaic, sci, { x0: 0, y0: 0, width, height }, 1024 ** 3);
  const projection = skyProjection(sci.header), ra = Number(primary.TARG_RA), dec = Number(primary.TARG_DEC);
  if (!Number.isFinite(ra) || !Number.isFinite(dec)) throw new TypeError('The mosaic names no target position.');
  const cosDec = Math.cos(dec * DEG), [east, north] = predictedEastNorthArcsec;
  const target = projection.pixelOf(ra, dec), predicted = projection.pixelOf(ra + east / 3600 / cosDec, dec + north / 3600);
  if (!target || !predicted) throw new Error('The target or the planet is off the tangent plane.');
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height ? values[y * width + x]! : NaN;
  const search = Math.ceil(options.searchArcsec / projection.scaleArcsec), fwhm = options.fwhmArcsec / projection.scaleArcsec, box = Math.ceil(fwhm);
  let peak = -Infinity, px = 0, py = 0;
  for (let y = Math.round(predicted[1]) - search; y <= Math.round(predicted[1]) + search; y++) for (let x = Math.round(predicted[0]) - search; x <= Math.round(predicted[0]) + search; x++) {
    const v = at(x, y); if (Number.isFinite(v) && v > peak && Math.hypot(x - predicted[0], y - predicted[1]) <= search) { peak = v; px = x; py = y; }
  }
  const ring: number[] = [];
  for (let y = py - 3 * box; y <= py + 3 * box; y++) for (let x = px - 3 * box; x <= px + 3 * box; x++) {
    const r = Math.hypot(x - px, y - py), v = at(x, y); if (r > 2 * box && r <= 3 * box && Number.isFinite(v)) ring.push(v);
  }
  ring.sort((a, b) => a - b);
  const local = ring[ring.length >> 1]!, spread = 1.4826 * [...ring.map(v => Math.abs(v - local))].sort((a, b) => a - b)[ring.length >> 1]!;
  const peakOverLocal = (peak - local) / spread;
  if (!(peakOverLocal >= (options.minimumPeakOverLocal ?? 5))) throw new Error(`The planet is not found: its peak is ${peakOverLocal.toFixed(1)} times the scatter around it.`);
  let sw = 0, sx = 0, sy = 0;
  for (let y = py - box; y <= py + box; y++) for (let x = px - box; x <= px + box; x++) {
    const v = at(x, y) - local; if (Number.isFinite(v) && v > 0 && Math.hypot(x - px, y - py) <= fwhm) { sw += v; sx += v * x; sy += v * y; }
  }
  const found: [number, number] = [sx / sw, sy / sw];
  // Shift the frame so the planet lands on its prediction: the star is the target pixel moved by the same offset.
  const [starRa, starDec] = projection.skyOf(target[0] + found[0] - predicted[0], target[1] + found[1] - predicted[1]);
  return { predictedEastNorthArcsec, targetPixel: target, predictedPixel: predicted, foundPixel: found, peakOverLocal,
    correctionMas: [(starRa - ra) * cosDec * 3.6e6, (starDec - dec) * 3.6e6], starRaDecDeg: [starRa, starDec] };
}
