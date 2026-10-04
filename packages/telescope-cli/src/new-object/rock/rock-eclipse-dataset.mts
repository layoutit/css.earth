/** A bare-rock model dataset from a paper's measured eclipse depth: for a rocky planet whose paper finds its day side as bright
 * as a rock with no atmosphere, the `bare-rock-eclipse` format (packages/bake/src/objects/raster/eclipse-map/bare-rock.ts)
 * draws the rock that shows that depth, T(z) = T_ss cos(z)^(1/4) on the day side and nothing at night. It is a model set by one
 * measured number, and every text it writes says so. TRAPPIST-1 c's hand-made dataset is the worked example.
 *
 *   new-object --rock-eclipse entries.json      a list of { id, dataset, label, path, url, credit, observed, depth: { low, high,
 *                                               cell, where }, filter | throughput, band, star: { teffK, logg, fid }, verdict }
 *
 * The entry holds what a person settles by reading the paper: the depth and its one-sigma range, which instrument band it
 * was measured in, and the paper's own verdict. The route is only for a planet whose paper finds a bare rock: a deeper or a
 * shallower eclipse than a rock gives is a measurement this model would contradict. The tool brings the band's filter curve
 * from the Spanish Virtual Observatory, or for a spectrograph's summed light the throughput table a paper released on Zenodo
 * cut to the wavelengths the paper summed, and the star's model spectrum from the Spanish Virtual Observatory, checks that the spectrum is the grid point nearest
 * the star's cited temperature and gravity, and derives the range drawn and the words. */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { containedPath } from '@cssearth/bake/objects/sources';
import { ECLIPSE_DEPTH_SCHEMA } from '@cssearth/objects';
import type { Archive } from '../archives/archives.mts';
import { bindInputs, json, openOnMap, type PackageFiles } from '../dataset.mts';
import { DATASET_REBUILD_FILES, writeWithMarker } from '../planet-datasets.mts';
import { zipMember } from '../map/zip-member.mts';
import { ZENODO_RECORDS, parseZenodoRecord, reuseLicense, type ReuseLicense } from '../../simulations/simulations.mts';

/** A spectrograph's throughput table from a paper's Zenodo release, for an eclipse depth summed over the instrument's
 * wavelengths: the record's DOI, its file and the member when that file is a ZIP, where the table lives in the package's
 * source directory, the wavelengths the paper summed, the instrument as a reader names it and the release's paper. */
export interface RockThroughput { readonly record: string; readonly file: string; readonly member?: string; readonly path: string;
  readonly minimumMicrons: number; readonly maximumMicrons: number; readonly instrument: string; readonly credit: string }
export interface ThroughputRelease { readonly doi: string; readonly recordUrl: string; readonly title: string; readonly license: ReuseLicense; readonly fileUrl: string }
const ZENODO_DOI = /^10\.5281\/zenodo\.(\d+)$/u;

export interface RockEclipseEntry {
  /** Dataset id, and the dataset key of its reader text. */
  readonly dataset: string; readonly label: string;
  /** The depth record's path inside the package's source directory, the paper's address, who measured it and what they observed. */
  readonly path: string; readonly url: string; readonly credit: string; readonly observed: string;
  /** The eclipse depth's one-sigma range in ppm, the cell as printed and where it is printed. */
  readonly depth: { readonly low: number; readonly high: number; readonly cell: string; readonly where: string };
  /** The band: its SVO Filter Profile Service id ("JWST/MIRI.F1500W"), or a released throughput table when the depth was summed
   * over a spectrograph's wavelengths, and its wavelength as a reader says it ("15 µm"). */
  readonly filter?: string; readonly throughput?: RockThroughput; readonly band: string;
  /** The star's model spectrum: the BT-Settl CIFIST grid point and its file id in the SVO's theoretical spectra service. */
  readonly star: { readonly teffK: number; readonly logg: number; readonly fid: number };
  /** The paper's verdict, as the rest of the sentence "The paper finds the day side ...": "consistent with a bare rock". */
  readonly verdict: string;
  /** The radius ratio the paper fitted with the depth, when it prints one: the two belong to one fit. */
  readonly radiusRatio?: { readonly value: number; readonly cell: string; readonly where: string };
  /** The dayside brightness temperature the paper prints, with its one-sigma errors: the check, never an input. A model whose
   * uniform day side is more than two sigma from it is refused. */
  readonly dayside?: { readonly kelvin: number; readonly minus: number; readonly plus: number; readonly where: string };
}

