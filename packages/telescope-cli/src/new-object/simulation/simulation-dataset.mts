/** A published simulation as a dataset beside a body's default dataset: one field of a model run a paper released on Zenodo,
 * read by the `netcdf-lonlat-field` format (packages/bake/src/objects/raster/netcdf/netcdf-lonlat-field.ts) and labelled as
 * the rule on published simulations requires (.agents/skills/celestial-skill/references/scientific-faithfulness.md): its own
 * dataset, named as a model with its paper and the scenario it assumes, never the default.
 *
 *   new-object --simulation entries.json      a list of { id, dataset, label, quantity, record, file, path, variable, coordinates,
 *                                             select, units, longitudeZeroAt, model, credit, url, scenario, detected, undetected?,
 *                                             others?, range? }
 *
 * The entry holds what only a person can settle by reading the paper: which file and variable, which time and level, where
 * the model put the star overhead, what the run assumes and whether that has been detected. The tool checks the rest against
 * the release and derives the words: the record's license, that it names this object and lists the file; the variable, its
 * units and its grid; the range drawn and the legend. Nothing is guessed, and whatever fails is refused with the object,
 * the file and the field. */
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { containedPath, publishPinnedSourceStream } from '@cssearth/bake/objects/sources';
import type { Archive } from '../archives/archives.mts';
import { bindInputs, json, type PackageFiles } from '../dataset.mts';
import { MAX_RECORDS, ZENODO_RECORDS, namesObject, parseZenodoRecord, parseZenodoSearch, reuseLicense, speaksOfSimulation, zenodoQuery, type ReuseLicense } from '../../simulations/simulations.mts';

export interface SimulationEntry {
  /** Dataset id, and the dataset key of its reader text. */
  readonly dataset: string; readonly label: string;
  /** What the field is, as the legend titles it: "Surface temperature". */
  readonly quantity: string;
  /** The release: its Zenodo DOI, the file of it that is read, and where that file lives inside the package's source directory. */
  readonly record: string; readonly file: string; readonly path: string;
  /** What is read from the file: the variable, its coordinate variables, the index along every other dimension and its units. */
  readonly variable: string; readonly coordinates: { readonly longitude: string; readonly latitude: string };
  readonly select: Readonly<Record<string, number>>; readonly units: string;
  /** The grid longitude, in degrees east, of the body's zero meridian: where the model put the star overhead on a synchronous planet. */
  readonly longitudeZeroAt: number;
  /** Who made it: the model's name ("ExoCAM"), the paper ("Wolf et al. (2022)") and its URL. */
  readonly model: string; readonly credit: string; readonly url: string;
  /** What the run assumes, as the rest of a sentence: "one bar of nitrogen with 400 ppm of carbon dioxide over a global ocean". */
  readonly scenario: string;
  /** Whether what the scenario assumes has been detected on the object, and when it has not, what nobody has detected ("an atmosphere"). */
  readonly detected: boolean; readonly undetected?: string;
  /** How far other published models of the same case differ, as a sentence, with the paper that says so. */
  readonly others?: { readonly text: string; readonly url: string };
  /** The legend's limits, when the paper's own color scale is used; the released range rounded outward otherwise. */
  readonly range?: readonly [number, number];
}

/** The inferno ramp WASP-103 b's hand-made climate simulation draws. */
const INFERNO = ['#000004', '#57106e', '#bc3754', '#f98e09', '#fcffa4'];
const ZENODO_DOI = /^10\.5281\/zenodo\.(\d+)$/u;

