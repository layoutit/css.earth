/**
 * How fast Neptune's clouds drift in longitude at each latitude, measured from the frames themselves.
 *
 * Two frames of one filter taken hours apart show the same clouds displaced along their latitude circle. For each latitude
 * band the displacement is the lag that best correlates the two frames' longitude profiles; divided by the time between
 * them it is the drift rate against the planet's rotation frame. Bands without clouds give no correlation and no rate.
 */
import type { NeptuneFrame, Spheroid } from './voyager-frames.mts';
import type { MapGrid } from './voyager-map.mts';

export interface DriftPolicy {
  bandDegrees: number; highPassDegrees: number;
  /** Pairs are used when their exposures are this many hours apart. */
  minimumHours: number; maximumHours: number;
  /** Lags searched, as a drift rate in degrees per hour either side of zero. */
  maximumRateDegreesPerHour: number;
  minimumOverlapDegrees: number; minimumCorrelation: number; minimumContrast: number;
}
export const DRIFT_POLICY: DriftPolicy = { bandDegrees: 2, highPassDegrees: 24, minimumHours: 4, maximumHours: 20, maximumRateDegreesPerHour: 4.5,
  minimumOverlapDegrees: 40, minimumCorrelation: 0.8, minimumContrast: 0.004 };
export interface DriftSample { latitude: number; rateDegreesPerHour: number; correlation: number; hours: number; pair: [string, string] }

/** A frame's band profile along longitude: band mean, minus its own running mean, NaN where unseen. */
function bandProfile(map: Float32Array, grid: MapGrid, firstRow: number, rows: number, highPassColumns: number) {
  const mean = new Float32Array(grid.width).fill(NaN);
  for (let x = 0; x < grid.width; x++) { let sum = 0, n = 0; for (let y = firstRow; y < firstRow + rows; y++) { const v = map[y * grid.width + x]!; if (!Number.isNaN(v)) { sum += v; n++; } } if (n === rows) mean[x] = sum / n; }
  const profile = new Float32Array(grid.width).fill(NaN), half = Math.floor(highPassColumns / 2);
  for (let x = 0; x < grid.width; x++) {
    if (Number.isNaN(mean[x]!)) continue;
    let sum = 0, n = 0;
    for (let d = -half; d <= half; d++) { const v = mean[((x + d) % grid.width + grid.width) % grid.width]!; if (!Number.isNaN(v)) { sum += v; n++; } }
    // Only where the whole window is seen: near the edge of a frame's footprint the running mean is lopsided, and that
    // pattern travels with the camera, not with the clouds.
    if (n === 2 * half + 1) profile[x] = mean[x]! / (sum / n) - 1;
  }
  return profile;
}

export function measureDrift(frames: readonly NeptuneFrame[], maps: readonly Float32Array[], grid: MapGrid, policy: DriftPolicy = DRIFT_POLICY): DriftSample[] {
  const rowsPerBand = Math.round(policy.bandDegrees / 180 * grid.height), degreesPerColumn = 360 / grid.width, samples: DriftSample[] = [];
  const highPass = Math.round(policy.highPassDegrees / degreesPerColumn), minimumOverlap = Math.round(policy.minimumOverlapDegrees / degreesPerColumn);
  for (let firstRow = 0; firstRow + rowsPerBand <= grid.height; firstRow += rowsPerBand) {
    const latitude = 90 - (firstRow + rowsPerBand / 2) / grid.height * 180;
    const profiles = maps.map(map => bandProfile(map, grid, firstRow, rowsPerBand, highPass));
    for (let i = 0; i < frames.length; i++) for (let j = 0; j < frames.length; j++) {
      const hours = (frames[j]!.et - frames[i]!.et) / 3600;
      if (frames[i]!.filter !== frames[j]!.filter || hours < policy.minimumHours || hours > policy.maximumHours) continue;
      const a = profiles[i]!, b = profiles[j]!, maximumLag = Math.ceil(policy.maximumRateDegreesPerHour * hours / degreesPerColumn);
      // Anything fixed to the camera moves by the change in the longitude under the spacecraft; that lag is not a cloud's.
      const under = (frame: NeptuneFrame) => Math.atan2(frame.positionKm[1]!, frame.positionKm[0]!) * 180 / Math.PI;
      const cameraLag = ((under(frames[j]!) - under(frames[i]!)) % 360 + 540) % 360 - 180;
      let best = -Infinity, bestLag = 0, second = -Infinity;
      const scores = new Float32Array(2 * maximumLag + 1).fill(NaN);
      for (let lag = -maximumLag; lag <= maximumLag; lag++) {
        if (Math.abs(lag * degreesPerColumn - cameraLag) < 8) continue;
        let sab = 0, saa = 0, sbb = 0, n = 0;
        for (let x = 0; x < grid.width; x++) { const va = a[x]!, vb = b[((x + lag) % grid.width + grid.width) % grid.width]!; if (Number.isNaN(va) || Number.isNaN(vb)) continue; sab += va * vb; saa += va * va; sbb += vb * vb; n++; }
        if (n < minimumOverlap || Math.sqrt(saa / n) < policy.minimumContrast || Math.sqrt(sbb / n) < policy.minimumContrast) continue;
        const score = sab / Math.sqrt(saa * sbb); scores[lag + maximumLag] = score;
        if (score > best) { best = score; bestLag = lag; }
      }
      if (!(best >= policy.minimumCorrelation)) continue;
      // The peak must stand clear of any other peak more than 6 degrees away, or the band's clouds repeat and the lag is ambiguous.
      for (let lag = -maximumLag; lag <= maximumLag; lag++) if (Math.abs(lag - bestLag) * degreesPerColumn > 6 && scores[lag + maximumLag]! > second) second = scores[lag + maximumLag]!;
      if (second > best - 0.15) continue;
      samples.push({ latitude, rateDegreesPerHour: bestLag * degreesPerColumn / hours, correlation: best, hours, pair: [frames[i]!.id, frames[j]!.id] });
    }
  }
  return samples;
}

