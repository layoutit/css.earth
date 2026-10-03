/** Prepared content records and the historical panel field projection. */
import { isRecord } from '@cssearth/core';
import type { ObjectContentSource, Fact, ContentDatasetRecipe, ChartRecipe, GalleryRecipe } from './object-content.js';
export const PREPARED_CONTENT_SCHEMA = 'cssearth-prepared-content@2';

export interface PreparedObjectContent {
  objectId: string;
  title: { label: string };
  facts: ObjectContentSource["panel"]["facts"];
  moreFacts: NonNullable<ObjectContentSource["panel"]["moreFacts"]>;
  datasets: {
    title: { label: string; src: string; width: number; height: number };
    defaultDataset: string;
    controls: Array<Record<string, unknown> & Pick<ContentDatasetRecipe, "facts">>;
  };
  settings: {
    title: { label: string; src: string; width: number; height: number };
    controls: ObjectContentSource["settings"]["controls"];
  };
  charts: Array<ChartRecipe & { title: { label: string } }>;
  galleries: Array<GalleryRecipe & { title: { label: string; src: string; width: number; height: number } }>;
  resources: ObjectContentSource["resources"];
}

export interface PreparedObjectContentDocument {
  schema: typeof PREPARED_CONTENT_SCHEMA;
  objectId: string;
  title: PreparedObjectContent["title"];
  facts: PreparedObjectContent["facts"];
  moreFacts: PreparedObjectContent["moreFacts"];
  charts: PreparedObjectContent["charts"];
  galleries: PreparedObjectContent["galleries"];
  resources: PreparedObjectContent["resources"];
  provenance: ObjectContentSource["provenance"];
  destinations?: { searchLabel: string; description: string };
}

export interface PreparedTitle {
  label: string;
  src: string;
  width: number;
  height: number;
}

export interface ObjectTitle {
  label: string;
}

export interface Chart {
  id: string;
  title: Pick<PreparedTitle, "label">;
  open?: boolean;
  src: string;
  width: number;
  height: number;
  alt: string;
}

export interface GalleryItem {
  id: string;
  label: string;
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
  sourceUrl: string;
}

export interface Gallery {
  id: string;
  hidden?: boolean;
  title: PreparedTitle;
  open?: boolean;
  qualification?: string;
  items: GalleryItem[];
}

export interface PreparedPanelContent {
  objectId: string;
  title: ObjectTitle;
  facts: Fact[];
  moreFacts: Fact[];
  charts: Chart[];
  galleries: Gallery[];
  destinations?: { searchLabel: string; description: string };
  features?: { searchLabel: string; description: string };
}

const object = (value: unknown, label: string): Record<string, unknown> => {
  if (!isRecord(value)) throw new TypeError(`Prepared ${label} must be an object.`);
  return value;
};
const text = (value: unknown, label: string): string => {
  if (typeof value !== 'string') throw new TypeError(`Prepared ${label} must be text.`);
  return value;
};
const number = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`Prepared ${label} must be finite.`);
  return value;
};
const optionalText = (value: unknown, label: string) => value === undefined ? undefined : text(value, label);
const optionalBoolean = (value: unknown, label: string) => {
  if (value !== undefined && typeof value !== 'boolean') throw new TypeError(`Prepared ${label} must be boolean.`);
  return value;
};
const array = (value: unknown, label: string): readonly unknown[] => {
  if (!Array.isArray(value)) throw new TypeError(`Prepared ${label} must be an array.`);
  return value;
};
function rasterTitle(value: unknown): PreparedTitle {
  const title = object(value, 'raster title');
  return { label: text(title.label, 'title label'), src: text(title.src, 'title image'), width: number(title.width, 'title width'), height: number(title.height, 'title height') };
}
function objectTitle(value: unknown): ObjectTitle {
  const title = object(value, 'object title');
  return { label: text(title.label, 'title label') };
}
function facts(value: unknown): Fact[] {
  return array(value, 'facts').map(value => { const fact = object(value, 'fact'); return { id: text(fact.id, 'fact id'), label: text(fact.label, 'fact label'), value: text(fact.value, 'fact value') }; });
}
function chart(value: unknown): Chart {
  const chart = object(value, 'chart'), title = object(chart.title, 'chart title');
  return { id: text(chart.id, 'chart id'), title: { label: text(title.label, 'chart title') }, open: optionalBoolean(chart.open, 'chart open'), src: text(chart.src, 'chart image'),
    width: number(chart.width, 'chart width'), height: number(chart.height, 'chart height'), alt: text(chart.alt, 'chart description') };
}
function gallery(value: unknown): Gallery {
  const gallery = object(value, 'gallery');
  return { id: text(gallery.id, 'gallery id'), title: rasterTitle(gallery.title), open: optionalBoolean(gallery.open, 'gallery open'), hidden: optionalBoolean(gallery.hidden, 'gallery hidden'),
    qualification: optionalText(gallery.qualification, 'gallery qualification'), items: array(gallery.items, 'gallery images').map(value => {
      const item = object(value, 'gallery image');
      return { id: text(item.id, 'image id'), label: text(item.label, 'image label'), src: text(item.src, 'image URL'), width: number(item.width, 'image width'), height: number(item.height, 'image height'),
        alt: text(item.alt, 'image alt'), caption: text(item.caption, 'image caption'), sourceUrl: text(item.sourceUrl, 'image source') };
    }) };
}
/** Validate the fields the shared Astro panel renders, before assigning display types. */
export function parsePreparedPanelContent(value: unknown): PreparedPanelContent {
  const content = object(value, 'panel content');
  if (content.schema !== PREPARED_CONTENT_SCHEMA) throw new TypeError('Prepared panel content schema is incompatible.');
  const destinations = content.destinations === undefined ? undefined : object(content.destinations, 'destinations');
  const features = content.features === undefined ? undefined : object(content.features, 'features');
  return { objectId: text(content.objectId, 'object id'), title: objectTitle(content.title),
    facts: facts(content.facts), moreFacts: facts(content.moreFacts), charts: array(content.charts, 'charts').map(chart), galleries: array(content.galleries, 'galleries').map(gallery),
    destinations: destinations ? { searchLabel: text(destinations.searchLabel, 'destination search label'), description: text(destinations.description, 'destination description') } : undefined,
    features: features ? { searchLabel: text(features.searchLabel, 'feature search label'), description: text(features.description, 'feature description') } : undefined };
}
