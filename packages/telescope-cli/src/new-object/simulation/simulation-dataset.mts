/** A published simulation as a dataset beside a body's default dataset: one field of a model run a paper released on Zenodo,
 * read by the `netcdf-lonlat-field` format (packages/bake/src/objects/raster/netcdf/netcdf-lonlat-field.ts) and labelled as
 * the rule on published simulations requires (.agents/skills/celestial-skill/references/scientific-faithfulness.md): its own
 * dataset, named as a model with its paper and the scenario it assumes. The body opens on it only where it had no map.
 *
 *   new-object --simulation entries.json      a list of { id, dataset, label, quantity, record, file, path, variable, coordinates,
 *                                             select, units, displayUnits?, longitudeZeroAt, model, credit, url, scenario, time,
 *                                             detected, undetected?, observed?, others?, range? }
 *
 * The entry holds what only a person can settle by reading the paper: which file and variable, which time and level, where
 * the model put the star overhead, what the run assumes and whether that has been detected. The tool checks the rest against
 * the release and derives the words: the record's license, that it names this object and lists the file; the variable, its
 * units and its grid; the range drawn and the legend. Nothing is guessed, and whatever fails is refused with the object,
 * the file and the field.
 *
 * A model writes files of gigabytes, and one map is a few kilobytes of one. The release is never fetched whole: two range
 * requests bring its first bytes (the header and the coordinate variables) and the bytes of the selected grid, and the
 * package keeps those two parts as exact bytes of the release, each declared with its range in the source manifest.
 *
 * A release that is a ZIP archive holding the model file adds `member`, the file's path inside the archive. NetCDF-4
 * spreads its structure through the file, and a member of any format is taken out of its archive whole, so that file is
 * kept whole, outside git, and restored by the package's own acquisition step. It is one source record however many
 * datasets read it. Such an entry may add `isobar` ({ along, pressure, pressureUnits, at }) to read the field at one
 * pressure, as a paper draws a model whose levels are heights (netcdf-isobar.ts). */
