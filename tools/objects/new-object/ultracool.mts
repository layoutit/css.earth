/** Band photometry for directly imaged planets, drafted from the UltracoolSheet (Best, Liu, Magnier & Dupuy 2024, v2.1 on Zenodo):
 * each planet's MKO K, H and J magnitudes, converted to flux densities with the zero points the SVO Filter Profile Service publishes
 * for the MKO filters (Rodrigo et al. 2012, 2020), become the red, green and blue of the band-colour lens (planet-lenses.mts,
 * `--photometry`). A planet takes its own display range, zero to its brightest band, so the colour shows its band ratios; brightness
 * across planets at different distances is not compared. Each value is cited to the paper that measured it, through the sheet's
 * reference codes. A planet missing any of the three bands is left out and named. */
import type { Archive } from './archives.mts';
import { SIMBAD_TAP } from './companions.mts';
import type { PhotometrySpec } from './spec.mts';

export const ULTRACOOL = { record: 'https://doi.org/10.5281/zenodo.15802304', credit: 'Best, Liu, Magnier & Dupuy (2024), The UltracoolSheet v2.1 (Zenodo)',
  main: 'https://zenodo.org/api/records/15802304/files/UltracoolSheet%20-%20Main.csv/content', references: 'https://zenodo.org/api/records/15802304/files/UltracoolSheet%20-%20References.csv/content' };
export const SVO_FPS = 'https://svo2.cab.inta-csic.es/theory/fps/fps.php';
/** Red, green, blue: the longest wavelength first. */
const BANDS = [{ band: 'K', filter: 'MKO/NSFCam.K' }, { band: 'H', filter: 'MKO/NSFCam.H' }, { band: 'J', filter: 'MKO/NSFCam.J' }] as const;

/** A CSV with quoted fields that hold commas. */
export function readCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c; }
    else if (c === '"') quoted = true; else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n') { row.push(cell.replace(/\r$/u, '')); rows.push(row); row = []; cell = ''; } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [header, ...body] = rows;
  return body.filter(values => values.length > 1).map(values => Object.fromEntries(header!.map((key, i) => [key, values[i] ?? ''])));
}

/** A filter's effective wavelength (µm) and Vega zero point (Jy), as the SVO Filter Profile Service gives them. */
export async function filterZeroPoint(archive: Archive, filter: string) {
  const text = await archive.text(`${SVO_FPS}?ID=${encodeURIComponent(filter)}`), value = (name: string) => Number(new RegExp(`name="${name}"[^>]*value="([^"]+)"`, 'u').exec(text)?.[1]);
  const wavelength = value('WavelengthEff') / 1e4, zeroPoint = value('ZeroPoint');
  if (!(wavelength > 0) || !(zeroPoint > 0)) throw new Error(`SVO has no effective wavelength and zero point for ${filter}.`);
  return { wavelength, zeroPoint };
}

const normal = (name: string) => name.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/gu, '');

/** Photometry entries for the planets named (id and display name), and a note for each one the sheet cannot colour. */
export async function draftUltracoolPhotometry(archive: Archive, planets: readonly { readonly id: string; readonly name: string }[]) {
  const [sheet, references, ...points] = await Promise.all([archive.text(ULTRACOOL.main).then(readCsv), archive.text(ULTRACOOL.references).then(readCsv), ...BANDS.map(entry => filterZeroPoint(archive, entry.filter))]);
  const byName = new Map(sheet.map(row => [normal(row.name ?? ''), row])), paper = new Map(references.map(row => [row.code_ref, row]));
  // The sheet names planets its own way ("beta Pic b"); SIMBAD's main identifier, which the sheet records for each row, matches ours.
  const bySimbad = new Map(sheet.flatMap(row => [row.name_simbad, row.name_simbadable].filter(name => name && name !== 'null').map(name => [normal(name!), row] as const)));
  const simbadMain = async (name: string) => { const answer = await archive.text(SIMBAD_TAP, { REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'csv', QUERY: `SELECT b.main_id FROM basic AS b JOIN ident AS n ON b.oid = n.oidref WHERE n.id = '${name.replaceAll("'", "''")}'` }).catch(() => ''); return answer.split(/\r?\n/u)[1]?.replace(/^"|"$/gu, ''); };
  const entries: { id: string; photometry: PhotometrySpec }[] = [], notes: string[] = [];
  for (const planet of planets) {
    const main = byName.has(normal(planet.name)) ? undefined : await simbadMain(planet.name);
    const row = byName.get(normal(planet.name)) ?? (main ? bySimbad.get(normal(main)) : undefined);
    if (!row) { notes.push(`${planet.id}: ${planet.name} is not in the UltracoolSheet`); continue; }
    const magnitude = (band: string) => Number(row[`${band}_MKO`]), missing = BANDS.filter(entry => !Number.isFinite(magnitude(entry.band))).map(entry => entry.band);
    if (missing.length) { notes.push(`${planet.id}: the UltracoolSheet has no MKO ${missing.join(', ')} magnitude for ${row.name}`); continue; }
    // m -> F = zero point x 10^(-0.4 m) in Jy, in µJy; the magnitude error carries through as F x 0.4 ln 10 x dm.
    const bands = BANDS.map((entry, i) => { const flux = points[i]!.zeroPoint * 10 ** (-0.4 * magnitude(entry.band)) * 1e6, error = flux * 0.4 * Math.LN10 * (Number(row[`${entry.band}err_MKO`]) || 0);
      return { band: `MKO ${entry.band}`, wavelengthMicrometres: Number(points[i]!.wavelength.toFixed(4)), value: Number(flux.toPrecision(4)), error: Number(error.toPrecision(2)) }; }) as unknown as PhotometrySpec['bands'];
    const codes = [...new Set(BANDS.map(entry => row[`ref_${entry.band}_MKO`]!))], cited = codes.map(code => paper.get(code));
    const lead = cited[0], url = lead?.ADSkey_ref ? `https://ui.adsabs.harvard.edu/abs/${lead.ADSkey_ref}` : ULTRACOOL.record;
    entries.push({ id: planet.id, photometry: { unit: 'µJy',
      source: { citation: `${cited.map(entry => entry?.citetext_ref ?? '?').join('; ')}, as compiled in ${ULTRACOOL.credit}; zero points from the SVO Filter Profile Service`, url,
        locator: `UltracoolSheet Main.csv, ${row.name}: MKO ${BANDS.map(entry => `${entry.band} ${row[`${entry.band}_MKO`]} +/- ${row[`${entry.band}err_MKO`]} (${row[`ref_${entry.band}_MKO`]})`).join(', ')}; SVO ${BANDS.map((entry, i) => `${entry.filter} ${points[i]!.zeroPoint.toFixed(1)} Jy`).join(', ')}` },
      bands, displayRange: [0, Math.max(...bands.map(band => band.value))],
      displayRangeSource: `This planet alone, from zero to its brightest band (${bands.reduce((a, b) => (b.value > a.value ? b : a)).band}), so the colour shows its band ratios; brightness is not compared across planets at different distances.` } });
  }
  return { entries, notes };
}
