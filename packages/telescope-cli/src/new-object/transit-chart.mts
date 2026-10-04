/** A generated planet's transit chart: its host's TESS light curves as the SPOC pipeline delivers them (2-minute cadence, one sector
 * per file), folded onto the planet's hosted orbit at bake (`folded-transit`, site/build/charts). The planet's TIC id and transit
 * duration are the NASA Exoplanet Archive's; the files are the newest three sectors MAST holds, downloaded unchanged and pinned in
 * the manifest like any other source. The chart is drawn only when the fold measures the dip: its depth (the mean of the middle 60%
 * of the transit below the baseline) at least DETECTION_SIGMA times its standard error. A planet with no 2-minute light curve, no
 * whole transit, or a dip TESS does not resolve gets no chart, and the report says which. */
import { resolve } from 'node:path';
import type { Archive } from './archives/archives.mts';
import type { PackageFiles } from './dataset.mts';
import { NASA_TAP } from './orbit.mts';

/** At most this many sectors, newest first: enough transits to stack for a short-period planet, a few MB per planet. */
export const TRANSIT_SECTORS = 3;
/** A dip is drawn when its depth is at least this many standard errors: a 5-sigma detection, the usual bar for a transit. */
export const DETECTION_SIGMA = 5;
export interface FoldMeasure { readonly transits: number; readonly depthPpm: number; readonly errorPpm: number }
/** The fold the gate measures: the light curves' mean time (BMJD_TDB), and the dip with the ephemeris moved by `shiftMinutes`. */
export interface Fold { midBmjd(curves: readonly Buffer[]): number; measure(curves: readonly Buffer[], durationHours: number, shiftMinutes: number): FoldMeasure }
/** How far from its ephemeris a dip is looked for: this many times the ephemeris's own uncertainty at the light curves' dates. */
export const ALIGN_SIGMA = 3;
const SPOC_LIGHT_CURVE = /^tess\d{13}-s\d{4}-\d{16}-\d{4}-s$/u;

export interface LightCurveFile { readonly name: string; readonly uri: string; readonly bytes: number; readonly sector: number }
/** The MAST calls the chart needs, passed in so tests answer offline. */
export interface TessArchive {
  lightCurves(tic: string): Promise<LightCurveFile[]>;
  download(file: LightCurveFile): Promise<Buffer>;
}

/** MAST through the telescope's Astroquery boundary: single-sector SPOC observations at 120 s, then each one's LC product. */
export async function liveTessArchive(): Promise<TessArchive> {
  const { MAST_CACHE, mastFile, mastService } = await import('@cssearth/telescope/node'), { readFile } = await import('node:fs/promises');
  return {
    async lightCurves(tic) {
      const observations = await mastService({ service: 'Mast.Caom.Filtered', pagesize: 500, page: 1, params: { columns: 'obsid,obs_id,provenance_name,t_exptime,sequence_number',
        filters: [{ paramName: 'obs_collection', values: ['TESS'] }, { paramName: 'dataproduct_type', values: ['timeseries'] }, { paramName: 'target_name', values: [tic] }, { paramName: 'dataRights', values: ['PUBLIC'] }] } });
      const sectors = observations.rows.filter(row => row.provenance_name === 'SPOC' && Number(row.t_exptime) === 120 && SPOC_LIGHT_CURVE.test(String(row.obs_id)))
        .sort((a, b) => Number(b.sequence_number) - Number(a.sequence_number)).slice(0, TRANSIT_SECTORS);
      const files: LightCurveFile[] = [];
      for (const row of sectors) {
        const products = await mastService({ service: 'Mast.Caom.Products', params: { obsid: String(row.obsid) } });
        const lc = products.rows.find(product => product.productSubGroupDescription === 'LC');
        if (lc) files.push({ name: String(lc.productFilename), uri: String(lc.dataURI), bytes: Number(lc.size), sector: Number(row.sequence_number) });
      }
      return files;
    },
    async download(file) { return readFile(await mastFile(file, resolve(MAST_CACHE, 'tess'))); },
  };
}

/** The planet's TIC id and published transit duration, from the archive's composite row. */
async function ticAndDuration(archive: Archive, planet: string) {
  const csv = await archive.text(`${NASA_TAP}?${new URLSearchParams({ query: `select tic_id,pl_trandur from pscomppars where pl_name='${planet.replace(/'/gu, "''")}'`, format: 'csv' })}`);
  const [header, row] = csv.trim().split(/\r?\n/u);
  if (header !== 'tic_id,pl_trandur' || !row) return undefined;
  const [tic, duration] = row.split(',').map(cell => cell.replace(/^"|"$/gu, ''));
  const digits = /^TIC (\d+)$/u.exec(tic ?? '')?.[1], hours = Number(duration);
  return digits && hours > 0 ? { tic: digits, durationHours: hours } : undefined;
}

