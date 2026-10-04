import type { PreparedBank } from '../prepared-bank.js';
import { preparedBankColumn } from '../prepared-bank.js';
import type { VolumeVector } from '../density-volume.js';
import type { PreparedCssVolume } from './css-volume-types.js';
import { DEFAULT_POINT_VISIBILITY } from './point-visibility.js';
import { validatePreparedCataloguePoints, type PreparedCataloguePoints } from './prepared-catalogue-points.js';
import { samePreparedVolumeTopology } from './prepared-volume-topology.js';
import { validatePreparedVolumeDatasets, type PreparedVolumeDataset, type PreparedVolumeDatasets } from './prepared-volume-datasets.js';
import { PREPARED_VOLUME_DATASETS_SCHEMA } from './volume-schemas.js';

/**
 * How a volume dataset bank is stored and travels. In memory a bank is one value with every dataset's volume and stars
 * (prepared-volume-datasets.ts); the page mounts one dataset at a time, so on disk each part a mount needs is its own
 * file, and a part several datasets share is one file:
 *  - `datasets.json`, the index: the bank's fields and, for each dataset, its card text, brightness, textures, the
 *    family of datasets that share its geometry, and the names of its two files;
 *  - `<dataset>/volume.json`, that dataset's volume;
 *  - `stars.bin`, the catalogue stars as columns (prepared-bank.ts), once for every dataset that draws the same ones;
 *  - `record.json`, each volume's provenance and approximation notes, which no page reads.
 * Stored as one file, the Small Magellanic Cloud's five datasets were 2.76 MB of JSON, 48 % of it the same stars five
 * times, parsed on the page's thread in the frame it arrived in (2026-10-04).
 */
export const PREPARED_VOLUME_DATASET_INDEX_SCHEMA = 'cssearth-volume-dataset-index@1';
export const PREPARED_VOLUME_DATASET_RECORD_SCHEMA = 'cssearth-volume-dataset-record@1';
export const PREPARED_VOLUME_STARS_SCHEMA = 'cssearth-volume-stars@1';
export const VOLUME_DATASET_INDEX_FILE = 'datasets.json', VOLUME_DATASET_RECORD_FILE = 'record.json';

export interface PreparedVolumeDatasetEntry extends Omit<PreparedVolumeDataset, 'volume' | 'stars'> {
  /** The datasets of one family share their geometry: one mounted surface shows whichever of them is selected. */
  readonly topology: number;
  readonly resources: PreparedCssVolume['resources'];
  /** The dataset's files, relative to the index. */
  readonly volume: string;
  readonly stars: string;
}
export interface PreparedVolumeDatasetIndex extends Omit<PreparedVolumeDatasets, 'schema' | 'datasets' | 'provenance'> {
  readonly schema: typeof PREPARED_VOLUME_DATASET_INDEX_SCHEMA;
  readonly datasets: readonly PreparedVolumeDatasetEntry[];
}
/** A stored bank's files by name: what a preparation writes and reads back. */
export interface PreparedVolumeDatasetFiles {
  readonly index: PreparedVolumeDatasetIndex;
  readonly volumes: ReadonlyMap<string, PreparedCssVolume>;
  readonly stars: ReadonlyMap<string, PreparedBank>;
  readonly record: { readonly schema: typeof PREPARED_VOLUME_DATASET_RECORD_SCHEMA; readonly id: string; readonly provenance?: unknown;
    readonly datasets: Readonly<Record<string, { readonly provenance?: unknown; readonly approximation?: unknown }>> };
}

const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-z][a-z0-9-]*$/u.test(id);
const relativeFile = (path: unknown): path is string => typeof path === 'string' && /^[a-z0-9][a-z0-9@._-]*(?:\/[a-z0-9][a-z0-9@._-]*)*$/u.test(path);

/** The catalogue stars of a dataset as columns. A position, size and opacity keep every digit; a color is an index into
 * the header's palette; an absent diameter is NaN. */
export function encodeVolumeStars(input: PreparedCataloguePoints): PreparedBank {
  const stars = validatePreparedCataloguePoints(input), count = stars.points.length;
  const palette = [...new Set(stars.points.map(point => point.colorCss))];
  const position = new Float64Array(count * 3), sizePx = new Float64Array(count), opacity = new Float64Array(count);
  const color = palette.length <= 0x100 ? new Uint8Array(count) : new Uint16Array(count);
  const sized = stars.points.some(point => point.diameterUnits !== undefined), diameterUnits = sized ? new Float64Array(count) : null;
  const paletteIndex = new Map(palette.map((entry, index) => [entry, index] as const));
  stars.points.forEach((point, index) => {
    position.set(point.positionUnits, index * 3); sizePx[index] = point.sizePx; opacity[index] = point.opacity;
    color[index] = paletteIndex.get(point.colorCss)!;
    if (diameterUnits) diameterUnits[index] = point.diameterUnits ?? Number.NaN;
  });
  return { schema: PREPARED_VOLUME_STARS_SCHEMA, fields: { frame: stars.frame, ids: stars.points.map(point => point.id), palette },
    columns: { position, sizePx, opacity, color, ...(diameterUnits ? { diameterUnits } : {}) } };
}

