/** A new star's colour lens from the best spectrum any archive holds of it. The routes are tried in this order, and each candidate is
 * downloaded and read with the colour lens's own reader (stellar-photometric-color.mts), so a route counts only if it yields a colour:
 *
 * 1. stis-ngsl: the HST/STIS Next Generation Spectral Library (space spectrophotometry, 168-1020 nm), by HD number.
 * 2. gaia-xp: the Gaia DR3 externally calibrated BP/RP sampled spectrum (space, absolute flux), when Gaia published one.
 * 3. pulkovo: the Pulkovo catalogue (VizieR III/201 table5, 320-1080 nm in 2.5 nm steps), by HR number.
 * 4. kiehling: Kiehling (1987) (VizieR III/124, 1 nm steps to 880 nm), by HR number.
 * 5. kharitonov: the Alma-Ata catalogue (VizieR III/202, 5 nm steps to 757.5 nm), by HR number.
 * 6. burnashev: the Chilean catalogue in Burnashev's compilation (VizieR III/126 part2), by BS (HR) number; the scan that covers
 *    most of 380-780 nm.
 *
 * Space spectra come first, then the ground catalogues from the widest and finest sampling down. The first route read is the colour;
 * the next one is its cross-check, which preparation compares against CROSS_CHECK_AGREEMENT. With no spectrum at all the colour is a
 * Planck spectrum at the cited temperature. Stretches of 380-780 nm with no sample are declared as gaps with their reason, as
 * the reader requires. */
import { gunzipSync } from 'node:zlib';
import { CROSS_CHECK_AGREEMENT, measuredSpectrumColor, planckColor, readMeasuredSpectrum, type MeasuredSpectrumRecord, type StellarColor } from '../observation/stellar/stellar-photometric-color.mts';
import { ARI_TAP, BURNASHEV_PART2, KHARITONOV_CATALOG, ngslUrl, PULKOVO_TABLE5, VIZIER_ASU, xpSampledMirrorForm, xpSampledUrl, type Archive, type GaiaRow, type Identifiers } from './archives.mts';
import type { Cited, ColorRoute, StarSpec } from './spec.mts';

export const CHECKED = new Date().toISOString().slice(0, 10);
const VIZIER_LICENSE = { license: 'CDS VizieR catalogue: free use with citation', licenseEvidence: ['https://cds.unistra.fr/vizier-org/licences_vizier.html'] };
const GAIA_LICENSE = { license: 'Gaia data are public under the ESA Gaia data policy; the Gaia/DPAC credit is retained', licenseEvidence: ['https://www.cosmos.esa.int/web/gaia-users/credits'] };
const XP_CREDIT = 'ESA/Gaia/DPAC; Gaia Collaboration (2023), A&A 674, A1; De Angeli et al. (2023), A&A 674, A2; Montegriffo et al. (2023), A&A 674, A3';

type Gap = MeasuredSpectrumRecord['gaps'][number];
/** The stretches of 380-780 nm a spectrum leaves empty: before its first sample, after its last, and between samples more than
 * 10 nm apart (the reader interpolates a 1 nm bin only from neighbours within 5 nm). */
export function coverageGaps(wavelengthsNm: readonly number[]): Gap[] {
  const w = wavelengthsNm.filter(value => value >= 370 && value <= 790), gaps: Gap[] = [], round = (value: number) => Math.round(value * 10) / 10;
  if (!w.length) throw new RangeError('The spectrum has no sample near 380-780 nm.');
  if (w[0]! >= 380.5) gaps.push({ fromNm: 380, toNm: round(w[0]!), reason: `the spectrum starts at ${round(w[0]!)} nm; its first value is held to 380 nm, where the observer adds little` });
  for (let i = 1; i < w.length; i++) if (w[i]! - w[i - 1]! > 10 && w[i]! > 380 && w[i - 1]! < 780) {
    gaps.push({ fromNm: round(Math.max(380, w[i - 1]!)), toNm: round(Math.min(780, w[i]!)), reason: `no samples from ${round(w[i - 1]!)} to ${round(w[i]!)} nm; the neighbours are joined by a straight line` });
  }
  const last = w[w.length - 1]!;
  if (last < 779.5) gaps.push({ fromNm: round(last), toNm: 780, reason: `the spectrum ends at ${round(last)} nm; the last value is held to 780 nm, where the observer adds little` });
  return gaps;
}

