import { parseDistanceSubject } from '../prepared-data/spatial-relations.js';
import type { ObjectDiscovery } from './object-discovery.js';
import { parseObjectDiscovery } from './object-discovery.js';
import { isRecord } from '@cssearth/core';
import { defineObject, OBJECT_CLASSIFICATIONS } from './object-schema.js';
import type { ObjectClassification, ObjectDefinitionInput, ObjectEntry } from './object-schema.js';
import type { NavigationDistance } from './navigation-distance.js';
import { parseNavigationDistance } from './navigation-distance.js';
import { destinationSearchNames, objectSystem } from './navigable-object.js';
import { systemHostId, systemObjectId } from './system-address.js';
import type { NavigableObject } from './navigable-object.js';
import { overviewLevel } from './overview-object.js';
import type { OverviewObject } from './overview-object.js';

/** `orbitsWithinAu`: a host's authored presentation range, the camera distance up to which its system draws every orbit. */
/** `labelPlacement: 'centre'` captions the body over its middle instead of below it (Sgr A*'s black shadow). */
export interface CatalogContext { name?: string; color?: string; order?: number; orbitsWithinAu?: number; labelPlacement?: 'centre' }
/** Alternate scientific names owned by the object's package. They are not navigation labels or system membership. */
export type CatalogEntry<Scene = unknown, Signal = unknown> = ObjectEntry<Scene, Signal> & { readonly aliases: readonly string[]; order?: number; context?: CatalogContext };

function classification(value: unknown): ObjectClassification {
  if (!(OBJECT_CLASSIFICATIONS as readonly unknown[]).includes(value)) throw new TypeError(`Invalid catalogue classification: ${String(value)}.`);
  return value as ObjectClassification;
}

function order(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new TypeError('Invalid catalogue order.');
  return value;
}

function aliases(value: unknown, id: string): readonly string[] {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.some(alias => typeof alias !== 'string' || !alias.trim())) {
    throw new TypeError(`Invalid catalogue aliases: ${id}.`);
  }
  return Object.freeze([...value]);
}

