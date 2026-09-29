import { isRecord } from '@cssearth/core';
import { parseNavigationDistance } from './navigation-distance.js';
import type { NavigationDistance } from './navigation-distance.js';
import type { ObjectEntry } from './object-schema.js';
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
}
/** Every entry of the one registry: a scene, or what a host scene draws without one (a catalogue focus, an overview). */
export type NavigableObject<Scene = unknown, Signal = unknown> = ObjectEntry<Scene, Signal> | PreparedFocusObject | OverviewObject;
export const isSceneObject = <Scene, Signal>(object: NavigableObject<Scene, Signal>): object is ObjectEntry<Scene, Signal> => object.kind === 'scene';

/** A focus reuses its host scene and camera; it has no scene loader. */
export function definePreparedFocus(input: unknown): PreparedFocusObject {
  if (!isRecord(input) || Object.keys(input).some(key => !['kind', 'id', 'focusId', 'name', 'searchNames', 'classification', 'systemName', 'route', 'sceneHostId', 'distance'].includes(key)) ||
      input.kind !== 'prepared-focus' || typeof input.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.+-]*$/u.test(input.id) || input.focusId !== input.id ||
      typeof input.sceneHostId !== 'string' || !/^[a-z][a-z0-9-]*$/u.test(input.sceneHostId) ||
      input.route !== `/${input.id}/` ||
      typeof input.name !== 'string' || !input.name || typeof input.systemName !== 'string' || !input.systemName ||
      (input.classification !== 'galaxy' && input.classification !== 'galaxy-cluster' && input.classification !== 'nebula' && input.classification !== 'globular-cluster') ||
      !Array.isArray(input.searchNames) || !input.searchNames.length || !input.searchNames.every(name => typeof name === 'string' && name)) {
    throw new TypeError(`Invalid prepared focus destination: ${isRecord(input) ? String(input.id) : typeof input}; its route must be /<id>/ and its fields complete.`);
  }
  return Object.freeze({ kind: input.kind, id: input.id, focusId: input.id, name: input.name,
    searchNames: Object.freeze([...input.searchNames]), classification: input.classification, systemName: input.systemName,
    route: input.route, sceneHostId: input.sceneHostId, distance: parseNavigationDistance(input.distance) });
}
