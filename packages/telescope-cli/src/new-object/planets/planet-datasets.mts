/** Color for a planet nobody has imaged, from what is measured about it.
 *
 * - **Dayside thermal color.** The NASA Exoplanet Archive's emission-spectroscopy table holds secondary-eclipse depths and the
 *   brightness temperatures papers derive from them. A planet with a measured (not limit) temperature gets a "Thermal glow" dataset:
 *   the color of a black body at that temperature over the disc, lit by the sphere lighting so its day side faces the star.
 *   The row is chosen by rule, the smallest relative uncertainty and the longest wavelength on a tie; every row is kept in the
 *   package and the choice is stated.
 * - **Host light.** A planet with nothing measured keeps the neutral gray, but under its own star's color instead of a white
 *   lamp: the gray's brightness with the chromaticity of the host's color dataset (interpret.mts, `hostLitGray`).
 *
 * Nothing here decides a value: the temperature is the archive's, the host color is the host package's. */
import { PLANCK_FLOOR_KELVIN } from '@cssearth/objects';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { decodeEntities, type Archive } from '../archives/archives.mts';
import { CHECKED, planckChoice } from '../color.mts';
import { bindInputs, json, type PackageFiles } from '../dataset.mts';
import { NASA_TAP } from './orbit.mts';
import type { Cited, PhaseCurveEntry, PhotometrySpec, ThermalSpec } from '../spec-types.mts';
import { DISC_BAND_COLOR_SCHEMA, loadDiscBandColor } from '@cssearth/bake/objects/layers/observation';
import { loadStellarPhotometricColor } from '@cssearth/bake/objects/stellar';
import { parseCieTable, hostLitGray } from '@cssearth/bake/objects/color';
import { readCie1931ColorMatching } from '@cssearth/bake/objects/sources';
import { HOSTED_PLANET_STYLESHEET } from '../new-hosted-planet.mts';
import { installPhaseCurveDataset } from './phase-curve-dataset.mts';
import { daysideLine, installDaysideDataset } from '../thermal/dayside-dataset.mts';
import { WORKSPACE } from '@cssearth/telescope/node';
import { installSimulationDataset, memberFormat, restoreSimulationField, restoreSimulationMember, simulationPaths, simulationRecipe, simulationRelease, type SimulationEntry } from '../simulation/simulation-dataset.mts';
import { loadNetcdfLonLatField } from '@cssearth/bake/objects/raster';

export const EMISSION_COLUMNS = 'plntname,centralwavelng,bandwidth,especlipdep,especlipdeperr1,especlipdeperr2,especlipdeplim,espbritemp,espbritemperr1,espbritemperr2,espbritemplim,facility,instrument,plntreflink';
export const emissionQuery = (planet: string) => `select ${EMISSION_COLUMNS} from emissionspec where plntname='${planet.replace(/'/gu, "''")}' order by centralwavelng`;

export interface EmissionRow {
  readonly planet: string; readonly wavelengthMicrometres: number; readonly bandwidthMicrometres?: number;
  readonly depthPpm?: number; readonly depthLimit: boolean; readonly temperatureK?: number; readonly temperatureErrorK?: number; readonly temperatureLimit: boolean;
  readonly facility: string; readonly instrument: string; readonly label: string; readonly url?: string;
}