/** Decode package metadata at both the build and application boundaries. */
export function catalogEntry<Scene, Signal>(input: unknown, loadScene: ObjectDefinitionInput<Scene, Signal>['loadScene'], distance: NavigationDistance, discovery?: ObjectDiscovery): CatalogEntry<Scene, Signal> {
  if (!isRecord(input) || input.schema !== 'cssearth-object@2' || typeof input.id !== 'string' || !isRecord(input.properties)) {
    throw new TypeError('Invalid catalogue descriptor.');
  }
  const catalog = input.properties.catalog;
  if (!isRecord(catalog)) throw new TypeError(`Missing catalogue entry: ${input.id}.`);
  const { name, systemName, color, distanceAu, description } = catalog;
  const keys = ['name', 'systemName', 'classification', 'classificationLabel', 'color', 'distanceAu', 'description', 'aliases', 'order', 'context', 'featured', 'illustrationDatasets', 'orientationReference', 'distanceSubject'];
  if (Object.keys(catalog).some(key => !keys.includes(key)) || typeof name !== 'string' || typeof systemName !== 'string' ||
      typeof color !== 'string' || typeof distanceAu !== 'number' || typeof description !== 'string') throw new TypeError(`Invalid catalogue metadata: ${input.id}.`);
  // Another subject's distance the package adopts (a nebula placed at its star cluster's): navigation states it.
  if (catalog.distanceSubject !== undefined) parseDistanceSubject(catalog.distanceSubject);
  if (catalog.orientationReference !== undefined && (!Number.isInteger(catalog.orientationReference) || Number(catalog.orientationReference) < 1)) throw new TypeError(`Invalid orientation reference: ${input.id}.`);
  if (catalog.featured !== undefined && typeof catalog.featured !== 'boolean' || catalog.illustrationDatasets !== undefined &&
      (!Array.isArray(catalog.illustrationDatasets) || !catalog.illustrationDatasets.every(id => typeof id === 'string' && /^[a-z][a-z0-9-]*$/u.test(id)))) throw new TypeError(`Invalid discovery metadata: ${input.id}.`);
  let context: CatalogContext | undefined;
  if (catalog.context !== undefined) {
    const value = catalog.context;
    if (!isRecord(value) || Object.keys(value).some(key => !['name', 'color', 'order', 'orbitsWithinAu', 'labelPlacement'].includes(key)) ||
        (value.name !== undefined && (typeof value.name !== 'string' || !value.name)) ||
        (value.orbitsWithinAu !== undefined && !(typeof value.orbitsWithinAu === 'number' && Number.isFinite(value.orbitsWithinAu) && value.orbitsWithinAu > 0)) ||
        (value.labelPlacement !== undefined && value.labelPlacement !== 'centre') ||
        (value.color !== undefined && (typeof value.color !== 'string' || !/^#[0-9a-f]{6}$/u.test(value.color)))) {
      throw new TypeError(`Invalid context metadata: ${input.id}.`);
    }
    context = { ...(typeof value.name === 'string' ? { name: value.name } : {}),
      ...(typeof value.color === 'string' ? { color: value.color } : {}), order: order(value.order),
      ...(typeof value.orbitsWithinAu === 'number' ? { orbitsWithinAu: value.orbitsWithinAu } : {}),
      ...(value.labelPlacement === 'centre' ? { labelPlacement: 'centre' as const } : {}) };
  }
  // Legacy catalog.distanceAu mixes orbital references and positions. It is
  // validated as authored metadata but never published as a measured distance.
  return { ...defineObject({ id: input.id, name, systemName, color, distance, description,
    classification: classification(catalog.classification),
    classificationLabel: typeof catalog.classificationLabel === 'string' ? catalog.classificationLabel : undefined, route: `/${input.id}/`,
    worldFrame: input.properties.worldFrame, discovery, loadScene }), aliases: aliases(catalog.aliases, input.id),
    order: order(catalog.order), ...(context ? { context } : {}) };
}

/** One entry of the prepared catalogue, as `prepare:catalog` writes it and `/objects/<id>/entry.json` serves it: a package's
 * descriptor with its navigation distance and discovery. What the object is comes from the descriptor alone; `loadScene`
 * binds its scene to the host's loader. The catalogue's order and context stay out of the object. */
export function catalogueObject<Scene, Signal>(value: unknown,
  loadScene: (descriptor: Record<string, unknown>) => ObjectDefinitionInput<Scene, Signal>['loadScene']): NavigableObject<Scene, Signal> {
  if (!isRecord(value) || !isRecord(value.descriptor) || !isRecord(value.descriptor.properties) || typeof value.descriptor.id !== 'string') throw new TypeError('Invalid catalogue entry.');
  const descriptor = value.descriptor, id = value.descriptor.id;
  if (value.descriptor.properties.catalog === undefined) throw new TypeError(`Invalid catalogue entry: ${id} has no catalogue entry.`);
  const ladder = overviewLevel(descriptor);
  const { order: _order, context: _context, ...entry } = catalogEntry(descriptor, loadScene(descriptor), parseNavigationDistance(value.distance), parseObjectDiscovery(value.discovery));
  const system = objectSystem(descriptor);
  const expected = system ? system.members === 'moons' ? 'satellite-system' : 'planetary-system' : null;
  if ((entry.classification === 'planetary-system' || entry.classification === 'satellite-system') !== (system !== null) || expected !== null && entry.classification !== expected) {
    throw new TypeError(`src/objects/${id}/object.json: a system object carries properties.system and the classification of its members (${expected ?? 'none'}); got classification ${entry.classification}${system ? '' : ' without properties.system'}.`);
  }
  // An id names a system exactly when its package is one, of the host the id names (system-address.ts): `/ring-system/`
  // would otherwise read as the system of `ring`, and a system named otherwise would have no address.
  if (systemHostId(id) !== (system?.host ?? null)) {
    throw new TypeError(`src/objects/${id}/object.json: ${system ? `the system of ${system.host} is ${systemObjectId(system.host)}, not ${id}` : `${id} reads as the system of ${systemHostId(id)}, and only a system package (properties.system) may be named so`}.`);
  }
  const object = { ...entry, ...(ladder === null ? {} : { level: Object.freeze({ order: ladder.order, zoom: ladder.zoom, holds: ladder.holds, packages: ladder.packages }) }),
    ...(system ? { system } : {}) };
  // An object with alternate names is found by them: search matches its id, its name and each alias.
  return object.aliases.length ? { ...object, searchNames: Object.freeze(destinationSearchNames([id, object.name, ...object.aliases])) } : object;
}

/** A level of the zoom ladder as the ladder reads it, from the object that is the level. */
export function levelOf(object: NavigableObject): OverviewObject {
  if (!object.level) throw new TypeError(`${object.id} is not a level of the zoom ladder.`);
  return Object.freeze({ id: object.id, name: object.name, description: object.description, route: object.route, ...object.level,
    classification: object.classification, ...(object.classificationLabel === undefined ? {} : { classificationLabel: object.classificationLabel }),
    worldFrame: object.worldFrame });
}
