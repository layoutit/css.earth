/** Authored object content wire records; asset preparation stays with bake/site. */
import type { DatasetVolume } from './object-controls.js';
import { isRecord } from '@cssearth/core';
import { parse, object, array, dictionary, union, optional, literal, number, string, boolean, json } from '@cssearth/core/schema';
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

const source = object({ id: string, path: optional(string), url: optional(string) });
const fact = object({ id: string, label: string, value: string, source: optional(object({
  catalogueId: string, url: string, label: string, checked: string, path: optional(string), locator: optional(string),
})) });
const legend = object({
  kind: literal('scale', 'categories', 'ranges'), title: string, meta: optional(string),
  image: optional(string), width: optional(number), height: optional(number), labels: optional(array(string)),
  sourceUrl: optional(string), sourcePath: optional(string),
  ranges: optional(array(object({label: string, color: string, low: number}))),
  items: optional(array(object({label: string, description: optional(string), color: union(string, array(number))}))),
  recipe: optional(object({palette: array(array(number)), labels: array(string)})),
  rasterRecipe: optional(object({
    crop: object({left: number, top: number, width: number, height: number}),
    dividerRows: optional(object({threshold: number, expectedRuns: number, minimumCoverage: number})),
    outputWidth: number, outputHeight: number,
  })),
});
// Reader text lives in the package's text.json, so the content recipe carries facts, dataset recipes and legends only.
const content = object({
  schema: literal(OBJECT_CONTENT_SCHEMA), version: literal(OBJECT_CONTENT_VERSION), id: string, displayName: string,
  panel: object({facts: array(fact), moreFacts: optional(array(fact)), schema: optional(string), objectId: optional(string), sources: optional(json)}),
  datasets: object({titleKey: literal('datasets'), defaultDataset: string, labels: optional(dictionary(string)),
    controls: array(object({id: string, label: string, thumbnail: string, shortLabel: optional(string), filter: optional(string),
      qualification: optional(string), surface: optional(string), poles: optional(string), material: optional(string),
      legendNote: optional(string), falseColor: optional(boolean), view: optional(literal('exterior', 'interior')),
      notes: optional(string), noData: optional(boolean), legend: optional(legend), facts: optional(array(fact)), source,
      scope: optional(literal('system')), volume: optional(object({objectId: string, datasetId: string, surface: string})),
      step: optional(object({group: string, label: string, autoplay: optional(boolean), opens: optional(literal('first', 'last'))})),
    })),
  }),
  settings: object({titleKey: literal('settings'), controls: array(object({kind: literal('cycle', 'toggle'),
    name: string, label: string, state: optional(string), checked: optional(boolean),
  }))}),
  charts: array(object({id: string, titleKey: string, src: string, alt: string, width: number, height: number,
    open: optional(boolean), source})),
  galleries: optional(array(object({id: string, titleKey: string, open: optional(boolean), qualification: optional(string),
    items: array(object({id: string, label: string, src: string, alt: string, caption: string, sourceUrl: string,
      width: number, height: number})),
  }))),
  resources: array(object({label: string, role: string, description: string, href: string})),
  provenance: dictionary(object({id: optional(string), path: optional(string), url: optional(string),
    credit: optional(string), license: optional(string)})),
});

/** Historical complete-record admission used by content fixtures. Production authoring may fill chart/dataset fields later. */
export function parseCompleteObjectContentSource(value: unknown, label = 'object content fixture'): ObjectContentSource {
  return parse(value, content, label);
}

/** Historical preparation envelope admission; field/editorial checks remain with their callers. */
export function validateObjectContentEnvelope(source: { schema: unknown; version: unknown; id: unknown }): void {
  if (source.schema !== OBJECT_CONTENT_SCHEMA || source.version !== OBJECT_CONTENT_VERSION) {
    throw new Error(`${source.id}: unsupported object content schema`);
  }
}

const preparedObject = (value: unknown, label: string): Record<string, unknown> => {
  if (!isRecord(value)) throw new TypeError(`Prepared ${label} must be an object.`);
  return value;
};
const preparedText = (value: unknown, label: string): string => {
  if (typeof value !== 'string') throw new TypeError(`Prepared ${label} must be text.`);
  return value;
};
const preparedArray = (value: unknown, label: string): readonly unknown[] => {
  if (!Array.isArray(value)) throw new TypeError(`Prepared ${label} must be an array.`);
  return value;
};
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