import { open, stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { executeAcquisition, parseAcquisitionPlan } from '@cssearth/bake/objects/acquisition';
import { NetcdfHeaderIncomplete, parseClassicNetcdfHeader, parseIsobar, valueRange, type ByteRange, type Isobar, type NetcdfHeader } from '@cssearth/bake/objects/raster';
import { containedPath, publishPinnedSourceStream } from '@cssearth/bake/objects/sources';
import { assertRangeResponse, rangeRequestHeader } from '@cssearth/objects/node';
import type { Archive } from '../archives/archives.mts';
import { bindInputs, json, openOnMap, type PackageFiles } from '../dataset.mts';
import { MAX_RECORDS, ZENODO_RECORDS, nameForms, namesObject, parseZenodoRecord, parseZenodoSearch, reuseLicense, sizeText, speaksOfSimulation, zenodoQuery, type ReuseLicense } from '../../simulations/simulations.mts';

export interface SimulationEntry {
  /** Dataset id, and the dataset key of its reader text. */
  readonly dataset: string; readonly label: string;
  /** What the field is, as the legend titles it: "Surface temperature". */
  readonly quantity: string;
  /** The release: its Zenodo DOI, the file of it that is read, and where that file would live inside the package's source
   * directory. The two parts kept of it are named after that place (simulationPaths). */
  readonly record: string; readonly file: string; readonly path: string;
  /** What is read from the file: the variable, its coordinate variables, the index along every other dimension and its units. */
  readonly variable: string; readonly coordinates: { readonly longitude: string; readonly latitude: string };
  readonly select: Readonly<Record<string, number>>; readonly units: string;
  /** The units as a reader sees them, when the file's own spelling is not it: "W/m²" for the file's "W m-2". */
  readonly displayUnits?: string;
  /** The grid longitude, in degrees east, of the body's zero meridian: where the model put the star overhead on a synchronous planet. */
  readonly longitudeZeroAt: number;
  /** Who made it: the model's name ("ExoCAM"), the paper ("Wolf et al. (2022)") and its URL. */
  readonly model: string; readonly credit: string; readonly url: string;
  /** What the run assumes, as the rest of a sentence: "one bar of nitrogen with 400 ppm of carbon dioxide over a global ocean". */
  readonly scenario: string;
  /** What the map is in time, as the rest of the sentence "The map is ...": "the mean state the release holds", "one instant, the run's last output". */
  readonly time: string;
  /** Whether what the scenario assumes has been detected on the object, and when it has not, what nobody has detected ("an atmosphere"). */
  readonly detected: boolean; readonly undetected?: string;
  /** What a measurement of the object says about the scenario, as a sentence that names its paper, with the paper's address. */
  readonly observed?: { readonly text: string; readonly url: string };
  /** How far other published models of the same case differ, as a sentence, with the paper that says so. */
  readonly others?: { readonly text: string; readonly url: string };
  /** The legend's limits, when the paper's own color scale is used; the released range rounded outward otherwise. */
  readonly range?: readonly [number, number];
  /** When `file` is a ZIP archive: the path inside it of the NetCDF-4 model file, which is kept whole at `path`. */
  readonly member?: string;
  /** The pressure the field is read at, for a model whose levels are not pressures; only with `member`. */
  readonly isobar?: Isobar;
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
  const known = new Set(['id', 'dataset', 'label', 'quantity', 'record', 'file', 'path', 'variable', 'coordinates', 'select', 'units', 'displayUnits', 'longitudeZeroAt', 'model', 'credit', 'url', 'scenario', 'time', 'detected', 'undetected', 'observed', 'others', 'range', 'member', 'isobar']);
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
  const variable = text('variable');
  // The kept part is named after the variable and the selection, so both are plain names.
  for (const [field, name] of [['variable', variable], ...Object.keys(select).map(dimension => ['select', dimension])] as const)
    if (!/^[A-Za-z0-9_]+$/u.test(name)) throw new TypeError(`${label}.${field} ${name}: a NetCDF name of letters, digits and underscores.`);
  const member = input.member === undefined ? undefined : text('member'), isobar = input.isobar === undefined ? undefined : parseIsobar(input.isobar, `${label}.isobar`);
  if (member !== undefined && !(/\.zip$/u.test(file) && /^[A-Za-z0-9_][A-Za-z0-9._-]*(?:\/[A-Za-z0-9_][A-Za-z0-9._-]*)*$/u.test(member)))
    throw new TypeError(`${label}.member ${member}: the path of the model file inside ${file}, which must then be a ZIP archive.`);
  if (isobar && member === undefined) throw new TypeError(`${label}.isobar reads every level of the model, which the two kept parts of a classic release do not hold; it needs a NetCDF-4 file named by member.`);
  const scenario = text('scenario'), time = text('time');
  if (/[.!?]$/u.test(scenario)) throw new TypeError(`${label}.scenario is the rest of the sentence "The run assumes ..."; leave out its final period.`);
  if (/[.!?]$/u.test(time)) throw new TypeError(`${label}.time is the rest of the sentence "The map is ..."; leave out its final period.`);
  if (typeof input.detected !== 'boolean') throw new TypeError(`${label}.detected must say, true or false, whether what the scenario assumes has been detected on the object.`);
  if (input.detected !== (input.undetected === undefined)) throw new TypeError(input.detected ? `${label}.undetected: nothing is undetected when detected is true.` : `${label}.undetected must name what nobody has detected ("an atmosphere").`);
  const cited = (key: 'others' | 'observed', paper: string) => input[key] === undefined ? undefined : (() => {
    const record = requireRecord(input[key], `${label}.${key}`), sentence = requireString(record.text, `${label}.${key}.text`).trim(), source = requireString(record.url, `${label}.${key}.url`);
    if (!/[.]$/u.test(sentence)) throw new TypeError(`${label}.${key}.text is a whole sentence, ending in a period.`);
    if (!/^https:\/\//u.test(source)) throw new TypeError(`${label}.${key}.url ${source}: the https address of the paper that ${paper}.`);
    return { text: sentence, url: source };
  })();
  const others = cited('others', 'compares the models'), observed = cited('observed', 'reports the measurement');
  const range = input.range === undefined ? undefined : (() => {
    const limits = requireArray(input.range, `${label}.range`).map((limit, index) => requireFiniteNumber(limit, `${label}.range[${index}]`));
    if (limits.length !== 2 || !(limits[0]! < limits[1]!)) throw new TypeError(`${label}.range is [minimum, maximum], the first below the second.`);
    return [limits[0]!, limits[1]!] as const;
  })();
  return { dataset, label: text('label'), quantity: text('quantity'), record, file, path, variable,
    coordinates: { longitude: requireString(coordinates.longitude, `${label}.coordinates.longitude`), latitude: requireString(coordinates.latitude, `${label}.coordinates.latitude`) },
    select: select as Record<string, number>, units: text('units'), ...(input.displayUnits === undefined ? {} : { displayUnits: text('displayUnits') }), longitudeZeroAt: requireFiniteNumber(input.longitudeZeroAt, `${label}.longitudeZeroAt`), model: text('model'), credit: text('credit'), url, scenario, time,
    detected: input.detected, ...(input.undetected === undefined ? {} : { undetected: text('undetected') }), ...(observed ? { observed } : {}), ...(others ? { others } : {}), ...(range ? { range } : {}),
    ...(member === undefined ? {} : { member }), ...(isobar ? { isobar } : {}) };
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

/** Whether a model file is named for the object: its name is in the file's, written with or without its spaces and
 * hyphens, and is not the start of a longer one ("21_ANN4500-4999.aijTrappist1e_04.nc" and "runs/TRAPPIST-1e/ts.nc" for
 * TRAPPIST-1e; a letter after the planet's letter, or a digit after a star's number, makes it another name). A release of
 * many planets' runs names each in its files, and its record may name only the one its paper is about. */
export function fileNamesObject(file: string, names: readonly string[]): boolean {
  return names.map(name => name.toLowerCase().replace(/[^a-z0-9]/gu, '')).filter(name => name.length > 3)
    .some(name => new RegExp(`${[...name].join('[^a-z0-9]?')}(?![${/[a-z]$/u.test(name) ? 'a-z' : '0-9'}])`, 'iu').test(file));
}

/** The release an entry names, as Zenodo states it today. Refused: a record under no license that allows reuse, one that
 * names this object neither in its title or description nor in the model file's own name (a model of a class of objects
 * is not a model of this one), and one that lists no such file. */
export async function simulationRelease(archive: Archive, id: string, names: readonly string[], entry: SimulationEntry): Promise<SimulationRelease> {
  const number = ZENODO_DOI.exec(entry.record)![1]!, record = parseZenodoRecord(JSON.parse(await archive.text(`${ZENODO_RECORDS}/${number}`)), `Zenodo record ${number}`);
  const license = reuseLicense(record.license), where = `${id}, dataset ${entry.dataset}: Zenodo record ${entry.record}`;
  if (!license) throw new Error(`${where} states ${record.license ? `the license ${record.license}` : 'no license'}; a simulation is shown only under a license known to allow reuse (field record).`);
  if (!namesObject(record, names) && !fileNamesObject(entry.member ?? entry.file, names)) throw new Error(`${where} ("${record.title}") does not name ${names[0]} in its title or description, and ${entry.member ?? entry.file} is not named for it; a model of a class of objects is not a model of this one (field record).`);
  const file = record.files.find(candidate => candidate.name === entry.file);
  if (!file) throw new Error(`${where} lists no file ${entry.file} (field file); it lists ${record.files.slice(0, 5).map(candidate => candidate.name).join(', ')}${record.files.length > 5 ? ` and ${record.files.length - 5} more` : ''}.`);
  return { doi: entry.record, recordUrl: record.url, title: record.title, license, fileUrl: file.url, bytes: file.bytes };
}

/** Where the two kept parts of the release live, beside where the entry puts the file: its first bytes, and the selected grid
 * named after the variable and the selection. */
export function simulationPaths(entry: SimulationEntry): { readonly head: string; readonly field: string } {
  const stem = entry.path.replace(/\.nc$/u, '');
  return { head: `${stem}.head.dat`, field: `${stem}.${entry.variable}${Object.entries(entry.select).map(([dimension, index]) => `-${dimension}${index}`).join('')}.dat` };
}

export interface SimulationRanges { readonly head: ByteRange; readonly field: ByteRange }
/** The most kept of a release's first bytes: a history file's header names hundreds of variables, and its coordinates follow. */
const HEAD_LIMIT = 8 * 1024 * 1024;

/** The two byte ranges of the release an entry is drawn from, by the release's own header: from its first byte to the end of
 * the later coordinate variable, and the selected grid. Refused: coordinates stored in records, and a variable whose
 * longitude and latitude are not its last two dimensions, since its grid is then not one run of bytes. */
export function simulationRanges(header: NetcdfHeader, entry: SimulationEntry, where: string): SimulationRanges {
  const variable = header.variables.get(entry.variable);
  if (!variable) throw new TypeError(`${where} has no variable ${entry.variable} (field variable); it has ${[...header.variables.keys()].slice(0, 12).join(', ')}${header.variables.size > 12 ? ` and ${header.variables.size - 12} more` : ''}.`);
  const coordinate = (role: 'longitude' | 'latitude') => {
    const name = entry.coordinates[role], found = header.variables.get(name);
    if (!found || found.dimensions.length !== 1) throw new TypeError(`${where} has no one-dimensional ${role} variable ${name} (field coordinates.${role}).`);
    if (header.layout.get(name)!.record) throw new TypeError(`${where}: the ${role} variable ${name} is stored in records, not among the file's first bytes (field coordinates.${role}).`);
    const range = valueRange(header, name, 0, found.shape[0]!, where);
    return { dimension: found.dimensions[0]!, end: range.offset + range.length };
  };
  const longitude = coordinate('longitude'), latitude = coordinate('latitude'), last = variable.dimensions.length - 1;
  const places = [variable.dimensions.indexOf(longitude.dimension), variable.dimensions.indexOf(latitude.dimension)];
  if (last < 1 || Math.min(...places) !== last - 1 || Math.max(...places) !== last)
    throw new TypeError(`${where}: ${entry.variable} varies along ${variable.dimensions.join(', ')}; its grid is kept as one run of bytes, which needs its longitude and latitude last (field variable).`);
  const grid = variable.shape[last - 1]! * variable.shape[last]!;
  const start = variable.dimensions.slice(0, last - 1).reduce((sum, dimension, place) => {
    const index = entry.select[dimension], length = variable.shape[place]!;
    if (index === undefined) throw new TypeError(`${where}: select gives no index along ${dimension}; ${entry.variable} varies along ${variable.dimensions.join(', ')} (field select).`);
    if (index >= length) throw new RangeError(`${where}: select.${dimension} is ${index}; ${dimension} has ${length} entries, counted from 0 (field select).`);
    return sum * length + index;
  }, 0) * grid;
  const head = { offset: 0, length: Math.max(longitude.end, latitude.end) };
  if (head.length > HEAD_LIMIT) throw new RangeError(`${where}: its header and coordinates take ${head.length} bytes, more than the ${HEAD_LIMIT} kept (field file).`);
  return { head, field: valueRange(header, entry.variable, start, grid, where) };
}

/** The two kept parts in the package's source directory, each brought by one range request and held to its length. The
 * header is asked for first, in growing pieces until it parses, since it says where the parts lie. A part already there at
 * its length is not asked for again. Returns the ranges and the bytes fetched for the parts. */
export async function restoreSimulationField(sourceRoot: string, id: string, entry: SimulationEntry, release: SimulationRelease, fetcher: typeof fetch = fetch): Promise<SimulationRanges & { readonly fetched: number }> {
  const where = `${id}, dataset ${entry.dataset}: ${entry.file}`;
  const ranged = async (range: ByteRange) => {
    const response = await fetcher(release.fileUrl, { redirect: 'follow', headers: { 'user-agent': 'cssEarth-telescope/1.0 (https://css.earth)', range: rangeRequestHeader(range) } });
    if (!response.ok || !response.body) throw new Error(`${where}: Zenodo returned HTTP ${response.status} for bytes ${range.offset} to ${range.offset + range.length - 1} of ${release.fileUrl}.`);
    assertRangeResponse(response, range, release.fileUrl);
    return response;
  };
  let header: NetcdfHeader | undefined;
  for (let length = Math.min(release.bytes, 1 << 18); header === undefined; length = Math.min(release.bytes, length * 4)) {
    try { header = parseClassicNetcdfHeader(Buffer.from(await (await ranged({ offset: 0, length })).arrayBuffer()), where); }
    catch (error) {
      if (!(error instanceof NetcdfHeaderIncomplete)) throw error;
      if (length === release.bytes || length >= HEAD_LIMIT) throw new TypeError(`${where}: its NetCDF header does not end within its first ${length} bytes (field file).`);
    }
  }
  const ranges = simulationRanges(header, entry, where), paths = simulationPaths(entry);
  let fetched = 0;
  for (const [path, range] of [[paths.head, ranges.head], [paths.field, ranges.field]] as const) {
    const target = containedPath(sourceRoot, path);
    const size = await stat(target).then(info => info.size, (error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return undefined; throw error; });
    if (size === range.length) continue;
    if (size !== undefined) throw new Error(`${where}: ${target} has ${size} bytes and the release puts ${range.length} there; remove it to fetch the range again.`);
    const response = await ranged(range);
    await publishPinnedSourceStream({ sourceRoot, entry: { path, origin: release.fileUrl, range }, stream: Readable.fromWeb(response.body as never), declaredBytes: range.length });
    fetched += range.length;
  }
  return { ...ranges, fetched };
}

/** The step that takes a ZIP release's model file whole into the package, as the package's acquisition plan declares it. */
const memberStep = (entry: SimulationEntry, release: SimulationRelease) => ({ kind: 'zip-member', groups: ['restore', 'refresh'], path: entry.path, url: release.fileUrl, member: entry.member });

/** The model file of a ZIP release in the package's source directory, taken by the acquisition step the package will declare
 * for it, read with the plan and manifest already in `files`. A file already there is kept. Returns the bytes fetched. */
export async function restoreSimulationMember(files: PackageFiles, id: string, sourceRoot: string, entry: SimulationEntry, release: SimulationRelease, fetcher: typeof fetch = fetch): Promise<number> {
  const here = await stat(containedPath(sourceRoot, entry.path)).then(info => info.size > 0, (error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return false; throw error; });
  if (here) return 0;
  const read = (path: string) => requireRecord(JSON.parse(String(files.get(`src/objects/${id}/source/${path}`))), path);
  await executeAcquisition({ sourceRoot, group: 'restore', plan: parseAcquisitionPlan({ ...read('preparation/acquisition.json'), operations: [memberStep(entry, release)] }),
    manifest: { schema: requireString(read('manifest.json').schema, 'manifest schema'), inputs: [{ path: entry.path, origin: release.fileUrl }], generatedIntermediates: [], documents: [] },
    // The acquisition's own transport names this project to Zenodo; a test passes its own.
    ...(fetcher === fetch ? {} : { transport: { fetch: (url: string, init?: RequestInit) => fetcher(url, init) } }) });
  return release.bytes;
}

/** Which NetCDF a restored model file is, from its first bytes: a classic file opens with "CDF". Three bytes are read, never the file. */
export async function memberFormat(path: string): Promise<'classic' | 'netcdf-4'> {
  const file = await open(path, 'r');
  try { return (await file.read(Buffer.alloc(3), 0, 3, 0)).buffer.toString('latin1') === 'CDF' ? 'classic' : 'netcdf-4'; } finally { await file.close(); }
}

/** What the field reader is asked for: the entry's statements about the file, its two kept parts or its whole model file, and the tolerance WASP-103 b's table uses. */
export function simulationRecipe(entry: SimulationEntry) {
  const paths = simulationPaths(entry), kept = entry.member === undefined ? { path: paths.head, field: paths.field } : { path: entry.path };
  return { format: 'netcdf-lonlat-field', ...kept, variable: entry.variable, coordinates: entry.coordinates, select: entry.select, ...(entry.isobar ? { isobar: entry.isobar } : {}),
    sourceUnits: entry.units, longitudeZeroAt: entry.longitudeZeroAt, coordinateToleranceDegrees: 0.005 };
}

/** The released range rounded outward to one step of its own size: 204.6 to 295.2 K is drawn from 200 to 300. */
export function roundedRange(minimum: number, maximum: number): readonly [number, number] {
  if (!(maximum > minimum)) throw new RangeError(`A field with one value, ${minimum}, has no range to draw.`);
  const step = 10 ** Math.floor(Math.log10(maximum - minimum)), tidy = (value: number) => Number(value.toPrecision(12));
  return [tidy(Math.floor(minimum / step) * step), tidy(Math.ceil(maximum / step) * step)];
}

export interface FieldReport { readonly minimum: number; readonly maximum: number; readonly latitudeRange: readonly (number | undefined)[]; readonly missing: number }

/** Add the dataset to the package in `files`. It becomes the default where the default was one color or the neutral shape; a
 * default that is a measured map stays. `member` says which NetCDF a ZIP member is. Returns the range drawn and whether the
 * default changed. */
export function installSimulationDataset(files: PackageFiles, id: string, name: string, entry: SimulationEntry, release: SimulationRelease, field: FieldReport, ranges?: SimulationRanges, member: 'netcdf-4' | 'classic' = 'netcdf-4') {
  if ((ranges === undefined) !== (entry.member !== undefined)) throw new TypeError(`${id}, dataset ${entry.dataset}: a classic release is installed with the ranges of its two kept parts, a ZIP member without.`);
  const o = `src/objects/${id}`, s = `${o}/source`, read = (path: string) => requireRecord(JSON.parse(String(files.get(path))), path);
  const others = (list: unknown, where: string, key: string, value: string) => requireArray(list, where).filter(item => requireRecord(item, where)[key] !== value);
  const [minimum, maximum] = entry.range ?? roundedRange(field.minimum, field.maximum), number = (value: number) => String(Number(value.toPrecision(12)));
  const units = entry.displayUnits ?? entry.units, paths = simulationPaths(entry), readFrom = ranges ? paths.head : entry.path;
  if (field.minimum < minimum || field.maximum > maximum)
    throw new RangeError(`${id}, dataset ${entry.dataset}: ${entry.variable} in ${entry.file} runs from ${field.minimum} to ${field.maximum} ${entry.units}, outside the range ${minimum} to ${maximum} the entry gives (field range).`);
  const labels = [minimum, (minimum + maximum) / 2, maximum].map(number);
  // Rows the release does not hold, and cells it marks missing, stay without a value: they are drawn gray and said so.
  const north = field.latitudeRange[1]!, south = field.latitudeRange[0]!, short = north < 90 || south > -90;
  const caps = short ? ` Gray caps: no released grid samples beyond ${number(Math.min(north, -south))}° north or south.` : '', gaps = field.missing ? ' Gray cells have no value in the release.' : '';
  const quantity = `${entry.quantity[0]!.toLowerCase()}${entry.quantity.slice(1)}`, consumer = `${entry.dataset}-simulation`, input = `${id}-${entry.dataset}-simulation`;

  const raster = read(`${s}/preparation/raster.json`), lit = raster.emission === undefined;
  const science = { kind: 'terrestrial-scientific', id: entry.dataset, label: entry.label, ...simulationRecipe(entry), consumer, sampling: 'bilinear', displaySampling: 'nearest',
    outputLongitudeOrigin: 0, units, minimum, maximum, colors: INFERNO, labels,
    description: `Simulated ${quantity} from the ${entry.model} model, a published simulation and not a measurement.${caps}${gaps}`, title: `${entry.label} · ${entry.model} simulation`, sourceUrl: entry.url };
  raster.surfaces = [...others(raster.surfaces, `${id} raster surfaces`, 'id', entry.dataset),
    { id: entry.dataset, output: `${id}-surface-{id}{suffix}.webp`, thumbnail: `${id}-dataset-{id}.webp`, source: readFrom, falseColor: true, science }];
  files.set(`${s}/preparation/raster.json`, json(raster));
  const descriptor = read(`${o}/object.json`), recipe = requireRecord(requireRecord(descriptor.properties, `${id} properties`).recipe, `${id} recipe`);
  const surface = requireRecord(requireArray(recipe.surfaces, `${id} recipe surfaces`)[0], `${id} recipe surface`);
  surface.datasets = [...others(surface.datasets, `${id} recipe datasets`, 'id', entry.dataset), { id: entry.dataset, source: 'content', material: lit ? 'lighting' : 'emission' }];
  files.set(`${o}/object.json`, json(descriptor));

  // One record stands for a file's header, or for a whole model file, however many datasets read it: each is among its
  // consumers, and a whole file is cited under the name of its first reader. What this dataset read before and no longer
  // names is dropped, unless another dataset still reads it; a record others read under this dataset's name cannot be left.
  const manifest = read(`${s}/manifest.json`), every = requireArray(manifest.inputs, `${id} manifest inputs`).map(item => requireRecord(item, `${id} manifest input`));
  const grid = `${input}-grid`, readersOf = (item: Record<string, unknown>) => Array.isArray(item.consumers) ? item.consumers.map(String) : [];
  const file = every.find(item => item.path === (ranges ? paths.head : entry.path)), cited = String(ranges ? input : file?.id ?? input);
  const written = new Set([input, String(ranges ? file?.id ?? grid : cited)]), dropped = new Set<Record<string, unknown>>(), left = new Map<Record<string, unknown>, string[]>();
  for (const item of every) {
    if (item === file || !(item.id === input || item.id === grid || readersOf(item).includes(consumer))) continue;
    const rest = readersOf(item).filter(reader => reader !== consumer);
    if (!rest.length) dropped.add(item);
    else if (written.has(String(item.id))) throw new TypeError(`${id}, dataset ${entry.dataset}: ${String(item.path)} is declared under this dataset's name and ${rest.join(', ')} still read${rest.length === 1 ? 's' : ''} it, so this dataset cannot move to another file; move the others first, or give this one a new dataset id (field file).`);
    else left.set(item, rest);
  }
  const twice = ranges ? every.find(item => item.path === paths.field && item.id !== input) : undefined;
  if (twice) throw new TypeError(`${id}, dataset ${entry.dataset}: ${String(twice.id)} already draws ${paths.field}; one field is one dataset (field variable).`);
  const content = read(`${s}/content/object.json`), palette = INFERNO.map(hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)));
  const control = { id: entry.dataset, label: entry.label, qualification: `Simulation · ${entry.model} · ${entry.credit} · False color`,
    thumbnail: `${id}-dataset-${entry.dataset}.webp`, surface: `${id}-surface-${entry.dataset}@2x.webp`, poles: `${id}-poles-${entry.dataset}@2x.webp`,
    source: { id: cited, path: '../manifest.json', url: entry.url }, falseColor: true, ...(short || field.missing ? { noData: true } : {}),
    legend: { kind: 'scale', title: entry.quantity, labels, recipe: { palette, labels }, meta: units, sourceUrl: entry.url },
    notes: `${entry.quantity} of ${name} in the ${entry.model} simulation of ${entry.credit}: a model, not a measurement. The run assumes ${entry.scenario}. The map is ${entry.time}.${entry.detected ? '' : ` Nobody has detected ${entry.undetected} on ${name}.`}${entry.observed ? ` ${entry.observed.text}` : ''}${entry.others ? ` ${entry.others.text}` : ''}${caps}${gaps} The false color runs from ${minimum.toLocaleString('en-US')} to ${maximum.toLocaleString('en-US')} ${units}; it is not what an eye would see.${lit ? " With shadows on, the star's light darkens the night half." : ''}` };
  const shown = requireRecord(content.datasets, `${id} content datasets`);
  shown.controls = [...others(shown.controls, `${id} dataset controls`, 'id', entry.dataset), control];
  files.set(`${s}/content/object.json`, json(content));
  const text = read(`${o}/text.json`);
  text.datasets = { ...requireRecord(text.datasets ?? {}, `${id} text datasets`), [entry.dataset]: { title: `${entry.model} simulation`, detail: 'Published simulation',
    // Two sentences, the summary's budget, with or without the caps.
    summary: `${entry.quantity} in a published model, in false color. ${short ? 'One scenario, not a measurement; gray caps lack samples.' : 'It shows one scenario, not a measurement.'}` } };
  files.set(`${o}/text.json`, json(text));

  // The two kept parts are exact bytes of the release, each one declared with its range and restored by one range request.
  const selection = Object.entries(entry.select).map(([dimension, index]) => ` at ${dimension} index ${index}`).join('');
  const shared = { origin: release.fileUrl, productId: entry.file, version: release.doi, sourceUrl: release.recordUrl, credit: `${entry.credit}; ${entry.model} simulation`, displayCredit: `${entry.credit} · ${entry.model}`,
    license: release.license.name, licenseEvidence: [release.recordUrl, release.license.url] };
  const kept = { redistribution: `Exact bytes of the release; ${release.license.name} with attribution.`, consumers: [consumer] };
  const title = `${entry.quantity} (${entry.variable}) of ${name} in the ${entry.model} simulation: ${release.title}`;
  const declared = every.filter(item => item !== file && !dropped.has(item)).map(item => left.has(item) ? { ...item, consumers: left.get(item) } : item);
  const readers = [...new Set([...(file ? readersOf(file) : []), consumer])];
  manifest.inputs = [...declared,
    ...(ranges ? [{ id: input, path: paths.field, range: ranges.field, ...shared, title,
      acquisition: `One range request to Zenodo record ${release.doi}: the bytes of ${entry.variable}${selection} in ${entry.file}, where the file's header puts them. The ${sizeText(release.bytes)} file is never fetched whole. A model output, not an observation.`, ...kept },
    { id: file?.id ?? grid, path: paths.head, range: ranges.head, ...shared, title: `Header and coordinate variables of ${entry.file}, the ${entry.model} simulation of ${name}`,
      acquisition: `One range request to Zenodo record ${release.doi}: the first ${ranges.head.length.toLocaleString('en-US')} bytes of ${entry.file}, its header and its coordinate variables.`, ...kept, consumers: readers }]
    // A model file out of a ZIP release: one input, the whole member, which git does not hold. Read by several datasets, it is titled as the file.
    : [{ id: cited, path: entry.path, ...shared, productId: entry.member, title: readers.length > 1 ? `${entry.model} simulation of ${name}, ${entry.member}: ${release.title}` : title,
      acquisition: `Restored through source/preparation/acquisition.json from Zenodo record ${release.doi}: the member ${entry.member} of ${entry.file} (${sizeText(release.bytes)}), unchanged and whole, because ${member === 'classic' ? 'a member is taken out of a ZIP archive whole' : 'a NetCDF-4 file spreads its structure through itself'}. A model output, not an observation.`,
      redistribution: `Not redistributed in git; restored from Zenodo. ${release.license.name} with attribution.`, consumers: readers }])];
  files.set(`${s}/manifest.json`, json(manifest));
  const plan = read(`${s}/preparation/acquisition.json`), targets = ranges ? [paths.field, paths.head] : [entry.path], gone = new Set([...targets, ...[...dropped].map(item => String(item.path))]);
  plan.operations = [...requireArray(plan.operations, `${id} acquisition operations`).filter(item => !gone.has(String(requireRecord(item, `${id} acquisition operation`).path))),
    ...(ranges ? targets.map(target => ({ kind: 'download', groups: ['restore', 'refresh'], path: target, url: release.fileUrl })) : [memberStep(entry, release)])];
  files.set(`${s}/preparation/acquisition.json`, json(plan));
  bindInputs(files, id);
  // A body opens on the best dataset it has: the simulation takes the default from one color or the neutral shape, never from
  // a measured map (dataset.mts openOnMap).
  return { minimum, maximum, promoted: openOnMap(files, id, entry.dataset) };
}

/** Zenodo's guest search answers 30 requests a minute: one is made every PACE_MS, up to PAGES pages for a question.
 * It refuses a long question with HTTP 500, so the survey of 40 names at once had stopped working. A question is sized by
 * the spellings it asks for (`nameForms`: two for "TOI-1266 c", four for "HD 189733 b", eight for "HD 135344 Ab"), since
 * that is what its length follows. Measured 2026-10-05 on 110 questions: every one of up to 33 spellings was answered,
 * those of 40 were answered or refused, and every one of 44 or more was refused. */
const PACE_MS = 2100, SPELLINGS_AT_ONCE = 32, PAGES = 4;

/** `names` in questions Zenodo answers: in order, each as full as SPELLINGS_AT_ONCE allows; a name with more goes alone. */
export function surveyQuestions(names: readonly string[]): string[][] {
  const questions: string[][] = [];
  for (const name of names) {
    const open = questions.at(-1);
    if (open && nameForms([...open, name]).length <= SPELLINGS_AT_ONCE) open.push(name); else questions.push([name]);
  }
  return questions;
}

/** Which of `names` have simulation records on Zenodo, asked once for a whole draft run so no sweep passes one by unseen.
 * `note` gives a host's report the records of its planets. It is a note for a person: a record becomes a dataset only
 * through an entry. A survey that fails says so once, in `failure`, and what it found before failing is kept. */
export async function simulationSurvey(archive: Archive, names: readonly string[], wait = (ms: number) => new Promise<void>(done => { setTimeout(done, ms); })) {
  const found = new Map<string, string[]>(), unique = [...new Set(names.filter(Boolean))];
  let failure: string | undefined, asked = 0;
  try {
    for (const group of surveyQuestions(unique)) {
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
