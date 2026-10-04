/** Authored object content wire records; asset preparation stays with bake/site. */
import type { DatasetVolume } from './object-controls.js';
import { object as preparedObject, text as preparedText, array as preparedArray } from './panel-readers.js';
import { sourceUrl } from '../sources/catalog.js';

export const OBJECT_CONTENT_SCHEMA = 'cssearth-object-content@2';
export const OBJECT_CONTENT_VERSION = 1;

export interface DatasetLegendRecipe {
  kind: "scale" | "categories" | "ranges";
  ranges?: Array<{ label: string; color: string; low: number }>;
  title: string;
  meta?: string;
  image?: string;
  width?: number;
  height?: number;
  labels?: string[];
  recipe?: { palette: number[][]; labels: string[] };
  items?: Array<{ label: string; description?: string; color: string | number[] }>;
  sourceUrl?: string;
  sourcePath?: string;
  rasterRecipe?: {
    crop: { left: number; top: number; width: number; height: number };
    dividerRows?: { threshold: number; expectedRuns: number; minimumCoverage: number };
    outputWidth: number;
    outputHeight: number;
  };
}

export interface DatasetSource {
  id: string;
  path?: string;
  url?: string;
}

export interface ContentDatasetRecipe {
  id: string;
  label: string;
  /** The observation covers the host system rather than just its body. */
  scope?: "system";
  shortLabel?: string;
  /** Maintainer notes about the dataset. They are never published; reader text lives in the package's text.json. */
  notes?: string;
  /** The prepared surface marks missing observations with the shared no-data grid. */
  noData?: boolean;
  facts?: Array<{ id: string; label: string; value: string }>;
  filter?: string;
  qualification?: string;
  falseColor?: boolean;
  view?: "exterior" | "interior";
  thumbnail: string;
  surface?: string;
  poles?: string;
  material?: string;
  legend?: DatasetLegendRecipe;
  legendNote?: string;
  /**
   * A dataset may name a cloud that accompanies the body. It borrows the named surface's prepared
   * plates for the body itself, and the shell asks the cloud's bank for the dataset while it is selected.
   */
  volume?: DatasetVolume;
  /**
   * One step of a dataset shown as a sequence, such as a map at each of 25 wavelengths. Every step is an ordinary dataset with
   * its own prepared surface; the steps of a group sit together in the controls, the panel lists the group once and steps
   * through its members in order.
   */
  step?: DatasetStep;
  source: DatasetSource;
}

export interface DatasetStep {
  /** The group this dataset is one step of; members are consecutive in the controls. */
  group: string;
  /** What distinguishes this step, such as "1.45 µm". */
  label: string;
  /** Start this group's loop automatically; false keeps depth or other manual selections still. */
  autoplay?: boolean;
  /** The step the panel lists the group as, and opens: its first by default, or its last (the newest date of a record). */
  opens?: 'first' | 'last';
}

export interface ChartRecipe {
  id: string;
  titleKey: string;
  open?: boolean;
  src: string;
  width: number;
  height: number;
  alt: string;
  source: DatasetSource;
}

export interface GalleryRecipe {
  id: string;
  titleKey: string;
  open?: boolean;
  qualification?: string;
  items: Array<{
    id: string;
    label: string;
    src: string;
    width: number;
    height: number;
    alt: string;
    caption: string;
    sourceUrl: string;
  }>;
}

export interface ObjectContentSource {
  schema: typeof OBJECT_CONTENT_SCHEMA;
  version: typeof OBJECT_CONTENT_VERSION;
  id: string;
  displayName: string;
  panel: {
    facts: Fact[];
    moreFacts?: Fact[];
  };
  datasets: {
    titleKey: "datasets";
    defaultDataset: string;
    labels?: Record<string, string>;
    controls: ContentDatasetRecipe[];
  };
  settings: {
    titleKey: "settings";
    controls: Array<{
      kind: "cycle" | "toggle";
      name: string;
      label: string;
      state?: string;
      checked?: boolean;
    }>;
  };
  charts: ChartRecipe[];
  galleries?: GalleryRecipe[];
  resources: Array<{ label: string; role: string; description: string; href: string }>;
  provenance: Record<string, { id?: string; path?: string; url?: string; credit?: string; license?: string }>;
}

