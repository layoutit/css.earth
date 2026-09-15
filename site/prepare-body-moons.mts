import { PLANET_SEARCH_OBJECTS } from './planet-search-objects.mts';
import { isSceneObject } from './prepared-focus-object.mts';
import preparedWorld from '../src/objects/sun/prepared/world-context.json' with { type: 'json' };
import moonCatalogues from './source/moon-catalogues.json' with { type: 'json' };
import type { ObjectEntry } from './object-schema.mts';
import type { SceneSource } from './scene-sources.mts';
import { sourceArray, sourceId, sourceObject, sourceText, sourceUnique, sourceUrl } from '../src/platform/source-catalog.mts';
import { labelEligible } from '../src/renderers/css/labels/universe-label-policy.ts';

export interface MoonListEntry { id: string; name: string; object?: ObjectEntry; }

/** JPL's Name column is distinct from its provisional designation. Acquisition
 * falls back to that designation only when no proper name has been assigned. */
export function hasProperMoonName(moon: { name: string; provisionalDesignation: string | null }): boolean {
  return labelEligible({ named: moon.name !== moon.provisionalDesignation });
}

/** Read names from the source catalogue without creating scene objects or invented positions. */
export function parseMoonCatalogue(input: unknown, source: SceneSource) {
  const catalogue = sourceObject(input);
  const moons = sourceArray(catalogue.moons, value => {
    const moon = sourceObject(value);
    return { id: sourceId(moon.id), name: sourceText(moon.name) };
  });
  sourceUnique(moons.map(moon => moon.id), 'moon identities');
  const count = catalogue.count;
  if (!Number.isInteger(count) || count !== moons.length) throw new TypeError('Moon catalogue count does not match its entries.');
  return { moons, source };
}

const source: SceneSource = { label: 'JPL', role: 'moon catalogue',
  href: sourceUrl(moonCatalogues.sources.discovery.url), description: 'Planetary Satellite Discovery Circumstances' };
const catalogues: Readonly<Record<string, ReturnType<typeof parseMoonCatalogue>>> = Object.fromEntries(
  moonCatalogues.systems.map(system => [sourceId(system.id), parseMoonCatalogue(system, source)]));

export function bodyMoonCatalogueSource(objectId: string): SceneSource | undefined {
  return catalogues[objectId]?.source;
}

export function bodyMoonPositionSource(objectId: string): SceneSource | undefined {
  const missing = objectId === 'saturn' ? ' S/2009 S1 and S/2009 S2 appear only in the list because no position is available.'
    : objectId === 'uranus' ? ' S/2025 U1 appears only in the list because no usable Horizons position is available.' : '';
  return ['jupiter', 'saturn', 'uranus', 'neptune'].includes(objectId) ? {
    label: 'JPL Horizons', role: 'moon positions', href: 'https://ssd.jpl.nasa.gov/horizons/',
    description: `Moon labels use geometric positions at the scene date.${missing}`,
  } : undefined;
}

export function prepareBodyMoons(objectId: string): readonly MoonListEntry[] {
  const children = new Set(preparedWorld.bodies
    .filter(body => body.orbit?.centerBodyId === objectId).map(body => body.id));
  const available = PLANET_SEARCH_OBJECTS.filter(isSceneObject).filter(object =>
    object.classification === 'satellite' && children.has(object.id));
  const catalogue = catalogues[objectId];
  if (!catalogue) return available.map(object => ({ id: object.id, name: object.name, object }));
  const byId = new Map(available.map(object => [object.id, object]));
  const knownIds = new Set(catalogue.moons.map(moon => moon.id));
  for (const object of available) if (!knownIds.has(object.id)) throw new TypeError(`Moon catalogue is missing ${object.id}.`);
  return catalogue.moons.map(moon => ({ ...moon, object: byId.get(moon.id) }));
}
