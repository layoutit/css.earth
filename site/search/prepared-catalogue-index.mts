import { distanceDescription } from '@cssearth/objects';
import { objectTypeLabel, SEARCH_OBJECTS } from './search-objects.mts';
import { sidebarThumbnail } from '../sidebar-thumbnails.mts';
import { PREPARED_NAVIGATION_MARKERS } from '../prepared-navigation-markers.mjs';
import { sourceDocumentation, systemSourceDocumentation } from '../source-documentation.mts';
import { allPlanetarySystems } from '../object-systems.mts';
import { SCENE_OBJECTS } from '../objects.mts';
import type { CatalogueIndex, CatalogueIndexEntry } from './catalogue-index.mts';

/** How a result row shows an object: a body by its marker. An object drawn from a bank (a galaxy, a nebula, a cluster) has no
 * marker: its bank's thumbnail stands for it, or the plain marker where the bank has no image. */
export function objectResultMarker(object: { readonly id: string; readonly color: string }) {
  return Object.freeze(Object.hasOwn(PREPARED_NAVIGATION_MARKERS, object.id) ? { kind: 'scene' as const, id: object.id, color: object.color }
    : { kind: 'thumbnail' as const, thumbnail: sidebarThumbnail(object.id)?.url2x ?? null });
}

/** Every object search can list. The build writes it once (`pages/catalogue/index.json.ts`); the find function reads
 * that file, matches and orders it, and a browser receives only the rows it shows. */
export function preparedCatalogueIndex(): CatalogueIndex {
  return Object.freeze({
    schema: 'cssearth-catalogue-index@1',
    entries: Object.freeze([...SEARCH_OBJECTS.map((object): CatalogueIndexEntry => {
      const title = distanceDescription(object.distance);
      const source = sourceDocumentation(object.id, object.name);
      const value = String(Number(object.distance.value.toFixed(3)));
      return Object.freeze({
        kind: 'scene' as const,
        id: object.id,
        name: object.name,
        searchNames: Object.freeze((object.searchNames ?? []).map(name => name.toLocaleLowerCase('en'))),
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
        marker: objectResultMarker(object),
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
