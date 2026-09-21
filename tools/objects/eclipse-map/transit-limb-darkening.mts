/** A star's quadratic limb darkening measured from its planet's transits in TESS light curves. Each SPOC light-curve file (one
 * sector, 2-minute cadence) is read for its good-quality PDCSAP flux; every transit with enough data on both sides is divided by a
 * straight line fitted outside it and folded onto the reference transit of the planet's hosted orbit. The folded transit is fitted by
 * `measureTransitShift`, which refines the radius ratio and the two coefficients together with the transit time. The value is the fit
 * to all sectors together; the bounds are the least and greatest coefficients the sectors give one by one, a measure of how far the
 * result moves between seasons rather than a formal error. */
import type { HostedOrbit } from '@cssearth/astronomy';
import { binaryTable, numbers, readFitsHdus, tableColumn } from '../interferometry/fits-table.mts';
import { measureTransitShift } from './transit-timing.mts';

/** TESS times are BJD_TDB - 2457000; the hosted orbit's transit time is BJD_TDB - 2400000.5. */
const BTJD_TO_BMJD = 2457000 - 2400000.5;
const HALF_WINDOW_DAYS = 0.2, OUT_OF_TRANSIT_DAYS = 0.06, IN_TRANSIT_DAYS = 0.05, MIN_OUTSIDE = 150, MIN_INSIDE = 60;

export interface TessLightCurve {
  readonly sector: number; readonly ticId: number; readonly exposureSeconds: number;
  readonly time: Float64Array; readonly flux: Float64Array; readonly error: Float64Array;
}

/** The good-quality (QUALITY 0) PDCSAP samples of a SPOC light-curve file, on the BMJD_TDB scale. The header must state the TDB
 * barycentric time system TESS uses, or the file is refused. */
export function readTessLightCurve(bytes: Buffer): TessLightCurve {
  const [primary, table] = readFitsHdus(bytes);
  if (!primary || !table || table.extname !== 'LIGHTCURVE') throw new TypeError('A TESS light-curve file has a LIGHTCURVE table after its primary header.');
  const { TIMESYS, BJDREFI, BJDREFF, TIMEUNIT } = table.header;
  if (TIMESYS !== 'TDB' || BJDREFI !== 2457000 || BJDREFF !== 0 || TIMEUNIT !== 'd') throw new TypeError('The light curve must be in BJD_TDB - 2457000 days.');
  const sector = Number(primary.header.SECTOR), ticId = Number(primary.header.TICID);
  if (!Number.isInteger(sector) || !Number.isInteger(ticId)) throw new TypeError('The light curve must state its sector and TIC id.');
  const integrationSeconds = Number(table.header.INT_TIME) * Number(table.header.NUM_FRM);
  if (!(Number.isFinite(integrationSeconds) && integrationSeconds > 0 && Number(table.header.TIMEPIXR) === .5))
    throw new TypeError('The light curve must state its centered photon-accumulation duration.');
  const rows = binaryTable(table), columns = ['TIME', 'PDCSAP_FLUX', 'PDCSAP_FLUX_ERR', 'QUALITY'].map(name => tableColumn(rows, name));
  const time: number[] = [], flux: number[] = [], error: number[] = [];
  for (let row = 0; row < rows.rows; row++) {
    const [t, f, e, quality] = columns.map(column => numbers(bytes, rows, row, column)[0]!);
    if (quality === 0 && [t, f, e].every(Number.isFinite)) { time.push(t! + BTJD_TO_BMJD); flux.push(f!); error.push(e!); }
  }
  return { sector, ticId, exposureSeconds: integrationSeconds, time: Float64Array.from(time), flux: Float64Array.from(flux), error: Float64Array.from(error) };
}

/** Every transit in the light curves with at least `MIN_OUTSIDE` samples beyond 0.06 d and `MIN_INSIDE` within 0.05 d of mid-transit
 * (inside a 0.2 d half-window), normalised by its out-of-transit line and folded onto the orbit's reference transit, in time order. */
export function foldTransits(curves: readonly TessLightCurve[], orbit: Pick<HostedOrbit, 'periodDays' | 'transitTimeBmjdTdb'>) {
  const samples: [number, number, number][] = [];
  let transits = 0;
  for (const curve of curves) {
    const { time, flux, error } = curve, first = Math.ceil((time[0]! - orbit.transitTimeBmjdTdb) / orbit.periodDays), last = Math.floor((time.at(-1)! - orbit.transitTimeBmjdTdb) / orbit.periodDays);
    for (let epoch = first; epoch <= last; epoch++) {
      const middle = orbit.transitTimeBmjdTdb + epoch * orbit.periodDays, near: number[] = [];
      for (let i = 0; i < time.length; i++) if (Math.abs(time[i]! - middle) < HALF_WINDOW_DAYS) near.push(i);
      const outside = near.filter(i => Math.abs(time[i]! - middle) > OUT_OF_TRANSIT_DAYS), inside = near.filter(i => Math.abs(time[i]! - middle) < IN_TRANSIT_DAYS);
      if (outside.length < MIN_OUTSIDE || inside.length < MIN_INSIDE) continue;
      let sx = 0, sy = 0, sxx = 0, sxy = 0;
      for (const i of outside) { const x = time[i]! - middle; sx += x; sy += flux[i]!; sxx += x * x; sxy += x * flux[i]!; }
      const n = outside.length, slope = (n * sxy - sx * sy) / (n * sxx - sx * sx), intercept = (sy - slope * sx) / n;
      for (const i of near) { const baseline = intercept + slope * (time[i]! - middle); samples.push([orbit.transitTimeBmjdTdb + time[i]! - middle, flux[i]! / baseline, error[i]! / baseline]); }
      transits++;
    }
  }
  samples.sort((a, b) => a[0] - b[0]);
  return { transits, time: Float64Array.from(samples, s => s[0]), flux: Float64Array.from(samples, s => s[1]), error: Float64Array.from(samples, s => s[2]) };
}

export function fitTransitLimbDarkening(curves: readonly TessLightCurve[], orbit: HostedOrbit, host: { rightAscensionDegrees: number; declinationDegrees: number }, radiusRatio: number) {
  const fit = (subset: readonly TessLightCurve[]) => {
    const exposures = new Set(subset.map(curve => curve.exposureSeconds));
    if (exposures.size !== 1) throw new TypeError('Folded transit light curves must share one recorded exposure duration.');
    const folded = foldTransits(subset, orbit);
    const result = measureTransitShift(folded, orbit, host, radiusRatio, { windowDays: HALF_WINDOW_DAYS, rangeSeconds: 60, exposureSeconds: subset[0]!.exposureSeconds });
    return { transits: folded.transits, samples: result.samples, radiusRatio: result.radiusRatio, shiftSeconds: result.shiftSeconds, reducedChiSquared: result.reducedChiSquared,
      shiftUncertaintySeconds: result.uncertaintySeconds, exposureSeconds: subset[0]!.exposureSeconds, u1: result.limbDarkening[0], u2: result.limbDarkening[1], software: result.fit.software };
  };
  const all = fit(curves), sectors = curves.length > 1 ? curves.map(curve => ({ sector: curve.sector, ...fit([curve]) })) : [];
  const bounds = (key: 'u1' | 'u2') => (sectors.length ? [Math.min(...sectors.map(s => s[key])), Math.max(...sectors.map(s => s[key]))] : [all[key], all[key]]) as [number, number];
  return { u1: all.u1, u2: all.u2, u1Bounds: bounds('u1'), u2Bounds: bounds('u2'), all, sectors };
}
