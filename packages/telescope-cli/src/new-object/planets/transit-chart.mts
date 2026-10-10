/** A generated planet's transit chart: its host's light curves as the mission's pipeline delivers them, folded onto the planet's
 * hosted orbit at bake (`folded-transit`, site/build/charts). TESS is asked first: the SPOC pipeline's 2-minute light curves, one
 * sector per file, the newest three MAST holds. A planet of a Kepler star that TESS does not resolve is then asked of Kepler's own
 * long-cadence light curves, one quarter per file, every quarter MAST holds: the light it was found in. The planet's TIC id and
 * transit duration are the NASA Exoplanet Archive's, its Kepler id that of the archive's table of Kepler names; the files are
 * downloaded unchanged and pinned in the manifest like any other source. The chart is drawn only when the fold measures the dip: its
 * depth (the mean of the middle 60% of the transit below the baseline) at least DETECTION_SIGMA times its standard error. A planet
 * with no light curve, no whole transit, or a dip neither mission resolves gets no chart, and the report says which. */
import { resolve } from 'node:path';
import type { Archive } from '../archives/archives.mts';
import type { PackageFiles } from '../dataset.mts';
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
const KEPLER_LONG_CADENCE = /^kplr\d{9}_lc_Q\d+$/u;

/** One light-curve file: `sector` is its TESS sector, or its quarter for a Kepler file. */
export interface LightCurveFile { readonly name: string; readonly uri: string; readonly bytes: number; readonly sector: number }
/** The MAST calls the chart needs, passed in so tests answer offline. An archive without `keplerLightCurves` asks TESS alone. */
export interface TessArchive {
  lightCurves(tic: string): Promise<LightCurveFile[]>;
  keplerLightCurves?(kic: string): Promise<LightCurveFile[]>;
  download(file: LightCurveFile): Promise<Buffer>;
}

/** What differs between the two missions a transit is folded from: how the star, a file's window and the light curves are named,
 * and the records that cite them. */
interface Mission {
  readonly name: 'TESS' | 'Kepler'; readonly catalogue: 'TIC' | 'KIC'; readonly window: 'sector' | 'quarter'; readonly directory: string;
  /** The light curves, as the chart's description and the source record's title name them. */
  readonly curves: string; readonly recordTitle: string; readonly inputTitle: string;
  /** The kind of light curve asked of MAST, and one file of it. */
  readonly kind: string; readonly files: string;
  readonly note: string; readonly pipeline: string; readonly locator: string;
  /** No bin is narrower: two of TESS's 2-minute samples, one of Kepler's 30-minute ones. */
  readonly minimumBinMinutes: number;
  readonly recordId: (star: string) => string; readonly landing: { readonly url: string; readonly label: string };
  readonly statement: string; readonly statementEvidence: string; readonly credit: string; readonly displayCredit: string;
}
const TESS: Mission = { name: 'TESS', catalogue: 'TIC', window: 'sector', directory: 'tess', curves: "the SPOC pipeline's 2-minute light curves", recordTitle: 'TESS SPOC 2-minute light curves', inputTitle: 'TESS SPOC 2-minute light curve',
  kind: '2-minute SPOC', files: 'SPOC light-curve file', note: 'TESS 2-min SPOC', pipeline: 'TESS SPOC, PDCSAP flux, quality 0', locator: 'LIGHTCURVE table, PDCSAP_FLUX, QUALITY, TIME in BJD_TDB - 2457000', minimumBinMinutes: 4,
  recordId: tic => `mast-tess-spoc-tic-${tic}`, landing: { url: 'https://doi.org/10.1117/12.2233418', label: 'Jenkins et al. (2016), the TESS Science Processing Operations Center' },
  statement: 'This includes data collected by the TESS mission, funded by the NASA Explorer Program, obtained from MAST; SPOC pipeline, Jenkins et al. (2016)', statementEvidence: 'https://archive.stsci.edu/missions-and-data/tess',
  credit: 'NASA TESS mission; SPOC pipeline (Jenkins et al. 2016); obtained from MAST', displayCredit: 'TESS · SPOC' };
