/** Band photometry for directly imaged planets, drafted from the UltracoolSheet (Best, Liu, Magnier & Dupuy 2024, v2.1 on Zenodo):
 * each planet's MKO K, H and J magnitudes, converted to flux densities with the zero points the SVO Filter Profile Service publishes
 * for the MKO filters (Rodrigo et al. 2012, 2020), become the red, green and blue of the band-color dataset (planet-datasets.mts,
 * `--photometry`). A planet takes its own display range, zero to its brightest band, so the color shows its band ratios; brightness
 * across planets at different distances is not compared. Each value is cited to the paper that measured it, through the sheet's
 * reference codes. A band the sheet lacks in the MKO system is taken from its 2MASS column (J, H, Ks) with the 2MASS zero point, and
 * the band's name says which system it is. A planet missing any of the three bands in both systems is left out and named. */
import type { Archive } from './archives.mts';
import { SIMBAD_TAP } from '../companions.mts';
import type { PhotometrySpec } from '../spec.mts';

export const ULTRACOOL = { record: 'https://doi.org/10.5281/zenodo.15802304', credit: 'Best, Liu, Magnier & Dupuy (2024), The UltracoolSheet v2.1 (Zenodo)',
  main: 'https://zenodo.org/api/records/15802304/files/UltracoolSheet%20-%20Main.csv/content', references: 'https://zenodo.org/api/records/15802304/files/UltracoolSheet%20-%20References.csv/content' };
export const SVO_FPS = 'https://svo2.cab.inta-csic.es/theory/fps/fps.php';
/** Red, green, blue: the longest wavelength first. */
const BANDS = [{ band: 'K', filter: 'MKO/NSFCam.K', other: { band: 'Ks', filter: '2MASS/2MASS.Ks' } }, { band: 'H', filter: 'MKO/NSFCam.H', other: { band: 'H', filter: '2MASS/2MASS.H' } },
  { band: 'J', filter: 'MKO/NSFCam.J', other: { band: 'J', filter: '2MASS/2MASS.J' } }] as const;

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

/** Photometry entries for the planets named (id and display name), and a note for each one the sheet cannot color. */
export async function draftUltracoolPhotometry(archive: Archive, planets: readonly { readonly id: string; readonly name: string; readonly aliases?: readonly string[] }[]) {
  const [sheet, references, ...zero] = await Promise.all([archive.text(ULTRACOOL.main).then(readCsv), archive.text(ULTRACOOL.references).then(readCsv),
    ...BANDS.map(entry => filterZeroPoint(archive, entry.filter)), ...BANDS.map(entry => filterZeroPoint(archive, entry.other.filter))]);
  const byName = new Map(sheet.map(row => [normal(row.name ?? ''), row])), paper = new Map(references.map(row => [row.code_ref, row]));
  // The sheet names planets its own way ("beta Pic b"); SIMBAD's main identifier, which the sheet records for each row, matches ours.
  const bySimbad = new Map(sheet.flatMap(row => [row.name_simbad, row.name_simbadable].filter(name => name && name !== 'null').map(name => [normal(name!), row] as const)));
  const simbadMain = async (name: string) => { const answer = await archive.text(SIMBAD_TAP, { REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'csv', QUERY: `SELECT b.main_id FROM basic AS b JOIN ident AS n ON b.oid = n.oidref WHERE n.id = '${name.replaceAll("'", "''")}'` }).catch(() => ''); return answer.split(/\r?\n/u)[1]?.replace(/^"|"$/gu, ''); };
  const entries: { id: string; photometry: PhotometrySpec }[] = [], notes: string[] = [];
  for (const planet of planets) {
    // The sheet's own name first, under the planet's name or any alias its record gives; then SIMBAD's main identifier.
    const named = [planet.name, ...planet.aliases ?? []].map(name => byName.get(normal(name))).find(Boolean), main = named ? undefined : await simbadMain(planet.name);
    const row = named ?? (main ? bySimbad.get(normal(main)) : undefined);
    if (!row) { notes.push(`${planet.id}: ${planet.name} is not in the UltracoolSheet`); continue; }
    // Each band from the MKO column, else the 2MASS one, with that system's zero point.
    const picked = BANDS.map((entry, i) => Number.isFinite(Number(row[`${entry.band}_MKO`])) ? { system: 'MKO', band: entry.band, filter: entry.filter, point: zero[i]! }
      : Number.isFinite(Number(row[`${entry.other.band}_2MASS`])) ? { system: '2MASS', band: entry.other.band, filter: entry.other.filter, point: zero[BANDS.length + i]! } : undefined);
    const missing = BANDS.filter((_, i) => !picked[i]).map(entry => entry.band);
    if (missing.length) { notes.push(`${planet.id}: the UltracoolSheet has no MKO or 2MASS ${missing.join(', ')} magnitude for ${row.name}`); continue; }
    const cells = picked.map(pick => ({ ...pick!, magnitude: Number(row[`${pick!.band}_${pick!.system}`]), error: Number(row[`${pick!.band}err_${pick!.system}`]) || 0, code: row[`ref_${pick!.band}_${pick!.system}`]! }));
    // m -> F = zero point x 10^(-0.4 m) in Jy, in µJy; the magnitude error carries through as F x 0.4 ln 10 x dm.
    const bands = cells.map(cell => { const flux = cell.point.zeroPoint * 10 ** (-0.4 * cell.magnitude) * 1e6, error = flux * 0.4 * Math.LN10 * cell.error;
      return { band: `${cell.system} ${cell.band}`, wavelengthMicrometres: Number(cell.point.wavelength.toFixed(4)), value: Number(flux.toPrecision(4)), error: Number(error.toPrecision(2)) }; }) as unknown as PhotometrySpec['bands'];
    const codes = [...new Set(cells.map(cell => cell.code))], cited = codes.map(code => paper.get(code));
    // The sheet's reference keys can carry stray spaces; a link with one is not a link.
    const lead = cited[0], key = lead?.ADSkey_ref?.trim(), url = key ? `https://ui.adsabs.harvard.edu/abs/${key}` : ULTRACOOL.record;
    entries.push({ id: planet.id, photometry: { unit: 'µJy',
      source: { citation: `${cited.map(entry => entry?.citetext_ref ?? '?').join('; ')}, as compiled in ${ULTRACOOL.credit}; zero points from the SVO Filter Profile Service`, url,
        locator: `UltracoolSheet Main.csv, ${row.name}: ${cells.map(cell => `${cell.system} ${cell.band} ${cell.magnitude} +/- ${cell.error} (${cell.code})`).join(', ')}; SVO ${cells.map(cell => `${cell.filter} ${cell.point.zeroPoint.toFixed(1)} Jy`).join(', ')}` },
      bands, displayRange: [0, Math.max(...bands.map(band => band.value))],
      displayRangeSource: `This planet alone, from zero to its brightest band (${bands.reduce((a, b) => (b.value > a.value ? b : a)).band}), so the color shows its band ratios; brightness is not compared across planets at different distances.` } });
  }
  return { entries, notes };
}