/** The catalogue stars a dataset mounts, from their columns, checked as the bank's own validator checks them. */
export function decodeVolumeStars(bank: PreparedBank, at = 'volume stars'): PreparedCataloguePoints {
  if (bank.schema !== PREPARED_VOLUME_STARS_SCHEMA) throw new TypeError(`${at}: expected ${PREPARED_VOLUME_STARS_SCHEMA}, got ${bank.schema}.`);
  const { frame, ids, palette } = bank.fields as { frame?: unknown; ids?: unknown; palette?: unknown };
  if (!Array.isArray(ids) || !Array.isArray(palette)) throw new TypeError(`${at}: its header holds the stars' ids and their palette.`);
  const count = ids.length, position = preparedBankColumn(bank, 'position', 'f64', count * 3, at), sizePx = preparedBankColumn(bank, 'sizePx', 'f64', count, at);
  const opacity = preparedBankColumn(bank, 'opacity', 'f64', count, at), color = preparedBankColumn(bank, 'color', ['u8', 'u16'], count, at);
  const diameterUnits = bank.columns.diameterUnits === undefined ? null : preparedBankColumn(bank, 'diameterUnits', 'f64', count, at);
  return validatePreparedCataloguePoints({ frame, points: ids.map((id: unknown, index) => {
    const diameter = diameterUnits?.[index];
    return { id, positionUnits: [position[index * 3]!, position[index * 3 + 1]!, position[index * 3 + 2]!] as unknown as VolumeVector, sizePx: sizePx[index]!,
      ...(diameter === undefined || Number.isNaN(diameter) ? {} : { diameterUnits: diameter }), colorCss: palette[color[index]!] as string, opacity: opacity[index]! };
  }) });
}

/** A validated bank as its files. Datasets that draw the same stars name one file. */
export function splitPreparedVolumeDatasets(bank: PreparedVolumeDatasets): PreparedVolumeDatasetFiles {
  const families: PreparedCssVolume[] = [], volumes = new Map<string, PreparedCssVolume>(), stars = new Map<string, PreparedBank>(), starFiles = new Map<string, string>();
  const records: Record<string, { provenance?: unknown; approximation?: unknown }> = {};
  const datasets = bank.datasets.map((dataset): PreparedVolumeDatasetEntry => {
    let topology = families.findIndex(first => samePreparedVolumeTopology(first, dataset.volume));
    if (topology < 0) topology = families.push(dataset.volume) - 1;
    const { provenance, approximation, ...volume } = dataset.volume, volumeFile = `${dataset.id}/volume.json`;
    volumes.set(volumeFile, volume as PreparedCssVolume);
    records[dataset.id] = { ...(provenance === undefined ? {} : { provenance }), ...(approximation === undefined ? {} : { approximation }) };
    const key = JSON.stringify(dataset.stars);
    let starFile = starFiles.get(key);
    if (starFile === undefined) {
      starFile = starFiles.size ? `${dataset.id}/stars.bin` : 'stars.bin';
      starFiles.set(key, starFile); stars.set(starFile, encodeVolumeStars(dataset.stars));
    }
    const { volume: _volume, stars: _stars, ...card } = dataset;
    return { ...card, topology, resources: dataset.volume.resources, volume: volumeFile, stars: starFile };
  });
  const { schema: _schema, datasets: _datasets, provenance, ...fields } = bank;
  return { index: { ...fields, schema: PREPARED_VOLUME_DATASET_INDEX_SCHEMA, datasets }, volumes, stars,
    record: { schema: PREPARED_VOLUME_DATASET_RECORD_SCHEMA, id: bank.id, ...(provenance === undefined ? {} : { provenance }), datasets: records } };
}