const SVO = 'https://svo2.cab.inta-csic.es/theory';
/** The palette TRAPPIST-1 c's rock model draws (plasma). */
const PLASMA = ['#0d0887', '#7e03a8', '#cc4778', '#f89540', '#f0f921'];
/** The grid's half steps: a model within these of the star's cited values is the nearest grid point. */
const HALF_STEP_K = 50, HALF_STEP_LOGG = 0.25;

export function rockEclipseEntry(value: unknown, label: string): RockEclipseEntry {
  const input = requireRecord(value, label), text = (key: string) => {
    const words = requireString(input[key], `${label}.${key}`).trim();
    if (!words) throw new TypeError(`${label}.${key} is empty.`);
    return words;
  };
  const known = new Set(['id', 'dataset', 'label', 'path', 'url', 'credit', 'observed', 'depth', 'filter', 'throughput', 'band', 'star', 'verdict', 'radiusRatio', 'dayside']), unknown = Object.keys(input).filter(key => !known.has(key));
  if (unknown.length) throw new TypeError(`${label}: unknown fields ${unknown.join(', ')}.`);
  const dataset = text('dataset'), path = text('path'), url = text('url'), filter = input.filter === undefined ? undefined : text('filter'), verdict = text('verdict');
  if ((filter === undefined) === (input.throughput === undefined)) throw new TypeError(`${label} names the band once: an SVO filter id (field filter) or a released throughput table (field throughput).`);
  if (!/^[a-z][a-z0-9-]*$/u.test(dataset)) throw new TypeError(`${label}.dataset ${dataset}: a dataset id is lowercase letters, digits and hyphens.`);
  if (!/^science\/[a-z0-9-]+\/[a-z0-9.-]+\.json$/u.test(path)) throw new TypeError(`${label}.path ${path}: a record lives at science/<paper>/<name>.json.`);
  if (!/^https:\/\//u.test(url)) throw new TypeError(`${label}.url ${url}: the paper's https address.`);
  if (filter !== undefined && !/^[A-Za-z0-9_]+\/[A-Za-z0-9_.]+$/u.test(filter)) throw new TypeError(`${label}.filter ${filter}: an SVO filter id, FACILITY/INSTRUMENT.BAND.`);
  if (!/bare rock|airless|no (?:significant )?atmosphere/iu.test(verdict)) throw new TypeError(`${label}.verdict must be the paper's finding of a bare rock or of no atmosphere; a rock model contradicts any other measurement.`);
  if (/[.!?]$/u.test(verdict)) throw new TypeError(`${label}.verdict is the rest of the sentence "The paper finds the day side ..."; leave out its final period.`);
  const depth = requireRecord(input.depth, `${label}.depth`), low = requireFiniteNumber(depth.low, `${label}.depth.low`), high = requireFiniteNumber(depth.high, `${label}.depth.high`);
  if (!(low > 0 && high > low)) throw new RangeError(`${label}.depth is the one-sigma range in ppm, 0 < low < high.`);
  const star = requireRecord(input.star, `${label}.star`), teffK = requireFiniteNumber(star.teffK, `${label}.star.teffK`), logg = requireFiniteNumber(star.logg, `${label}.star.logg`), fid = requireFiniteNumber(star.fid, `${label}.star.fid`);
  if (teffK % 100 || (logg * 2) % 1 || !Number.isSafeInteger(fid) || fid <= 0) throw new TypeError(`${label}.star is a BT-Settl CIFIST grid point (teffK in hundreds, logg in halves) and its SVO file id.`);
  let throughput: RockThroughput | undefined;
  if (input.throughput !== undefined) {
    const table = requireRecord(input.throughput, `${label}.throughput`), words = (key: string) => requireString(table[key], `${label}.throughput.${key}`).trim();
    const member = table.member === undefined ? undefined : words('member');
    throughput = { record: words('record'), file: words('file'), ...(member ? { member } : {}), path: words('path'), minimumMicrons: requireFiniteNumber(table.minimumMicrons, `${label}.throughput.minimumMicrons`),
      maximumMicrons: requireFiniteNumber(table.maximumMicrons, `${label}.throughput.maximumMicrons`), instrument: words('instrument'), credit: words('credit') };
    if (!ZENODO_DOI.test(throughput.record)) throw new TypeError(`${label}.throughput.record ${throughput.record}: a Zenodo DOI, 10.5281/zenodo.<number>.`);
    if ((member !== undefined) !== throughput.file.endsWith('.zip')) throw new TypeError(`${label}.throughput.member names the table inside a .zip file, and only there.`);
    if (!/^science\/[a-z0-9-]+\/[A-Za-z0-9._-]+$/u.test(throughput.path)) throw new TypeError(`${label}.throughput.path ${throughput.path}: the table lives at science/<paper>/<name>.`);
    if (!(throughput.minimumMicrons > 0 && throughput.maximumMicrons > throughput.minimumMicrons)) throw new RangeError(`${label}.throughput sums from minimumMicrons to a larger maximumMicrons.`);
  }
  let radiusRatio: RockEclipseEntry['radiusRatio'], dayside: RockEclipseEntry['dayside'];
  if (input.radiusRatio !== undefined) {
    const ratio = requireRecord(input.radiusRatio, `${label}.radiusRatio`);
    radiusRatio = { value: requireFiniteNumber(ratio.value, `${label}.radiusRatio.value`), cell: requireString(ratio.cell, `${label}.radiusRatio.cell`), where: requireString(ratio.where, `${label}.radiusRatio.where`) };
    if (!(radiusRatio.value > 0 && radiusRatio.value < 1)) throw new RangeError(`${label}.radiusRatio.value is the planet's radius in stellar radii, between 0 and 1.`);
  }
  if (input.dayside !== undefined) {
    const day = requireRecord(input.dayside, `${label}.dayside`), value = (key: string) => requireFiniteNumber(day[key], `${label}.dayside.${key}`);
    dayside = { kelvin: value('kelvin'), minus: value('minus'), plus: value('plus'), where: requireString(day.where, `${label}.dayside.where`) };
    if (!(dayside.kelvin > 0 && dayside.minus > 0 && dayside.plus > 0)) throw new RangeError(`${label}.dayside is the printed temperature in K with its positive one-sigma errors.`);
  }
  return { dataset, label: text('label'), path, url, credit: text('credit'), observed: text('observed'), depth: { low, high, cell: requireString(depth.cell, `${label}.depth.cell`), where: requireString(depth.where, `${label}.depth.where`) },
    ...(filter ? { filter } : {}), ...(throughput ? { throughput } : {}), band: text('band'), star: { teffK, logg, fid }, verdict, ...(radiusRatio ? { radiusRatio } : {}), ...(dayside ? { dayside } : {}) };
}

/** `--rock-eclipse entries.json`: the entries for planets already in the tree, by planet id. */
export function parseRockEclipseEntries(value: unknown): Map<string, RockEclipseEntry[]> {
  const out = new Map<string, RockEclipseEntry[]>();
  requireArray(value, 'rock-eclipse entries').forEach((entry, i) => {
    const id = requireString(requireRecord(entry, `entry ${i}`).id, `entry ${i}.id`);
    out.set(id, [...out.get(id) ?? [], rockEclipseEntry(entry, `${id}.rockEclipses[${out.get(id)?.length ?? 0}]`)]);
  });
  return out;
}

/** Where the band's curve and the model spectrum live in the package's source directory, and where they are served: the SVO,
 * or for a throughput table the file of its Zenodo release. */
export function rockInputs(entry: RockEclipseEntry): { readonly filter: { readonly path: string; readonly url: string; readonly member?: string }; readonly star: { readonly path: string; readonly url: string } } {
  const { teffK, logg, fid } = entry.star, table = entry.throughput;
  return { filter: table ? { path: table.path, url: `https://zenodo.org/records/${ZENODO_DOI.exec(table.record)![1]}/files/${encodeURIComponent(table.file)}?download=1`, ...(table.member ? { member: table.member } : {}) }
      : { path: `science/svo/${entry.filter!.replace('/', '_')}.xml`, url: `${SVO}/fps/fps.php?ID=${entry.filter}` },
    star: { path: `science/bt-settl-cifist/bt-settl-cifist-${teffK}-${logg.toFixed(1)}-0.0.xml`, url: `${SVO}/newov2/ssap.php?model=bt-settl-cifist&fid=${fid}` } };
}

/** What the bake's recipe is asked for: the depth record, the band and the star's spectrum, for this planet and its host. */
export function rockRecipe(id: string, host: string, entry: RockEclipseEntry) {
  const inputs = rockInputs(entry);
  return { format: 'bare-rock-eclipse', path: entry.path, sampling: 'bilinear', units: 'K', planet: id, host,
    band: entry.throughput ? { encoding: 'throughput-columns', path: inputs.filter.path, minimumMicrons: entry.throughput.minimumMicrons, maximumMicrons: entry.throughput.maximumMicrons } : { encoding: 'svo-filter', path: inputs.filter.path }, star: { encoding: 'svo-model-spectrum', path: inputs.star.path } };
}

/** The star's cited temperature and gravity, from its package's measurements. */
export async function hostAtmosphere(root: string, host: string): Promise<{ readonly teffK: number; readonly logg: number }> {
  const path = resolve(root, 'src/objects', host, 'source/measurements.json'), measured = requireRecord(JSON.parse(await readFile(path, 'utf8')), path);
  return { teffK: requireFiniteNumber(measured.effectiveTemperatureK, `${host} effectiveTemperatureK`), logg: requireFiniteNumber(measured.surfaceGravityLogg, `${host} surfaceGravityLogg`) };
}

/** The band's curve and the model spectrum in the source directory, fetched when absent: from the SVO, or the throughput table
 * from its Zenodo release. Refused: a model spectrum that is not the grid point nearest the star's cited values, a file that
 * states another grid point than the entry names, and a table that does not span the wavelengths summed. Returns the bytes fetched. */
export async function restoreRockInputs(sourceRoot: string, id: string, host: { readonly id: string; readonly teffK: number; readonly logg: number }, entry: RockEclipseEntry, archive: Archive): Promise<number> {
  const where = `${id}, dataset ${entry.dataset}`, { teffK, logg } = entry.star;
  if (Math.abs(teffK - host.teffK) > HALF_STEP_K || Math.abs(logg - host.logg) > HALF_STEP_LOGG)
    throw new RangeError(`${where}: the model spectrum at ${teffK} K, log g ${logg} is not the grid point nearest ${host.id}'s cited ${host.teffK} K, log g ${host.logg} (field star).`);
  const inputs = rockInputs(entry);
  let total = 0;
  for (const [kind, input] of Object.entries(inputs)) {
    const target = containedPath(sourceRoot, input.path);
    if (await stat(target).then(info => info.size > 0, (error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return false; throw error; })) continue;
    const fetched = await archive.bytes(input.url), member = 'member' in input ? input.member : undefined;
    const bytes = member === undefined ? fetched : await zipMember(fetched, member), head = bytes.subarray(0, 65536).toString('utf8');
    if (kind === 'star') {
      const stated = (name: string) => Number(new RegExp(`<PARAM name="${name}"[^>]*value="([^"]*)"`, 'u').exec(head)?.[1] ?? NaN);
      if (stated('teff') !== teffK || stated('logg') !== logg || stated('meta') !== 0)
        throw new TypeError(`${where}: SVO file ${entry.star.fid} states Teff ${stated('teff')} K, log g ${stated('logg')}, [M/H] ${stated('meta')}, not the ${teffK} K, log g ${logg}, [M/H] 0 the entry names (field star.fid).`);
    } else if (entry.throughput) {
      // Two columns, wavelength in microns and throughput, that reach both ends of the wavelengths the paper summed.
      const rows = bytes.toString('utf8').split(/\r?\n/u).filter(line => line.trim() && !line.startsWith('#')).map(line => line.trim().split(/\s+/u).map(Number));
      const { minimumMicrons, maximumMicrons } = entry.throughput, step = rows.length > 1 ? rows[1]![0]! - rows[0]![0]! : NaN;
      if (rows.length < 2 || rows.some(row => row.length !== 2 || !row.every(Number.isFinite)) || !(rows[0]![0]! <= minimumMicrons + step && rows.at(-1)![0]! >= maximumMicrons - step))
        throw new TypeError(`${where}: ${member ?? entry.throughput.file} is not a two-column throughput table that spans ${minimumMicrons} to ${maximumMicrons} µm (field throughput).`);
    } else if (!head.includes(entry.filter!)) throw new TypeError(`${where}: the SVO's answer for ${entry.filter} does not name that filter (field filter).`);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
    total += fetched.length;
  }
  return total;
}

/** The release a throughput table comes from, as Zenodo states it today. Refused: a record under no license that allows
 * reuse, and one that lists no such file. */
export async function throughputRelease(archive: Archive, where: string, table: RockThroughput): Promise<ThroughputRelease> {
  const number = ZENODO_DOI.exec(table.record)![1]!, record = parseZenodoRecord(JSON.parse(await archive.text(`${ZENODO_RECORDS}/${number}`)), `Zenodo record ${number}`), license = reuseLicense(record.license);
  if (!license) throw new Error(`${where}: Zenodo record ${table.record} states ${record.license ? `the license ${record.license}` : 'no license'}; a throughput table is used only under a license known to allow reuse (field throughput.record).`);
  const file = record.files.find(candidate => candidate.name === table.file);
  if (!file) throw new Error(`${where}: Zenodo record ${table.record} lists no file ${table.file} (field throughput.file).`);
  return { doi: table.record, recordUrl: record.url, title: record.title, license, fileUrl: file.url };
}

/** The transcribed record the bake reads: the depth's range, the radius ratio fitted with it when the paper prints one, and where both are printed. */
export const depthRecord = (id: string, entry: RockEclipseEntry) => ({ schema: ECLIPSE_DEPTH_SCHEMA, planet: id, eclipseDepthPpm: { low: entry.depth.low, high: entry.depth.high },
  ...(entry.radiusRatio ? { radiusRatio: entry.radiusRatio.value } : {}),
  source: `${entry.credit}: ${entry.observed}. Eclipse depth ${entry.depth.cell} (${entry.depth.where}); the range is its one-sigma interval.${entry.radiusRatio ? ` Radius ratio ${entry.radiusRatio.cell} (${entry.radiusRatio.where}), fitted with the depth.` : ''} The paper finds the day side ${entry.verdict}. ${entry.url}` });

/** Refuse a model whose uniform day side is more than two sigma from the dayside temperature the paper prints. */
export function checkDayside(where: string, entry: RockEclipseEntry, uniformDaysideK: number): string {
  if (!entry.dayside) return '';
  const { kelvin, minus, plus } = entry.dayside, sigma = (uniformDaysideK - kelvin) / (uniformDaysideK < kelvin ? minus : plus);
  if (!(Math.abs(sigma) <= 2)) throw new RangeError(`${where}: the uniform day side that shows the depth is ${Math.round(uniformDaysideK)} K, ${Math.abs(sigma).toFixed(1)} sigma from the ${kelvin} K the paper prints (${entry.dayside.where}); the depth, band, star or radius ratio is not read as the paper read it (fields depth, filter or throughput, star, radiusRatio).`);
  return `, uniform day side ${Math.round(uniformDaysideK)} K (paper ${kelvin} +${plus}/-${minus}, ${sigma >= 0 ? '+' : '-'}${Math.abs(sigma).toFixed(1)} sigma)`;
}

export interface RockReport { readonly substellarK: number; readonly substellarRangeK: readonly [number, number] }

/** Add the dataset to the package in `files`. It becomes the default where the default was one color or the neutral shape.
 * Returns the range drawn and whether the default changed. */
export function installRockEclipseDataset(files: PackageFiles, id: string, name: string, host: string, entry: RockEclipseEntry, report: RockReport, release?: ThroughputRelease) {
  if ((entry.throughput === undefined) !== (release === undefined)) throw new TypeError(`${id}, dataset ${entry.dataset}: a throughput table is installed with its checked release, and only then.`);
  const o = `src/objects/${id}`, s = `${o}/source`, read = (path: string) => requireRecord(JSON.parse(String(files.get(path))), path);
  const without = (list: unknown, where: string, key: string, values: readonly string[]) => requireArray(list, where).filter(item => !values.includes(String(requireRecord(item, where)[key])));
  const [lowK, highK] = report.substellarRangeK.map(Math.round) as [number, number], underStar = Math.round(report.substellarK), inputs = rockInputs(entry), { low, high } = entry.depth;
  // The night side is dark in the model: the scale starts at 50 K, as TRAPPIST-1 c's does, and ends above the hottest rock.
  const minimum = 50, maximum = Math.ceil(report.substellarRangeK[1] / 100) * 100, labels = [`≤ ${minimum}`, String((minimum + maximum) / 2), String(maximum)];
  const consumer = `${id}-bare-rock-model`, input = `${id}-${entry.dataset}-eclipse-depth`, table = entry.throughput,
    filterId = `${id}-${(table ? table.instrument : entry.filter!).toLowerCase().replace(/[^a-z0-9]+/gu, '-')}-${table ? 'throughput' : 'filter'}`, starId = `${id}-bt-settl-cifist-${entry.star.teffK}`;
  files.set(`${s}/${entry.path}`, json(depthRecord(id, entry)));

  const raster = read(`${s}/preparation/raster.json`), lit = raster.emission === undefined;
  const science = { kind: 'terrestrial-scientific', id: entry.dataset, label: entry.label, ...rockRecipe(id, host, entry), consumer, displaySampling: 'bilinear', outputLongitudeOrigin: 0, minimum, maximum, colors: PLASMA, labels,
    description: `A model, not a map: the temperature of a bare rock with no atmosphere to carry heat, set by the ${entry.band} eclipse depth ${entry.credit} measured: about ${underStar.toLocaleString('en-US')} K under the star, nothing at night. Only the dayside brightness is measured.`,
    title: `Bare-rock model · from ${entry.credit}'s eclipse depth`, sourceUrl: entry.url };
  raster.surfaces = [...without(raster.surfaces, `${id} raster surfaces`, 'id', [entry.dataset]), { id: entry.dataset, output: `${id}-surface-{id}{suffix}.webp`, thumbnail: `${id}-dataset-{id}.webp`, source: entry.path, falseColor: true, science }];
  files.set(`${s}/preparation/raster.json`, json(raster));
  const descriptor = read(`${o}/object.json`), recipe = requireRecord(requireRecord(descriptor.properties, `${id} properties`).recipe, `${id} recipe`);
  const surface = requireRecord(requireArray(recipe.surfaces, `${id} recipe surfaces`)[0], `${id} recipe surface`);
  surface.datasets = [...without(surface.datasets, `${id} recipe datasets`, 'id', [entry.dataset]), { id: entry.dataset, source: 'content', material: lit ? 'lighting' : 'emission' }];
  files.set(`${o}/object.json`, json(descriptor));

  const content = read(`${s}/content/object.json`), palette = PLASMA.map(hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)));
  const control = { id: entry.dataset, label: entry.label, qualification: `A model set by one measurement: the ${entry.band} eclipse depth of ${entry.credit}, ${entry.observed}`,
    thumbnail: `${id}-dataset-${entry.dataset}.webp`, surface: `${id}-surface-${entry.dataset}@2x.webp`, poles: `${id}-poles-${entry.dataset}@2x.webp`, source: { id: input, path: '../manifest.json', url: entry.url }, falseColor: true,
    legend: { kind: 'scale', title: 'Brightness temperature', labels, recipe: { palette, labels }, meta: 'K', sourceUrl: entry.url },
    notes: `A model, not a map. Only ${name}'s dayside brightness is measured: an eclipse depth of ${low} to ${high} ppm at ${entry.band} (${entry.credit}), which the paper finds ${entry.verdict}. A bare rock with that depth is ${lowK.toLocaleString('en-US')} to ${highK.toLocaleString('en-US')} K under the star and dark at night; whether the night side is dark is not measured.${lit ? " With shadows on, the star's light darkens the night half." : ''}` };
  const shown = requireRecord(content.datasets, `${id} content datasets`);
  shown.controls = [...without(shown.controls, `${id} dataset controls`, 'id', [entry.dataset]), control];
  files.set(`${s}/content/object.json`, json(content));
  const text = read(`${o}/text.json`);
  text.datasets = { ...requireRecord(text.datasets ?? {}, `${id} text datasets`), [entry.dataset]: { title: 'Bare rock from its eclipse depth', detail: 'A model from one measurement',
    summary: `A model, not a map: a bare rock as bright at ${entry.band} as the measured day side. About ${(Math.round(underStar / 10) * 10).toLocaleString('en-US')} K under the star, dark at night.` } };
  files.set(`${o}/text.json`, json(text));

  // The filter curve and the model spectrum serve many planets: each package pins its own copy and binds it locally, as
  // TRAPPIST-1 c's does, so no two packages claim one catalogue record.
  const manifest = read(`${s}/manifest.json`), svoUse = `${SVO}/fps/index.php?mode=use`, models = `${SVO}/newov2/index.php?models=bt-settl-cifist`;
  const pinned = (what: string) => ({ sourceBinding: { kind: 'local', reason: what === 'throughput table' ? 'A throughput table many planets share; each package pins its own copy.' : `Pinned SVO ${what}; the service has no catalogue record in this repository yet.` } });
  manifest.inputs = [...without(manifest.inputs, `${id} manifest inputs`, 'id', [input, filterId, starId]),
    { id: input, path: entry.path, origin: entry.url, credit: `${entry.credit}; ${entry.observed}`, license: 'Factual numerical measurement; source attribution retained',
      acquisition: 'Transcribed from the paper: the eclipse depth and its one-sigma range, with the cell and its location', redistribution: 'A two-number measurement record', consumers: [consumer] },
    table && release ? { id: filterId, path: inputs.filter.path, origin: release.fileUrl, productId: table.member ?? table.file, version: release.doi, title: `${table.instrument} throughput, from the release of ${table.credit}`,
      sourceUrl: release.recordUrl, credit: `${table.credit}: ${release.title}`, displayCredit: `${table.credit} · ${table.instrument} throughput`, license: release.license.name, licenseEvidence: [release.recordUrl, release.license.url],
      acquisition: `Restored through source/preparation/acquisition.json from Zenodo record ${release.doi}${table.member ? `, the member ${table.member} of ${table.file}` : ''}, unchanged. The model sums it from ${table.minimumMicrons} to ${table.maximumMicrons} µm, the wavelengths ${entry.credit} summed.`,
      redistribution: `Not redistributed in git; restored from Zenodo. ${release.license.name} with attribution.`, consumers: [consumer], ...pinned('throughput table') }
    : { id: filterId, path: inputs.filter.path, origin: inputs.filter.url, productId: entry.filter, version: 'SVO Filter Profile Service', title: `${entry.filter} filter response`,
      sourceUrl: `${SVO}/fps/index.php?id=${entry.filter}`, credit: 'Spanish Virtual Observatory Filter Profile Service (Rodrigo & Solano 2020)', displayCredit: 'SVO Filter Profile Service',
      license: 'Filter profiles served openly by the SVO for research use with citation', licenseEvidence: [svoUse],
      acquisition: `Restored through source/preparation/acquisition.json from the SVO Filter Profile Service VOTable for ${entry.filter}, unchanged.`, redistribution: 'Not redistributed in git; restored from the SVO.', consumers: [consumer], ...pinned('filter profile') },
    { id: starId, path: inputs.star.path, origin: inputs.star.url, productId: `bt-settl-cifist fid ${entry.star.fid}`, version: 'BT-Settl (CIFIST2011) through the SVO Theoretical Spectra service',
      title: `BT-Settl CIFIST model spectrum, Teff ${entry.star.teffK} K, log g ${entry.star.logg.toFixed(1)}, [M/H] 0`, sourceUrl: models,
      credit: 'F. Allard, D. Homeier, B. Freytag (2012), BT-Settl CIFIST2011; Spanish Virtual Observatory Theoretical Spectra service', displayCredit: 'BT-Settl · SVO',
      license: 'Model spectra served openly by the SVO for research use with citation', licenseEvidence: [models],
      acquisition: `Restored through source/preparation/acquisition.json from the SVO SSAP access reference for Teff ${entry.star.teffK} K, log g ${entry.star.logg.toFixed(1)}, [M/H] 0, the grid point nearest ${host}'s cited temperature and gravity.`,
      redistribution: 'Not redistributed in git; restored from the SVO.', consumers: [consumer], ...pinned('model spectrum') }];
  files.set(`${s}/manifest.json`, json(manifest));
  const plan = read(`${s}/preparation/acquisition.json`);
  plan.operations = [...without(plan.operations, `${id} acquisition operations`, 'path', [inputs.filter.path, inputs.star.path]),
    ...[inputs.filter, inputs.star].map(file => ({ kind: 'member' in file && file.member !== undefined ? 'zip-member' : 'download', groups: ['restore', 'refresh'], path: file.path, url: file.url, ...('member' in file && file.member !== undefined ? { member: file.member } : {}) }))];
  files.set(`${s}/preparation/acquisition.json`, json(plan));
  bindInputs(files, id);
  return { minimum, maximum, underStar, promoted: openOnMap(files, id, entry.dataset) };
}

