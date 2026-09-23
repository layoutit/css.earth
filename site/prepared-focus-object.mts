import { record } from './browser-types.mts';
import { parseNavigationDistance } from './navigation/navigation-distance.mts';
import type { NavigationDistance } from './navigation/navigation-distance.mts';
import type { ObjectEntry } from './object-schema.mts';

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
  /** A galaxy its catalogue has not confirmed (LVDB `confirmed_galaxy` and `confirmed_real`): searchable by name, not listed as a galaxy. */
  readonly candidate?: true;
}
export type NavigableObject = ObjectEntry | PreparedFocusObject;
export const isSceneObject = (object: NavigableObject): object is ObjectEntry => object.kind === 'scene';

/** A focus reuses its host scene and camera; it has no scene loader. */
export function definePreparedFocus(input: unknown): PreparedFocusObject {
  if (!record(input) || Object.keys(input).some(key => !['kind', 'id', 'focusId', 'name', 'searchNames', 'classification', 'systemName', 'route', 'sceneHostId', 'distance', 'candidate'].includes(key)) ||
      input.kind !== 'prepared-focus' || typeof input.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.+-]*$/u.test(input.id) || input.focusId !== input.id ||
      typeof input.sceneHostId !== 'string' || !/^[a-z][a-z0-9-]*$/u.test(input.sceneHostId) ||
      input.route !== `/${input.sceneHostId}/?focus=${encodeURIComponent(input.id)}` ||
      typeof input.name !== 'string' || !input.name || typeof input.systemName !== 'string' || !input.systemName ||
      (input.classification !== 'galaxy' && input.classification !== 'galaxy-cluster' && input.classification !== 'nebula' && input.classification !== 'globular-cluster') ||
      !Array.isArray(input.searchNames) || !input.searchNames.length || !input.searchNames.every(name => typeof name === 'string' && name) ||
      input.candidate !== undefined && (input.candidate !== true || input.classification !== 'galaxy')) {
    throw new TypeError('Invalid prepared focus destination.');
  }
  return Object.freeze({ kind: input.kind, id: input.id, focusId: input.id, name: input.name,
    searchNames: Object.freeze([...input.searchNames]), classification: input.classification, systemName: input.systemName,
    route: input.route, sceneHostId: input.sceneHostId, distance: parseNavigationDistance(input.distance), ...(input.candidate ? { candidate: true as const } : {}) });
}
