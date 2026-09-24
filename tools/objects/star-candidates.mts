#!/usr/bin/env node
/** Before reconstructing anything, find what the literature already published for a resolved-star candidate.
 *
 *   node tools/objects/star-candidates.mts "<SIMBAD identifier>" [--radius-arcsec 30] [--json]
 *
 * Public services, read only: SIMBAD for the star and every reference that cites it, the JMMC OiDB for interferometric
 * granules around its position grouped by instrument, calibration level and data PI, and VizieR for catalogues deposited
 * with those references, whose ReadMe is read for FITS images. `archive-search.mts` adds the leads those three cannot see: the
 * star's measured diameter (JMMC JMDC), ALMA projects and how many beams they put across the disc, ESO raw frames from
 * interferometers and adaptive-optics imagers, Hubble and JWST imaging in MAST, and data deposits (DataCite) that cite a paper about the star. The verdict orders the routes that worked for the stars
 * already placed: an author-deposited image (CE Tauri), author-calibrated visibilities at level 3 (π¹ Gruis, Betelgeuse),
 * then automated level-2 calibration alone (Antares: no image converged). An author-calibrated route is not a recommendation until
 * its reconstruction passes the spotless-disc test (Polaris failed it: its disc is about six beams across).
 *
 * Both the deposit and the level-3 files count only when their paper is about this star (see `aboutStar`): a diameter
 * survey of 87 stars also publishes level-3 visibilities with closure phases, but not enough resolution elements on any one
 * disc for an image. */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { almaObservations, archiveLeads, depositsCiting, esoRawObservations, fetchRetrying, mastObservations, measuredDiameters } from './archive-search.mts';
import { astroqueryRows } from './astronomy-packages/client.mts';


const SIMBAD = 'https://simbad.cds.unistra.fr/simbad/sim-tap', OIDB = 'https://tap.jmmc.fr/vollt/tap', VIZIER = 'https://tapvizier.cds.unistra.fr/TAPVizieR/tap';
const quote = (text: string) => `'${text.replaceAll("'", "''")}'`;

export interface OidbGroup { readonly instrument: string; readonly calibrationLevel: number; readonly dataPi: string; readonly bibcode: string | null; readonly granules: number; readonly firstMjd: number; readonly lastMjd: number; readonly sampleUrl: string }

/** OiDB rows [instrument, calib_level, datapi, bib_reference, t_min, access_url, facility] grouped, most calibrated first. The
 * database also holds single-telescope SPHERE images (facility VLT); those are not visibilities and are left out. */
export function summariseOidb(rows: readonly (readonly unknown[])[]): OidbGroup[] {
  const groups = new Map<string, { instrument: string; calibrationLevel: number; dataPi: string; bibcode: string | null; granules: number; firstMjd: number; lastMjd: number; sampleUrl: string }>();
  for (const [instrument, level, pi, bibcode, mjd, url, facility] of rows) {
    if (facility === 'VLT') continue;
    const key = [instrument, level, pi, bibcode].join('|');
    const group = groups.get(key) ?? { instrument: String(instrument), calibrationLevel: Number(level), dataPi: String(pi ?? ''), bibcode: bibcode ? String(bibcode) : null, granules: 0, firstMjd: Infinity, lastMjd: -Infinity, sampleUrl: String(url) };
    group.granules++; group.firstMjd = Math.min(group.firstMjd, Number(mjd)); group.lastMjd = Math.max(group.lastMjd, Number(mjd));
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.calibrationLevel - a.calibrationLevel || b.granules - a.granules);
}

/** The ReadMe's file summary lines that describe FITS images. */
export function readmeImageLines(readme: string): string[] {
  const summary = readme.split(/File Summary:/u)[1]?.split(/Byte-by-byte|Description of file|={20,}/u)[0] ?? '';
  // FITS images, not FITS spectra, tables or headers.
  return summary.split('\n').map(line => line.trim()).filter(line => /\bfits?\b|\.fits?\b/iu.test(line) && /\bimages?\b/iu.test(line) && !/spectr|header/iu.test(line));
}

/** SIMBAD links an object to a reference with a flag. Measured on CE Tauri (295 references) and Antares (793): bit 1 is set
 * when the star is in the title and bit 2 when it is in the abstract. A paper about the star names it in the title: CE Tauri
 * (flag 151), Antares (407), Polaris (155) and Betelgeuse (151, 239). A survey names it at most in the abstract: the NPOI
 * diameter papers carry flags 128, 160 and 208 for Polaris, Vega and Altair. SIMBAD leaves some older links unflagged,
 * π¹ Gruis in its Nature paper among them; then the paper's object count decides: imaging papers name 1 to 9 objects, the NPOI
 * surveys 31 and 157. Stable ids end to end: SIMBAD object, bibcode, VizieR catalogue. */
export const TITLE_FLAG = 1, MAX_OBJECTS_UNFLAGGED = 10;
export const aboutStar = (referenceFlag: unknown, paperObjects: unknown) => typeof referenceFlag === 'number'
  ? (referenceFlag & TITLE_FLAG) !== 0
  : referenceFlag === null && typeof paperObjects === 'number' && paperObjects <= MAX_OBJECTS_UNFLAGGED;

