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
import type { Archive } from './archives.mts';
import { CHECKED, planckChoice } from './color.mts';
import { bindInputs, json, type PackageFiles } from './dataset.mts';
import { decodeEntities, NASA_TAP } from './orbit.mts';
import type { Cited, PhotometrySpec, ThermalSpec } from './spec.mts';
import { DISC_BAND_COLOR_SCHEMA, loadDiscBandColor } from '@cssearth/bake/objects/layers/observation';
import { loadStellarPhotometricColor } from '@cssearth/bake/objects/stellar';
import { parseCieTable, hostLitGray } from '@cssearth/bake/objects/color';
import { readCie1931ColorMatching } from '@cssearth/bake/objects/sources';
import { HOSTED_PLANET_STYLESHEET } from './new-hosted-planet.mts';
import { installPhaseCurveDataset, type PhaseCurveEntry } from './phase-curve-dataset.mts';
import { installSimulationDataset, restoreSimulationFile, simulationRecipe, simulationRelease, type SimulationEntry } from './simulation/simulation-dataset.mts';
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

/** The archive's emission rows for a planet and the spec's thermal entry, or undefined with no measured temperature or one too
 * cool to glow (`why` says which). */
export async function thermalFromArchive(archive: Archive, planet: string): Promise<{ rows: EmissionRow[]; csv: string; thermal?: ThermalSpec; why?: string }> {
  const csv = await archive.text(`${NASA_TAP}?${new URLSearchParams({ query: emissionQuery(planet), format: 'csv' })}`);
  const rows = parseEmissionRows(csv), row = pickThermalRow(rows);
  if (!row) return { rows, csv, why: "no measured dayside brightness temperature in the archive's emission table" };
  if (row.temperatureK! <= PLANCK_FLOOR_KELVIN) return { rows, csv, why: `its dayside brightness temperature, ${row.temperatureK} K (${row.label}), is too cool to glow (a black-body color needs over ${PLANCK_FLOOR_KELVIN} K)` };
  return { rows, csv, thermal: { temperatureK: row.temperatureK!, ...(row.temperatureErrorK === undefined ? {} : { uncertaintyK: row.temperatureErrorK }), wavelengthMicrometres: row.wavelengthMicrometres,
    facility: `${row.facility}${row.instrument ? ` ${row.instrument}` : ''}`.trim(), source: `${row.label}, dayside brightness temperature at ${row.wavelengthMicrometres} µm (NASA Exoplanet Archive emission table)`,
    url: row.url ?? 'https://exoplanetarchive.ipac.caltech.edu/', chosen: `${rows.filter(r => r.temperatureK !== undefined && !r.temperatureLimit).length} measured of ${rows.length} rows; the smallest relative uncertainty, then the longest wavelength` } };
}

/** Turn a shape-only planet package into one with the "Thermal glow" dataset: the black-body color at its measured dayside
 * temperature. `csv` is the archive's emission table for the planet, kept beside the record. Returns the color. */