/** A stored bank's index, checked: the page reads it on arrival, and each of its files only when a mount needs it. */
export function validatePreparedVolumeDatasetIndex(input: unknown): PreparedVolumeDatasetIndex {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('A volume dataset index must be an object.');
  const value = input as PreparedVolumeDatasetIndex;
  if (value.schema !== PREPARED_VOLUME_DATASET_INDEX_SCHEMA || !validId(value.id) || !Number.isFinite(value.framingRadiusUnits) || value.framingRadiusUnits <= 0 ||
      !Array.isArray(value.datasets) || !value.datasets.length || (value.starsEnabled !== undefined && typeof value.starsEnabled !== 'boolean') ||
      (value.attachedTo !== undefined && !validId(value.attachedTo)) || (value.contextVisibility !== undefined && !['galactic', 'independent'].includes(value.contextVisibility))) {
    throw new TypeError(`Volume dataset index ${String(value.id)}: its identity, framing or datasets are invalid.`);
  }
  const ids = new Set<string>(), described = new Map<string, PreparedCssVolume['resources'][number]>();
  const datasets = value.datasets.map((dataset): PreparedVolumeDatasetEntry => {
    const at = `Volume dataset index ${value.id}, dataset ${String(dataset?.id)}`;
    if (!dataset || !validId(dataset.id) || ids.has(dataset.id) || [dataset.label, dataset.title, dataset.description].some(text => typeof text !== 'string' || !text.trim()) ||
        typeof dataset.sourceUrl !== 'string' || !/^https:\/\//u.test(dataset.sourceUrl) || !Number.isSafeInteger(dataset.topology) || dataset.topology < 0 ||
        !relativeFile(dataset.volume) || !relativeFile(dataset.stars) || !Array.isArray(dataset.resources) ||
        (dataset.occultingCentreUnits !== undefined && (!Array.isArray(dataset.occultingCentreUnits) || dataset.occultingCentreUnits.length !== 3 || !dataset.occultingCentreUnits.every(Number.isFinite)))) {
      throw new TypeError(`${at}: its card, family or files are invalid.`);
    }
    ids.add(dataset.id);
    if (!dataset.brightness || !(['overall', 'x', 'y', 'z'] as const).every(key => Number.isFinite(dataset.brightness[key]) && dataset.brightness[key] >= 0 && dataset.brightness[key] <= 1)) {
      throw new TypeError(`${at}: brightness holds overall, x, y and z between zero and one.`);
    }
    for (const resource of dataset.resources) {
      if (!resource || !relativeFile(resource.path) || ![resource.bytes, resource.width, resource.height].every(number => Number.isSafeInteger(number) && number > 0)) {
        throw new TypeError(`${at}: a texture needs its path, bytes, width and height.`);
      }
      // One path is one published file: every dataset that names it describes it alike.
      const known = described.get(resource.path);
      if (known && (known.bytes !== resource.bytes || known.width !== resource.width || known.height !== resource.height)) {
        throw new TypeError(`${at}: ${resource.path} is described differently from an earlier dataset of the bank.`);
      }
      described.set(resource.path, resource);
    }
    return Object.freeze({ id: dataset.id, label: dataset.label, title: dataset.title, description: dataset.description, sourceUrl: dataset.sourceUrl,
      brightness: Object.freeze({ ...dataset.brightness }), topology: dataset.topology, resources: Object.freeze((dataset.resources as PreparedCssVolume['resources']).map(resource => Object.freeze({ ...resource }))),
      volume: dataset.volume, stars: dataset.stars,
      ...(dataset.occultingCentreUnits === undefined ? {} : { occultingCentreUnits: Object.freeze([...dataset.occultingCentreUnits] as [number, number, number]) }) });
  });
  if (!ids.has(value.defaultDataset)) throw new TypeError(`Volume dataset index ${value.id}: its default dataset ${String(value.defaultDataset)} is not one of its datasets.`);
  const visibility = value.pointVisibility ?? DEFAULT_POINT_VISIBILITY;
  if (!Number.isFinite(visibility.hiddenBelowRadiusPixels) || visibility.hiddenBelowRadiusPixels < 0 ||
      !Number.isFinite(visibility.fullAboveRadiusPixels) || visibility.fullAboveRadiusPixels <= visibility.hiddenBelowRadiusPixels) {
    throw new TypeError(`Volume dataset index ${value.id}: point visibility needs increasing non-negative projected-radius thresholds.`);
  }
  return Object.freeze({ schema: value.schema, id: value.id, defaultDataset: value.defaultDataset, contextVisibility: value.contextVisibility ?? 'galactic',
    framingRadiusUnits: value.framingRadiusUnits, datasets: Object.freeze(datasets), starsEnabled: value.starsEnabled ?? true,
    ...(value.attachedTo === undefined ? {} : { attachedTo: value.attachedTo }), pointVisibility: Object.freeze({ ...visibility }) });
}

/** The bank in memory from its files: the inverse of splitPreparedVolumeDatasets, for the preparations that read a bank whole. */
export function joinPreparedVolumeDatasets(files: PreparedVolumeDatasetFiles): PreparedVolumeDatasets {
  const index = validatePreparedVolumeDatasetIndex(files.index), stars = new Map<string, PreparedCataloguePoints>();
  if (files.record.schema !== PREPARED_VOLUME_DATASET_RECORD_SCHEMA || files.record.id !== index.id) throw new TypeError(`Volume dataset bank ${index.id}: its record is of another bank.`);
  const datasets = index.datasets.map(({ topology: _topology, resources: _resources, volume: volumeFile, stars: starFile, ...card }): PreparedVolumeDataset => {
    const volume = files.volumes.get(volumeFile), packed = files.stars.get(starFile);
    if (!volume || !packed) throw new TypeError(`Volume dataset bank ${index.id}: dataset ${card.id} lacks ${volume ? starFile : volumeFile}.`);
    let points = stars.get(starFile);
    if (!points) stars.set(starFile, points = decodeVolumeStars(packed, `${index.id}/${starFile}`));
    return { ...card, volume: { ...volume, ...files.record.datasets[card.id] }, stars: points };
  });
  const { schema: _schema, datasets: _datasets, ...fields } = index;
  return validatePreparedVolumeDatasets({ ...fields, schema: PREPARED_VOLUME_DATASETS_SCHEMA, datasets,
    ...(Object.hasOwn(files.record, 'provenance') ? { provenance: files.record.provenance } : {}) });
}