/** Whether TESS shows planet `name`'s transit: its newest SPOC light curves folded on `fold`, the dip looked for within ALIGN_SIGMA
 * times the ephemeris's uncertainty and kept only at DETECTION_SIGMA or more. The draft asks this to choose planets, and the chart
 * to draw one; `reason` says why there is none. */
export async function detectTransit(archive: Archive, name: string, tess: TessArchive, fold?: Fold, timingSigmaDays?: (epochBjd: number) => number) {
  const found = await ticAndDuration(archive, name);
  if (!found) return { reason: 'no TIC id or transit duration in the archive' } as const;
  const lightCurves = (await tess.lightCurves(found.tic)).sort((a, b) => a.sector - b.sector);
  if (!lightCurves.length) return { reason: `TESS holds no 2-minute SPOC light curve of TIC ${found.tic}` } as const;
  const bytes = await Promise.all(lightCurves.map(file => tess.download(file)));
  // The dip is looked for within ALIGN_SIGMA times the ephemeris's uncertainty at these dates, and drawn only when a whole transit
  // folds (the bake would refuse an empty one) and the dip there is at least DETECTION_SIGMA times its standard error.
  const sectorList = lightCurves.map(file => file.sector).join(', ');
  const sigmaMinutes = fold && timingSigmaDays ? timingSigmaDays(fold.midBmjd(bytes) + 2400000.5) * 1440 : 0, reach = Math.min(720, Math.floor(ALIGN_SIGMA * sigmaMinutes / 2) * 2);
  let measured: (FoldMeasure & { shift: number }) | undefined;
  if (fold) for (let shift = -reach; shift <= reach; shift += 2) {
    const m = fold.measure(bytes, found.durationHours, shift);
    if (m.transits > 0 && (!measured || m.depthPpm / m.errorPpm > measured.depthPpm / measured.errorPpm)) measured = { ...m, shift };
  }
  if (fold && !measured) return { reason: `no whole transit in TESS sectors ${sectorList}` } as const;
  const where = sigmaMinutes ? ` within ${ALIGN_SIGMA} sigma (${Math.round(ALIGN_SIGMA * sigmaMinutes)} min) of its ephemeris` : ' at its ephemeris';
  if (measured && !(measured.depthPpm >= DETECTION_SIGMA * measured.errorPpm))
    return { reason: `TESS sectors ${sectorList} show no ${DETECTION_SIGMA}-sigma dip${where} (best ${Math.round(measured.depthPpm)} ± ${Math.round(measured.errorPpm)} ppm over ${measured.transits} transits)` } as const;
  return { found, lightCurves, bytes, measured, sigmaMinutes } as const;
}