export function simulationEntry(value: unknown, label: string): SimulationEntry {
  const input = requireRecord(value, label), text = (key: string) => {
    const words = requireString(input[key], `${label}.${key}`).trim();
    if (!words) throw new TypeError(`${label}.${key} is empty.`);
    return words;
  };
  const known = new Set(['id', 'dataset', 'label', 'quantity', 'record', 'file', 'path', 'variable', 'coordinates', 'select', 'units', 'longitudeZeroAt', 'model', 'credit', 'url', 'scenario', 'detected', 'undetected', 'others', 'range']);
  const unknown = Object.keys(input).filter(key => !known.has(key));
  if (unknown.length) throw new TypeError(`${label}: unknown fields ${unknown.join(', ')}.`);
  const dataset = text('dataset'), record = text('record'), file = text('file'), path = text('path'), url = text('url');
  if (!/^[a-z][a-z0-9-]*$/u.test(dataset)) throw new TypeError(`${label}.dataset ${dataset}: a dataset id is lowercase letters, digits and hyphens.`);
  if (!ZENODO_DOI.test(record)) throw new TypeError(`${label}.record ${record}: a release is named by its Zenodo DOI, 10.5281/zenodo.<number>.`);
  if (file.includes('/')) throw new TypeError(`${label}.file ${file}: the name of one file of the record.`);
  if (!/^science\/[a-z0-9-]+\/[A-Za-z0-9._-]+\.nc$/u.test(path)) throw new TypeError(`${label}.path ${path}: a released field lives at science/<paper>/<name>.nc.`);
  if (!/^https:\/\//u.test(url)) throw new TypeError(`${label}.url ${url}: the paper's https address.`);
  const coordinates = requireRecord(input.coordinates, `${label}.coordinates`), select = input.select === undefined ? {} : requireRecord(input.select, `${label}.select`);
  for (const [dimension, index] of Object.entries(select)) if (typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0) throw new TypeError(`${label}.select.${dimension} must be a whole index counted from 0.`);
  const scenario = text('scenario');
  if (/[.!?]$/u.test(scenario)) throw new TypeError(`${label}.scenario is the rest of the sentence "The run assumes ..."; leave out its final period.`);
  if (typeof input.detected !== 'boolean') throw new TypeError(`${label}.detected must say, true or false, whether what the scenario assumes has been detected on the object.`);
  if (input.detected !== (input.undetected === undefined)) throw new TypeError(input.detected ? `${label}.undetected: nothing is undetected when detected is true.` : `${label}.undetected must name what nobody has detected ("an atmosphere").`);
  const others = input.others === undefined ? undefined : (() => {
    const record = requireRecord(input.others, `${label}.others`), sentence = requireString(record.text, `${label}.others.text`).trim(), source = requireString(record.url, `${label}.others.url`);
    if (!/[.]$/u.test(sentence)) throw new TypeError(`${label}.others.text is a whole sentence, ending in a period.`);
    if (!/^https:\/\//u.test(source)) throw new TypeError(`${label}.others.url ${source}: the https address of the paper that compares the models.`);
    return { text: sentence, url: source };
  })();
  const range = input.range === undefined ? undefined : (() => {
    const limits = requireArray(input.range, `${label}.range`).map((limit, index) => requireFiniteNumber(limit, `${label}.range[${index}]`));
    if (limits.length !== 2 || !(limits[0]! < limits[1]!)) throw new TypeError(`${label}.range is [minimum, maximum], the first below the second.`);
    return [limits[0]!, limits[1]!] as const;
  })();
  return { dataset, label: text('label'), quantity: text('quantity'), record, file, path, variable: text('variable'),
    coordinates: { longitude: requireString(coordinates.longitude, `${label}.coordinates.longitude`), latitude: requireString(coordinates.latitude, `${label}.coordinates.latitude`) },
    select: select as Record<string, number>, units: text('units'), longitudeZeroAt: requireFiniteNumber(input.longitudeZeroAt, `${label}.longitudeZeroAt`), model: text('model'), credit: text('credit'), url, scenario,
    detected: input.detected, ...(input.undetected === undefined ? {} : { undetected: text('undetected') }), ...(others ? { others } : {}), ...(range ? { range } : {}) };
}

/** `--simulation entries.json`: the entries for bodies already in the tree, by body id. */
export function parseSimulationEntries(value: unknown): Map<string, SimulationEntry[]> {
  const out = new Map<string, SimulationEntry[]>();
  requireArray(value, 'simulation entries').forEach((entry, i) => {
    const id = requireString(requireRecord(entry, `entry ${i}`).id, `entry ${i}.id`);
    out.set(id, [...out.get(id) ?? [], simulationEntry(entry, `${id}.simulations[${out.get(id)?.length ?? 0}]`)]);
  });
  return out;
}

export interface SimulationRelease { readonly doi: string; readonly recordUrl: string; readonly title: string; readonly license: ReuseLicense; readonly fileUrl: string; readonly bytes: number }

/** The release an entry names, as Zenodo states it today. Refused: a record under no license that allows reuse, one that
 * does not name this object (a model of a class of objects is not a model of this one), and one that lists no such file. */
export async function simulationRelease(archive: Archive, id: string, names: readonly string[], entry: SimulationEntry): Promise<SimulationRelease> {
  const number = ZENODO_DOI.exec(entry.record)![1]!, record = parseZenodoRecord(JSON.parse(await archive.text(`${ZENODO_RECORDS}/${number}`)), `Zenodo record ${number}`);
  const license = reuseLicense(record.license), where = `${id}, dataset ${entry.dataset}: Zenodo record ${entry.record}`;
  if (!license) throw new Error(`${where} states ${record.license ? `the license ${record.license}` : 'no license'}; a simulation is shown only under a license known to allow reuse (field record).`);
  if (!namesObject(record, names)) throw new Error(`${where} ("${record.title}") does not name ${names[0]} in its title or description; a model of a class of objects is not a model of this one (field record).`);
  const file = record.files.find(candidate => candidate.name === entry.file);
  if (!file) throw new Error(`${where} lists no file ${entry.file} (field file); it lists ${record.files.slice(0, 5).map(candidate => candidate.name).join(', ')}${record.files.length > 5 ? ` and ${record.files.length - 5} more` : ''}.`);
  return { doi: entry.record, recordUrl: record.url, title: record.title, license, fileUrl: file.url, bytes: file.bytes };
}

/** The released file in the package's source directory. One already there at the size Zenodo lists is kept; otherwise it is
 * streamed from the record and held to that size, so a file of gigabytes is never held in memory. */
export async function restoreSimulationFile(sourceRoot: string, id: string, entry: SimulationEntry, release: SimulationRelease, fetcher: typeof fetch = fetch): Promise<'present' | 'downloaded'> {
  const path = containedPath(sourceRoot, entry.path);
  const size = await stat(path).then(info => info.size, (error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return undefined; throw error; });
  if (size === release.bytes) return 'present';
  if (size !== undefined) throw new Error(`${id}, dataset ${entry.dataset}: ${path} has ${size} bytes and Zenodo lists ${release.bytes} for ${entry.file}; remove it to download the release again.`);
  const response = await fetcher(release.fileUrl, { redirect: 'follow', headers: { 'user-agent': 'cssEarth-telescope/1.0 (https://css.earth)' } });
  if (!response.ok || !response.body) throw new Error(`${id}, dataset ${entry.dataset}: Zenodo returned HTTP ${response.status} for ${release.fileUrl}.`);
  await publishPinnedSourceStream({ sourceRoot, entry: { path: entry.path, origin: release.fileUrl }, stream: Readable.fromWeb(response.body as never), declaredBytes: release.bytes });
  return 'downloaded';
}

/** What the field reader is asked for: the entry's statements about the file, and the tolerance WASP-103 b's table uses. */
export function simulationRecipe(entry: SimulationEntry) {
  return { format: 'netcdf-lonlat-field', path: entry.path, variable: entry.variable, coordinates: entry.coordinates, select: entry.select,
    sourceUnits: entry.units, longitudeZeroAt: entry.longitudeZeroAt, coordinateToleranceDegrees: 0.005 };
}

/** The released range rounded outward to one step of its own size: 204.6 to 295.2 K is drawn from 200 to 300. */
export function roundedRange(minimum: number, maximum: number): readonly [number, number] {
  if (!(maximum > minimum)) throw new RangeError(`A field with one value, ${minimum}, has no range to draw.`);
  const step = 10 ** Math.floor(Math.log10(maximum - minimum)), tidy = (value: number) => Number(value.toPrecision(12));
  return [tidy(Math.floor(minimum / step) * step), tidy(Math.ceil(maximum / step) * step)];
}

export interface FieldReport { readonly minimum: number; readonly maximum: number; readonly latitudeRange: readonly (number | undefined)[]; readonly missing: number }

/** Add the dataset to the package in `files`, keeping its default dataset. Returns the range drawn. */
export function installSimulationDataset(files: PackageFiles, id: string, name: string, entry: SimulationEntry, release: SimulationRelease, field: FieldReport) {
  const o = `src/objects/${id}`, s = `${o}/source`, read = (path: string) => requireRecord(JSON.parse(String(files.get(path))), path);
  const others = (list: unknown, where: string, key: string, value: string) => requireArray(list, where).filter(item => requireRecord(item, where)[key] !== value);
  const [minimum, maximum] = entry.range ?? roundedRange(field.minimum, field.maximum), number = (value: number) => String(Number(value.toPrecision(12)));
  if (field.minimum < minimum || field.maximum > maximum)
    throw new RangeError(`${id}, dataset ${entry.dataset}: ${entry.variable} in ${entry.file} runs from ${field.minimum} to ${field.maximum} ${entry.units}, outside the range ${minimum} to ${maximum} the entry gives (field range).`);
  const labels = [minimum, (minimum + maximum) / 2, maximum].map(number);
  // Rows the release does not hold, and cells it marks missing, stay without a value: they are drawn gray and said so.
  const north = field.latitudeRange[1]!, south = field.latitudeRange[0]!, short = north < 90 || south > -90;
  const caps = short ? ` Gray caps: no released grid samples beyond ${number(Math.min(north, -south))}° north or south.` : '', gaps = field.missing ? ' Gray cells have no value in the release.' : '';
  const quantity = `${entry.quantity[0]!.toLowerCase()}${entry.quantity.slice(1)}`, consumer = `${entry.dataset}-simulation`, input = `${id}-${entry.dataset}-simulation`;

  const raster = read(`${s}/preparation/raster.json`), lit = raster.emission === undefined;
  const science = { kind: 'terrestrial-scientific', id: entry.dataset, label: entry.label, ...simulationRecipe(entry), consumer, sampling: 'bilinear', displaySampling: 'nearest',
    outputLongitudeOrigin: 0, units: entry.units, minimum, maximum, colors: INFERNO, labels,
    description: `Simulated ${quantity} from the ${entry.model} model, a published simulation and not a measurement.${caps}${gaps}`, title: `${entry.label} · ${entry.model} simulation`, sourceUrl: entry.url };
  raster.surfaces = [...others(raster.surfaces, `${id} raster surfaces`, 'id', entry.dataset),
    { id: entry.dataset, output: `${id}-surface-{id}{suffix}.webp`, thumbnail: `${id}-dataset-{id}.webp`, source: entry.path, falseColor: true, science }];
  files.set(`${s}/preparation/raster.json`, json(raster));
  const descriptor = read(`${o}/object.json`), recipe = requireRecord(requireRecord(descriptor.properties, `${id} properties`).recipe, `${id} recipe`);
  const surface = requireRecord(requireArray(recipe.surfaces, `${id} recipe surfaces`)[0], `${id} recipe surface`);
  surface.datasets = [...others(surface.datasets, `${id} recipe datasets`, 'id', entry.dataset), { id: entry.dataset, source: 'content', material: lit ? 'lighting' : 'emission' }];
  files.set(`${o}/object.json`, json(descriptor));

  const content = read(`${s}/content/object.json`), palette = INFERNO.map(hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)));
  const control = { id: entry.dataset, label: entry.label, qualification: `Simulation · ${entry.model} · ${entry.credit} · False color`,
    thumbnail: `${id}-dataset-${entry.dataset}.webp`, surface: `${id}-surface-${entry.dataset}@2x.webp`, poles: `${id}-poles-${entry.dataset}@2x.webp`,
    source: { id: input, path: '../manifest.json', url: entry.url }, falseColor: true, ...(short || field.missing ? { noData: true } : {}),
    legend: { kind: 'scale', title: entry.quantity, labels, recipe: { palette, labels }, meta: entry.units, sourceUrl: entry.url },
    notes: `${entry.quantity} of ${name} in the ${entry.model} simulation of ${entry.credit}: a model, not a measurement. The run assumes ${entry.scenario}.${entry.detected ? '' : ` Nobody has detected ${entry.undetected} on ${name}.`}${entry.others ? ` ${entry.others.text}` : ''}${caps}${gaps} The false color runs from ${minimum.toLocaleString('en-US')} to ${maximum.toLocaleString('en-US')} ${entry.units}; it is not what an eye would see.${lit ? " With shadows on, the star's light darkens the night half." : ''}` };
  const shown = requireRecord(content.datasets, `${id} content datasets`);
  shown.controls = [...others(shown.controls, `${id} dataset controls`, 'id', entry.dataset), control];
  files.set(`${s}/content/object.json`, json(content));
  const text = read(`${o}/text.json`);
  text.datasets = { ...requireRecord(text.datasets ?? {}, `${id} text datasets`), [entry.dataset]: { title: `${entry.model} simulation`, detail: 'Published simulation',
    summary: `${entry.quantity} in a published model, in false color. It shows one scenario, not a measurement.${short ? ' Gray caps lack released samples.' : ''}` } };
  files.set(`${o}/text.json`, json(text));

  const manifest = read(`${s}/manifest.json`);
  manifest.inputs = [...others(manifest.inputs, `${id} manifest inputs`, 'id', input), { id: input, path: entry.path, origin: release.fileUrl,
    productId: entry.file, version: release.doi, title: `${entry.quantity} (${entry.variable}) of ${name} in the ${entry.model} simulation: ${release.title}`, sourceUrl: release.recordUrl,
    credit: `${entry.credit}; ${entry.model} simulation`, displayCredit: `${entry.credit} · ${entry.model}`, license: release.license.name, licenseEvidence: [release.recordUrl, release.license.url],
    acquisition: `Download ${entry.file} unchanged from Zenodo record ${release.doi}; a model output, not an observation.`, redistribution: `${release.license.name} with attribution.`, consumers: [consumer] }];
  files.set(`${s}/manifest.json`, json(manifest));
  const plan = read(`${s}/preparation/acquisition.json`);
  plan.operations = [...others(plan.operations, `${id} acquisition operations`, 'path', entry.path), { kind: 'download', groups: ['restore', 'refresh'], path: entry.path, url: release.fileUrl }];
  files.set(`${s}/preparation/acquisition.json`, json(plan));
  bindInputs(files, id);
  return { minimum, maximum };
}

