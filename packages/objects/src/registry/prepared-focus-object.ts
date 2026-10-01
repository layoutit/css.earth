import { isRecord } from '@cssearth/core';
import { parseNavigationDistance } from './navigation-distance.js';
import type { NavigationDistance } from './navigation-distance.js';
import { parseWorldFrame } from './object-schema.js';
import type { ObjectEntry, ObjectWorldFrame } from './object-schema.js';
import { parseObjectDiscovery } from './object-discovery.js';
import type { ObjectDiscovery } from './object-discovery.js';
import { normalizeDestinationQuery } from './destination-search.js';
import type { OverviewObject } from './overview-object.js';

export interface PreparedFocusObject {
  readonly kind: 'prepared-focus';
  readonly id: string;
  readonly focusId: string;
  readonly name: string;
  readonly searchNames: readonly string[];
  readonly classification: 'galaxy' | 'galaxy-cluster' | 'nebula' | 'globular-cluster';
  readonly systemName: string;
  readonly route: string;
  readonly sceneHostId: string;
  readonly distance: NavigationDistance;
  /** As the package's catalogue block and world frame declare them: the world context places and names it like any body. */
  readonly color: string;
  readonly description: string;
  readonly worldFrame: ObjectWorldFrame;
  readonly discovery: Readonly<ObjectDiscovery>;
}
/** The package types the world's host draws instead of mounting a scene of their own: image layers, a volume, catalogue points. */
export const HOSTED_OBJECT_TYPES: readonly string[] = Object.freeze(['image-layer-bank', 'volume-dataset-bank', 'catalogue-point-bank']);
export const isHostedDescriptor = (descriptor: unknown): boolean => isRecord(descriptor) && typeof descriptor.type === 'string' && HOSTED_OBJECT_TYPES.includes(descriptor.type);
/** Every entry of the one registry: a scene, or what a host scene draws without one (a catalogue focus, an overview). */
export type NavigableObject<Scene = unknown, Signal = unknown> = ObjectEntry<Scene, Signal> | PreparedFocusObject | OverviewObject;
export const isSceneObject = <Scene, Signal>(object: NavigableObject<Scene, Signal>): object is ObjectEntry<Scene, Signal> => object.kind === 'scene';

/** The names a hosted object is found by: its id, name and aliases, normalised, with and without spaces. */
export const destinationSearchNames = (names: readonly string[]): string[] => [...new Set(names.flatMap(name => {
  const normalized = normalizeDestinationQuery(name);
  return [normalized, normalized.replaceAll(' ', '')];
}))];

/** A package the world's host draws, from its own entry (its descriptor's catalogue block, world frame and discovery). It
 * reuses the host scene and camera; it has no scene loader. */
export function hostedObject(entry: Pick<ObjectEntry, 'id' | 'name' | 'systemName' | 'classification' | 'color' | 'description' | 'distance' | 'worldFrame' | 'discovery'> & { readonly aliases?: readonly string[] },
  sceneHostId: string): PreparedFocusObject {
  return definePreparedFocus({ kind: 'prepared-focus', id: entry.id, focusId: entry.id, name: entry.name,
    searchNames: destinationSearchNames([entry.id, entry.name, ...entry.aliases ?? []]), classification: entry.classification,
    systemName: entry.systemName, route: `/${entry.id}/`, sceneHostId, distance: entry.distance, color: entry.color,
    description: entry.description, worldFrame: entry.worldFrame, discovery: entry.discovery });
}

export function definePreparedFocus(input: unknown): PreparedFocusObject {
  if (!isRecord(input) || Object.keys(input).some(key => !['kind', 'id', 'focusId', 'name', 'searchNames', 'classification', 'systemName', 'route', 'sceneHostId', 'distance', 'color', 'description', 'worldFrame', 'discovery'].includes(key)) ||
      input.kind !== 'prepared-focus' || typeof input.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.+-]*$/u.test(input.id) || input.focusId !== input.id ||
      typeof input.sceneHostId !== 'string' || !/^[a-z][a-z0-9-]*$/u.test(input.sceneHostId) ||
      input.route !== `/${input.id}/` ||
      typeof input.name !== 'string' || !input.name || typeof input.systemName !== 'string' || !input.systemName ||
      typeof input.color !== 'string' || !/^#[0-9a-f]{6}$/u.test(input.color) || typeof input.description !== 'string' || !input.description || !isRecord(input.worldFrame) ||
      (input.classification !== 'galaxy' && input.classification !== 'galaxy-cluster' && input.classification !== 'nebula' && input.classification !== 'globular-cluster') ||
      !Array.isArray(input.searchNames) || !input.searchNames.length || !input.searchNames.every(name => typeof name === 'string' && name)) {
    throw new TypeError(`Invalid prepared focus destination: ${isRecord(input) ? String(input.id) : typeof input}; its route must be /<id>/ and its fields complete.`);
  }
  return Object.freeze({ kind: input.kind, id: input.id, focusId: input.id, name: input.name,
    searchNames: Object.freeze([...input.searchNames]), classification: input.classification, systemName: input.systemName,
    route: input.route, sceneHostId: input.sceneHostId, distance: parseNavigationDistance(input.distance), color: input.color,
    description: input.description, worldFrame: parseWorldFrame(input.worldFrame), discovery: parseObjectDiscovery(input.discovery) });
}