export interface Fact {
  id: string;
  label: string;
  value: string;
  source?: { catalogueId: string; url: string; label: string; checked: string; path?: string; locator?: string };
}

/** Historical preparation envelope admission; field/editorial checks remain with their callers. */
export function validateObjectContentEnvelope(source: { schema: unknown; version: unknown; id: unknown }): void {
  if (source.schema !== OBJECT_CONTENT_SCHEMA || source.version !== OBJECT_CONTENT_VERSION) {
    throw new Error(`${source.id}: unsupported object content schema`);
  }
}

/** Join authored dataset links and scope while building the page; no source lookup runs in the browser. */
export function authoredDatasetMetadata(input: unknown, objectId: string): {
  sourceUrls: ReadonlyMap<string, string>; systemDatasetIds: ReadonlySet<string>;
} {
  const content = preparedObject(input, 'object content source');
  if (content.schema !== OBJECT_CONTENT_SCHEMA || content.id !== objectId) throw new TypeError(`${objectId}: dataset metadata owner differs.`);
  const datasets = preparedObject(content.datasets, 'object content datasets');
  const sourceUrls = new Map<string, string>();
  const systemDatasetIds = new Set<string>();
  const ids = new Set<string>();
  for (const value of preparedArray(datasets.controls, 'object content dataset controls')) {
    const control = preparedObject(value, 'object content dataset');
    const id = preparedText(control.id, 'object content dataset id');
    if (ids.has(id)) throw new TypeError(`${objectId}: duplicate dataset ${id}.`);
    ids.add(id);
    if (control.scope !== undefined && control.scope !== 'system') throw new TypeError(`${objectId}: invalid dataset scope for ${id}.`);
    if (control.scope === 'system') systemDatasetIds.add(id);
    if (control.source !== undefined) {
      const source = preparedObject(control.source, 'object content dataset source');
      if (source.url !== undefined) sourceUrls.set(id, sourceUrl(source.url));
    }
  }
  return { sourceUrls, systemDatasetIds };
}

/** Catalogue consumers read dataset companions, without requiring chart dimensions produced later. */
export function readObjectContentDatasets(input: unknown) {
  const record = preparedObject(input, 'object content source');
  validateObjectContentEnvelope({ schema: record.schema, version: record.version, id: record.id });
  const datasets = preparedObject(record.datasets, 'object datasets');
  const controls = preparedArray(datasets.controls, 'object datasets').map(value => {
    const control = preparedObject(value, 'object dataset');
    const id = preparedText(control.id, 'dataset id'), label = preparedText(control.label, 'dataset label');
    const thumbnail = control.thumbnail === undefined ? undefined : preparedText(control.thumbnail, 'dataset thumbnail');
    const rawVolume = control.volume === undefined ? undefined : preparedObject(control.volume, 'dataset volume');
    const volume = rawVolume === undefined ? undefined : { objectId: preparedText(rawVolume.objectId, 'volume object'),
      datasetId: preparedText(rawVolume.datasetId, 'volume dataset'), surface: preparedText(rawVolume.surface, 'volume surface') };
    return { ...control, id, label, ...(thumbnail === undefined ? {} : { thumbnail }), ...(volume === undefined ? {} : { volume }) };
  });
  return { ...record, id: preparedText(record.id, 'content id'), displayName: preparedText(record.displayName, 'display name'),
    datasets: { ...datasets, defaultDataset: preparedText(datasets.defaultDataset, 'default dataset'), controls } };
}
/** Factsheet consumers own cited panel admission; this reader checks the content envelope before exposing it. */
export function readObjectContentPanel(input: unknown) {
  const record = preparedObject(input, 'object content source');
  validateObjectContentEnvelope({ schema: record.schema, version: record.version, id: record.id });
  return { ...record, panel: preparedObject(record.panel, 'content panel') };
}