/** `new-object --rock-eclipse`: add each entry's dataset to its planet's package under `root`. The filter curve and the
 * model spectrum are fetched, the bake's own reader finds the rock that shows the depth, and nothing is written for a
 * planet whose entry is refused. Returns one line per dataset; nothing is baked here. */
export async function addRockEclipseDatasets(root: string, entries: ReadonlyMap<string, readonly RockEclipseEntry[]>, archive: Archive, progress = (_line: string) => {}): Promise<string[]> {
  const { loadBareRockEclipse } = await import('@cssearth/bake/objects/raster'), lines: string[] = [];
  for (const [id, list] of entries) {
    const o = resolve(root, 'src/objects', id), files: PackageFiles = new Map();
    for (const path of DATASET_REBUILD_FILES) files.set(`src/objects/${id}/${path}`, await readFile(resolve(o, path), 'utf8'));
    const name = requireString(requireRecord(JSON.parse(String(files.get(`src/objects/${id}/source/content/object.json`))), `${id} content`).displayName, `${id} displayName`);
    const body = requireRecord(JSON.parse(await readFile(resolve(root, 'packages/astronomy/data/bodies', `${id}.json`), 'utf8')), `${id} body`);
    const host = requireString(requireRecord(body.physical, `${id} physical`).parent, `${id} parent`), atmosphere = await hostAtmosphere(root, host);
    let promoted = false;
    for (const entry of list) {
      const release = entry.throughput ? await throughputRelease(archive, `${id}, dataset ${entry.dataset}`, entry.throughput) : undefined;
      const fetched = await restoreRockInputs(resolve(o, 'source'), id, { id: host, ...atmosphere }, entry, archive);
      if (fetched) progress(`${id}: ${fetched.toLocaleString('en-US')} bytes of band curve and model spectrum fetched`);
      // The reader takes the depth record from the source directory, as the bake will.
      const record = resolve(o, 'source', entry.path);
      await mkdir(dirname(record), { recursive: true });
      await writeFile(record, json(depthRecord(id, entry)));
      const rock = await loadBareRockEclipse(resolve(o, 'source'), rockRecipe(id, host, entry));
      const checked = checkDayside(`${id}, dataset ${entry.dataset}`, entry, rock.uniformDaysideK);
      const installed = installRockEclipseDataset(files, id, name, host, entry, { substellarK: rock.substellarK, substellarRangeK: [rock.lowerK, rock.upperK] }, release);
      promoted ||= installed.promoted;
      lines.push(`${id}: ${entry.dataset} rock model from ${entry.credit}, ${installed.underStar} K under the star, drawn ${installed.minimum}-${installed.maximum} K${checked}${installed.promoted ? '; the page now opens on it' : ''}`); progress(lines.at(-1)!);
    }
    await writeWithMarker(root, files, id, promoted);
  }
  return lines;
}
