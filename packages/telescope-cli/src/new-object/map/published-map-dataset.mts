/** A published eclipse map as a dataset: the map file a paper released, read as its authors saved it by the `npy-dictionary-map`
 * format (packages/bake/src/objects/raster/numpy/npy-dictionary-map.ts). HD 189733 b's and WASP-43 b's hand-made datasets are
 * the worked examples.
 *
 *   new-object --published-map entries.json      a list of { id, dataset, label, record, file, member?, path, container?, values,
 *                                                instrument, band, credit, url, observed, shown?, hotspot }
 *
 * The entry holds what a person settles by reading the paper and its release: which file is the map and how it is saved, the
 * longitudes the paper shows of it, and the hot-spot longitude the paper prints. That printed longitude is the check: it is
 * not an input of the map, so a file read on the wrong grid, upside down or mirrored puts its hottest point elsewhere and is
 * refused. The tool checks the release's license and that it names the planet, brings the file, and derives the range drawn
 * and the words. */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { containedPath } from '@cssearth/bake/objects/sources';
import type { Archive } from '../archives/archives.mts';
import { zipMember } from './zip-member.mts';
import { bindInputs, json, openOnMap, type PackageFiles } from '../dataset.mts';
import { DATASET_REBUILD_FILES, writeWithMarker } from '../planet-datasets.mts';
import { ZENODO_RECORDS, namesObject, parseZenodoRecord, reuseLicense, sizeText, type ReuseLicense } from '../../simulations/simulations.mts';

export interface PublishedMapEntry {
  /** Dataset id, and the dataset key of its reader text. */
  readonly dataset: string; readonly label: string;
  /** The release: its Zenodo DOI, the file of it that holds the map, the member when that file is a ZIP, and where the map file
   * lives inside the package's source directory. */
  readonly record: string; readonly file: string; readonly member?: string; readonly path: string;
  /** How the map is saved: `pickle` for a bare pickle instead of a `.npy` file, and the keys down to the array (none when the
   * file is the array). The grid is the pixel-centre grid eclipse-mapping codes build, south to north and west to east. */
  readonly container?: 'pickle'; readonly values: readonly string[];
  /** The instrument ("JWST MIRI") and the band as a reader says it ("5 to 12 µm"). */
  readonly instrument: string; readonly band: string;
  /** The paper, its address, and what was observed, as the rest of "fitted to ...": "one eclipse on 14 March 2023". */
  readonly credit: string; readonly url: string; readonly observed: string;
  /** The longitudes the paper shows, in degrees east of the point under the star, and where it says so. */
  readonly shown?: { readonly west: number; readonly east: number; readonly where: string };
  /** The hot spot's longitude as the paper prints it, in degrees east, with its one-sigma interval and where it is printed. */
  readonly hotspot: { readonly degreesEast: number; readonly minus: number; readonly plus: number; readonly where: string };
}

/** The legend's limits: the shown range rounded outward to 100 K, so a map of 549 to 2,165 K is drawn from 500 to 2,200. */
const LEGEND_STEP_K = 100;
/** The reader-text budget of a dataset summary (site/build/prepare/check-preparation-inputs.mts refuses a longer one). */
const SUMMARY_BUDGET = 125;
const PLASMA = ['#0d0887', '#7e03a8', '#cc4778', '#f89540', '#f0f921'];
const ZENODO_DOI = /^10\.5281\/zenodo\.(\d+)$/u;

