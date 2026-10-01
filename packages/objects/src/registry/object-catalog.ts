import { parseDistanceSubject } from '@cssearth/catalog';
import type { ObjectDiscovery } from './object-discovery.js';
import { parseObjectDiscovery } from './object-discovery.js';
import { isRecord } from '@cssearth/core';
import { defineObject, OBJECT_CLASSIFICATIONS } from './object-schema.js';
import type { ObjectClassification, ObjectDefinitionInput, ObjectEntry } from './object-schema.js';
import type { NavigationDistance } from './navigation-distance.js';
import { parseNavigationDistance } from './navigation-distance.js';
import { destinationSearchNames, isHostedDescriptor, sceneDescriptorOf } from './navigable-object.js';
import type { NavigableObject } from './navigable-object.js';
import { overviewLevel } from './overview-object.js';

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
 * descriptor, with its navigation distance and discovery when it is placed and the scene that draws it when it has none of
 * its own. What the object is comes from the descriptor alone: a catalogue block places it, `properties.overview` makes it a
 * level, and a scene type gives it a scene, which `loadScene` binds to the host's loader. The catalogue's order and context
 * stay out of the object. */
export function catalogueObject<Scene, Signal>(value: unknown,
  loadScene: (descriptor: Record<string, unknown>) => ObjectDefinitionInput<Scene, Signal>['loadScene']): NavigableObject<Scene, Signal> {
  if (!isRecord(value) || !isRecord(value.descriptor) || !isRecord(value.descriptor.properties) || typeof value.descriptor.id !== 'string') throw new TypeError('Invalid catalogue entry.');
  const descriptor = value.descriptor, properties = value.descriptor.properties, id = value.descriptor.id, level = overviewLevel(descriptor);
  // A bank package has a scene of its own once its body-less scene is prepared (`properties.scene`).
  const placed = properties.catalog !== undefined, scene = placed && level === null && (!isHostedDescriptor(descriptor) || properties.scene !== undefined);
  if (!placed && level === null) throw new TypeError(`Invalid catalogue entry: ${id} has neither a catalogue entry nor an overview.`);
  if (!scene && (typeof value.sceneHostId !== 'string' || !/^[a-z][a-z0-9-]*$/u.test(value.sceneHostId))) throw new TypeError(`Invalid catalogue entry: ${id} names no scene host.`);
  const entry = placed ? catalogEntry(descriptor, scene ? loadScene(sceneDescriptorOf(descriptor)) : async () => { throw new Error(`${id} has no scene of its own.`); },
    parseNavigationDistance(value.distance), parseObjectDiscovery(value.discovery)) : null;
  // An object with alternate names is found by them: search matches its id, its name and each alias.
  const searchNames = entry?.aliases.length ? { searchNames: Object.freeze(destinationSearchNames([id, entry.name, ...entry.aliases])) } : {};
  if (entry && scene) { const { order: _order, context: _context, ...object } = entry; return { ...object, ...searchNames }; }
  const { name: levelName, description: levelDescription, ...ladder } = level ?? {};
  const name = entry?.name ?? levelName, description = entry?.description ?? levelDescription;
  if (name === undefined || description === undefined) throw new TypeError(`Invalid catalogue entry: ${id} has no name or description.`);
  return Object.freeze({ id, name, description, route: `/${id}/`, sceneHostId: value.sceneHostId as string,
    ...(entry ? { classification: entry.classification, ...(entry.classificationLabel === undefined ? {} : { classificationLabel: entry.classificationLabel }),
      systemName: entry.systemName, color: entry.color, distance: entry.distance, worldFrame: entry.worldFrame, discovery: entry.discovery,
      aliases: entry.aliases, ...searchNames } : {}),
    ...ladder });
}