/** Add the transit chart's files, recipe and control to a planet's package, or say why there is none. */
export async function installTransitChart(files: PackageFiles, id: string, name: string, archive: Archive, tess: TessArchive, fold?: Fold, timingSigmaDays?: (epochBjd: number) => number, archiveName = name) {
  const s = `src/objects/${id}/source`, detected = await detectTransit(archive, archiveName, tess, fold, timingSigmaDays);
  if ('reason' in detected) return { report: `${id}: ${detected.reason}, so no transit chart` };
  const { found, lightCurves, bytes, measured, sigmaMinutes } = detected;
  // A dip found off the ephemeris, within its uncertainty, is drawn where TESS measures it, and the chart says by how much.
  const align = measured && Math.abs(measured.shift) > 2 ? measured.shift : 0, sigmaText = Math.max(1, Math.round(sigmaMinutes));
  const paths = lightCurves.map(file => `photometry/tess/${file.name}`), sectors = lightCurves.map(file => file.sector).join(', ');
  lightCurves.forEach((file, i) => files.set(`${s}/${paths[i]}`, bytes[i]!));
  // About fifteen bins across the transit, never finer than the 2-minute cadence.
  const binMinutes = Math.max(4, Math.round(found.durationHours * 60 / 15)), chartId = `${id}-transit`;
  const description = `${name} crossing its star, as TESS recorded it: ${lightCurves.length} sector${lightCurves.length === 1 ? '' : 's'} (${sectors}) of the SPOC pipeline's 2-minute light curves of TIC ${found.tic}, each transit divided by a straight line fitted to the light either side and folded onto the orbit the app draws${align ? `, moved ${Math.abs(align)} minutes ${align < 0 ? 'earlier' : 'later'} to where TESS measures the dip, inside the published ephemeris's ${ALIGN_SIGMA}-sigma uncertainty of ${Math.round(ALIGN_SIGMA * sigmaMinutes)} minutes at these dates` : ''}, then averaged in ${binMinutes}-minute bins. Error bars are each bin's standard error.`;
  const recipe = { kind: 'folded-transit', id: chartId, title: `${name}: its transit`, description, output: `${chartId}.svg`, metadata: { tic: `TIC ${found.tic}`, sectors: lightCurves.map(file => file.sector), pipeline: 'TESS SPOC, PDCSAP flux, quality 0' },
    planet: id, sources: paths, durationHours: found.durationHours, binMinutes, ...(align ? { alignMinutes: align } : {}),
    notes: [`TESS 2-min SPOC · sector${lightCurves.length === 1 ? '' : 's'} ${sectors}`.slice(0, 52),
      ...(align ? [`Aligned on TESS's dip, ${Math.abs(align)} min ${align < 0 ? 'early' : 'late'}; ${binMinutes}-min bins.`, `The ephemeris's own 1σ there is ${sigmaText} min.`] : [`Folded on the app's orbit; ${binMinutes}-min bins.`]),
      'Bars: standard error of each bin.'] };
  const control = { id: chartId, titleKey: 'transitLightCurve', src: `/scenes/${id}/${chartId}.svg`, alt: description, source: { id: `${id}-tess-sector-${lightCurves[0]!.sector}`, path: '../manifest.json', url: `https://mast.stsci.edu/api/v0.1/Download/file?uri=${lightCurves[0]!.uri}` } };
  // One source record per star, which every planet of that star cites: its files are the same products (HD 189733's record is the model).
  const recordId = `mast-tess-spoc-tic-${found.tic}`, today = new Date().toISOString().slice(0, 10);
  files.set(`src/sources/${recordId}.json`, `${JSON.stringify({ id: recordId, kind: 'data-product', identityLevel: 'work',
    title: `TESS SPOC 2-minute light curves of TIC ${found.tic}, sector${lightCurves.length === 1 ? '' : 's'} ${sectors}`,
    identifiers: [{ type: 'TIC', value: found.tic }],
    links: [{ role: 'archive', url: 'https://mast.stsci.edu/portal/Mashup/Clients/Mast/Portal.html', label: 'MAST' }, { role: 'landing', url: 'https://doi.org/10.1117/12.2233418', label: 'Jenkins et al. (2016), the TESS Science Processing Operations Center' }],
    evidence: [{ url: `https://mast.stsci.edu/api/v0.1/Download/file?uri=${lightCurves[0]!.uri}`, checkedOn: today, locator: `SPOC light-curve files for sector${lightCurves.length === 1 ? '' : 's'} ${sectors}: LIGHTCURVE table, PDCSAP_FLUX, QUALITY, TIME in BJD_TDB - 2457000` }],
    relations: [], statements: [{ kind: 'credit', text: 'This includes data collected by the TESS mission, funded by the NASA Explorer Program, obtained from MAST; SPOC pipeline, Jenkins et al. (2016)', scope: 'citation', evidence: 'https://archive.stsci.edu/missions-and-data/tess' }],
    publisher: 'Mikulski Archive for Space Telescopes (STScI)' }, null, 2)}\n`);
  const inputs = lightCurves.map((file, i) => ({ id: `${id}-tess-sector-${file.sector}`, path: paths[i], origin: `https://mast.stsci.edu/api/v0.1/Download/file?uri=${file.uri}`, productId: file.name,
    title: `TESS SPOC 2-minute light curve of ${name}'s star (TIC ${found.tic}), sector ${file.sector}`, sourceUrl: 'https://mast.stsci.edu/portal/Mashup/Clients/Mast/Portal.html',
    credit: 'NASA TESS mission; SPOC pipeline (Jenkins et al. 2016); obtained from MAST', displayCredit: 'TESS · SPOC', license: 'Public NASA mission data (MAST)', licenseEvidence: ['https://archive.stsci.edu/publishing/data-use'],
    acquisition: 'MAST download of the SPOC light-curve file, unchanged; restored through source/preparation/acquisition.json.', redistribution: 'Not redistributed in git; restored from MAST.', consumers: ['charts'],
    sourceBinding: { kind: 'catalogued', references: [{ catalogueId: recordId, role: 'material', evidence: `https://mast.stsci.edu/api/v0.1/Download/file?uri=${file.uri}` }] } }));
  const operations = lightCurves.map((file, i) => ({ kind: 'download', groups: ['restore', 'refresh'], path: paths[i], url: `https://mast.stsci.edu/api/v0.1/Download/file?uri=${file.uri}` }));
  return { report: `${id}: transit from TESS sectors ${sectors}${align ? `, aligned ${align} min (1 sigma ${sigmaText} min)` : ''}`, readme: `its transit in ${lightCurves.length} TESS sector${lightCurves.length === 1 ? '' : 's'} (${sectors}), folded onto its orbit`, recipe, control, inputs, operations };
}