const KEPLER: Mission = { name: 'Kepler', catalogue: 'KIC', window: 'quarter', directory: 'kepler', curves: "the Kepler pipeline's 30-minute light curves", recordTitle: 'Kepler long-cadence light curves', inputTitle: 'Kepler long-cadence light curve',
  kind: 'long-cadence', files: 'long-cadence light-curve file', note: 'Kepler 30-min', pipeline: 'Kepler pipeline, PDCSAP flux, quality 0', locator: 'LIGHTCURVE table, PDCSAP_FLUX, SAP_QUALITY, TIME in BJD_TDB - 2454833', minimumBinMinutes: 30,
  recordId: kic => `mast-kepler-kic-${kic}`, landing: { url: 'https://doi.org/10.1088/2041-8205/713/2/L87', label: 'Jenkins et al. (2010), overview of the Kepler science processing pipeline' },
  statement: 'This includes data collected by the Kepler mission and obtained from the MAST data archive at the Space Telescope Science Institute (STScI); Kepler pipeline, Jenkins et al. (2010)', statementEvidence: 'https://archive.stsci.edu/publishing/mission-acknowledgements',
  credit: 'NASA Kepler mission; Kepler pipeline (Jenkins et al. 2010); obtained from MAST', displayCredit: 'Kepler' };
/** The windows as a sentence lists them: TESS's few sectors one by one, Kepler's quarters as runs ("1 to 17"). */
const windowList = (mission: Mission, windows: readonly number[]) => {
  if (mission === TESS) return windows.join(', ');
  const runs: [number, number][] = [];
  for (const window of windows) { const last = runs.at(-1); if (last && window === last[1] + 1) last[1] = window; else runs.push([window, window]); }
  return runs.map(([first, last]) => first === last ? `${first}` : `${first} to ${last}`).join(', ');
};

/** MAST through the telescope's Astroquery boundary: single-sector SPOC observations at 120 s, then each one's LC product; and a
 * Kepler star's long-cadence observation, with the light curve of each of its quarters. */
export async function liveTessArchive(): Promise<TessArchive> {
  const { MAST_CACHE, mastFile, mastService } = await import('@cssearth/telescope/node'), { readFile } = await import('node:fs/promises');
  // A star's planets are drafted at once and ask for the same files: each is downloaded once, and every asker waits for it.
  const held = new Map<string, Promise<Buffer>>();
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
    async keplerLightCurves(kic) {
      const observations = await mastService({ service: 'Mast.Caom.Filtered', pagesize: 500, page: 1, params: { columns: 'obsid,obs_id',
        filters: [{ paramName: 'obs_collection', values: ['Kepler'] }, { paramName: 'dataproduct_type', values: ['timeseries'] }, { paramName: 'target_name', values: [`kplr${kic.padStart(9, '0')}`] }] } });
      const long = observations.rows.find(row => KEPLER_LONG_CADENCE.test(String(row.obs_id)));
      if (!long) return [];
      // The observation is every quarter of the star; each quarter's light curve says which it is ("... - Q2").
      const products = await mastService({ service: 'Mast.Caom.Products', params: { obsid: String(long.obsid) } });
      return products.rows.flatMap(product => { const quarter = /- Q(\d+)$/u.exec(String(product.description))?.[1];
        return product.productSubGroupDescription === 'LLC' && quarter ? [{ name: String(product.productFilename), uri: String(product.dataURI), bytes: Number(product.size), sector: Number(quarter) }] : []; });
    },
    download(file) {
      const asked = held.get(file.name) ?? mastFile(file, resolve(MAST_CACHE, file.name.startsWith('kplr') ? 'kepler' : 'tess')).then(path => readFile(path));
      held.set(file.name, asked);
      return asked;
    },
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

/** A planet's row in the archive's table of Kepler names: its star's Kepler Input Catalog id and the planet's Kepler name (Kepler-90 b
 * for the archive's KOI-351 b). A planet of a star Kepler did not watch has none. */
export async function keplerName(archive: Archive, planet: string) {
  const csv = await archive.text(`${NASA_TAP}?${new URLSearchParams({ query: `select kepid,kepler_name from keplernames where pl_name='${planet.replace(/'/gu, "''")}'`, format: 'csv' })}`);
  const [header, row] = csv.trim().split(/\r?\n/u);
  const cells = /^"?(\d+)"?,"?([^",]+)"?$/u.exec(row ?? '');
  return header === 'kepid,kepler_name' && cells ? { kic: cells[1]!, name: cells[2]! } : undefined;
}

