import { isRecord } from '@cssearth/core';
import type { NavigationDistance } from './navigation-distance.js';
import type { ObjectClassification, ObjectDefinitionInput, ObjectEntry, ObjectWorldFrame } from './object-schema.js';
import type { ObjectDiscovery } from './object-discovery.js';
import { normalizeDestinationQuery } from './destination-search.js';
import type { OverviewHolding, OverviewObject, OverviewZoom } from './overview-object.js';

/**
 * An object of the one registry. Every object has an identity and a page; what else it has is what its package declares:
 * a place in the world (its catalogue block and world frame), a scene of its own (`loadScene`), a level of the zoom ladder
 * (`zoom`). A planet is placed and has a scene; a galaxy package is placed and is drawn by the world's host; the Local Group
 * is placed and is a level; the observable universe is a level only. There is no kind: code asks for the capability it needs.
 */
export interface NavigableObject<Scene = unknown, Signal = unknown> {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly route: string;
  /** Placed: as the package's catalogue block and world frame declare them. */
  readonly classification?: ObjectClassification;
  readonly classificationLabel?: string;
  readonly systemName?: string;
  readonly color?: string;
  readonly distance?: NavigationDistance;
  readonly worldFrame?: ObjectWorldFrame;
  readonly discovery?: Readonly<ObjectDiscovery>;
  readonly aliases?: readonly string[];
  /** The names an object with alternate names is found by: its id, its name and each alias. */
  readonly searchNames?: readonly string[];
  /** A scene of its own; without one the object is drawn by `sceneHostId`'s scene. */
  readonly loadScene?: ObjectDefinitionInput<Scene, Signal>['loadScene'];
  readonly sceneHostId?: string;
  /** A level of the zoom ladder (overview-object.ts). */
  readonly order?: number;
  readonly zoom?: OverviewZoom;
  readonly holds?: readonly OverviewHolding[];
  readonly packages?: readonly string[];
  readonly originM?: readonly [number, number, number];
}

/** The fields an object with a place in the world carries. */
export interface PlacedObject {
  readonly id: string;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly searchNames: readonly string[];
  readonly classification: ObjectClassification;
  readonly classificationLabel?: string;
  readonly systemName: string;
  readonly route: string;
  readonly sceneHostId: string;
  readonly distance: NavigationDistance;
  readonly color: string;
  readonly description: string;
  readonly worldFrame: ObjectWorldFrame;
  readonly discovery: Readonly<ObjectDiscovery>;
}
/** The object mounts a scene of its own. */
export const isSceneObject = <Scene, Signal>(object: NavigableObject<Scene, Signal>): object is ObjectEntry<Scene, Signal> => typeof object.loadScene === 'function';
/** The object is a level of the zoom ladder. */
export const isOverviewObject = (object: NavigableObject<never, never> | NavigableObject): object is OverviewObject => (object as NavigableObject).zoom !== undefined;
/** The object has a place in the world: the world context draws, names and selects it. */
export const isPlacedObject = <Scene, Signal>(object: NavigableObject<Scene, Signal>): object is NavigableObject<Scene, Signal> & PlacedFields => object.worldFrame !== undefined;
export type PlacedFields = Pick<PlacedObject, 'classification' | 'systemName' | 'color' | 'distance' | 'worldFrame' | 'discovery'>;
/** The names an object without a scene is found by: its id, name and aliases, normalised, with and without spaces. */
export const destinationSearchNames = (names: readonly string[]): string[] => [...new Set(names.flatMap(name => {
  const normalized = normalizeDestinationQuery(name);
  return [normalized, normalized.replaceAll(' ', '')];
}))];
