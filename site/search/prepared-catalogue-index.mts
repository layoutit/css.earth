import { designationNames } from './object-search.mts';
import { distanceDescription } from '@cssearth/objects';
import { objectTypeLabel, SEARCH_OBJECTS } from './search-objects.mts';
import { sidebarThumbnail } from '../sidebar-thumbnails.mts';
import { PREPARED_NAVIGATION_MARKERS } from '../prepared-navigation-markers.mjs';
import { markerStyle } from '@cssearth/renderer/navigation/marker-presentation.ts';
import { sourceDocumentation, systemSourceDocumentation } from '../source-documentation.mts';
import { allPlanetarySystems } from '../object-systems.mts';
import { SCENE_OBJECTS, requireObject } from '../objects.mts';
import type { CatalogueIndex, CatalogueIndexEntry } from './catalogue-index.mts';
import { listDistance } from './list-distance.mts';
import { systemObjectId } from '@cssearth/objects';
import { allSatelliteSystems } from '../satellite-systems.mts';

/** A row's sprite is drawn at this share of its prepared size: the largest marker is 14 px. */
const THUMBNAIL_SCALE = 14 / Math.max(...Object.values(PREPARED_NAVIGATION_MARKERS).map(({ presentation }) => presentation.size));
/** A result row shows an object by its marker: its prepared search thumbnail when it has a context sprite (`preview`),
 * else its sprite of the marker sheet, as the styles the row writes. The row carries them, so a page holds no table of
 * every object's marker (site/prepared-navigation-markers.mjs was 820 KB of every page's code, 2026-10-02). */
export function objectResultMarker(object: { readonly id: string; readonly color: string }) {
  const prepared = PREPARED_NAVIGATION_MARKERS[object.id];
  if (!prepared) return Object.freeze({ id: object.id, color: object.color });
  if (prepared.context) return Object.freeze({ id: object.id, color: object.color, preview: true as const });
  const { style, innerStyle, ringed, ringStyle } = markerStyle(prepared, { color: object.color, scale: THUMBNAIL_SCALE });
  return Object.freeze({ id: object.id, color: object.color,
    sprite: Object.freeze({ style, innerStyle, ...(ringed ? { ringStyle } : {}) }) });
}

/** Every object search can list. The build writes it once (`pages/catalogue/index.json.ts`); the find function reads
 * that file, matches and orders it, and a browser receives only the rows it shows. */
export function preparedCatalogueIndex(): CatalogueIndex {
  return Object.freeze({
    schema: 'cssearth-catalogue-index@1',
    // A system's row is its own object's, built from its system (systemEntries below).
    entries: Object.freeze([...SEARCH_OBJECTS.filter(object => !object.system).map((object): CatalogueIndexEntry => {
      const title = distanceDescription(object.distance);
      const source = sourceDocumentation(object.id, object.name);
      const { value, unit } = listDistance(object.distance);
      return Object.freeze({
        id: object.id,
        name: object.name,
        searchNames: Object.freeze([...new Set([...designationNames(object.id, object.name), ...(object.searchNames ?? []).map(name => name.toLocaleLowerCase('en'))])]),
        classification: object.classification,
        classificationName: objectTypeLabel(object).toLocaleLowerCase('en'),
        systemName: object.systemName.toLocaleLowerCase('en'),
        route: object.route,
        illustration: object.discovery.illustration,
        distanceMeters: object.distance.meters,
        // A search row always states the distance; what kind of model draws it is the object page's business.
        detail: Object.freeze({ text: `${value} ${unit}`, value, unit,
          title, ariaLabel: `${value} ${unit}. ${title}` }),
        source: Object.freeze({ subject: `object:${object.id}`, document: source.href, label: source.label }),
        marker: objectResultMarker(object),
      });
    }), ...systemEntries()]),
  });
}

/** One row per system, leading to its own address: a star's planetary system or a planet's moons. search finds a system by name ("trappist" lists the TRAPPIST-1
 * system) and "planetary systems" lists them all, from the server, instead of a hidden row per system in every page. */
function systemEntries(): CatalogueIndexEntry[] {
  return [...allPlanetarySystems(SCENE_OBJECTS).map(system => {
    const star = SCENE_OBJECTS.find(object => object.id === system.id)!, source = systemSourceDocumentation(system);
    const title = distanceDescription(star.distance), { value, unit } = listDistance(star.distance);
    return Object.freeze({
      id: systemObjectId(system.id),
      name: system.name,
      searchNames: Object.freeze([]),
      // A star with planets is a planetary system; a star with only the stars bound to it, a star system.
      classification: requireObject(systemObjectId(system.id)).classification,
      classificationName: requireObject(systemObjectId(system.id)).classification.replaceAll('-', ' '),
      systemName: system.name.toLocaleLowerCase('en'),
      route: `/${systemObjectId(system.id)}/`,
      illustration: false,
      candidate: false,
      distanceMeters: star.distance.meters,
      detail: Object.freeze({ text: `${value} ${unit}`, value, unit, title, ariaLabel: `${value} ${unit}. ${title}` }),
      source: Object.freeze({ subject: `object:${systemObjectId(system.id)}`, document: source.href, label: source.label }),
      marker: objectResultMarker(star),
    });
  }), ...allSatelliteSystems().map(system => {
    // A planet's moons are a system too, an object with its own address: search finds "Jupiter system" as it finds a star's.
    const host = SCENE_OBJECTS.find(object => object.id === system.hostId)!, source = systemSourceDocumentation({ id: system.hostId, name: system.name, memberIds: system.memberIds });
    const title = distanceDescription(host.distance), { value, unit } = listDistance(host.distance);
    return Object.freeze({
      id: systemObjectId(system.hostId),
      name: system.name,
      searchNames: Object.freeze([]),
      classification: 'satellite-system',
      classificationName: 'moon system',
      systemName: host.systemName.toLocaleLowerCase('en'),
      route: `/${systemObjectId(system.hostId)}/`,
      illustration: false,
      candidate: false,
      distanceMeters: host.distance.meters,
      detail: Object.freeze({ text: `${value} ${unit}`, value, unit, title, ariaLabel: `${value} ${unit}. ${title}` }),
      source: Object.freeze({ subject: `object:${systemObjectId(system.hostId)}`, document: source.href, label: source.label }),
      marker: objectResultMarker(host),
    });
  })];
}

export const PREPARED_CATALOGUE_INDEX = preparedCatalogueIndex();
export const PREPARED_CATALOGUE_INDEX_TEXT = `${JSON.stringify(PREPARED_CATALOGUE_INDEX)}\n`;