/** The dip in one mission's light curves of the star, or why there is none. */
async function detectIn(mission: Mission, star: string, durationHours: number, files: LightCurveFile[], tess: TessArchive, fold?: Fold, timingSigmaDays?: (epochBjd: number) => number) {
  const lightCurves = files.sort((a, b) => a.sector - b.sector);
  if (!lightCurves.length) return { reason: `${mission.name} holds no ${mission.kind} light curve of ${mission.catalogue} ${star}` } as const;
  const bytes = await Promise.all(lightCurves.map(file => tess.download(file)));
  // The dip is looked for within ALIGN_SIGMA times the ephemeris's uncertainty at these dates, and drawn only when a whole transit
  // folds (the bake would refuse an empty one) and the dip there is at least DETECTION_SIGMA times its standard error.
  const windows = `${mission.name} ${mission.window}s ${windowList(mission, lightCurves.map(file => file.sector))}`;
  const sigmaMinutes = fold && timingSigmaDays ? timingSigmaDays(fold.midBmjd(bytes) + 2400000.5) * 1440 : 0, reach = Math.min(720, Math.floor(ALIGN_SIGMA * sigmaMinutes / 2) * 2);
  let measured: (FoldMeasure & { shift: number }) | undefined;
  if (fold) for (let shift = -reach; shift <= reach; shift += 2) {
    const m = fold.measure(bytes, durationHours, shift);
    if (m.transits > 0 && (!measured || m.depthPpm / m.errorPpm > measured.depthPpm / measured.errorPpm)) measured = { ...m, shift };
  }
  if (fold && !measured) return { reason: `no whole transit in ${windows}` } as const;
  const where = sigmaMinutes ? ` within ${ALIGN_SIGMA} sigma (${Math.round(ALIGN_SIGMA * sigmaMinutes)} min) of its ephemeris` : ' at its ephemeris';
  if (measured && !(measured.depthPpm >= DETECTION_SIGMA * measured.errorPpm))
    return { reason: `${windows} show no ${DETECTION_SIGMA}-sigma dip${where} (best ${Math.round(measured.depthPpm)} ± ${Math.round(measured.errorPpm)} ppm over ${measured.transits} transits)` } as const;
  return { mission, star, durationHours, lightCurves, bytes, measured, sigmaMinutes } as const;
}

/** Whether a mission shows planet `name`'s transit: its star's light curves folded on `fold`, the dip looked for within ALIGN_SIGMA
 * times the ephemeris's uncertainty and kept only at DETECTION_SIGMA or more. TESS's newest SPOC light curves are asked first; a
 * Kepler star TESS shows nothing of is asked of its Kepler quarters. The draft asks this to choose planets, and the chart to draw
 * one; `reason` says why there is none. */
export async function detectTransit(archive: Archive, name: string, tess: TessArchive, fold?: Fold, timingSigmaDays?: (epochBjd: number) => number) {
  const found = await ticAndDuration(archive, name);
  if (!found) return { reason: 'no TIC id or transit duration in the archive' } as const;
  const inTess = await detectIn(TESS, found.tic, found.durationHours, await tess.lightCurves(found.tic), tess, fold, timingSigmaDays);
  if (!('reason' in inTess) || !tess.keplerLightCurves) return inTess;
  const kic = (await keplerName(archive, name))?.kic;
  if (!kic) return inTess;
  const inKepler = await detectIn(KEPLER, kic, found.durationHours, await tess.keplerLightCurves(kic), tess, fold, timingSigmaDays);
  return 'reason' in inKepler ? { reason: `${inTess.reason}; ${inKepler.reason}` } as const : inKepler;
}

