/** A generated planet's transit chart: its host's TESS light curves as the SPOC pipeline delivers them (2-minute cadence, one sector
 * per file), folded onto the planet's hosted orbit at bake (`folded-transit`, site/build/charts). The planet's TIC id and transit
 * duration are the NASA Exoplanet Archive's; the files are the newest three sectors MAST holds, downloaded unchanged and pinned in
 * the manifest like any other source. The chart is drawn only when the fold measures the dip: its depth (the mean of the middle 60%
 * of the transit below the baseline) at least DETECTION_SIGMA times its standard error. A planet with no 2-minute light curve, no
 * whole transit, or a dip TESS does not resolve gets no chart, and the report says which. */
import { resolve } from 'node:path';
import type { Archive } from './archives.mts';
import type { PackageFiles } from './lens.mts';
import { NASA_TAP } from './orbit.mts';

/** At most this many sectors, newest first: enough transits to stack for a short-period planet, a few MB per planet. */
export const TRANSIT_SECTORS = 3;
/** A dip is drawn when its depth is at least this many standard errors: a 5-sigma detection, the usual bar for a transit. */
export const DETECTION_SIGMA = 5;
export interface FoldMeasure { readonly transits: number; readonly depthPpm: number; readonly errorPpm: number }
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

/** Add the transit chart's files, recipe and control to a planet's package, or say why there is none. */
export async function installTransitChart(files: PackageFiles, id: string, name: string, archive: Archive, tess: TessArchive, fold?: (curves: readonly Buffer[], durationHours: number) => FoldMeasure) {
  const s = `src/objects/${id}/source`, found = await ticAndDuration(archive, name);
  if (!found) return { report: `${id}: no TIC id or transit duration in the archive, so no transit chart` };
  const lightCurves = (await tess.lightCurves(found.tic)).sort((a, b) => a.sector - b.sector);
  if (!lightCurves.length) return { report: `${id}: TESS holds no 2-minute SPOC light curve of TIC ${found.tic}, so no transit chart` };
  const bytes = await Promise.all(lightCurves.map(file => tess.download(file)));
  // The chart is drawn only when a whole transit folds (the bake would refuse an empty one) and its dip is measured.
  const measured = fold?.(bytes, found.durationHours), sectorList = lightCurves.map(file => file.sector).join(', ');
  if (measured && measured.transits === 0) return { report: `${id}: no whole transit in TESS sectors ${sectorList}, so no transit chart` };
  if (measured && !(measured.depthPpm >= DETECTION_SIGMA * measured.errorPpm))
    return { report: `${id}: TESS sectors ${sectorList} do not resolve its transit (${Math.round(measured.depthPpm)} ± ${Math.round(measured.errorPpm)} ppm over ${measured.transits} transits, under ${DETECTION_SIGMA} sigma), so no transit chart` };
  const paths = lightCurves.map(file => `photometry/tess/${file.name}`), sectors = lightCurves.map(file => file.sector).join(', ');
  lightCurves.forEach((file, i) => files.set(`${s}/${paths[i]}`, bytes[i]!));
  // About fifteen bins across the transit, never finer than the 2-minute cadence.
  const binMinutes = Math.max(4, Math.round(found.durationHours * 60 / 15)), chartId = `${id}-transit`;
  const description = `${name} crossing its star, as TESS recorded it: ${lightCurves.length} sector${lightCurves.length === 1 ? '' : 's'} (${sectors}) of the SPOC pipeline's 2-minute light curves of TIC ${found.tic}, each transit divided by a straight line fitted to the light either side and folded onto the orbit the app draws, then averaged in ${binMinutes}-minute bins. Error bars are each bin's standard error.`;
  const recipe = { kind: 'folded-transit', id: chartId, title: `${name}: its transit`, description, output: `${chartId}.svg`, metadata: { tic: `TIC ${found.tic}`, sectors: lightCurves.map(file => file.sector), pipeline: 'TESS SPOC, PDCSAP flux, quality 0' },
    planet: id, sources: paths, durationHours: found.durationHours, binMinutes,
    notes: [`TESS 2-min SPOC · sector${lightCurves.length === 1 ? '' : 's'} ${sectors}`.slice(0, 52), `Folded on the app's orbit; ${binMinutes}-min bins.`, 'Bars: standard error of each bin.'] };
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
  return { report: `${id}: transit from TESS sectors ${sectors}`, readme: `its transit in ${lightCurves.length} TESS sector${lightCurves.length === 1 ? '' : 's'} (${sectors}), folded onto its orbit`, recipe, control, inputs, operations };
}