export async function installThermalDataset(files: PackageFiles, id: string, name: string, thermal: ThermalSpec, csv: string | undefined) {
  const o = `src/objects/${id}`, s = `${o}/source`, read = (path: string) => JSON.parse(String(files.get(path))) as Record<string, any>;
  const cmf = parseCieTable((await readCie1931ColorMatching()).toString('utf8'), 3);
  const cited: Cited = { value: thermal.temperatureK, ...(thermal.uncertaintyK === undefined ? {} : { uncertainty: thermal.uncertaintyK }), source: thermal.source, url: thermal.url };
  const color = planckChoice(id, cited, `Its day side's brightness temperature is measured in secondary eclipse at ${thermal.wavelengthMicrometres} µm (${thermal.facility}) and nobody has imaged it`, [], cmf, 'desaturate');
  const record = { ...color.record, temperature: { ...(color.record.temperature as Record<string, unknown>), chosen: thermal.chosen, wavelengthMicrometres: thermal.wavelengthMicrometres, facility: thermal.facility, ...(csv ? { rows: 'photometry/emission-spectroscopy.csv' } : {}) } };
  files.set(`${s}/photometry/thermal-color.json`, json(record));
  if (csv) files.set(`${s}/photometry/emission-spectroscopy.csv`, csv);
  const science: { kind: string; qualification: string } = { kind: 'dayside-thermal-color', qualification: `Color of a black body at the dayside brightness temperature ${thermal.temperatureK.toLocaleString('en-US')} K measured in secondary eclipse at ${thermal.wavelengthMicrometres} µm (${thermal.source}), uniform over the disc and lit by its star so the day side faces it. The planet is unresolved: no map is implied, and reflected starlight is not included.` };
  const loaded = await loadStellarPhotometricColor(async path => { const value = files.get(`${s}/${path}`); if (value === undefined) throw new Error(`${id}: ${path} is not in the generated package.`); return Buffer.from(value); }, science, 'photometry/thermal-color.json');
  const colorHex = `#${loaded.color.srgb.map(value => value.toString(16).padStart(2, '0')).join('')}`;
  // Below about 1,800 K a black body's color lies outside sRGB; it is shown mixed with the least white that brings it inside, hue kept.
  const mapped = loaded.color.gamut ? ` Its black-body color lies outside the sRGB gamut and is shown mixed with ${Math.round(loaded.color.gamut.whiteFraction * 100)}% white, the least that brings it inside, hue kept.` : '';
  science.qualification += mapped;

  const raster = read(`${s}/preparation/raster.json`);
  raster.surfaces = [{ id: 'thermal', output: `${id}-surface-{id}{suffix}.webp`, thumbnail: `${id}-dataset-{id}.webp`, source: 'photometry/thermal-color.json', falseColor: false, science }];
  files.set(`${s}/preparation/raster.json`, json(raster));
  const descriptor = read(`${o}/object.json`);
  descriptor.properties.recipe.surfaces[0].datasets = [{ id: 'thermal', source: 'content', material: 'lighting' }];
  files.set(`${o}/object.json`, json(descriptor));
  ensureStylesheet(files, id);
  const geometry = read(`${s}/preparation/geometry.json`);
  geometry.surface.color = colorHex;
  geometry.surface.surface.url = `/scenes/${id}/${id}-surface-thermal@2x.webp`; geometry.surface.poles.url = `/scenes/${id}/${id}-poles-thermal@2x.webp`;
  files.set(`${s}/preparation/geometry.json`, json(geometry));
  const content = read(`${s}/content/object.json`);
  content.datasets = { titleKey: 'datasets', defaultDataset: 'thermal', controls: [{ id: 'thermal', label: 'Thermal glow',
    qualification: `Black-body color at its measured dayside temperature, ${thermal.temperatureK.toLocaleString('en-US')} K. The disc itself is unresolved.`,
    thumbnail: `${id}-dataset-thermal.webp`, surface: `${id}-surface-thermal@2x.webp`, poles: `${id}-poles-thermal@2x.webp`,
    source: { id: `${id}-thermal-color`, path: '../manifest.json', url: thermal.url }, falseColor: false,
    notes: `The color of ${name}'s heat: a black body at the dayside brightness temperature measured in secondary eclipse at ${thermal.wavelengthMicrometres} µm (${thermal.facility}). Its star lights the day side; the night side is not measured. Reflected starlight is not included.` }] };
  files.set(`${s}/content/object.json`, json(content));
  const text = read(`${o}/text.json`);
  text.datasets = { thermal: { title: 'Dayside heat', detail: 'From its dayside temperature', summary: `The color of a black body at the ${thermal.temperatureK.toLocaleString('en-US')} K day side measured in eclipse.` } };
  files.set(`${o}/text.json`, json(text));
  const manifest = read(`${s}/manifest.json`);
  const inputs = [{ id: `${id}-thermal-color`, path: 'photometry/thermal-color.json', origin: thermal.url, credit: `${thermal.source}; CIE 1931 2° observer`, license: 'Factual numerical measurements; source attribution retained',
      acquisition: 'Authored method record: names the archive row chosen and the color computation applied', redistribution: 'Method record only', consumers: ['assets', 'datasets'],
      sourceBinding: { kind: 'local', reason: 'Project-authored color recipe naming the cited brightness temperature; repinned when edited.' } },
    ...csv ? [{ id: `${id}-emission-spectroscopy`, path: 'photometry/emission-spectroscopy.csv', origin: `${NASA_TAP}?${new URLSearchParams({ query: emissionQuery(name), format: 'csv' })}`,
      credit: 'NASA Exoplanet Archive, emission spectroscopy table (secondary-eclipse depths and brightness temperatures as published)', license: 'NASA Exoplanet Archive data use: acknowledge the archive and the papers it cites',
      acquisition: 'TAP query in source/preparation/acquisition.json: every emission row of this planet, ordered by wavelength.', redistribution: 'Table rows as served, with the archive acknowledged.', consumers: ['datasets'] }] : []];
  manifest.inputs = [...manifest.inputs, ...inputs];
  files.set(`${s}/manifest.json`, json(manifest));
  bindInputs(files, id);
  if (csv) {
    const plan = read(`${s}/preparation/acquisition.json`);
    plan.operations = [...plan.operations, { kind: 'download', groups: ['restore', 'refresh'], path: 'photometry/emission-spectroscopy.csv', url: `${NASA_TAP}?${new URLSearchParams({ query: emissionQuery(name), format: 'csv' })}` }];
    files.set(`${s}/preparation/acquisition.json`, json(plan));
  }
  return { hex: colorHex, credit: `Color: a black body at the ${thermal.temperatureK.toLocaleString('en-US')} K dayside brightness temperature of ${thermal.source}, through the CIE 1931 2° color-matching functions.`, checked: CHECKED };
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
const DATASET_REBUILD_FILES = ['object.json', 'text.json', 'source/preparation/raster.json', 'source/preparation/geometry.json', 'source/preparation/acquisition.json', 'source/content/object.json', 'source/manifest.json'] as const;

/** Give planets already in the tree their color from what is measured: `thermal` reads the archive's emission table and
 * installs the "Thermal glow" dataset where a dayside temperature is measured; `host-light` lights a neutral gray with the
 * host's color. Returns one line per planet; nothing is baked here (packages/bake/cli/prepare-object.mts does that). */
export async function rebuildExistingDatasets(root: string, ids: readonly string[], mode: 'thermal' | 'host-light' | 'photometry' | 'phase-curve' | 'simulation', archive: Archive, progress = (_line: string) => {}, photometry: ReadonlyMap<string, PhotometrySpec> = new Map(), phaseCurves: ReadonlyMap<string, readonly PhaseCurveEntry[]> = new Map(), simulations: ReadonlyMap<string, readonly SimulationEntry[]> = new Map()) {
  const { mkdir, writeFile } = await import('node:fs/promises');
  const lines: string[] = [];
  for (const id of ids) {
    const o = resolve(root, 'src/objects', id), files: PackageFiles = new Map();
    for (const path of DATASET_REBUILD_FILES) files.set(`src/objects/${id}/${path}`, await readFile(resolve(o, path), 'utf8'));
    const before = new Map(files);
    const descriptor = JSON.parse(String(files.get(`src/objects/${id}/source/content/object.json`))) as { displayName: string }, body = JSON.parse(await readFile(resolve(root, 'packages/astronomy/data/bodies', `${id}.json`), 'utf8')) as { physical?: { parent?: string } };
    const raster = JSON.parse(String(files.get(`src/objects/${id}/source/preparation/raster.json`))) as { emission?: unknown; surfaces: { science: { kind: string; hostLight?: unknown } }[] };
    const kind = raster.surfaces[0]?.science.kind;
    // A self-luminous body (an imaged young planet, drawn emissive) shines with its own heat; no starlight to tint.
    if (mode === 'host-light' && raster.emission !== undefined) { lines.push(`${id}: self-luminous, no starlight on it`); progress(lines.at(-1)!); continue; }
    // Whatever the mode, a lit shape planet gets its own stylesheet if it never had one (the lighting frame is 0×0 without it).
    if (kind === 'neutral-shape' && raster.emission === undefined && !(JSON.parse(String(files.get(`src/objects/${id}/object.json`))) as { properties: { page: { stylesheets: string[] } } }).properties.page.stylesheets.includes(HOSTED_PLANET_STYLESHEET)) { ensureStylesheet(files, id); lines.push(`${id}: stylesheet written, its lighting frame had no size`); progress(lines.at(-1)!); }
    if (mode === 'phase-curve') {
      // A heat map is added beside the default dataset, so the marker, drawn from the default dataset, stays as it is.
      for (const entry of phaseCurves.get(id) ?? []) {
        const { minimum, maximum, hottest } = await installPhaseCurveDataset(files, id, descriptor.displayName, entry);
        lines.push(`${id}: ${entry.dataset} dataset from ${entry.credit}, ${minimum}-${maximum} K, hottest ${hottest}° from noon`); progress(lines.at(-1)!);
      }
      for (const [path, value] of files) { await mkdir(dirname(resolve(root, path)), { recursive: true }); await writeFile(resolve(root, path), value); }
      continue;
    }
    if (mode === 'simulation') {
      // A published simulation is added beside the default dataset and never becomes it, so the marker stays as it is. The
      // release is checked on Zenodo, its file is brought into the source directory, and the range drawn is the file's own.
      const catalog = (JSON.parse(String(files.get(`src/objects/${id}/object.json`))) as { properties: { catalog?: { aliases?: unknown } } }).properties.catalog;
      const names = [descriptor.displayName, ...Array.isArray(catalog?.aliases) ? catalog.aliases.filter((alias): alias is string => typeof alias === 'string') : []];
      for (const entry of simulations.get(id) ?? []) {
        const release = await simulationRelease(archive, id, names, entry);
        if (await restoreSimulationFile(resolve(o, 'source'), id, entry, release) === 'downloaded') progress(`${id}: ${entry.file} downloaded from Zenodo record ${release.doi}`);
        const field = await loadNetcdfLonLatField(resolve(o, 'source'), simulationRecipe(entry));
        const { minimum, maximum } = installSimulationDataset(files, id, descriptor.displayName, entry, release, field.report);
        lines.push(`${id}: ${entry.dataset} dataset from the ${entry.model} simulation of ${entry.credit}, ${minimum}-${maximum} ${entry.units}, ${release.license.name}`); progress(lines.at(-1)!);
      }
      for (const [path, value] of files) { await mkdir(dirname(resolve(root, path)), { recursive: true }); await writeFile(resolve(root, path), value); }
      continue;
    }
    if (mode === 'photometry') {
      const spec = photometry.get(id);
      if (!spec) { lines.push(`${id}: no photometry entry in the spec`); progress(lines.at(-1)!); continue; }
      const { hex } = await installBandColorDataset(files, id, descriptor.displayName, spec);
      lines.push(`${id}: infrared color ${hex} from ${spec.source.citation}`);
    } else if (mode === 'thermal') {
      if (kind === 'dayside-thermal-color') { ensureStylesheet(files, id); lines.push(`${id}: keeps its thermal dataset; stylesheet refreshed`); for (const [path, value] of files) { await mkdir(dirname(resolve(root, path)), { recursive: true }); await writeFile(resolve(root, path), value); } progress(lines.at(-1)!); continue; }
      if (kind !== 'neutral-shape') { lines.push(`${id}: keeps its ${kind} dataset`); continue; }
      const { csv, thermal, why } = await thermalFromArchive(archive, descriptor.displayName);
      if (!thermal) { lines.push(`${id}: ${why}`); continue; }
      const { hex } = await installThermalDataset(files, id, descriptor.displayName, thermal, csv);
      lines.push(`${id}: thermal glow ${hex} at ${thermal.temperatureK} K (${thermal.wavelengthMicrometres} µm, ${thermal.facility})`);
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
    const { authorContextMarkers } = await import('../source-authoring/context-markers.mts'); await authorContextMarkers([id]);
    progress(lines.at(-1)!);
  }
  return lines;
}

/** A planet's context marker as the marker author draws it from its default dataset (packages/telescope-cli/src/source-authoring/context-markers.mts): the
 * manifest entry names that author and the inputs the dataset reads, replacing the scaffold's gray-disc entry. */
export function datasetMarkerEntry(files: PackageFiles, id: string) {
  const path = `src/objects/${id}/source/manifest.json`, manifest = JSON.parse(String(files.get(path))) as { inputs: { id: string }[]; generatedIntermediates?: Record<string, unknown>[] };
  const datasetInputs = manifest.inputs.map(input => input.id).filter(input => [`${id}-preparation-raster`, `${id}-observational-measurements`, `${id}-thermal-color`].includes(input) || input.endsWith('-band-color'));
  const generator = 'packages/telescope-cli/src/source-authoring/context-markers.mts', previous = manifest.generatedIntermediates?.find(entry => entry.path === 'presentation/context.png');
  manifest.generatedIntermediates = [...(manifest.generatedIntermediates ?? []).filter(entry => entry.path !== 'presentation/context.png'), {
    id: 'dataset-color-context-marker', path: 'presentation/context.png', origin: String(previous?.origin ?? ''), credit: `The default dataset's color as a disc; rendered by ${generator}`,
    license: 'Project-authored display derivative.', consumers: ['navigation'], recipe: { generator, inputs: datasetInputs }, generator,
    sourceBinding: { kind: 'local', reason: 'The default dataset drawn as a disc; `context-markers.mts --check` recomputes it.' } }];
  files.set(path, json(manifest));
}