/** Add the transit chart's files, recipe and control to a planet's package, or say why there is none. */
export async function installTransitChart(files: PackageFiles, id: string, name: string, archive: Archive, tess: TessArchive, fold?: Fold, timingSigmaDays?: (epochBjd: number) => number, archiveName = name) {
  const s = `src/objects/${id}/source`, detected = await detectTransit(archive, archiveName, tess, fold, timingSigmaDays);
  if ('reason' in detected) return { report: `${id}: ${detected.reason}, so no transit chart` };
  const { mission, star, durationHours, lightCurves, bytes, measured, sigmaMinutes } = detected, { name: telescope, catalogue, window } = mission;
  // A dip found off the ephemeris, within its uncertainty, is drawn where the mission measures it, and the chart says by how much.
  const align = measured && Math.abs(measured.shift) > 2 ? measured.shift : 0, sigmaText = Math.max(1, Math.round(sigmaMinutes));
  const paths = lightCurves.map(file => `photometry/${mission.directory}/${file.name}`), sectors = windowList(mission, lightCurves.map(file => file.sector)), windows = `${window}${lightCurves.length === 1 ? '' : 's'}`;
  lightCurves.forEach((file, i) => files.set(`${s}/${paths[i]}`, bytes[i]!));
  // About fifteen bins across the transit, never finer than the mission's cadence allows.
  const binMinutes = Math.max(mission.minimumBinMinutes, Math.round(durationHours * 60 / 15)), chartId = `${id}-transit`;
  const description = `${name} crossing its star, as ${telescope} recorded it: ${lightCurves.length} ${windows} (${sectors}) of ${mission.curves} of ${catalogue} ${star}, each transit divided by a straight line fitted to the light either side and folded onto the orbit the app draws${align ? `, moved ${Math.abs(align)} minutes ${align < 0 ? 'earlier' : 'later'} to where ${telescope} measures the dip, inside the published ephemeris's ${ALIGN_SIGMA}-sigma uncertainty of ${Math.round(ALIGN_SIGMA * sigmaMinutes)} minutes at these dates` : ''}, then averaged in ${binMinutes}-minute bins. Error bars are each bin's standard error.`;
  // A list too long for a note's line (a Kepler star's quarters, with the gaps its lost detector left) is a count and its span.
  const windowNote = `${mission.note} · ${windows} ${sectors}`;
  const recipe = { kind: 'folded-transit', id: chartId, title: `${name}: its transit`, description, output: `${chartId}.svg`, metadata: { [catalogue.toLowerCase()]: `${catalogue} ${star}`, [`${window}s`]: lightCurves.map(file => file.sector), pipeline: mission.pipeline },
    planet: id, sources: paths, durationHours, binMinutes, ...(align ? { alignMinutes: align } : {}),
    notes: [windowNote.length <= 52 ? windowNote : `${mission.note} · ${lightCurves.length} ${windows}, ${lightCurves[0]!.sector} to ${lightCurves.at(-1)!.sector}`.slice(0, 52),
      ...(align ? [`Aligned on ${telescope}'s dip, ${Math.abs(align)} min ${align < 0 ? 'early' : 'late'}; ${binMinutes}-min bins.`, `The ephemeris's own 1σ there is ${sigmaText} min.`] : [`Folded on the app's orbit; ${binMinutes}-min bins.`]),
      'Bars: standard error of each bin.'] };
  const inputId = (file: LightCurveFile) => `${id}-${mission.directory}-${window}-${file.sector}`, download = (file: LightCurveFile) => `https://mast.stsci.edu/api/v0.1/Download/file?uri=${file.uri}`;
  const control = { id: chartId, titleKey: 'transitLightCurve', src: `/scenes/${id}/${chartId}.svg`, alt: description, source: { id: inputId(lightCurves[0]!), path: '../manifest.json', url: download(lightCurves[0]!) } };
  // One source record per star, which every planet of that star cites: its files are the same products (HD 189733's record is the model).
  const recordId = mission.recordId(star), today = new Date().toISOString().slice(0, 10), filesOf = `${mission.files[0]!.toUpperCase()}${mission.files.slice(1)}s`;
  files.set(`src/sources/${recordId}.json`, `${JSON.stringify({ id: recordId, kind: 'data-product', identityLevel: 'work',
    title: `${mission.recordTitle} of ${catalogue} ${star}, ${windows} ${sectors}`,
    identifiers: [{ type: catalogue, value: star }],
    links: [{ role: 'archive', url: 'https://mast.stsci.edu/portal/Mashup/Clients/Mast/Portal.html', label: 'MAST' }, { role: 'landing', ...mission.landing }],
    evidence: [{ url: download(lightCurves[0]!), checkedOn: today, locator: `${filesOf} for ${windows} ${sectors}: ${mission.locator}` }],
    relations: [], statements: [{ kind: 'credit', text: mission.statement, scope: 'citation', evidence: mission.statementEvidence }],
    publisher: 'Mikulski Archive for Space Telescopes (STScI)' }, null, 2)}\n`);
  const inputs = lightCurves.map((file, i) => ({ id: inputId(file), path: paths[i], origin: download(file), productId: file.name,
    title: `${mission.inputTitle} of ${name}'s star (${catalogue} ${star}), ${window} ${file.sector}`, sourceUrl: 'https://mast.stsci.edu/portal/Mashup/Clients/Mast/Portal.html',
    credit: mission.credit, displayCredit: mission.displayCredit, license: 'Public NASA mission data (MAST)', licenseEvidence: ['https://archive.stsci.edu/publishing/data-use'],
    acquisition: `MAST download of the ${mission.files}, unchanged; restored through source/preparation/acquisition.json.`, redistribution: 'Not redistributed in git; restored from MAST.', consumers: ['charts'],
    sourceBinding: { kind: 'catalogued', references: [{ catalogueId: recordId, role: 'material', evidence: download(file) }] } }));
  const operations = lightCurves.map((file, i) => ({ kind: 'download', groups: ['restore', 'refresh'], path: paths[i], url: download(file) }));
  return { report: `${id}: transit from ${telescope} ${window}s ${sectors}${align ? `, aligned ${align} min (1 sigma ${sigmaText} min)` : ''}`, readme: `its transit in ${lightCurves.length} ${telescope} ${windows} (${sectors}), folded onto its orbit`, recipe, control, inputs, operations };
}