/** A catalogue record in src/sources for the spectrum a route reads (the shared form the placed stars already cite). */
export interface SourceRecord { readonly id: string; readonly record: Record<string, unknown> }
const dataProduct = (id: string, title: string, identifier: [string, string], landing: [string, string], evidence: [string, string], credit: string, creditEvidence: string, publisher: string): SourceRecord => ({ id, record: {
  id, kind: 'data-product', identityLevel: 'work', title, identifiers: [{ type: identifier[0], value: identifier[1] }], links: [{ role: 'landing', url: landing[0], label: landing[1] }],
  evidence: [{ url: evidence[0], checkedOn: CHECKED, locator: evidence[1] }], relations: [], statements: [{ kind: 'credit', text: credit, scope: 'citation', evidence: creditEvidence }], publisher } });
const CDS = 'Centre de Données astronomiques de Strasbourg';

/** One route that yielded a spectrum: its file, how the lens reads it, where it came from and how to restore it. */
export interface Candidate {
  readonly route: ColorRoute; readonly label: string; readonly file: string; readonly bytes: Buffer;
  readonly record: (path: string) => Omit<MeasuredSpectrumRecord, 'gaps'>; readonly gaps: Gap[];
  readonly source: string; readonly note: string; readonly credit: string; readonly catalogue?: SourceRecord;
  readonly restore: (path: string) => Record<string, unknown>; readonly origin: string; readonly license: Record<string, unknown>;
  readonly acquisition: string; readonly color: StellarColor;
}

interface Context { readonly spec: StarSpec; readonly row: GaiaRow; readonly ids: Identifiers; readonly archive: Archive; readonly cmf: Map<number, readonly number[]> }
/** The catalogue files every star reads (Pulkovo, Kharitonov, Burnashev) are fetched once per process, however many stars run at once. */
const shared = new Map<string, Promise<Buffer>>();
const once = (context: Context, url: string) => { let bytes = shared.get(url); if (!bytes) { bytes = context.archive.bytes(url); shared.set(url, bytes); bytes.catch(() => shared.delete(url)); } return bytes; };
const download = (url: string) => (path: string) => ({ kind: 'download', groups: ['restore', 'refresh'], path, url });

/** Read a candidate with the lens's reader: its samples, its derived gaps and the colour they give. Throws when it yields none. */
function evaluate(bytes: Buffer, record: Omit<MeasuredSpectrumRecord, 'gaps'>, cmf: Map<number, readonly number[]>) {
  const spectrum = readMeasuredSpectrum(bytes, { ...record, gaps: [] }), gaps = coverageGaps(spectrum.wavelengthsNm);
  return { gaps, color: measuredSpectrumColor(spectrum, cmf, gaps) };
}