export function publishedMapEntry(value: unknown, label: string): PublishedMapEntry {
  const input = requireRecord(value, label), text = (key: string) => {
    const words = requireString(input[key], `${label}.${key}`).trim();
    if (!words) throw new TypeError(`${label}.${key} is empty.`);
    return words;
  };
  const known = new Set(['id', 'dataset', 'label', 'record', 'file', 'member', 'path', 'container', 'values', 'instrument', 'band', 'credit', 'url', 'observed', 'shown', 'hotspot']);
  const unknown = Object.keys(input).filter(key => !known.has(key));
  if (unknown.length) throw new TypeError(`${label}: unknown fields ${unknown.join(', ')}.`);
  const dataset = text('dataset'), record = text('record'), file = text('file'), path = text('path'), url = text('url');
  if (!/^[a-z][a-z0-9-]*$/u.test(dataset)) throw new TypeError(`${label}.dataset ${dataset}: a dataset id is lowercase letters, digits and hyphens.`);
  if (!ZENODO_DOI.test(record)) throw new TypeError(`${label}.record ${record}: a Zenodo DOI, 10.5281/zenodo.<number>.`);
  if (!/^science\/[a-z0-9-]+\/[A-Za-z0-9._-]+$/u.test(path)) throw new TypeError(`${label}.path ${path}: the map file lives at science/<paper>/<name>.`);
  if (!/^https:\/\//u.test(url)) throw new TypeError(`${label}.url ${url}: the paper's https address.`);
  const member = input.member === undefined ? undefined : text('member');
  if ((member !== undefined) !== file.endsWith('.zip')) throw new TypeError(`${label}.member names the map inside a .zip file, and only there (file ${file}).`);
  if (input.container !== undefined && input.container !== 'pickle') throw new TypeError(`${label}.container is "pickle" or left out.`);
  const values = requireArray(input.values, `${label}.values`).map((key, index) => requireString(key, `${label}.values[${index}]`));
  const hot = requireRecord(input.hotspot, `${label}.hotspot`), number = (from: Record<string, unknown>, key: string, where: string) => requireFiniteNumber(from[key], `${label}.${where}.${key}`);
  const hotspot = { degreesEast: number(hot, 'degreesEast', 'hotspot'), minus: number(hot, 'minus', 'hotspot'), plus: number(hot, 'plus', 'hotspot'), where: requireString(hot.where, `${label}.hotspot.where`) };
  if (!(hotspot.minus > 0 && hotspot.plus > 0) || Math.abs(hotspot.degreesEast) > 180) throw new RangeError(`${label}.hotspot is the printed longitude in degrees east with its positive one-sigma errors.`);
  let shown: PublishedMapEntry['shown'];
  if (input.shown !== undefined) {
    const range = requireRecord(input.shown, `${label}.shown`);
    shown = { west: number(range, 'west', 'shown'), east: number(range, 'east', 'shown'), where: requireString(range.where, `${label}.shown.where`) };
    if (!(shown.west >= -180 && shown.west < shown.east && shown.east <= 180)) throw new RangeError(`${label}.shown runs from west to east within -180 to 180 degrees.`);
  }
  return { dataset, label: text('label'), record, file, ...(member ? { member } : {}), path, ...(input.container ? { container: 'pickle' as const } : {}), values,
    instrument: text('instrument'), band: text('band'), credit: text('credit'), url, observed: text('observed'), ...(shown ? { shown } : {}), hotspot };
}

/** `--published-map` entries by object id, in file order. */
export function parsePublishedMapEntries(value: unknown): Map<string, PublishedMapEntry[]> {
  const entries = new Map<string, PublishedMapEntry[]>();
  for (const [index, item] of requireArray(value, 'published-map entries').entries()) {
    const id = requireString(requireRecord(item, `published-map entry ${index}`).id, `published-map entry ${index}.id`);
    entries.set(id, [...entries.get(id) ?? [], publishedMapEntry(item, `published-map entry ${index} (${id})`)]);
  }
  return entries;
}

export interface MapRelease { readonly doi: string; readonly recordUrl: string; readonly title: string; readonly license: ReuseLicense; readonly fileUrl: string; readonly bytes: number }

/** The release an entry names, as Zenodo states it today. Refused: a record under no license that allows reuse, one that does
 * not name this planet, and one that lists no such file. */
export async function mapRelease(archive: Archive, id: string, names: readonly string[], entry: PublishedMapEntry): Promise<MapRelease> {
  const number = ZENODO_DOI.exec(entry.record)![1]!, record = parseZenodoRecord(JSON.parse(await archive.text(`${ZENODO_RECORDS}/${number}`)), `Zenodo record ${number}`);
  const license = reuseLicense(record.license), where = `${id}, dataset ${entry.dataset}: Zenodo record ${entry.record}`;
  if (!license) throw new Error(`${where} states ${record.license ? `the license ${record.license}` : 'no license'}; a released map is shown only under a license known to allow reuse (field record).`);
  if (!namesObject(record, names)) throw new Error(`${where} ("${record.title}") does not name ${names[0]} in its title or description (field record).`);
  const file = record.files.find(candidate => candidate.name === entry.file);
  if (!file) throw new Error(`${where} lists no file ${entry.file} (field file); it lists ${record.files.map(candidate => candidate.name).slice(0, 8).join(', ')}.`);
  return { doi: entry.record, recordUrl: record.url, title: record.title, license, fileUrl: file.url, bytes: file.bytes };
}

/** The reader's recipe for the map file. */
export const publishedMapRecipe = (entry: PublishedMapEntry) => ({ format: 'npy-dictionary-map', path: entry.path, sampling: 'bilinear', units: 'K', values: [...entry.values], gridLayout: 'pixel-centres',
  ...(entry.container ? { container: entry.container } : {}), ...(entry.shown ? { shownLongitudes: [entry.shown.west, entry.shown.east] } : {}) });

/** The map file in the source directory, fetched from the release when absent: the file itself, or its member of the ZIP,
 * taken as the acquisition plan's `zip-member` step takes it. Returns the bytes fetched. */
export async function restorePublishedMap(sourceRoot: string, entry: PublishedMapEntry, release: MapRelease, archive: Archive): Promise<number> {
  const target = containedPath(sourceRoot, entry.path);
  if (await stat(target).then(info => info.size > 0, (error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return false; throw error; })) return 0;
  const fetched = await archive.bytes(release.fileUrl), bytes = entry.member === undefined ? fetched : await zipMember(fetched, entry.member);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
  return fetched.length;
}

export interface MapReport { readonly minimum: number; readonly maximum: number; readonly hotspotDegreesEast: number; readonly blankColumns: number }

/** What the reader finds in the map: the range of the cells shown, the longitude of the hottest one and the columns left
 * blank. Refused: a hottest cell outside twice the paper's printed interval around its printed hot spot. */
export function publishedMapReport(map: { readonly width: number; readonly height: number; sample(longitude: number, latitude: number): number | null }, entry: PublishedMapEntry, where: string): MapReport {
  let minimum = Infinity, maximum = -Infinity, hotspot = NaN, blank = 0;
  for (let column = 0; column < map.width; column++) {
    const longitude = -180 + (column + 0.5) * 360 / map.width;
    let seen = false;
    for (let row = 0; row < map.height; row++) {
      const value = map.sample(longitude, -90 + (row + 0.5) * 180 / map.height);
      if (value === null) continue;
      seen = true; minimum = Math.min(minimum, value);
      if (value > maximum) { maximum = value; hotspot = longitude; }
    }
    if (!seen) blank++;
  }
  if (!Number.isFinite(hotspot)) throw new RangeError(`${where}: the map file holds no finite cell inside the longitudes shown (field values).`);
  const { degreesEast, minus, plus } = entry.hotspot;
  if (hotspot < degreesEast - 2 * minus || hotspot > degreesEast + 2 * plus) {
    throw new RangeError(`${where}: the map's hottest cell is ${hotspot.toFixed(1)}° east, outside twice the printed interval around ${degreesEast}° (${entry.hotspot.where}); the file is not read as the paper drew it (fields values, container, hotspot).`);
  }
  return { minimum, maximum, hotspotDegreesEast: hotspot, blankColumns: blank };
}

const side = (degrees: number) => `${Math.abs(Math.round(degrees))}° ${degrees < 0 ? 'west' : 'east'}`;

/** Add the dataset to the package in `files`. It becomes the default where the default was one color or the neutral shape.
 * Returns the range drawn and whether the default changed. */
export function installPublishedMapDataset(files: PackageFiles, id: string, name: string, entry: PublishedMapEntry, release: MapRelease, report: MapReport) {
  const o = `src/objects/${id}`, s = `${o}/source`, read = (path: string) => requireRecord(JSON.parse(String(files.get(path))), path);
  const without = (list: unknown, where: string, key: string, values: readonly string[]) => requireArray(list, where).filter(item => !values.includes(String(requireRecord(item, where)[key])));
  const minimum = Math.floor(report.minimum / LEGEND_STEP_K) * LEGEND_STEP_K, maximum = Math.ceil(report.maximum / LEGEND_STEP_K) * LEGEND_STEP_K, labels = [String(minimum), String((minimum + maximum) / 2), String(maximum)];
  const consumer = `${id}-${entry.dataset}-published-map`, input = `${id}-${entry.dataset}-map`, blank = entry.shown !== undefined, { degreesEast, minus, plus } = entry.hotspot;
  const hot = `${side(degreesEast)} of noon`, interval = `${Math.round(degreesEast - minus)}° to ${Math.round(degreesEast + plus)}°`;

  const raster = read(`${s}/preparation/raster.json`), lit = raster.emission === undefined;
  const science = { kind: 'terrestrial-scientific', id: entry.dataset, label: entry.label, ...publishedMapRecipe(entry), consumer, displaySampling: 'bilinear', outputLongitudeOrigin: 0, minimum, maximum, colors: PLASMA, labels,
    description: `Brightness temperature at ${entry.band}, fitted to ${entry.observed}. Only large patterns are real${blank ? '; longitudes the paper does not show are left blank' : ''}.`,
    title: `${entry.instrument} · eclipse map`, sourceUrl: release.recordUrl };
  raster.surfaces = [...without(raster.surfaces, `${id} raster surfaces`, 'id', [entry.dataset]), { id: entry.dataset, output: `${id}-surface-{id}{suffix}.webp`, thumbnail: `${id}-dataset-{id}.webp`, source: entry.path, falseColor: true, science }];
  files.set(`${s}/preparation/raster.json`, json(raster));
  const descriptor = read(`${o}/object.json`), recipe = requireRecord(requireRecord(descriptor.properties, `${id} properties`).recipe, `${id} recipe`);
  const surface = requireRecord(requireArray(recipe.surfaces, `${id} recipe surfaces`)[0], `${id} recipe surface`);
  surface.datasets = [...without(surface.datasets, `${id} recipe datasets`, 'id', [entry.dataset]), { id: entry.dataset, source: 'content', material: lit ? 'lighting' : 'emission' }];
  files.set(`${o}/object.json`, json(descriptor));

  const content = read(`${s}/content/object.json`), palette = PLASMA.map(hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)));
  const control = { id: entry.dataset, label: entry.label, qualification: `Published map · ${entry.credit} · ${entry.instrument} ${entry.band}, ${entry.observed}`,
    thumbnail: `${id}-dataset-${entry.dataset}.webp`, surface: `${id}-surface-${entry.dataset}@2x.webp`, poles: `${id}-poles-${entry.dataset}@2x.webp`, source: { id: input, path: '../manifest.json', url: release.recordUrl }, falseColor: true,
    legend: { kind: 'scale', title: 'Brightness temperature', labels, recipe: { palette, labels }, meta: 'K', sourceUrl: release.recordUrl },
    notes: `Brightness temperature at ${entry.band} of ${name}, the map ${entry.credit} fitted to ${entry.observed} and released. Only large patterns are real. The hot spot sits ${hot}, ${interval} within the paper's uncertainty.${blank ? ` The paper shows the map from ${side(entry.shown!.west)} to ${side(entry.shown!.east)}; the rest was not facing the telescope and is left blank.` : ''}${lit ? " With shadows on, the star's light darkens the night half." : ''}` };
  const shown = requireRecord(content.datasets, `${id} content datasets`);
  shown.controls = [...without(shown.controls, `${id} dataset controls`, 'id', [entry.dataset]), control];
  files.set(`${s}/content/object.json`, json(content));
  const text = read(`${o}/text.json`), summary = `Heat at ${entry.band}, from ${entry.observed}. The hot spot is ${hot}${blank ? '; the far side is blank' : ''}.`;
  if (summary.length > SUMMARY_BUDGET) throw new RangeError(`${id}, dataset ${entry.dataset}: the summary is ${summary.length} characters, over the ${SUMMARY_BUDGET} a dataset summary may have; shorten the fields band or observed.`);
  text.datasets = { ...requireRecord(text.datasets ?? {}, `${id} text datasets`), [entry.dataset]: { title: `${entry.instrument} map`, detail: 'Measured temperature', summary } };
  files.set(`${o}/text.json`, json(text));

  const manifest = read(`${s}/manifest.json`), kept = entry.member === undefined ? 'The released file, unchanged.' : `The member ${entry.member} of ${entry.file} (${sizeText(release.bytes)}), unchanged.`;
  manifest.inputs = [...without(manifest.inputs, `${id} manifest inputs`, 'id', [input]),
    { id: input, path: entry.path, origin: release.fileUrl, productId: entry.member ?? entry.file, version: release.doi, title: `${release.title}: the eclipse map of ${name}`, sourceUrl: release.recordUrl,
      credit: `${entry.credit}; ${entry.instrument}, ${entry.observed}`, displayCredit: `${entry.credit} · ${entry.instrument}`, license: release.license.name, licenseEvidence: [release.recordUrl, release.license.url],
      acquisition: `Restored through source/preparation/acquisition.json from Zenodo record ${release.doi}. ${kept} The hot-spot longitude the paper prints (${degreesEast}°, ${entry.hotspot.where} of ${entry.url}) is the check that the grid is read as drawn.`,
      redistribution: `Not redistributed in git; restored from Zenodo. ${release.license.name} with attribution.`, consumers: [consumer] }];
  files.set(`${s}/manifest.json`, json(manifest));
  const plan = read(`${s}/preparation/acquisition.json`);
  plan.operations = [...without(plan.operations, `${id} acquisition operations`, 'path', [entry.path]),
    entry.member === undefined ? { kind: 'download', groups: ['restore', 'refresh'], path: entry.path, url: release.fileUrl } : { kind: 'zip-member', groups: ['restore', 'refresh'], path: entry.path, url: release.fileUrl, member: entry.member }];
  files.set(`${s}/preparation/acquisition.json`, json(plan));
  bindInputs(files, id);
  return { minimum, maximum, promoted: openOnMap(files, id, entry.dataset) };
}