/** Whether a ReadMe's title and description (not its abstract, which cites other instruments) describe interferometric images:
 * an interferometer named in capitals, or images reconstructed by aperture synthesis. */
export function readmeInterferometric(readme: string) {
  const title = readme.split('\n')[0] ?? '';
  const description = readme.split(/\nDescription:/u)[1]?.split(/\n\S[^\n]*:\s*\n|\nFile Summary:/u)[0] ?? '';
  const text = `${title}\n${description}`;
  return /\b(?:VLTI|PIONIER|MATISSE|GRAVITY|AMBER|CHARA|MIRC-X|MIRC|NPOI|MYSTIC)\b/u.test(text) || /aperture.synthesis|image reconstruction|reconstructed images?/iu.test(text);
}

export interface Catalogue { readonly name: string; readonly title: string; readonly bibcode: string; readonly imageLines: readonly string[]; readonly aboutStar: boolean; readonly interferometric: boolean }

/** `aboutStarBibcodes` holds the references about this star (`aboutStar`); level-3 files from any other paper are calibrated
 * for something else, typically a diameter survey. */
const VLTI_CALIBRATORS: ReadonlySet<string> = new Set(['PIONIER', 'AMBER', 'GRAVITY', 'MATISSE']);

export function candidateVerdict(oidb: readonly OidbGroup[], catalogues: readonly Catalogue[], aboutStarBibcodes: ReadonlySet<string>) {
  // Only an interferometric image deposit about this star shows its photosphere; other image deposits of it are context.
  const deposited = catalogues.filter(catalogue => catalogue.imageLines.length && catalogue.aboutStar && catalogue.interferometric);
  if (deposited.length) return { route: 'published-image', reason: `cast the authors' deposited image as published: ${deposited.map(catalogue => catalogue.name).join(', ')}` } as const;
  const authored = oidb.filter(group => group.calibrationLevel >= 3 && group.bibcode !== null && aboutStarBibcodes.has(group.bibcode));
  if (authored.length) return { route: 'author-calibrated', reason: `reconstruct from author-calibrated visibilities (level 3, ${authored.map(group => `${group.instrument} by ${group.dataPi}`).join('; ')}), then run tools/objects/interferometry/spotless-disc.mts on the same sampling before casting it: Polaris's April 2021 image failed that test. Compare with any published figure` } as const;
  // Level 0 and 1 granules of the VLTI instruments are the ESO archive's public raw frames, which the interferometry tools calibrate.
  const raw = [...new Set(oidb.filter(group => group.calibrationLevel <= 1 && VLTI_CALIBRATORS.has(group.instrument)).map(group => group.instrument))];
  if (raw.length) return { route: 'raw-calibration', reason: `calibrate public raw ${raw.join(', ')} frames with tools/objects/interferometry/calibrate-<instrument>.mts, choosing one season observed on the small, medium and large arrays; reconstruct, then run tools/objects/interferometry/spotless-disc.mts (fit, spot ratio, halves) before casting` } as const;
  if (oidb.some(group => group.calibrationLevel >= 2)) return { route: 'automated-calibration', reason: 'only visibilities calibrated automatically (level 2) or for another paper, such as a diameter survey, are public; a reconstruction may not converge (Antares). Keep the package shape-only and record the attempt in its ledger' } as const;
  return { route: 'shape-only', reason: 'no calibrated interferometry and no deposited image: a shape-only package, off the map' } as const;
}

async function tap(service: string, query: string, columns: readonly string[]): Promise<unknown[][]> {
  const rows = await astroqueryRows({ operation: 'tap-query', service, query });
  return rows.map(row => columns.map(column => row[column] ?? null));
}