type Route = (context: Context) => Promise<Omit<Candidate, 'gaps' | 'color'> | string>;
const ROUTES: Record<ColorRoute, Route> = {
  async 'stis-ngsl'({ ids, archive }) {
    if (!ids.hd) return 'no HD number in SIMBAD';
    const url = ngslUrl(ids.hd);
    if (!await archive.exists(url)) return `HD ${ids.hd} is not in the library`;
    const bytes = await archive.bytes(url), header = bytes.subarray(0, 28800).toString('latin1'), quality = /DATAQUAL=\s*'?\s*(\w+)/u.exec(header)?.[1];
    if (quality && quality.toUpperCase() !== 'GOOD') return `the library marks HD ${ids.hd}'s spectrum DATAQUAL ${quality}`;
    const n = String(ids.hd).padStart(6, '0'), file = `h_stis_ngsl_hd${n}_v2.fits`;
    return { route: 'stis-ngsl', label: 'STIS NGSL', file, bytes, origin: url, license: { license: 'HST archive data: public, with acknowledgement', licenseEvidence: ['https://archive.stsci.edu/publishing/data-use'] },
      record: path => ({ path, format: 'fits-table', extension: '1', wavelength: { column: 'WAVELENGTH', unit: 'angstrom' }, flux: { column: 'FLUX', kind: 'flux' } }),
      source: `HST/STIS Next Generation Spectral Library v2 (Heap & Lindler; MAST high-level science product), HD ${ids.hd}: 168-1020 nm`,
      note: `Space spectrophotometry from the Hubble Space Telescope${quality ? `; the file header marks it DATAQUAL ${quality}` : ''}.`,
      credit: 'NASA/STScI; STIS Next Generation Spectral Library v2 (Heap & Lindler), MAST', restore: download(url), acquisition: 'Archive file downloaded unchanged; restored through source/preparation/acquisition.json',
      catalogue: dataProduct(`stis-ngsl-v2-hd${n}`, `STIS Next Generation Spectral Library v2: HD ${ids.hd}`, ['NGSL file', file], ['https://archive.stsci.edu/prepds/stisngsl/', 'NGSL at MAST'],
        [url, 'HDU 1 binary table: WAVELENGTH (Angstrom), FLUX (FLAM)'], 'NASA/STScI; STIS Next Generation Spectral Library v2 (Heap & Lindler), MAST', 'https://archive.stsci.edu/publishing/data-use', 'Space Telescope Science Institute') };
  },
  async 'gaia-xp'({ row, archive }) {
    if (!row.hasXpSampled) return 'Gaia DR3 published no sampled BP/RP spectrum of it';
    // ESA's DataLink first; when it is down, the same product from the ARI Heidelberg partner data centre's TAP mirror.
    const url = xpSampledUrl(row.sourceId), form = xpSampledMirrorForm(row.sourceId);
    let bytes: Buffer, origin = url, restore = download(url), service = 'ESA Gaia DataLink';
    try { bytes = await archive.bytes(url); }
    catch (error) {
      bytes = Buffer.from(await archive.text(ARI_TAP, form)); origin = ARI_TAP; service = `the ARI Heidelberg Gaia mirror (ESA DataLink failed: ${(error as Error).message})`;
      restore = (path: string) => ({ kind: 'request-download', groups: ['restore', 'refresh'], path, url: ARI_TAP, form, requiredPrefix: 'source_id,ra,dec,flux,flux_error,solution_id' });
    }
    return { route: 'gaia-xp', label: 'Gaia DR3 XP', file: 'gaia-dr3-xp-sampled.csv', bytes, origin, license: GAIA_LICENSE,
      record: path => ({ path, format: 'gaia-xp-sampled', wavelength: { column: 'lambda', unit: 'nm' }, flux: { column: row.sourceId, kind: 'flux' } }),
      source: `Gaia DR3 XP spectrum, source ${row.sourceId}`,
      note: "Gaia's own low-resolution spectrum of the star, calibrated to absolute flux. Its samples at the even wavelengths from 380 to 780 nm are weighted by the CIE 1931 2-degree observer. The range in the prepared report is the colour of the spectrum moved one standard error down and up at every sample.",
      credit: XP_CREDIT, restore, acquisition: `Download from ${service} in source/preparation/acquisition.json: the externally calibrated BP/RP sampled mean spectrum of source_id ${row.sourceId}, 343 samples from 336 to 1020 nm.`,
      catalogue: dataProduct(`gaia-dr3-xp-${row.sourceId}`, `Gaia DR3 XP sampled spectrum, source_id ${row.sourceId}`, ['Gaia DR3 XP source_id', row.sourceId], ['https://gea.esac.esa.int/archive/', 'Gaia Archive'],
        [origin === url ? url : `${ARI_TAP}?${new URLSearchParams(form)}`, 'XP sampled mean spectrum: 343 fluxes from 336 to 1020 nm in 2 nm steps, W m^-2 nm^-1'], XP_CREDIT, 'https://www.cosmos.esa.int/web/gaia-users/credits', 'European Space Agency, Gaia Data Processing and Analysis Consortium') };
  },
  async pulkovo(context) {
    const hr = context.ids.hr;
    if (!hr) return 'no HR number';
    const bytes = await once(context, PULKOVO_TABLE5);
    if (!new RegExp(`^ {8}.*\\b${hr}\\b`, 'mu').test(bytes.toString('latin1'))) return `HR ${hr} is not in the catalogue`;
    return { route: 'pulkovo', label: 'Pulkovo', file: 'pulkovo-table5.dat', bytes, origin: PULKOVO_TABLE5, license: VIZIER_LICENSE,
      record: path => ({ path, format: 'pulkovo-blocks', wavelength: { column: 'lambda', unit: 'nm' }, flux: { column: String(hr), kind: 'flux' } }),
      source: `Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. ${context.spec.name} is HR ${hr}.`,
      note: `Ground-based photoelectric scans by Pulkovo astronomers, combined into one absolute energy distribution per star with a stated accuracy of 1.5-2%. The catalogue gives no observation dates. HR ${hr}'s column is read from the raw flux file, which lists seven stars per block.`,
      credit: 'Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201 (CDS)', restore: download(PULKOVO_TABLE5),
      acquisition: 'Raw catalogue flux file table5.dat downloaded unchanged from the CDS archive; restored through source/preparation/acquisition.json',
      catalogue: { id: 'vizier-iii-201-pulkovo-spectrophotometry', record: {} } };
  },
  async kiehling({ ids, archive }) {
    const hr = ids.hr;
    if (!hr) return 'no HR number';
    const form = { '-source': 'III/124/spectra', '-out': `lambda,m(HR${hr})`, '-out.max': '1000' };
    const text = (await archive.text(VIZIER_ASU, form)).replace(/^#.*\n/gmu, '').replace(/^\s*\n/gmu, '');
    if (!text.includes(`m(HR${hr})`)) return `HR ${hr} is not among its 60 stars`;
    return { route: 'kiehling', label: 'Kiehling', file: 'kiehling-1987.tsv', bytes: Buffer.from(text), origin: VIZIER_ASU, license: VIZIER_LICENSE,
      record: path => ({ path, format: 'tsv-columns', wavelength: { column: 'lambda', unit: 'nm' }, flux: { column: `m(HR${hr})`, kind: 'magnitude', missing: 99.999 } }),
      source: `Kiehling (1987), spectrophotometry of 60 bright F, G, K and M stars, 320-880 nm in 1 nm steps as normalised magnitudes: Kiehling (1987), A&AS 69, 465; VizieR III/124. ${ids.main ?? `HR ${hr}`} is HR ${hr}.`,
      note: "Ground-based photoelectric spectrophotometry, published as magnitudes normalised to the star's own flux near 555 nm; read here as flux 10^(-0.4 m). The calibration is relative, which is all a colour needs. The catalogue gives no observation dates.",
      credit: 'Kiehling (1987), A&AS 69, 465; VizieR III/124 (CDS)',
      restore: path => ({ kind: 'request-download', groups: ['restore', 'refresh'], url: VIZIER_ASU, form, requiredText: [`m(HR${hr})`], replacements: [{ pattern: '^#.*\\n', flags: 'gm', replacement: '' }, { pattern: '^\\s*\\n', flags: 'gm', replacement: '' }], path }),
      acquisition: `VizieR ASU TSV for III/124/spectra, columns lambda and m(HR${hr}), with the response's dated comment lines and blank lines removed so the bytes are stable; restored through source/preparation/acquisition.json.`,
      catalogue: dataProduct(`vizier-iii-124-kiehling-hr${hr}`, `Kiehling (1987) spectrophotometry of HR ${hr} (VizieR III/124)`, ['VizieR III/124 column', `m(HR${hr})`], ['https://cdsarc.cds.unistra.fr/viz-bin/cat/III/124', 'VizieR III/124'],
        [VIZIER_ASU, `III/124/spectra: lambda (nm) and m(HR${hr}), normalised magnitude, 99.999 = no data (ReadMe)`], 'Kiehling (1987), A&AS 69, 465; VizieR III/124 (CDS)', 'https://cds.unistra.fr/vizier-org/licences_vizier.html', CDS) };
  },
  async kharitonov(context) {
    const hr = context.ids.hr;
    if (!hr) return 'no HR number';
    const bytes = await once(context, KHARITONOV_CATALOG);
    const line = bytes.toString('latin1').split(/\r?\n/u).find(entry => Number(entry.trim().split(/\s+/u)[7]) === hr);
    if (!line) return `HR ${hr} is not in the catalogue`;
    const record = String(Number(line.slice(0, 4)));
    return { route: 'kharitonov', label: 'Kharitonov', file: 'kharitonov-catalog.dat', bytes, origin: KHARITONOV_CATALOG, license: VIZIER_LICENSE,
      record: path => ({ path, format: 'kharitonov-records', wavelength: { column: 'lambda', unit: 'nm' }, flux: { column: record, kind: 'flux', missing: 0 } }),
      source: `Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record ${record}: HR ${hr}; VizieR III/202`,
      note: 'Ground-based photoelectric scans from Alma-Ata, 322.5 to 757.5 nm in 5 nm steps, in absolute flux. The catalogue gives no observation dates.',
      credit: 'Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars, Alma-Ata; VizieR III/202 (CDS)', restore: download(KHARITONOV_CATALOG),
      acquisition: 'Raw catalogue file catalog.dat downloaded unchanged from the CDS archive; restored through source/preparation/acquisition.json',
      catalogue: dataProduct(`vizier-iii-202-kharitonov-${record}`, `Kharitonov, Tereshchenko & Knyazeva (1988) spectrophotometry, record ${record}: ${context.spec.name}`, ['VizieR III/202 record', record],
        ['https://cdsarc.cds.unistra.fr/viz-bin/cat/III/202', 'VizieR III/202'], [KHARITONOV_CATALOG, `catalog.dat line ${record} (HR ${hr}): bytes 80-695, 88 fluxes (I7) from 322.5 to 757.5 nm in 5 nm steps, 10^-5 erg cm^-2 s^-1 cm^-1`],
        'Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars, Alma-Ata; VizieR III/202 (CDS)', 'https://cds.unistra.fr/vizier-org/licences_vizier.html', CDS) };
  },
  async burnashev(context) {
    const hr = context.ids.hr;
    if (!hr) return 'no HR (BS) number';
    const bytes = await once(context, BURNASHEV_PART2), lines = gunzipSync(bytes).toString('latin1').split(/\r?\n/u);
    const records = lines.map((line, i) => ({ line, record: String(i + 1) })).filter(({ line }) => new RegExp(`^BS 0*${hr}\\b`, 'u').test(line));
    if (!records.length) return `BS ${hr} is not in part2`;
    // The scan that leaves the least of 380-780 nm to gaps.
    const scored = records.map(({ record }) => {
      try {
        const spectrum = readMeasuredSpectrum(bytes, { path: '', format: 'burnashev-records', wavelength: { column: 'lambda', unit: 'angstrom' }, flux: { column: record, kind: 'log10', missing: -9.999999 }, gaps: [] });
        return { record, missing: coverageGaps(spectrum.wavelengthsNm).reduce((sum, gap) => sum + gap.toNm - gap.fromNm, 0) };
      } catch { return { record, missing: Infinity }; }
    }).sort((a, b) => a.missing - b.missing);
    const record = scored[0]!.record;
    return { route: 'burnashev', label: 'Burnashev', file: 'III_126_part2.dat.gz', bytes, origin: BURNASHEV_PART2, license: VIZIER_LICENSE,
      record: path => ({ path, format: 'burnashev-records', wavelength: { column: 'lambda', unit: 'angstrom' }, flux: { column: record, kind: 'log10', missing: -9.999999 } }),
      source: `Burnashev (1985), Abastumani Astrophys. Obs. Bull. 59, 83; VizieR III/126, part2 record ${record} (BS ${hr})${records.length > 1 ? `, the widest of its ${records.length} scans` : ''}`,
      note: 'Ground-based scans of the Chilean catalogue in Burnashev\'s compilation, as log10 flux.',
      credit: 'Burnashev (1985), Abastumani Astrophys. Obs. Bull. 59, 83; VizieR III/126 (CDS)', restore: download(BURNASHEV_PART2),
      acquisition: 'Archive file part2.dat.gz downloaded unchanged from the CDS archive; restored through source/preparation/acquisition.json',
      catalogue: dataProduct(`vizier-iii-126-burnashev-${record}`, `Burnashev (1985) spectrophotometry, record ${record}: ${context.spec.name} (BS ${hr})`, ['VizieR III/126 part2 record', record],
        ['https://cdsarc.cds.unistra.fr/viz-bin/cat/III/126', 'VizieR III/126'], [BURNASHEV_PART2, `part2.dat line ${record}: from byte 59, pairs of wavelength (0.1 nm) and log10 flux; -9.999999 no data`],
        'Burnashev (1985), Abastumani Astrophys. Obs. Bull. 59, 83; VizieR III/126 (CDS)', 'https://cds.unistra.fr/vizier-org/licences_vizier.html', CDS) };
  },
};

export interface ColorChoice {
  readonly record: Record<string, unknown>; readonly files: Map<string, Buffer>; readonly acquisition: Record<string, unknown>[];
  readonly inputs: Record<string, unknown>[]; readonly catalogue: SourceRecord[]; readonly color: StellarColor;
  readonly route: ColorRoute | 'planck'; readonly crossCheck?: { readonly route: ColorRoute; readonly difference: number };
  /** Why each skipped or missing route was not used, for the README. */
  readonly tried: readonly string[]; readonly credits: readonly string[]; readonly summary: string; readonly todo?: string;
}

const channelDifference = (a: StellarColor, b: StellarColor) => Math.max(...a.srgb.map((value, i) => Math.abs(value - b.srgb[i]!)));

/** Try every route in order and write the colour record for the first, with the second as its cross-check. */
export async function chooseColor(spec: StarSpec, row: GaiaRow, ids: Identifiers, archive: Archive, cmf: Map<number, readonly number[]>): Promise<ColorChoice> {
  const context: Context = { spec, row, ids, archive, cmf }, candidates: Candidate[] = [], tried: string[] = [];
  // Every route is probed at once; the candidates are then taken in the routes' quality order.
  const probed = await Promise.all((Object.keys(ROUTES) as ColorRoute[]).map(async route => {
    if (spec.color?.skip.includes(route)) return { route, found: `skipped (${spec.color.reason})` as const };
    return { route, found: await ROUTES[route](context) };
  }));
  for (const { route, found } of probed) {
    if (typeof found === 'string') { tried.push(`${route}: ${found}`); continue; }
    if (candidates.length === 2) { tried.push(`${route}: found, not needed after the colour and its cross-check`); continue; }
    try { candidates.push({ ...found, ...evaluate(found.bytes, found.record(''), cmf) }); }
    catch (error) { tried.push(`${route}: the spectrum was found but gives no colour (${(error as Error).message})`); }
  }
  const [primary, second] = candidates, id = spec.id, files = new Map<string, Buffer>(), acquisition: Record<string, unknown>[] = [], inputs: Record<string, unknown>[] = [], catalogue: SourceRecord[] = [];
  const CMF_METHOD = { catalogueId: 'cie-1931-2deg-cmf', role: 'method', evidence: 'https://files.cie.co.at/Publications-datasets/CIE_xyz_1931_2deg.csv_metadata.json#/checksums' };
  const addFile = (candidate: Candidate, path: string, entryId: string) => {
    files.set(path, candidate.bytes); acquisition.push(candidate.restore(path));
    const binding = candidate.route === 'gaia-xp' && entryId !== `${id}-crosscheck-spectrum` ? undefined
      : { kind: 'catalogued', references: [{ catalogueId: candidate.catalogue!.id, role: 'material', evidence: `src/objects/${id}/source/${path}` }] };
    inputs.push({ id: entryId, path, origin: candidate.origin, credit: candidate.credit, ...candidate.license, acquisition: candidate.acquisition,
      redistribution: 'One archived spectrum or catalogue file, unchanged, with citation', consumers: ['assets', 'lenses'], ...(binding ? { sourceBinding: binding } : {}) });
    if (binding && Object.keys(candidate.catalogue!.record).length) catalogue.push(candidate.catalogue!);
  };
  if (!primary) return planckChoice(id, spec.temperature, `No archive holds a spectrum of this star (${tried.join('; ')})`, tried, cmf);
  const primaryPath = `photometry/${primary.file}`;
  addFile(primary, primaryPath, `${id}-${primary.route}`);
  const record: Record<string, unknown> = primary.route === 'gaia-xp'
    ? { schema: 'cssearth-stellar-photometric-color@1', objectId: id, spectrum: 'gaia-xp-sampled', sampledSpectrum: {
        source: 'Gaia Collaboration (2023), Gaia Data Release 3, A&A 674, A1; BP/RP spectra: De Angeli et al. (2023), A&A 674, A2, and externally calibrated sampled spectra: Montegriffo et al. (2023), A&A 674, A3',
        path: primaryPath, service: primary.origin, checked: CHECKED, sourceId: row.sourceId, sampling: '343 samples from 336 to 1020 nm in 2 nm steps, flux in W m^-2 nm^-1 (the DataLink default sampling)', note: primary.note } }
    : { schema: 'cssearth-stellar-photometric-color@1', objectId: id, spectrum: 'measured', measuredSpectrum: { source: primary.source, ...primary.record(primaryPath), service: primary.origin, checked: CHECKED, gaps: primary.gaps, note: primary.note } };
  record.whitePoint = 'sRGB D65'; record.normalization = 'brightest linear sRGB channel = 1';
  let todo: string | undefined, crossCheck: ColorChoice['crossCheck'];
  if (second) {
    const path = `photometry/crosscheck-${second.file}`, difference = channelDifference(primary.color, second.color);
    addFile(second, path, `${id}-crosscheck-spectrum`);
    record.crossCheck = { source: second.source, spectrum: { ...second.record(path), gaps: second.gaps },
      ...(difference > CROSS_CHECK_AGREEMENT ? { disagreement: `TODO(new-object): the ${second.label} colour differs from the ${primary.label} colour by ${difference} levels; say why.` } : {}) };
    if (difference > CROSS_CHECK_AGREEMENT) todo = `${second.label} disagrees with ${primary.label} by ${difference} levels`;
    crossCheck = { route: second.route, difference };
  }
  inputs.push({ id: `${id}-stellar-color`, path: 'photometry/stellar-color.json', origin: primary.origin, credit: `${primary.credit}; CIE 1931 2° observer`, license: 'Factual numerical measurements; source attribution retained',
    acquisition: 'Authored method record: names the archived spectrum, how it is read and the colour computation applied', redistribution: 'Method record only', consumers: ['assets', 'lenses'],
    ...(primary.route === 'gaia-xp' ? { sourceBinding: { kind: 'local', reason: 'Project-authored colour recipe naming the Gaia DR3 spectrum bound above; repinned when edited.' } }
      : { sourceBinding: { kind: 'catalogued', references: [{ catalogueId: primary.catalogue!.id, role: 'material', evidence: `src/objects/${id}/source/photometry/stellar-color.json#/measuredSpectrum` }, CMF_METHOD] } }) });
  return { record, files, acquisition, inputs, catalogue, color: primary.color, route: primary.route, tried, ...(crossCheck ? { crossCheck } : {}), ...(todo ? { todo } : {}),
    credits: [`Colour: ${primary.source}, through the CIE 1931 2° colour-matching functions (CIE 2019, CC BY-SA 4.0, doi:10.25039/CIE.DS.xvudnb9b).${second ? ` Cross-check: ${second.source}.` : ''}`],
    summary: `${primary.source}${second ? `, cross-checked against ${second.source} (${crossCheck!.difference} levels apart at most, the threshold is ${CROSS_CHECK_AGREEMENT})` : ''}` };
}

/** The colour of a Planck spectrum at the cited temperature: for a star no archive holds a spectrum of, or a companion the archives
 * do not resolve from its star. `why` opens the record's note. */
export function planckChoice(id: string, t: Cited, why: string, tried: readonly string[], cmf: Map<number, readonly number[]>, gamut?: 'desaturate'): ColorChoice {
  const lower = t.uncertainty ? t.value - t.uncertainty : t.value, upper = t.uncertainty ? t.value + t.uncertainty : t.value;
  const record = { schema: 'cssearth-stellar-photometric-color@1', objectId: id, spectrum: 'planck', temperature: {
    published: { kelvin: t.value, lowerKelvin: lower, upperKelvin: upper, citation: `${t.source}${t.uncertainty ? `: ${t.value} +/- ${t.uncertainty} K` : `: ${t.value} K; the source gives no uncertainty, so the range is the value itself`}, ${t.url}` },
    note: `${why}, so the colour is a Planck spectrum at its published temperature.` },
    whitePoint: 'sRGB D65', normalization: 'brightest linear sRGB channel = 1', ...(gamut ? { gamut } : {}) };
  const inputs = [{ id: `${id}-stellar-color`, path: 'photometry/stellar-color.json', origin: t.url, credit: `${t.source}; CIE 1931 2° observer`, license: 'Factual numerical measurements; source attribution retained',
    acquisition: 'Authored method record: names the published temperature and the colour computation applied', redistribution: 'Method record only', consumers: ['assets', 'lenses'],
    sourceBinding: { kind: 'local', reason: 'Project-authored colour recipe naming the cited temperature; repinned when edited.' } }];
  // Below about 1,800 K a black body's colour lies outside sRGB (a brown dwarf, a cool companion): it is then shown mixed with the
  // least white that brings it inside, and the record says so; a colour inside the gamut keeps its record plain.
  let color: StellarColor, mapped = gamut;
  try { color = planckColor(t.value, cmf, gamut); } catch (error) { if (gamut || !/sRGB gamut/u.test((error as Error).message)) throw error; mapped = 'desaturate'; color = planckColor(t.value, cmf, mapped); }
  if (mapped && !gamut) Object.assign(record, { gamut: mapped });
  return { record, files: new Map(), acquisition: [], inputs, catalogue: [], color, route: 'planck', tried,
    credits: [`Colour: a Planck spectrum at the temperature of ${t.source}, through the CIE 1931 2° colour-matching functions (CIE 2019, CC BY-SA 4.0, doi:10.25039/CIE.DS.xvudnb9b).`],
    summary: `a Planck spectrum at ${t.value.toLocaleString('en-US')} K, because ${why.charAt(0).toLowerCase()}${why.slice(1)}` };
}
