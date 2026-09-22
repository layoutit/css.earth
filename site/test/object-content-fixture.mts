import type { ObjectContentSource, TitleSource } from '../../tools/objects/content/types.ts';
import { parse, object, array, dictionary, union, optional, literal, number, string, boolean, json } from '../../tools/objects/material-composition/data-schema.mts';

const title = object({ label: string, viewBox: string, path: string, source: string, sourceUrl: string,
  xOrigin: string, sourceGenerator: string, width: number, height: number,
  weight: number, opticalSize: number, fontSize: number, letterSpacing: number, baseline: number });
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
  schema: literal('cssearth-object-content@1'), version: literal(1), id: string, displayName: string, title,
  panel: object({facts: array(fact), moreFacts: optional(array(fact)), schema: optional(string), planetId: optional(string), sources: optional(json)}),
  lenses: object({titleKey: literal('lenses'), defaultLens: string, labels: optional(dictionary(string)),
    controls: array(object({id: string, label: string, thumbnail: string, shortLabel: optional(string), filter: optional(string),
      qualification: optional(string), surface: optional(string), poles: optional(string), material: optional(string),
      legendNote: optional(string), falseColor: optional(boolean), view: optional(literal('exterior', 'interior')),
      notes: optional(string), noData: optional(boolean), legend: optional(legend), facts: optional(array(fact)), source,
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

// Preserve the original values and extra source metadata after validation;
// preparation and tampering tests must observe the actual fixture bytes.
export function parseObjectContentFixture(value: unknown): ObjectContentSource {
  return parse(value, content, 'object content fixture');
}
export function parseTitleFixture(value: unknown): TitleSource {
  return parse(value, title, 'object title fixture');
}