/** Zenodo's guest search answers 30 requests a minute: one is made every PACE_MS, for NAMES_AT_ONCE names, up to PAGES pages. */
const PACE_MS = 2100, NAMES_AT_ONCE = 40, PAGES = 4;

/** Which of `names` have simulation records on Zenodo, asked once for a whole draft run so no sweep passes one by unseen.
 * `note` gives a host's report the records of its planets. It is a note for a person: a record becomes a dataset only
 * through an entry. A survey that fails says so once, in `failure`, and what it found before failing is kept. */
export async function simulationSurvey(archive: Archive, names: readonly string[], wait = (ms: number) => new Promise<void>(done => { setTimeout(done, ms); })) {
  const found = new Map<string, string[]>(), unique = [...new Set(names.filter(Boolean))];
  let failure: string | undefined, asked = 0;
  try {
    for (let start = 0; start < unique.length; start += NAMES_AT_ONCE) {
      const group = unique.slice(start, start + NAMES_AT_ONCE);
      for (let page = 1; page <= PAGES; page++) {
        if (asked++) await wait(PACE_MS);
        const records = parseZenodoSearch(JSON.parse(await archive.text(`${zenodoQuery(group)}&page=${page}`)));
        for (const record of records.filter(speaksOfSimulation)) for (const name of group) if (namesObject(record, [name])) found.set(name, [...new Set([...found.get(name) ?? [], record.doi])]);
        if (records.length < MAX_RECORDS) break;
      }
    }
  } catch (error) { failure = `Zenodo could not be asked for published simulations of every planet (${(error as Error).message.split('\n')[0]}); ask with telescope simulations OBJECT.`; }
  const note = (planets: readonly string[]): string => {
    const listed = planets.flatMap(planet => found.has(planet) ? [`${planet} ${found.get(planet)!.join(', ')}`] : []);
    return listed.length ? `; published simulations on Zenodo, to read before any is shown: ${listed.join('; ')}` : '';
  };
  return { note, failure, requests: asked };
}