/** Zonal speed in m/s (eastward positive) of a drift rate at a planetographic latitude. */
export function driftSpeed(rateDegreesPerHour: number, latitudeDegrees: number, { equatorialKm: a, polarKm: c }: Spheroid) {
  const latitude = latitudeDegrees * Math.PI / 180, parametric = Math.atan2(c * Math.sin(latitude), a * Math.cos(latitude));
  return rateDegreesPerHour * Math.PI / 180 / 3600 * a * Math.cos(parametric) * 1000;
}

/**
 * The Voyager zonal wind fit of Sromovsky, Limaye and Fry (1993, Icarus 105, 110): speed in m/s, eastward positive, against
 * the 16.11 h radio rotation, at a latitude in degrees. Coefficients as tabulated by Fitzpatrick et al. (2014, arXiv:1312.2676, table 1).
 */
export const VOYAGER_WIND_FIT = { constant: -398, quadratic: 0.188, quartic: -1.2e-5 } as const;
export const windSpeed = (latitudeDegrees: number) => VOYAGER_WIND_FIT.constant + VOYAGER_WIND_FIT.quadratic * latitudeDegrees ** 2 + VOYAGER_WIND_FIT.quartic * latitudeDegrees ** 4;
/** Drift in degrees of longitude per hour (eastward positive) that the wind fit gives at a planetographic latitude. */
export function windDriftRate(latitudeDegrees: number, { equatorialKm: a, polarKm: c }: Spheroid) {
  const latitude = latitudeDegrees * Math.PI / 180, parametric = Math.atan2(c * Math.sin(latitude), a * Math.cos(latitude)), axisDistanceMeters = a * Math.cos(parametric) * 1000;
  return axisDistanceMeters < 1 ? 0 : windSpeed(latitudeDegrees) / axisDistanceMeters * 3600 * 180 / Math.PI;
}

export interface DriftBand { latitude: number; rateDegreesPerHour: number; pairs: number; spread: number }
/** Bands whose pairs agree: the median rate where at least `minimumPairs` pairs lie within `maximumSpread` degrees per hour of it. */
export function driftBands(samples: readonly DriftSample[], minimumPairs = 6, maximumSpread = 0.25): DriftBand[] {
  const byLatitude = new Map<number, number[]>();
  for (const sample of samples) byLatitude.set(sample.latitude, [...(byLatitude.get(sample.latitude) ?? []), sample.rateDegreesPerHour]);
  const bands: DriftBand[] = [];
  for (const [latitude, rates] of byLatitude) {
    rates.sort((p, q) => p - q);
    const median = rates[Math.floor(rates.length / 2)]!, near = rates.filter(rate => Math.abs(rate - median) <= maximumSpread);
    if (near.length < minimumPairs || near.length < 0.6 * rates.length) continue;
    const mean = near.reduce((p, q) => p + q, 0) / near.length;
    bands.push({ latitude, rateDegreesPerHour: mean, pairs: near.length, spread: Math.sqrt(near.reduce((p, q) => p + (q - mean) ** 2, 0) / near.length) });
  }
  return bands.sort((p, q) => q.latitude - p.latitude);
}

/**
 * The drift used to carry frames to an epoch: the rate measured from the frames in the bands where their clouds gave one,
 * joined linearly between measured bands no more than `bridgeDegrees` apart, and the published wind fit everywhere else.
 * A measured band hands over to the fit across `bridgeDegrees`, so the applied drift has no step.
 */
export function driftProfile(bands: readonly DriftBand[], spheroid: Spheroid, bridgeDegrees = 4) {
  const sorted = [...bands].sort((p, q) => p.latitude - q.latitude);
  return (latitudeDegrees: number) => {
    const fit = windDriftRate(latitudeDegrees, spheroid);
    if (sorted.length === 0) return fit;
    let below: DriftBand | undefined, above: DriftBand | undefined;
    for (const band of sorted) { if (band.latitude <= latitudeDegrees) below = band; else { above = band; break; } }
    const toward = (band: DriftBand) => { const distance = Math.abs(band.latitude - latitudeDegrees), share = Math.max(0, 1 - distance / bridgeDegrees); return band.rateDegreesPerHour * share + fit * (1 - share); };
    if (below && above && above.latitude - below.latitude <= bridgeDegrees) { const f = (latitudeDegrees - below.latitude) / (above.latitude - below.latitude); return below.rateDegreesPerHour * (1 - f) + above.rateDegreesPerHour * f; }
    if (below && above) return latitudeDegrees - below.latitude < above.latitude - latitudeDegrees ? toward(below) : toward(above);
    return toward((below ?? above)!);
  };
}
