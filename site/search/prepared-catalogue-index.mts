import { distanceDescription, isSceneObject } from '@cssearth/objects';
import { FOCUS_SOURCE_DOCUMENTS } from '../focus-catalog-data.mts';
import { objectClassificationLabel, objectTypeLabel, SEARCH_OBJECTS } from './search-objects.mts';
import { sidebarThumbnail } from '../sidebar-thumbnails.mts';
import { sourceDocumentation, systemSourceDocumentation } from '../source-documentation.mts';
import { allPlanetarySystems } from '../object-systems.mts';
import { SCENE_OBJECTS } from '../objects.mts';
import type { CatalogueIndex, CatalogueIndexEntry } from './catalogue-index.mts';

/** Every object search can list. The build writes it once (`pages/catalogue/index.json.ts`); the find function reads
 * that file, matches and orders it, and a browser receives only the rows it shows. */
export function preparedCatalogueIndex(): CatalogueIndex {
  return Object.freeze({
    schema: 'cssearth-catalogue-index@1',
    entries: Object.freeze([...SEARCH_OBJECTS.map((object): CatalogueIndexEntry => {
      const title = distanceDescription(object.distance);
      if (isSceneObject(object)) {
        const source = sourceDocumentation(object.id, object.name);
        const value = String(Number(object.distance.value.toFixed(3)));
        return Object.freeze({
          kind: 'scene' as const,
          id: object.id,
          name: object.name,
          searchNames: Object.freeze([]),
          classification: object.classification,
          classificationName: objectTypeLabel(object).toLocaleLowerCase('en'),
          systemName: object.systemName.toLocaleLowerCase('en'),
          route: object.route,
          illustration: object.discovery.illustration,
          distanceMeters: object.distance.meters,
          // A search row always states the distance; what kind of model draws it is the object page's business.
          detail: Object.freeze({ text: `${value} ${object.distance.unit}`, value, unit: object.distance.unit,
            title, ariaLabel: `${value} ${object.distance.unit}. ${title}` }),
          source: Object.freeze({ subject: `object:${object.id}`, document: source.href, label: source.label }),
          marker: Object.freeze({ kind: 'scene' as const, id: object.id, color: object.color }),
        });
      }
      const source = FOCUS_SOURCE_DOCUMENTS.get(object.id);
      if (!source) throw new Error(`Missing focus source document: ${object.id}`);
      const value = new Intl.NumberFormat('en', { maximumSignificantDigits: 4 }).format(object.distance.value);
      const detail = `${value} pc${object.distance.quantity === 'comoving' ? ' (comoving)' : ''}`;
      return Object.freeze({
        kind: 'prepared-focus' as const,
        id: object.id,
        name: object.name,
        searchNames: Object.freeze((object.searchNames ?? []).map(name => name.toLocaleLowerCase('en'))),
        classification: object.classification,
        classificationName: objectClassificationLabel(object.classification).toLocaleLowerCase('en'),
        systemName: object.systemName.toLocaleLowerCase('en'),
        route: object.route,
        illustration: false,
        distanceMeters: object.distance.meters,
        detail: Object.freeze({ text: detail, title, ariaLabel: `${object.distance.value} pc. ${title}` }),
        source: Object.freeze({ subject: `focus:${object.id}`, document: source.href, label: source.label }),
        marker: Object.freeze({ kind: 'focus' as const, thumbnail: sidebarThumbnail(object.id)?.url2x ?? null }),
      });
    }), ...systemEntries()]),
  });
}

/** One row per planetary system, leading to its overview: search finds a system by name ("trappist" lists the TRAPPIST-1
 * system) and "planetary systems" lists them all, from the server, instead of a hidden row per system in every page. */
function systemEntries(): CatalogueIndexEntry[] {
  return allPlanetarySystems(SCENE_OBJECTS).map(system => {
    const star = SCENE_OBJECTS.find(object => object.id === system.id)!, source = systemSourceDocumentation(system);
    const title = distanceDescription(star.distance), value = String(Number(star.distance.value.toFixed(3)));
    return Object.freeze({
      kind: 'system' as const,
      id: system.id,
      name: system.name,
      searchNames: Object.freeze([]),
      classification: 'planetary-system',
      classificationName: 'planetary system',
      systemName: system.name.toLocaleLowerCase('en'),
      route: `${system.route}?overview=system`,
      illustration: false,
      candidate: false,
      distanceMeters: star.distance.meters,
      detail: Object.freeze({ text: `${value} ${star.distance.unit}`, value, unit: star.distance.unit, title, ariaLabel: `${value} ${star.distance.unit}. ${title}` }),
      source: Object.freeze({ subject: `overview:system:${system.id}`, document: source.href, label: source.label }),
      marker: Object.freeze({ kind: 'scene' as const, id: star.id, color: star.color }),
    });
  });
}

export const PREPARED_CATALOGUE_INDEX = preparedCatalogueIndex();
export const PREPARED_CATALOGUE_INDEX_TEXT = `${JSON.stringify(PREPARED_CATALOGUE_INDEX)}\n`;