const split = (line: string) => [...line.matchAll(/("([^"]|"")*"|[^,]*)(,|$)/gu)].map(m => m[1]!.replace(/^"|"$/gu, '').replaceAll('""', '"'));

/** The emission table's rows for one planet, as the archive's CSV gives them. */
export function parseEmissionRows(csv: string): EmissionRow[] {
  const [header, ...lines] = csv.trim().split(/\r?\n/u);
  if (header !== EMISSION_COLUMNS) throw new TypeError(`The NASA Exoplanet Archive emission table answered with columns ${header}, not ${EMISSION_COLUMNS}.`);
  return lines.filter(line => line.trim()).map(line => {
    const c = split(line), n = (i: number) => c[i] === '' || c[i] === undefined ? undefined : Number(c[i]);
    const anchor = c[13] ?? '', label = decodeEntities(/>([^<]+)<\/a>/u.exec(anchor)?.[1] ?? anchor).trim(), url = /href=(\S+?)(?:\s|>)/u.exec(anchor)?.[1];
    const err1 = n(8), err2 = n(9);
    return { planet: c[0]!, wavelengthMicrometres: n(1)!, ...(n(2) === undefined ? {} : { bandwidthMicrometres: n(2)! }), ...(n(3) === undefined ? {} : { depthPpm: n(3)! }), depthLimit: n(6) !== undefined && n(6) !== 0,
      ...(n(7) === undefined ? {} : { temperatureK: n(7)! }), ...(err1 === undefined && err2 === undefined ? {} : { temperatureErrorK: Math.max(Math.abs(err1 ?? 0), Math.abs(err2 ?? 0)) }),
      temperatureLimit: n(10) !== undefined && n(10) !== 0, facility: c[11] ?? '', instrument: c[12] ?? '', label, ...(url ? { url: url.replace(/^"|"$/gu, '') } : {}) };
  });
}

/** The row the dataset uses: a measured (not limit) brightness temperature with the smallest relative uncertainty; on a tie
 * the longest wavelength, where the eclipse is thermal rather than reflected. Undefined when no row measures one. */
export function pickThermalRow(rows: readonly EmissionRow[]): EmissionRow | undefined {
  const measured = rows.filter(row => row.temperatureK !== undefined && row.temperatureK > 0 && !row.temperatureLimit);
  const relative = (row: EmissionRow) => row.temperatureErrorK === undefined ? Number.POSITIVE_INFINITY : row.temperatureErrorK / row.temperatureK!;
  return [...measured].sort((a, b) => relative(a) - relative(b) || b.wavelengthMicrometres - a.wavelengthMicrometres)[0];
}

/** Spitzer's 3.6 and 4.5 µm dayside brightness temperatures of 122 hot Jupiters from one uniform reanalysis of every eclipse
 * (Deming et al. 2023, AJ 165, 104), as the CDS serves its table 2. The archive's emission table predates it and lacks most of
 * these planets, so it is asked second. */
export const SPITZER_ECLIPSES = { table: 'https://cdsarc.cds.unistra.fr/ftp/J/AJ/165/104/table2.dat', paper: 'https://ui.adsabs.harvard.edu/abs/2023AJ....165..104D/abstract', label: 'Deming et al. 2023', catalogue: 'J/AJ/165/104' };
/** A planet name as the catalogue's key: "WASP-29 b" and the catalogue's "WASP-029" are both wasp29. The catalogue lists planets b only,
 * and names the planet of a binary's primary by the system: its "WASP-077" is WASP-77 A b, its "XO-2" is XO-2 N b. */
const eclipseKey = (name: string) => name.trim().replace(/\s+(?:[AN]\s+)?b$/u, '').toLowerCase().replace(/[\s-]+/gu, '').replace(/(^|\D)0+(?=\d)/gu, '$1');

/** The catalogue's rows for one planet, one per band it measured. The table is fixed width (its ReadMe): the name in bytes 1 to 10,
 * then per band the temperature and its upper and lower one-sigma errors, 3.6 µm from byte 48 and 4.5 µm from byte 62. A band
 * Spitzer did not observe is printed as 0, and a temperature whose lower error reaches it is not a detection. */
export function parseSpitzerEclipses(table: string, planet: string): EmissionRow[] {
  const key = eclipseKey(planet), rows: EmissionRow[] = [];
  for (const line of table.split(/\r?\n/u)) {
    if (!line.trim() || eclipseKey(line.slice(0, 10)) !== key) continue;
    for (const [wavelengthMicrometres, at] of [[3.6, 47], [4.5, 61]] as const) {
      const cell = (from: number, to: number) => Number(line.slice(from, to).trim()), temperatureK = cell(at, at + 4), upper = cell(at + 5, at + 8), lower = cell(at + 9, at + 13);
      if (![temperatureK, upper, lower].every(Number.isFinite)) throw new TypeError(`${SPITZER_ECLIPSES.catalogue} table 2: the ${wavelengthMicrometres} µm cells of ${line.slice(0, 10).trim()} are not numbers; the table's layout has changed.`);
      if (!(temperatureK > 0) || lower >= temperatureK) continue;
      rows.push({ planet, wavelengthMicrometres, depthLimit: false, temperatureK, temperatureErrorK: Math.max(upper, lower), temperatureLimit: false, facility: 'Spitzer', instrument: 'IRAC', label: SPITZER_ECLIPSES.label, url: SPITZER_ECLIPSES.paper });
    }
  }
  return rows;
}
/** From this eccentricity a planet's temperature swings round its orbit, and a single eclipse is one moment of it: the measurement
 * is shown as the day side at secondary eclipse, never as a glow. Past the second, the swing is so large (HD 80606 b heats by
 * hundreds of kelvin in hours) that no single temperature is shown. */
const ECCENTRIC_ORBIT = 0.3, EXTREME_ORBIT = 0.6;
// One request for the catalogue per archive, however many planets ask.
const eclipseTables = new WeakMap<Archive, Promise<string>>();

/** The archive's emission rows for a planet and the spec's thermal entry, or undefined with no measured temperature or one too
 * cool to glow (`why` says which). A planet the archive's table lacks is looked up in the Spitzer eclipse catalogue; then
 * `csv` is empty, since the archive's rows are not what the color comes from. */
export async function thermalFromArchive(archive: Archive, planet: string): Promise<{ rows: EmissionRow[]; csv: string; thermal?: ThermalSpec; cool?: ThermalSpec; why?: string }> {
  let csv = await archive.text(`${NASA_TAP}?${new URLSearchParams({ query: emissionQuery(planet), format: 'csv' })}`);
  let rows = parseEmissionRows(csv), row = pickThermalRow(rows), where = 'NASA Exoplanet Archive emission table';
  if (!row) {
    let table: string;
    try { table = await (eclipseTables.get(archive) ?? eclipseTables.set(archive, archive.text(SPITZER_ECLIPSES.table)).get(archive)!); }
    catch (error) { eclipseTables.delete(archive); return { rows, csv, why: `no measured dayside brightness temperature in the archive's emission table, and the Spitzer eclipse catalogue could not be read (${(error as Error).message.split('\n')[0]})` }; }
    const catalogued = parseSpitzerEclipses(table, planet);
    if (pickThermalRow(catalogued)) { rows = catalogued; row = pickThermalRow(catalogued); csv = ''; where = `uniform reanalysis of Spitzer's eclipses, CDS ${SPITZER_ECLIPSES.catalogue} table 2`; }
  }
  if (!row) return { rows, csv, why: "no measured dayside brightness temperature in the archive's emission table or the Spitzer eclipse catalogue" };
  const thermal: ThermalSpec = { temperatureK: row.temperatureK!, ...(row.temperatureErrorK === undefined ? {} : { uncertaintyK: row.temperatureErrorK }), wavelengthMicrometres: row.wavelengthMicrometres,
    facility: `${row.facility}${row.instrument ? ` ${row.instrument}` : ''}`.trim(), source: `${row.label}, dayside brightness temperature at ${row.wavelengthMicrometres} µm (${where})`,
    url: row.url ?? 'https://exoplanetarchive.ipac.caltech.edu/', chosen: `${rows.filter(r => r.temperatureK !== undefined && !r.temperatureLimit).length} measured of ${rows.length} rows; the smallest relative uncertainty, then the longest wavelength` };
  // Measured, but too cool for a visible glow: the measurement is returned for the false-color day side (thermal/dayside-dataset.mts).
  if (row.temperatureK! <= PLANCK_FLOOR_KELVIN) return { rows, csv, cool: thermal, why: `its dayside brightness temperature, ${row.temperatureK} K (${row.label}), is too cool to glow (a black-body color needs over ${PLANCK_FLOOR_KELVIN} K)` };
  return { rows, csv, thermal };
}

/** A hot giant's published equilibrium temperature, for the "Expected glow" dataset of a planet nobody has measured: the
 * temperature, the paper that computes it and its address, and which archive row it is. */
export interface EquilibriumSpec { readonly temperatureK: number; readonly uncertaintyK?: number; readonly source: string; readonly url: string; readonly chosen: string;
  /** Set for a small planet of a red dwarf: the temperature is the bare-rock maximum for its orbit, not a paper's equilibrium temperature. */
  readonly rock?: boolean }
/** How the estimate was tested, said wherever it is shown: Deming et al. (2023) table 2 over table 3, the 120 planets on near-circular orbits. */
export const EQUILIBRIUM_TEST = 'On 120 hot Jupiters whose day side Spitzer measured, the measured temperature is within 20% of this kind of estimate for 83% (Deming et al. 2023)';
/** The giants the test covers: Deming et al.'s sample starts at 0.77 Jupiter radii. */
export const TESTED_GIANT_RADIUS_KM = 0.77 * 71492;
/** The same kind of estimate for a small planet of a red dwarf: the hottest day side a dark, airless rock can have: the star's
 * temperature over the square root of a/R_star, times (2/3)^(1/4). Coy et al. (2025, ApJ 987, 22, Table 2) print the measured day side over that maximum for nine such rocks: 0.88 to
 * 1.07. The planets shown are like those nine: at most 1.5 Earth radii (their largest is 1.38), a star no hotter than 3,600 K
 * (their hottest is 3,575 K), an irradiation temperature of 480 to 1,930 K. GJ 357 b, measured since, is 1.35: said with the test. */
export const ROCK_TEST = 'Nine rocky planets of red dwarfs with a measured day side fall within 13% of this kind of estimate (Coy et al. 2025); GJ 357 b, measured since, is 35% above it';
export const TESTED_ROCK = { radiusKm: 1.5 * 6371, hostKelvin: 3600, irradiationKelvin: [480, 1930] as const, paper: 'https://arxiv.org/abs/2412.06573' };
/** The bare-rock maximum from the star's temperature and the orbit's a/R*, or why the planet is not like the tested rocks. */
export function rockEstimate(planetRadiusKm: number, star: { readonly id: string; readonly kelvin: number; readonly source: string }, orbit: { readonly aOverRstar: number; readonly source: string }): { rock?: EquilibriumSpec; why?: string } {
  if (planetRadiusKm > TESTED_ROCK.radiusKm) return { why: `at ${(planetRadiusKm / 6371).toFixed(2)} Earth radii it is larger than the rocks the estimate was tested on` };
  if (star.kelvin > TESTED_ROCK.hostKelvin) return { why: `its star, at ${star.kelvin} K, is hotter than the red dwarfs the estimate was tested on` };
  const irradiation = star.kelvin / Math.sqrt(orbit.aOverRstar), maximum = Math.round(irradiation * (2 / 3) ** 0.25);
  if (irradiation < TESTED_ROCK.irradiationKelvin[0] || irradiation > TESTED_ROCK.irradiationKelvin[1]) return { why: `its irradiation temperature, ${Math.round(irradiation)} K, is outside the 480 to 1,930 K the estimate was tested on` };
  return { rock: { rock: true, temperatureK: maximum, source: `computed from ${star.id}'s temperature, ${star.kelvin} K, and the orbit's a/R* ${orbit.aOverRstar}, as T* (R*/a)^(1/2) (2/3)^(1/4)`, url: TESTED_ROCK.paper,
    chosen: `the bare-rock maximum, no light reflected and no heat carried to the night side; the star's temperature is ${star.source.split(' (')[0]}, a/R* is ${orbit.source.split(' (')[0]}` } };
}

/** The body README's color paragraph for either dataset. */
export const thermalColorLine = (thermal: ThermalSpec | EquilibriumSpec, hex: string) => 'wavelengthMicrometres' in thermal
  ? `**Color.** A black body at the ${thermal.temperatureK.toLocaleString('en-US')} K dayside brightness temperature measured in secondary eclipse at ${thermal.wavelengthMicrometres} µm (${thermal.source}): ${hex}. ${thermal.where ? `Read from the paper (${thermal.where}): ` : "Chosen from the archive's emission rows by rule: "}${thermal.chosen}. Reflected starlight is not included.`
  : thermal.rock ? `**Color.** An estimate, not a measurement: a black body at ${thermal.temperatureK.toLocaleString('en-US')} K, the hottest day side a dark, airless rock can have on its orbit, ${thermal.source}: ${hex}. Chosen by rule: ${thermal.chosen}. ${ROCK_TEST}; see [the expected glow](../../../docs/color-preparation.md#the-expected-glow-of-a-hot-giant). Reflected starlight is not included.`
  : `**Color.** An estimate, not a measurement: a black body at the ${thermal.temperatureK.toLocaleString('en-US')} K equilibrium temperature of ${thermal.source}: ${hex}. Chosen by rule: ${thermal.chosen}. ${EQUILIBRIUM_TEST}; see [the expected glow](../../../docs/color-preparation.md#the-expected-glow-of-a-hot-giant). Reflected starlight is not included.`;

const EQUILIBRIUM_COLUMNS = 'pl_name,pl_eqt,pl_eqterr1,pl_eqterr2,pl_refname,default_flag,pl_pubdate';
/** Every row of the planetary systems table that prints an equilibrium temperature, in one request for a whole run. */
export const EQUILIBRIUM_QUERY = `select ${EQUILIBRIUM_COLUMNS} from ps where pl_eqt is not null`;
interface EquilibriumRow { readonly kelvin: number; readonly errors: readonly number[]; readonly isDefault: boolean; readonly published: string; readonly label: string; readonly url?: string }
const equilibriumTables = new WeakMap<Archive, Promise<Map<string, EquilibriumRow[]>>>();

/** The archive's rows by planet name. A row counts when a paper prints it: its reference names a year (the TESS project's
 * candidate list, ExoFOP, is not a paper). */
export function parseEquilibriumRows(csv: string): Map<string, EquilibriumRow[]> {
  const [header, ...lines] = csv.trim().split(/\r?\n/u), rows = new Map<string, EquilibriumRow[]>();
  if (header !== EQUILIBRIUM_COLUMNS) throw new TypeError(`The NASA Exoplanet Archive planetary systems table answered with columns ${header}, not ${EQUILIBRIUM_COLUMNS}.`);
  for (const line of lines) {
    if (!line.trim()) continue;
    const c = split(line), anchor = c[4] ?? '', label = decodeEntities(/>([^<]+)<\/a>/u.exec(anchor)?.[1] ?? anchor).trim(), kelvin = Number(c[1]);
    if (!(kelvin > 0) || !/\d{4}/u.test(label)) continue;
    const row = { kelvin, errors: [c[2], c[3]].filter(cell => cell !== '' && cell !== undefined).map(cell => Math.abs(Number(cell))), isDefault: c[5] === '1', published: c[6] ?? '', label, url: /href=(\S+?)(?:\s|>)/u.exec(anchor)?.[1]?.replace(/^"|"$/gu, '') };
    rows.set(c[0]!, [...rows.get(c[0]!) ?? [], row]);
  }
  return rows;
}

/** The equilibrium temperature a paper prints for a planet, from the archive's planetary systems table: the default
 * parameter set's when that set prints one, the most recently published otherwise. Undefined with `why` when no paper prints one. */
export async function equilibriumFromArchive(archive: Archive, planet: string): Promise<{ equilibrium?: EquilibriumSpec; why?: string }> {
  const table = equilibriumTables.get(archive) ?? equilibriumTables.set(archive, archive.text(`${NASA_TAP}?${new URLSearchParams({ query: EQUILIBRIUM_QUERY, format: 'csv' })}`).then(parseEquilibriumRows)).get(archive)!;
  const rows = [...(await table.catch(error => { equilibriumTables.delete(archive); throw error; })).get(planet) ?? []].sort((x, y) => y.published.localeCompare(x.published));
  const row = rows.find(candidate => candidate.isDefault) ?? rows[0];
  if (!row) return { why: 'no paper in the archive prints its equilibrium temperature' };
  return { equilibrium: { temperatureK: row.kelvin, ...(row.errors.length ? { uncertaintyK: Math.max(...row.errors) } : {}), source: `${row.label}, equilibrium temperature (NASA Exoplanet Archive planetary systems table)`,
    url: row.url ?? 'https://exoplanetarchive.ipac.caltech.edu/', chosen: `${rows.length} paper${rows.length === 1 ? '' : 's'} in the archive print${rows.length === 1 ? 's' : ''} one; ${row.isDefault ? "the archive's default parameter set" : 'the most recently published'}` } };
}

/** Turn a shape-only planet package into one with the "Thermal glow" dataset: the black-body color at its measured dayside
 * temperature. `csv` is the archive's emission table for the planet, kept beside the record. Returns the color. An
 * `EquilibriumSpec` makes the "Expected glow" dataset instead: the same color at the temperature its paper computes, said
 * to be an estimate in every text. A measured temperature replaces an estimate; nothing else is replaced. */
export async function installThermalDataset(files: PackageFiles, id: string, name: string, thermal: ThermalSpec | EquilibriumSpec, csv: string | undefined) {
  const measured = 'wavelengthMicrometres' in thermal ? thermal : undefined, kelvin = thermal.temperatureK.toLocaleString('en-US'), rock = !measured && (thermal as EquilibriumSpec).rock === true;
  // What the estimated temperature is, and the published sample that tests it.
  const basis = rock ? 'the hottest day side a dark, airless rock can have on its orbit' : "the equilibrium temperature its paper computes from its star's light", tested = rock ? ROCK_TEST : EQUILIBRIUM_TEST;
  const o = `src/objects/${id}`, s = `${o}/source`, read = (path: string) => JSON.parse(String(files.get(path))) as Record<string, any>;
  const cmf = parseCieTable((await readCie1931ColorMatching()).toString('utf8'), 3);
  const cited: Cited = { value: thermal.temperatureK, ...(thermal.uncertaintyK === undefined ? {} : { uncertainty: thermal.uncertaintyK }), source: thermal.source, url: thermal.url };
  const color = planckChoice(id, cited, measured ? `Its day side's brightness temperature is measured in secondary eclipse at ${measured.wavelengthMicrometres} µm (${measured.facility}) and nobody has imaged it`
    : `Nobody has measured its heat or imaged it; this is ${basis}, an estimate`, [], cmf, 'desaturate');
  const record = { ...color.record, temperature: { ...(color.record.temperature as Record<string, unknown>), chosen: thermal.chosen, ...(measured ? { wavelengthMicrometres: measured.wavelengthMicrometres, facility: measured.facility } : { estimate: true }), ...(csv ? { rows: 'photometry/emission-spectroscopy.csv' } : {}) } };
  files.set(`${s}/photometry/thermal-color.json`, json(record));
  if (csv) files.set(`${s}/photometry/emission-spectroscopy.csv`, csv);
  const science: { kind: string; qualification: string } = !measured ? { kind: 'equilibrium-thermal-color', qualification: rock ? `An estimate, not a measurement: the color of a black body at ${kelvin} K, ${basis} (${thermal.source}), uniform over the disc. ${tested}.`
      : `An estimate, not a measurement: the color of a black body at the equilibrium temperature ${kelvin} K (${thermal.source}), uniform over the disc. ${EQUILIBRIUM_TEST}.` }
    : { kind: 'dayside-thermal-color', qualification: `Color of a black body at the dayside brightness temperature ${thermal.temperatureK.toLocaleString('en-US')} K measured in secondary eclipse at ${measured.wavelengthMicrometres} µm (${thermal.source}), uniform over the disc and lit by its star so the day side faces it. The planet is unresolved: no map is implied, and reflected starlight is not included.` };
  const loaded = await loadStellarPhotometricColor(async path => { const value = files.get(`${s}/${path}`); if (value === undefined) throw new Error(`${id}: ${path} is not in the generated package.`); return Buffer.from(value); }, science, 'photometry/thermal-color.json');
  const colorHex = `#${loaded.color.srgb.map(value => value.toString(16).padStart(2, '0')).join('')}`;
  // Below about 1,800 K a black body's color lies outside sRGB; it is shown mixed with the least white that brings it inside, hue kept.
  const mapped = loaded.color.gamut ? ` Its black-body color lies outside the sRGB gamut and is shown mixed with ${Math.round(loaded.color.gamut.whiteFraction * 100)}% white, the least that brings it inside, hue kept.` : '';
  science.qualification += mapped;

  const raster = read(`${s}/preparation/raster.json`);
  // The glow takes the place of the neutral shape; any other dataset the package has (an illustration) stays beside it.
  const kept = <T extends { id?: string }>(list: readonly T[] | undefined) => (list ?? []).filter(entry => entry.id !== 'shape' && entry.id !== 'thermal');
  raster.surfaces = [{ id: 'thermal', output: `${id}-surface-{id}{suffix}.webp`, thumbnail: `${id}-dataset-{id}.webp`, source: 'photometry/thermal-color.json', falseColor: false, science }, ...kept(raster.surfaces)];
  files.set(`${s}/preparation/raster.json`, json(raster));
  const descriptor = read(`${o}/object.json`);
  descriptor.properties.recipe.surfaces[0].datasets = [{ id: 'thermal', source: 'content', material: 'lighting' }, ...kept(descriptor.properties.recipe.surfaces[0].datasets)];
  files.set(`${o}/object.json`, json(descriptor));
  ensureStylesheet(files, id);
  const geometry = read(`${s}/preparation/geometry.json`);
  geometry.surface.color = colorHex;
  geometry.surface.surface.url = `/scenes/${id}/${id}-surface-thermal@2x.webp`; geometry.surface.poles.url = `/scenes/${id}/${id}-poles-thermal@2x.webp`;
  files.set(`${s}/preparation/geometry.json`, json(geometry));
  const content = read(`${s}/content/object.json`);
  const others = kept(content.datasets?.controls as { id?: string }[] | undefined);
  content.datasets = { titleKey: 'datasets', defaultDataset: 'thermal', controls: [{ id: 'thermal', label: measured ? 'Thermal glow' : 'Expected glow',
    qualification: measured ? `Black-body color at its measured dayside temperature, ${kelvin} K. The disc itself is unresolved.` : rock ? `An estimate, not a measurement: black-body color at ${kelvin} K, the bare-rock maximum for its orbit.` : `An estimate, not a measurement: black-body color at its published equilibrium temperature, ${kelvin} K.`,
    thumbnail: `${id}-dataset-thermal.webp`, surface: `${id}-surface-thermal@2x.webp`, poles: `${id}-poles-thermal@2x.webp`,
    source: { id: `${id}-thermal-color`, path: '../manifest.json', url: thermal.url }, falseColor: false,
    notes: measured ? `The color of ${name}'s heat: a black body at the dayside brightness temperature measured in secondary eclipse at ${measured.wavelengthMicrometres} µm (${measured.facility}). Its star lights the day side; the night side is not measured. Reflected starlight is not included.`
      : `Nobody has measured ${name}'s heat. This is the color of a black body at ${kelvin} K, ${basis} (${thermal.source}). ${tested}. Its star lights the day side. Reflected starlight is not included.` }, ...others] };
  files.set(`${s}/content/object.json`, json(content));
  const text = read(`${o}/text.json`);
  text.datasets = { ...Object.fromEntries(Object.entries((text.datasets ?? {}) as Record<string, unknown>).filter(([key]) => key !== 'shape' && key !== 'thermal')), thermal: measured ? { title: 'Dayside heat', detail: 'From its dayside temperature', summary: `The color of a black body at the ${kelvin} K day side measured in eclipse.` }
    : { title: 'Estimated heat', detail: 'An estimate, not measured', summary: rock ? `Not measured: the color of a black body at the ${kelvin} K a dark, airless rock would reach there.` : `Not measured: the color of a black body at the ${kelvin} K its paper computes from its star's light.` } };
  files.set(`${o}/text.json`, json(text));
  const manifest = read(`${s}/manifest.json`);
  const inputs = [{ id: `${id}-thermal-color`, path: 'photometry/thermal-color.json', origin: thermal.url, credit: `${thermal.source}; CIE 1931 2° observer`, license: 'Factual numerical measurements; source attribution retained',
      acquisition: 'Authored method record: names the archive row chosen and the color computation applied', redistribution: 'Method record only', consumers: ['assets', 'datasets'],
      sourceBinding: { kind: 'local', reason: `Project-authored color recipe naming the cited ${measured ? 'brightness' : 'equilibrium'} temperature; repinned when edited.` } },
    ...csv ? [{ id: `${id}-emission-spectroscopy`, path: 'photometry/emission-spectroscopy.csv', origin: `${NASA_TAP}?${new URLSearchParams({ query: emissionQuery(name), format: 'csv' })}`,
      credit: 'NASA Exoplanet Archive, emission spectroscopy table (secondary-eclipse depths and brightness temperatures as published)', license: 'NASA Exoplanet Archive data use: acknowledge the archive and the papers it cites',
      acquisition: 'TAP query in source/preparation/acquisition.json: every emission row of this planet, ordered by wavelength.', redistribution: 'Table rows as served, with the archive acknowledged.', consumers: ['datasets'] }] : []];
  // Installed again, or measured over an estimate, the dataset replaces its own inputs.
  manifest.inputs = [...(manifest.inputs as { id: string }[]).filter(input => !inputs.some(own => own.id === input.id)), ...inputs];
  files.set(`${s}/manifest.json`, json(manifest));
  bindInputs(files, id);
  if (csv) {
    const plan = read(`${s}/preparation/acquisition.json`);
    plan.operations = [...plan.operations, { kind: 'download', groups: ['restore', 'refresh'], path: 'photometry/emission-spectroscopy.csv', url: `${NASA_TAP}?${new URLSearchParams({ query: emissionQuery(name), format: 'csv' })}` }];
    files.set(`${s}/preparation/acquisition.json`, json(plan));
  }
  return { hex: colorHex, credit: measured ? `Color: a black body at the ${kelvin} K dayside brightness temperature of ${thermal.source}, through the CIE 1931 2° color-matching functions.`
    : rock ? `Color: an estimate, a black body at ${kelvin} K, the bare-rock maximum ${thermal.source}, through the CIE 1931 2° color-matching functions.`
    : `Color: an estimate, a black body at the ${kelvin} K equilibrium temperature of ${thermal.source}, through the CIE 1931 2° color-matching functions.`, checked: CHECKED };
}

/** Give an imaged planet the band-color dataset from its published flux densities in three infrared bands, the route HR 8799 b–e
 * use: red, green and blue from the longest wavelength on the spec's shared display range. Returns the color. */
export async function installBandColorDataset(files: PackageFiles, id: string, name: string, photometry: PhotometrySpec) {
  const o = `src/objects/${id}`, s = `${o}/source`, read = (path: string) => JSON.parse(String(files.get(path))) as Record<string, any>;
  files.set(`${s}/photometry/band-color.json`, json({ schema: DISC_BAND_COLOR_SCHEMA, objectId: id, unit: photometry.unit, source: photometry.source, bands: photometry.bands, displayRange: photometry.displayRange, displayRangeSource: photometry.displayRangeSource }));
  const loaded = await loadDiscBandColor(async path => { const value = files.get(`${s}/${path}`); if (value === undefined) throw new Error(`${id}: ${path} is not in the generated package.`); return Buffer.from(value); }, 'photometry/band-color.json');
  const colorHex = `#${loaded.srgb.map(value => value.toString(16).padStart(2, '0')).join('')}`, bands = photometry.bands.map(band => `${band.band} ${band.wavelengthMicrometres} µm`);
  const raster = read(`${s}/preparation/raster.json`), emissive = raster.emission !== undefined;
  const science = { kind: 'disc-integrated-band-color', qualification: `Infrared false color of the whole disc from published flux densities (${photometry.source.citation}, ${photometry.source.locator}): red ${bands[0]}, green ${bands[1]}, blue ${bands[2]}, on one range shared with the bodies the record names. The planet is unresolved, so no map is implied.${emissive ? ' It glows with its own heat, so no lighting.' : ''}` };
  raster.surfaces = [{ id: 'infrared', output: `${id}-surface-{id}{suffix}.webp`, thumbnail: `${id}-dataset-{id}.webp`, source: 'photometry/band-color.json', falseColor: true, science }];
  files.set(`${s}/preparation/raster.json`, json(raster));
  const descriptor = read(`${o}/object.json`);
  descriptor.properties.recipe.surfaces[0].datasets = [{ id: 'infrared', source: 'content', material: emissive ? 'emission' : 'lighting' }];
  files.set(`${o}/object.json`, json(descriptor));
  // A self-luminous planet's stylesheet is the emissive one, which does not name its dataset; only a lit planet's names it.
  if (!emissive) ensureStylesheet(files, id);
  const geometry = read(`${s}/preparation/geometry.json`);
  geometry.surface.color = colorHex;
  geometry.surface.surface.url = `/scenes/${id}/${id}-surface-infrared@2x.webp`; geometry.surface.poles.url = `/scenes/${id}/${id}-poles-infrared@2x.webp`;
  files.set(`${s}/preparation/geometry.json`, json(geometry));
  const content = read(`${s}/content/object.json`);
  content.datasets = { titleKey: 'datasets', defaultDataset: 'infrared', controls: [{ id: 'infrared', label: 'Infrared color',
    qualification: `False color from its measured flux in three infrared bands (${photometry.source.citation}). The disc itself is unresolved.`,
    thumbnail: `${id}-dataset-infrared.webp`, surface: `${id}-surface-infrared@2x.webp`, poles: `${id}-poles-infrared@2x.webp`,
    source: { id: `${id}-band-color`, path: '../manifest.json', url: photometry.source.url }, falseColor: true,
    notes: `${name}'s brightness in three infrared bands as one color: red ${bands[0]}, green ${bands[1]}, blue ${bands[2]} (${photometry.source.citation}), on a range shared with ${photometry.displayRangeSource.split('.')[0]!.toLowerCase()}. Not a natural color; nobody has resolved its disc.` }] };
  files.set(`${s}/content/object.json`, json(content));
  const text = read(`${o}/text.json`);
  text.datasets = { infrared: { title: 'Infrared brightness', detail: 'From its band fluxes', summary: `False color from flux densities in three infrared bands, longest wavelength red.` } };
  files.set(`${o}/text.json`, json(text));
  const manifest = read(`${s}/manifest.json`);
  manifest.inputs = [...manifest.inputs, { id: `${id}-band-color`, path: 'photometry/band-color.json', origin: photometry.source.url, credit: `${photometry.source.citation}, ${photometry.source.locator}`, license: 'Factual numerical measurements; source attribution retained',
    acquisition: 'Authored method record: the published flux densities transcribed with their bands and the shared display range', redistribution: 'Method record only', consumers: ['assets', 'datasets'],
    sourceBinding: { kind: 'local', reason: 'Project-authored color recipe transcribing the cited photometry; repinned when edited.' } }];
  files.set(`${s}/manifest.json`, json(manifest));
  return { hex: colorHex, credit: `Color: infrared false color from the flux densities of ${photometry.source.citation} (${bands.join(', ')}).` };
}

/** The hosted-planet stylesheet, which sizes the planet's lighting frame, listed on its page. Planets scaffolded before the tool
 * had none, and their lighting frame measured 0×0, a flat unlit disc. */
export function ensureStylesheet(files: PackageFiles, id: string) {
  const path = HOSTED_PLANET_STYLESHEET, o = `src/objects/${id}`;
  const descriptor = JSON.parse(String(files.get(`${o}/object.json`))) as { properties: { page: { stylesheets: string[] } } };
  if (!descriptor.properties.page.stylesheets.includes(path)) descriptor.properties.page.stylesheets.push(path);
  files.set(`${o}/object.json`, json(descriptor));
}

export interface HostLight { readonly host: string; readonly srgb: string; readonly source: string; readonly url: string }

/** The host star's measured color as its package states it, for a planet's neutral gray. Undefined when the host has no color dataset. */
export async function hostLightOf(root: string, hostId: string): Promise<HostLight | undefined> {
  const source = resolve(root, 'src/objects', hostId, 'source');
  const geometry = JSON.parse(await readFile(resolve(source, 'preparation/geometry.json'), 'utf8').catch(() => 'null')) as { surface?: { color?: unknown } } | null;
  const raster = JSON.parse(await readFile(resolve(source, 'preparation/raster.json'), 'utf8').catch(() => 'null')) as { surfaces?: { science?: { kind?: unknown } }[] } | null;
  const content = JSON.parse(await readFile(resolve(source, 'content/object.json'), 'utf8').catch(() => 'null')) as { datasets?: { controls?: { id?: unknown; source?: { url?: unknown } }[] } } | null;
  const kind = raster?.surfaces?.[0]?.science?.kind, srgb = geometry?.surface?.color, url = content?.datasets?.controls?.[0]?.source?.url;
  if (kind !== 'stellar-photometric-color' || typeof srgb !== 'string' || !/^#[0-9a-f]{6}$/u.test(srgb) || typeof url !== 'string') return undefined;
  return { host: hostId, srgb, source: `the color dataset of ${hostId} (src/objects/${hostId}/source/photometry/stellar-color.json)`, url };
}

/** Light a shape-only planet's neutral gray with its host's color. */
export function installHostLight(files: PackageFiles, id: string, light: HostLight) {
  const o = `src/objects/${id}`, s = `${o}/source`, read = (path: string) => JSON.parse(String(files.get(path))) as Record<string, any>;
  const raster = read(`${s}/preparation/raster.json`), surface = raster.surfaces[0];
  if (surface.science.kind !== 'neutral-shape') throw new TypeError(`${id}: host light applies to a neutral-shape surface, not ${surface.science.kind}.`);
  surface.science = { ...surface.science, hostLight: { host: light.host, srgb: light.srgb, source: light.source },
    qualification: `Shared neutral gray display convention for a planet with no image or measured color in this package; a sphere of the published radius, lit by its own star, whose measured color (${light.srgb}, ${light.source}) tints the gray at the same brightness.` };
  files.set(`${s}/preparation/raster.json`, json(raster));
  // The marker keeps the planet's lighter gray (#9a9a9a) at the same brightness, tinted the same way.
  const geometry = read(`${s}/preparation/geometry.json`), marker = String(geometry.surface.color);
  geometry.surface.color = `#${hostLitGray(light.srgb, parseInt(marker.slice(1, 3), 16)).map(value => value.toString(16).padStart(2, '0')).join('')}`;
  files.set(`${s}/preparation/geometry.json`, json(geometry));
  const content = read(`${s}/content/object.json`), control = content.datasets.controls[0];
  control.notes = `${String(control.notes)} The gray takes the color of ${light.host}'s light, as its color dataset measures it.`;
  files.set(`${s}/content/object.json`, json(content));
}

/** The package files the dataset installers rewrite, read from the tree so a planet already in the universe can take a dataset. */
export const DATASET_REBUILD_FILES = ['object.json', 'text.json', 'source/preparation/raster.json', 'source/preparation/geometry.json', 'source/preparation/acquisition.json', 'source/content/object.json', 'source/manifest.json'] as const;

/** Give planets already in the tree their color from what is measured: `thermal` reads the archive's emission table and
 * installs the "Thermal glow" dataset where a dayside temperature is measured; `host-light` lights a neutral gray with the
 * host's color. Returns one line per planet; nothing is baked here (packages/bake/cli/prepare-object.mts does that). */
export async function rebuildExistingDatasets(root: string, ids: readonly string[], mode: 'thermal' | 'expected-glow' | 'host-light' | 'photometry' | 'phase-curve' | 'simulation', archive: Archive, progress = (_line: string) => {}, photometry: ReadonlyMap<string, PhotometrySpec> = new Map(), phaseCurves: ReadonlyMap<string, readonly PhaseCurveEntry[]> = new Map(), simulations: ReadonlyMap<string, readonly SimulationEntry[]> = new Map(), fetcher: typeof fetch = fetch, thermals: ReadonlyMap<string, ThermalSpec> = new Map()) {
  const { mkdir, writeFile } = await import('node:fs/promises');
  const lines: string[] = [];
  for (const id of ids) {
    const o = resolve(root, 'src/objects', id), files: PackageFiles = new Map();
    for (const path of DATASET_REBUILD_FILES) files.set(`src/objects/${id}/${path}`, await readFile(resolve(o, path), 'utf8'));
    const before = new Map(files);
    const descriptor = JSON.parse(String(files.get(`src/objects/${id}/source/content/object.json`))) as { displayName: string }, body = JSON.parse(await readFile(resolve(root, 'packages/astronomy/data/bodies', `${id}.json`), 'utf8')) as { physical?: { parent?: string; meanRadiusKm?: number }; hostedOrbit?: { eccentricity?: number; semiMajorAxisStellarRadii?: number; sources?: { shape?: string } } };
    const raster = JSON.parse(String(files.get(`src/objects/${id}/source/preparation/raster.json`))) as { emission?: unknown; surfaces: { science: { kind: string; hostLight?: unknown } }[] };
    const kind = raster.surfaces[0]?.science.kind;
    // A self-luminous body (an imaged young planet, drawn emissive) shines with its own heat; no starlight to tint.
    if (mode === 'host-light' && raster.emission !== undefined) { lines.push(`${id}: self-luminous, no starlight on it`); progress(lines.at(-1)!); continue; }
    // Whatever the mode, a lit shape planet gets its own stylesheet if it never had one (the lighting frame is 0×0 without it).
    if (kind === 'neutral-shape' && raster.emission === undefined && !(JSON.parse(String(files.get(`src/objects/${id}/object.json`))) as { properties: { page: { stylesheets: string[] } } }).properties.page.stylesheets.includes(HOSTED_PLANET_STYLESHEET)) { ensureStylesheet(files, id); lines.push(`${id}: stylesheet written, its lighting frame had no size`); progress(lines.at(-1)!); }
    if (mode === 'phase-curve') {
      // A heat map is added beside the default dataset, so the marker, drawn from the default dataset, stays as it is.
      let promoted = false;
      for (const entry of phaseCurves.get(id) ?? []) {
        const installed = await installPhaseCurveDataset(files, id, descriptor.displayName, entry);
        promoted ||= installed.promoted;
        lines.push(`${id}: ${entry.dataset} dataset from ${entry.credit}, ${installed.minimum}-${installed.maximum} K, hottest ${installed.hottest}° from noon${installed.promoted ? '; the page now opens on it' : ''}`); progress(lines.at(-1)!);
      }
      await writeWithMarker(root, files, id, promoted);
      continue;
    }
    if (mode === 'simulation') {
      // A published simulation is its own dataset, and the page opens on it where it had no map. The release is checked on
      // Zenodo, the two parts read of its file are brought into the source directory, and the range drawn is the file's own.
      const catalog = (JSON.parse(String(files.get(`src/objects/${id}/object.json`))) as { properties: { catalog?: { aliases?: unknown } } }).properties.catalog;
      const names = [descriptor.displayName, ...Array.isArray(catalog?.aliases) ? catalog.aliases.filter((alias): alias is string => typeof alias === 'string') : []];
      let promoted = false;
      for (const entry of simulations.get(id) ?? []) {
        const release = await simulationRelease(archive, id, names, entry);
        // A classic release is kept as two of its byte ranges; a NetCDF-4 file inside a ZIP release is kept whole.
        const ranges = entry.member === undefined ? await restoreSimulationField(resolve(o, 'source'), id, entry, release, fetcher) : undefined, paths = simulationPaths(entry);
        const fetched = ranges ? ranges.fetched : await restoreSimulationMember(files, id, resolve(o, 'source'), entry, release, fetcher);
        if (fetched) progress(`${id}: ${fetched.toLocaleString('en-US')} bytes of ${entry.file} fetched from Zenodo record ${release.doi}`);
        const field = await loadNetcdfLonLatField(resolve(o, 'source'), simulationRecipe(entry), new Map(ranges ? [[paths.head, ranges.head], [paths.field, ranges.field]] : []));
        // A classic member is kept whole because it came out of an archive, not for its format.
        const installed = installSimulationDataset(files, id, descriptor.displayName, entry, release, field.report, ranges, ranges ? undefined : await memberFormat(resolve(o, 'source', entry.path)));
        promoted ||= installed.promoted;
        lines.push(`${id}: ${entry.dataset} dataset from the ${entry.model} simulation of ${entry.credit}, ${installed.minimum}-${installed.maximum} ${entry.displayUnits ?? entry.units}, ${release.license.name}${installed.promoted ? '; the page now opens on it' : ''}`); progress(lines.at(-1)!);
      }
      await writeWithMarker(root, files, id, promoted);
      continue;
    }
    if (mode === 'photometry') {
      const spec = photometry.get(id);
      if (!spec) { lines.push(`${id}: no photometry entry in the spec`); progress(lines.at(-1)!); continue; }
      const { hex } = await installBandColorDataset(files, id, descriptor.displayName, spec);
      lines.push(`${id}: infrared color ${hex} from ${spec.source.citation}`);
    } else if (mode === 'thermal' || mode === 'expected-glow') {
      const say = (line: string) => { lines.push(line); progress(line); };
      if (kind === 'dayside-thermal-color') { ensureStylesheet(files, id); lines.push(`${id}: keeps its thermal dataset; stylesheet refreshed`); for (const [path, value] of files) { await mkdir(dirname(resolve(root, path)), { recursive: true }); await writeFile(resolve(root, path), value); } progress(lines.at(-1)!); continue; }
      // A measured day side replaces an estimate; any other dataset stays.
      if (kind !== 'neutral-shape' && !(mode === 'thermal' && kind === 'equilibrium-thermal-color')) { say(`${id}: keeps its ${kind} dataset`); continue; }
      if (raster.emission !== undefined) { say(`${id}: self-luminous, its own light is its color`); continue; }
      // One eclipse of a planet on a very eccentric orbit catches it near its closest approach: not its day side round the orbit.
      const eccentricity = body.hostedOrbit?.eccentricity ?? 0;
      if (eccentricity >= EXTREME_ORBIT) { say(`${id}: its orbit is so eccentric (e ${eccentricity}) that one temperature is a moment of it, not its day side`); continue; }
      const atEclipse = eccentricity >= ECCENTRIC_ORBIT;
      // A name the archive cannot be asked for (a Greek letter in it) is one planet's line, not the end of the run.
      // A day side read from its paper (--thermal-entries) is taken as given; the archives are asked for the others.
      const given = thermals.get(id);
      const asked = given ? { csv: '', ...(given.temperatureK <= PLANCK_FLOOR_KELVIN ? { cool: given, thermal: undefined } : { thermal: given }), why: undefined } : await thermalFromArchive(archive, descriptor.displayName).catch((error: Error) => ({ csv: '', thermal: undefined, why: `the archive could not be asked for ${descriptor.displayName} (${error.message.split('\n')[0]!.slice(0, 80)})`, failed: true }));
      if ('failed' in asked) { say(`${id}: ${asked.why}`); continue; }
      const { csv, thermal, why } = asked;
      // A measured day side that cannot be a glow (too cool, or one moment of an eccentric orbit) is its own false-color dataset.
      const lens = 'cool' in asked && asked.cool ? asked.cool : atEclipse ? thermal : undefined;
      if (lens) {
        if (kind !== 'neutral-shape') { say(`${id}: keeps its ${kind} dataset`); continue; }
        installDaysideDataset(files, id, descriptor.displayName, lens, atEclipse);
        const readme = resolve(o, 'README.md'), text = await readFile(readme, 'utf8'), line = daysideLine(lens, atEclipse), old = text.split('\n').find(row => row.startsWith('**Measured day side.**'));
        await writeFile(readme, old !== undefined ? text.replace(old, () => line) : text.replace('\n**Charts.**', () => `\n${line}\n\n**Charts.**`));
        await writeWithMarker(root, files, id, true);
        say(`${id}: measured day side ${lens.temperatureK} K (${lens.wavelengthMicrometres} µm, ${lens.facility})${atEclipse ? ', at secondary eclipse' : ''}, drawn in false color`);
        continue;
      }
      if (atEclipse) { say(`${id}: its orbit is eccentric (e ${eccentricity}) and no day side is measured; an estimate would hold for no moment of it`); continue; }
      let chosen: ThermalSpec | EquilibriumSpec | undefined = thermal;
      if (!chosen && mode === 'expected-glow') {
        // The estimate is shown only for the planets its test covers: giants hot enough to glow.
        const radiusKm = body.physical?.meanRadiusKm ?? 0;
        if (radiusKm < TESTED_GIANT_RADIUS_KM) {
          // A small planet: the bare-rock maximum, for planets like the red-dwarf rocks that test it.
          const hostId = body.physical?.parent, aOverRstar = body.hostedOrbit?.semiMajorAxisStellarRadii;
          const star = hostId ? JSON.parse(await readFile(resolve(root, 'src/objects', hostId, 'source/measurements.json'), 'utf8').catch(() => '{}')) as { effectiveTemperatureK?: number; effectiveTemperatureSource?: string } : {};
          if (!hostId || !(aOverRstar! > 0) || !(star.effectiveTemperatureK! > 0)) { say(`${id}: ${why}; no star temperature or a/R* in its records for the bare-rock estimate`); continue; }
          const { rock, why: unlike } = rockEstimate(radiusKm, { id: hostId, kelvin: star.effectiveTemperatureK!, source: star.effectiveTemperatureSource ?? 'its record' }, { aOverRstar: aOverRstar!, source: body.hostedOrbit?.sources?.shape ?? 'its record' });
          if (!rock) { say(`${id}: ${why}; ${unlike}`); continue; }
          if (rock.temperatureK <= PLANCK_FLOOR_KELVIN) { say(`${id}: ${why}; a bare rock there reaches ${rock.temperatureK} K, too cool to glow`); continue; }
          chosen = rock;
        }
        const { equilibrium, why: none } = chosen ? { equilibrium: chosen as EquilibriumSpec, why: undefined } : await equilibriumFromArchive(archive, descriptor.displayName).catch((error: Error) => ({ equilibrium: undefined, why: `the archive could not be asked for its equilibrium temperature (${error.message.split('\n')[0]!.slice(0, 80)})` }));
        if (!equilibrium) { say(`${id}: ${why}, and ${none}`); continue; }
        if (equilibrium.temperatureK <= PLANCK_FLOOR_KELVIN) { say(`${id}: ${why}; its equilibrium temperature, ${equilibrium.temperatureK} K, is too cool to glow`); continue; }
        chosen = equilibrium;
      }
      if (!chosen) { say(`${id}: ${why}`); continue; }
      // The archive's emission rows are kept beside a measured color only: an estimate has none to keep.
      const { hex } = await installThermalDataset(files, id, descriptor.displayName, chosen, 'wavelengthMicrometres' in chosen ? csv : undefined);
      const readme = resolve(o, 'README.md'), text = await readFile(readme, 'utf8'), color = text.split('\n').find(line => line.startsWith('**Color.**'));
      if (color !== undefined) await writeFile(readme, text.replace(color, () => thermalColorLine(chosen, hex)));
      say('wavelengthMicrometres' in chosen ? `${id}: thermal glow ${hex} at ${chosen.temperatureK} K (${chosen.wavelengthMicrometres} µm, ${chosen.facility})` : `${id}: expected glow ${hex} at ${chosen.temperatureK} K, an estimate${chosen.rock ? ' for a bare rock' : ''} (${chosen.source})`);
    } else {
      if (kind !== 'neutral-shape') { lines.push(`${id}: keeps its ${kind} dataset`); continue; }
      if (raster.surfaces[0]!.science.hostLight !== undefined) { lines.push(`${id}: already lit by its host`); if ([...files].some(([path, value]) => before.get(path) !== value)) for (const [path, value] of files) { await mkdir(dirname(resolve(root, path)), { recursive: true }); await writeFile(resolve(root, path), value); } continue; }
      const host = body.physical?.parent;
      if (!host) { lines.push(`${id}: no host in its astronomy record`); continue; }
      const light = await hostLightOf(root, host);
      if (!light) { lines.push(`${id}: host ${host} has no color dataset`); continue; }
      installHostLight(files, id, light);
      lines.push(`${id}: gray lit by ${host} (${light.srgb})`);
    }
    datasetMarkerEntry(files, id);
    for (const [path, value] of files) { await mkdir(dirname(resolve(root, path)), { recursive: true }); await writeFile(resolve(root, path), value); }
    const { authorContextMarkers } = await import('../../source-authoring/context-markers.mts'); await authorContextMarkers([id]);
    progress(lines.at(-1)!);
  }
  return lines;
}

/** Write a package whose datasets changed. When its default dataset changed too, the marker is drawn again from the new one. */
export async function writeWithMarker(root: string, files: PackageFiles, id: string, defaultChanged: boolean) {
  const { mkdir, writeFile } = await import('node:fs/promises');
  if (defaultChanged) datasetMarkerEntry(files, id);
  for (const [path, value] of files) { await mkdir(dirname(resolve(root, path)), { recursive: true }); await writeFile(resolve(root, path), value); }
  // The marker author draws in the checkout it runs in; a package written to a scratch root keeps the marker it has.
  if (defaultChanged && resolve(root) === resolve(WORKSPACE)) { const { authorContextMarkers } = await import('../../source-authoring/context-markers.mts'); await authorContextMarkers([id]); }
}

/** A planet's context marker as the marker author draws it from its default dataset (packages/telescope-cli/src/source-authoring/context-markers.mts): the
 * manifest entry names that author and the inputs the dataset reads, replacing the scaffold's gray-disc entry. */
export function datasetMarkerEntry(files: PackageFiles, id: string) {
  const path = `src/objects/${id}/source/manifest.json`, manifest = JSON.parse(String(files.get(path))) as { inputs: { id: string }[]; generatedIntermediates?: Record<string, unknown>[] };
  // A default that is a map is drawn from the input its control names (a published fit, a released simulation).
  const content = JSON.parse(String(files.get(`src/objects/${id}/source/content/object.json`))) as { datasets?: { defaultDataset?: string; controls?: { id: string; source?: { id?: string } }[] } };
  const mapInput = content.datasets?.controls?.find(control => control.id === content.datasets?.defaultDataset)?.source?.id;
  const datasetInputs = manifest.inputs.map(input => input.id).filter(input => [`${id}-preparation-raster`, `${id}-observational-measurements`, `${id}-thermal-color`, mapInput].includes(input) || input.endsWith('-band-color'));
  const generator = 'packages/telescope-cli/src/source-authoring/context-markers.mts', previous = manifest.generatedIntermediates?.find(entry => entry.path === 'presentation/context.png');
  manifest.generatedIntermediates = [...(manifest.generatedIntermediates ?? []).filter(entry => entry.path !== 'presentation/context.png'), {
    id: 'dataset-color-context-marker', path: 'presentation/context.png', origin: String(previous?.origin ?? ''), credit: `The default dataset's color as a disc; rendered by ${generator}`,
    license: 'Project-authored display derivative.', consumers: ['navigation'], recipe: { generator, inputs: datasetInputs }, generator,
    sourceBinding: { kind: 'local', reason: 'The default dataset drawn as a disc; `context-markers.mts --check` recomputes it.' } }];
  files.set(path, json(manifest));
}