/** `new-object --published-map`: add each entry's dataset to its planet's package under `root`. The release is checked and
 * the map file fetched, the bake's own reader reads it, and nothing is written for a planet whose entry is refused. Returns
 * one line per dataset; nothing is baked here. */
export async function addPublishedMapDatasets(root: string, entries: ReadonlyMap<string, readonly PublishedMapEntry[]>, archive: Archive, progress = (_line: string) => {}): Promise<string[]> {
  const { loadNpyDictionaryMap } = await import('@cssearth/bake/objects/raster'), lines: string[] = [];
  for (const [id, list] of entries) {
    const o = resolve(root, 'src/objects', id), files: PackageFiles = new Map();
    for (const path of DATASET_REBUILD_FILES) files.set(`src/objects/${id}/${path}`, await readFile(resolve(o, path), 'utf8'));
    const content = requireRecord(JSON.parse(String(files.get(`src/objects/${id}/source/content/object.json`))), `${id} content`), name = requireString(content.displayName, `${id} displayName`);
    const catalog = await readFile(resolve(root, 'packages/astronomy/data/bodies', `${id}.json`), 'utf8').then(text => requireRecord(JSON.parse(text), `${id} body`));
    const names = [name, ...Array.isArray(catalog.aliases) ? catalog.aliases.filter((alias): alias is string => typeof alias === 'string') : []];
    let promoted = false;
    for (const entry of list) {
      const release = await mapRelease(archive, id, names, entry), fetched = await restorePublishedMap(resolve(o, 'source'), entry, release, archive);
      if (fetched) progress(`${id}: ${sizeText(fetched)} fetched from Zenodo record ${release.doi}`);
      const report = publishedMapReport(await loadNpyDictionaryMap(resolve(o, 'source'), publishedMapRecipe(entry)), entry, `${id}, dataset ${entry.dataset}`);
      const installed = installPublishedMapDataset(files, id, name, entry, release, report);
      promoted ||= installed.promoted;
      lines.push(`${id}: ${entry.dataset} map from ${entry.credit}, ${Math.round(report.minimum)}-${Math.round(report.maximum)} K drawn ${installed.minimum}-${installed.maximum} K, hottest ${report.hotspotDegreesEast.toFixed(1)}° east (paper ${entry.hotspot.degreesEast}°), ${report.blankColumns} blank columns${installed.promoted ? '; the page now opens on it' : ''}`);
      progress(lines.at(-1)!);
    }
    await writeWithMarker(root, files, id, promoted);
  }
  return lines;
}
