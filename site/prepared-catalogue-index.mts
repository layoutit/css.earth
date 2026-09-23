import { distanceDescription } from './navigation-distance.mts';
import { FOCUS_SOURCE_DOCUMENTS } from './focus-catalog-data.mts';
import { isSceneObject } from './prepared-focus-object.mts';
import { objectClassificationLabel, SEARCH_OBJECTS } from './search-objects.mts';
import { sidebarThumbnail } from './sidebar-thumbnails.mts';
import { sourceDocumentation } from './source-documentation.mts';
import type { CatalogueIndex } from './catalogue-index.mts';
import { sha256 } from '../src/platform/sha256.mts';

/** Prepared search transport. Runtime filters records and materializes only the visible rows. */
export function preparedCatalogueIndex(): CatalogueIndex {
  return Object.freeze({
    schema: 'cssearth-catalogue-index@1',
    entries: Object.freeze(SEARCH_OBJECTS.map(object => {
      const title = distanceDescription(object.distance);
      if (isSceneObject(object)) {
        const source = sourceDocumentation(object.id, object.name);
        const value = String(Number(object.distance.value.toFixed(3)));
        return Object.freeze({
          kind: object.kind,
          id: object.id,
          name: object.name,
          searchNames: Object.freeze([]),
          classification: object.classification,
          classificationName: objectClassificationLabel(object.classification).toLocaleLowerCase('en'),
          systemName: object.systemName.toLocaleLowerCase('en'),
          route: object.route,
          illustration: object.discovery.illustration,
          distanceMeters: object.distance.meters,
          // A search row always states the distance; what kind of model draws it is the object page's business.
          detail: Object.freeze({ text: `${value} ${object.distance.unit}`, value, unit: object.distance.unit,
            title, ariaLabel: `${value} ${object.distance.unit}. ${title}` }),
          source: Object.freeze({ subject: `object:${object.name}`, document: source.href, label: source.label }),
          marker: Object.freeze({ kind: 'scene' as const, id: object.id, color: object.color }),
        });
      }
      const source = FOCUS_SOURCE_DOCUMENTS.get(object.id);
      if (!source) throw new Error(`Missing focus source document: ${object.id}`);
      const value = new Intl.NumberFormat('en', { maximumSignificantDigits: 4 }).format(object.distance.value);
      const detail = `${value} pc${object.distance.quantity === 'comoving' ? ' (comoving)' : ''}`;
      return Object.freeze({
        kind: object.kind,
        id: object.focusId,
        name: object.name,
        searchNames: Object.freeze(object.searchNames.map(name => name.toLocaleLowerCase('en'))),
        classification: object.classification,
        classificationName: objectClassificationLabel(object.classification).toLocaleLowerCase('en'),
        systemName: object.systemName.toLocaleLowerCase('en'),
        route: object.route,
        illustration: false,
        distanceMeters: object.distance.meters,
        detail: Object.freeze({ text: detail, title, ariaLabel: `${object.distance.value} pc. ${title}` }),
        source: Object.freeze({ subject: `focus:${object.focusId}`, document: source.href, label: source.label }),
        marker: Object.freeze({ kind: 'focus' as const, thumbnail: sidebarThumbnail(object.id)?.url2x ?? null }),
      });
    })),
  });
}

export const PREPARED_CATALOGUE_INDEX = preparedCatalogueIndex();
export const PREPARED_CATALOGUE_INDEX_TEXT = `${JSON.stringify(PREPARED_CATALOGUE_INDEX)}\n`;
export const PREPARED_CATALOGUE_INDEX_PIN = Object.freeze({
  sha256: sha256(PREPARED_CATALOGUE_INDEX_TEXT),
  bytes: new TextEncoder().encode(PREPARED_CATALOGUE_INDEX_TEXT).byteLength,
  get url() { return `/catalogue/${this.sha256}.json`; },
});
