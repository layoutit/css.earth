/** Complete content-fixture admission; production readers stay browser-safe. */
import { parse, object, array, dictionary, union, optional, literal, number, string, boolean, json } from '@cssearth/core/schema';
import { OBJECT_CONTENT_SCHEMA, OBJECT_CONTENT_VERSION, type ObjectContentSource } from '../../prepared-data/content/object-content.js';

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