export async function starCandidates(identifier: string, radiusArcsec = 30) {
  const [star] = await tap(SIMBAD, `SELECT b.oid, b.main_id, b.ra, b.dec, b.plx_value, b.sp_type, b.otype FROM basic b JOIN ident i ON i.oidref = b.oid WHERE i.id = ${quote(identifier)}`,
    ['oid', 'main_id', 'ra', 'dec', 'plx_value', 'sp_type', 'otype']);
  if (!star) throw new Error(`SIMBAD does not know ${identifier}; use its exact identifier, for example "pi1 Gru" or "V* CE Tau".`);
  const [oid, mainId, ra, dec, parallax, spectralType] = star as [number, string, number, number, number | null, string | null];
  const radius = radiusArcsec / 3600, cosDec = Math.max(Math.cos(Number(dec) * Math.PI / 180), 1e-6);
  const oidbRows = await tap(OIDB, `SELECT instrument_name, calib_level, datapi, bib_reference, t_min, access_url, facility_name FROM oidb WHERE s_ra BETWEEN ${ra - radius / cosDec} AND ${ra + radius / cosDec} AND s_dec BETWEEN ${dec - radius} AND ${dec + radius}`,
    ['instrument_name', 'calib_level', 'datapi', 'bib_reference', 't_min', 'access_url', 'facility_name']);
  const references = await tap(SIMBAD, `SELECT r.bibcode, h.ref_flag, r.nbobject, r.doi FROM has_ref h JOIN ref r ON h.oidbibref = r.oidbib WHERE h.oidref = ${oid}`,
    ['bibcode', 'ref_flag', 'nbobject', 'doi']);
  const bibcodes = references.map(([bibcode]) => String(bibcode)), about = new Set(references.filter(([, flag, objects]) => aboutStar(flag, objects)).map(([bibcode]) => String(bibcode)));
  const catalogues: Catalogue[] = [];
  for (let start = 0; start < bibcodes.length; start += 100) {
    const chunk = bibcodes.slice(start, start + 100);
    for (const [name, title, bibcode] of await tap(VIZIER, `SELECT name, title, bibcode FROM METAcat WHERE bibcode IN (${chunk.map(quote).join(', ')})`, ['name', 'title', 'bibcode'])) {
      const readme = await fetchRetrying(`https://cdsarc.cds.unistra.fr/ftp/${String(name)}/ReadMe`).then(response => response.ok ? response.text() : '');
      catalogues.push({ name: String(name), title: String(title), bibcode: String(bibcode), imageLines: readmeImageLines(readme), aboutStar: about.has(String(bibcode)), interferometric: readmeInterferometric(readme) });
    }
  }
  const oidb = summariseOidb(oidbRows);
  // Beyond the three services above: the disc size, then the archives and deposits that hold what they cannot see.
  const diameters = await measuredDiameters(ra, dec, radius), position = { position: { ra, dec, radiusDegrees: radius } };
  const aboutDois = references.filter(([bibcode, , , doi]) => about.has(String(bibcode)) && typeof doi === 'string' && doi).map(([, , , doi]) => String(doi));
  const [alma, eso, mast, found] = await Promise.all([almaObservations(position, diameters.largestMas), esoRawObservations(position), mastObservations(position), depositsCiting(aboutDois)]);
  // CDS catalogues (DataCite prefix 10.26093) are the VizieR deposits already read through their ReadMe above.
  const deposits = found.filter(deposit => !deposit.doi.startsWith('10.26093/'));
  const archives = { alma, eso, mast, deposits };
  return { star: { identifier, mainId, rightAscensionDegrees: ra, declinationDegrees: dec, parallaxMas: parallax, spectralType }, references: bibcodes.length, oidb, catalogues,
    diameters, archives, leads: archiveLeads(archives), verdict: candidateVerdict(oidb, catalogues, about) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), radiusIndex = args.indexOf('--radius-arcsec');
  const identifier = args.find((argument, index) => !argument.startsWith('--') && (radiusIndex < 0 || index !== radiusIndex + 1));
  if (!identifier) throw new TypeError('Usage: star-candidates "<SIMBAD identifier>" [--radius-arcsec 30] [--json]');
  const result = await starCandidates(identifier, radiusIndex >= 0 ? Number(args[radiusIndex + 1]) : 30);
  if (args.includes('--json')) { console.log(JSON.stringify(result, null, 2)); process.exit(0); }
  const { star } = result;
  console.log(`${star.mainId}: RA ${star.rightAscensionDegrees.toFixed(5)}, Dec ${star.declinationDegrees.toFixed(5)}, parallax ${star.parallaxMas ?? 'none'} mas, ${star.spectralType ?? 'no spectral type'}; ${result.references} SIMBAD references`);
  console.log('\nOiDB granules (instrument, calibration level, data PI, bibcode, granules, MJD range):');
  for (const group of result.oidb) console.log(`  ${group.instrument}  level ${group.calibrationLevel}  ${group.dataPi || '-'}  ${group.bibcode ?? '-'}  ${group.granules}  ${group.firstMjd.toFixed(0)}-${group.lastMjd.toFixed(0)}`);
  const deposits = result.catalogues.filter(catalogue => catalogue.imageLines.length && catalogue.aboutStar);
  console.log(`\nVizieR: ${result.catalogues.length} catalogues from those references, ${deposits.length} with FITS images of this star:`);
  for (const catalogue of deposits) console.log(`  ${catalogue.name}  ${catalogue.title} (${catalogue.bibcode})${catalogue.interferometric ? '  interferometric' : '  not interferometric: context, not a surface'}\n    ${catalogue.imageLines.join(' | ')}`);
  const largest = result.diameters.largestMas;
  console.log(`\nMeasured diameter (JMDC): ${largest === null ? 'none catalogued, so no archive resolution is set against a disc' : `${largest} mas, largest of ${result.diameters.measurements.length} measurements`}`);
  console.log(`\nArchive leads (ALMA, ESO, MAST, DataCite): ${result.leads.length ? '' : 'none'}`);
  for (const lead of result.leads) console.log(`  ${lead}`);
  console.log(`\nVerdict: ${result.verdict.route}: ${result.verdict.reason}.`);
}
