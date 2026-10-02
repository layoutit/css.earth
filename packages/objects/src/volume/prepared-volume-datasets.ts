import { PREPARED_VOLUME_DATASETS_SCHEMA } from './volume-schemas.js';
import type { DensityVolumeFrame } from '../density-volume.js';
import type { PreparedCssVolume } from './css-volume-types.js';
import { validatePreparedCssVolume } from './css-volume-validation.js';
import { validatePreparedCataloguePoints, type PreparedCataloguePoints } from './prepared-catalogue-points.js';
import { DEFAULT_POINT_VISIBILITY, type PreparedPointVisibility } from './point-visibility.js';

export interface PreparedVolumeDatasetBrightness { readonly overall: number; readonly x: number; readonly y: number; readonly z: number }
export interface PreparedVolumeDataset {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly description: string;
  readonly sourceUrl: string;
  readonly volume: PreparedCssVolume;
  readonly brightness: PreparedVolumeDatasetBrightness;
  readonly stars: PreparedCataloguePoints;
  /** The centre of a compact structure that can pass in front of the body at the middle of this frame. The bank
   * composites this dataset over the detail scene while that centre is nearer to the camera than the body, and behind
   * it otherwise. Omitted for a dataset whose emission surrounds the body, which always composites behind it. */
  readonly occultingCentreUnits?: readonly [number, number, number];
}
export interface PreparedVolumeDatasets {
  readonly schema: typeof PREPARED_VOLUME_DATASETS_SCHEMA;
  readonly id: string;
  readonly defaultDataset: string;
  readonly framingRadiusUnits: number;
  readonly datasets: readonly PreparedVolumeDataset[];
  /** Visibility remains toggleable; saved exposure and support belong in prepared point opacity. */
  readonly starsEnabled?: boolean;
  /** Nearby volumes must not inherit the Milky Way overview fade. */
  readonly contextVisibility?: 'galactic' | 'independent';
  /** The body this cloud accompanies. An accompanying cloud is not a place of its own and is drawn only while one of
   * that body's own datasets asks for it; a free-standing cloud names nothing and is drawn whenever it is in view. */
  readonly attachedTo?: string;
  readonly pointVisibility?: PreparedPointVisibility;
  readonly provenance?: unknown;
}
export type PreparedVolumeDatasetBank = PreparedVolumeDatasets;
export function validatePreparedVolumeDatasets(input: unknown): PreparedVolumeDatasets {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Prepared volume datasets must be an object.');
  const value = input as PreparedVolumeDatasets, validId = (id: unknown) => typeof id === 'string' && /^[a-z][a-z0-9-]*$/u.test(id);
  if (value.schema !== PREPARED_VOLUME_DATASETS_SCHEMA || !validId(value.id) || !Number.isFinite(value.framingRadiusUnits) ||
      value.framingRadiusUnits <= 0 || !Array.isArray(value.datasets) || !value.datasets.length ||
      (value.starsEnabled !== undefined && typeof value.starsEnabled !== 'boolean') ||
      (value.attachedTo !== undefined && (typeof value.attachedTo !== 'string' || !validId(value.attachedTo))) ||
      (value.contextVisibility !== undefined && !['galactic', 'independent'].includes(value.contextVisibility))) {
    throw new TypeError('Prepared volume dataset identity, framing or bank is invalid.');
  }
  const ids = new Set<string>(), resources = new Map<string, PreparedCssVolume['resources'][number]>();
  const datasets = value.datasets.map(dataset => {
    if (!dataset || !validId(dataset.id) || ids.has(dataset.id) || [dataset.label, dataset.title, dataset.description].some(text => typeof text !== 'string' || !text.trim()) ||
        typeof dataset.sourceUrl !== 'string' || !/^https:\/\//u.test(dataset.sourceUrl) ||
        (dataset.occultingCentreUnits !== undefined && (!Array.isArray(dataset.occultingCentreUnits) ||
          dataset.occultingCentreUnits.length !== 3 || !dataset.occultingCentreUnits.every(Number.isFinite)))) throw new TypeError('Prepared volume dataset content is invalid.');
    ids.add(dataset.id);
    const volume = validatePreparedCssVolume(dataset.volume), stars = validatePreparedCataloguePoints(dataset.stars);
    if (!samePreparedPhysicalFrame(volume.frame, stars.frame)) throw new TypeError('Prepared volume and catalogue must share a physical frame.');
    if (!dataset.brightness || !['overall', 'x', 'y', 'z'].every(key => {
      const number = dataset.brightness[key as keyof PreparedVolumeDatasetBrightness];
      return Number.isFinite(number) && number >= 0 && number <= 1;
    })) throw new TypeError('Prepared volume brightness must contain overall/X/Y/Z attenuation between zero and one.');
    for (const resource of volume.resources) {
      // One path is one published file: every dataset that names it must describe it alike.
      const known = resources.get(resource.path);
      if (known && (known.bytes !== resource.bytes || known.width !== resource.width || known.height !== resource.height)) {
        throw new TypeError(`Prepared volume dataset ${dataset.id} describes ${resource.path} differently from an earlier dataset in the fixed bank.`);
      }
      resources.set(resource.path, resource);
    }
    return Object.freeze({ id: dataset.id, label: dataset.label, title: dataset.title, description: dataset.description,
      sourceUrl: dataset.sourceUrl, volume, stars, brightness: Object.freeze({ ...dataset.brightness }),
      ...(dataset.occultingCentreUnits === undefined ? {} : { occultingCentreUnits: Object.freeze([...dataset.occultingCentreUnits] as [number, number, number]) }) });
  });
  if (!ids.has(value.defaultDataset)) throw new TypeError('Prepared default volume dataset is unavailable.');
  if (datasets.some(dataset => !samePreparedCatalogueGeometry(datasets[0].stars, dataset.stars))) {
    throw new TypeError('Prepared volume datasets must retain the same catalogue geometry.');
  }
  const visibility = value.pointVisibility ?? DEFAULT_POINT_VISIBILITY;
  if (!Number.isFinite(visibility.hiddenBelowRadiusPixels) || visibility.hiddenBelowRadiusPixels < 0 ||
      !Number.isFinite(visibility.fullAboveRadiusPixels) || visibility.fullAboveRadiusPixels <= visibility.hiddenBelowRadiusPixels) {
    throw new TypeError('Prepared point visibility needs increasing non-negative projected-radius thresholds.');
  }
  return Object.freeze({ schema: value.schema, id: value.id, defaultDataset: value.defaultDataset,
    contextVisibility: value.contextVisibility ?? 'galactic', framingRadiusUnits: value.framingRadiusUnits, datasets: Object.freeze(datasets), starsEnabled: value.starsEnabled ?? true,
    ...(value.attachedTo === undefined ? {} : { attachedTo: value.attachedTo }),
    pointVisibility: Object.freeze({ ...visibility }),
    ...(Object.hasOwn(value, 'provenance') ? { provenance: value.provenance } : {}) });
}

/** Bounds describe coverage; the physical embedding and point identities must not change with a dataset. */
export function samePreparedCatalogueGeometry(left: PreparedCataloguePoints, right: PreparedCataloguePoints): boolean {
  if (!samePreparedPhysicalFrame(left.frame, right.frame) || left.points.length !== right.points.length) return false;
  const points = new Map(right.points.map(point => [point.id, point]));
  return left.points.every(point => {
    const other = points.get(point.id);
    return other && point.positionUnits.every((value, axis) => value === other.positionUnits[axis]);
  });
}

export function samePreparedPhysicalFrame(left: DensityVolumeFrame, right: DensityVolumeFrame): boolean {
  return left.referenceFrame === right.referenceFrame && left.epochJdTt === right.epochJdTt &&
    left.metersPerUnit === right.metersPerUnit && left.originM.every((value, axis) => value === right.originM[axis]) &&
    left.localToReferenceXyzw.every((value, axis) => value === right.localToReferenceXyzw[axis]);
}
