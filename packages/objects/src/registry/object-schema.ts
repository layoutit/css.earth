import { parseObjectDiscovery, type ObjectDiscovery } from './object-discovery.js';
import { isArray, isRecord } from '@cssearth/core';
import { parseNavigationDistance } from './navigation-distance.js';
import type { NavigationDistance } from './navigation-distance.js';

/** Metres in the reference frame. */
export type ObjectPositionM = readonly [number, number, number];
/** A prepared world frame: the numeric data a renderer's world camera places the body with. */
export interface ObjectWorldFrame {
  readonly referenceFrame: string;
  readonly epochJdTt: number;
  readonly originM: ObjectPositionM;
  /** Row-major map from CSS presentation directions to reference directions: a reflection. */
  readonly presentationToReference: readonly number[];
  readonly metersPerUnit: number;
  readonly bodyRadiusM: number;
  readonly orbitUpReference?: ObjectPositionM;
}

export type ObjectClassification = 'star' | 'planet' | 'satellite' | 'dwarf-planet' | 'asteroid' | 'comet' | 'trans-neptunian' | 'interstellar' | 'exoplanet' | 'black-hole';
/** `Scene` is what the host's loader resolves to and `Signal` how the host cancels it (an `AbortSignal`); the registry only
 * checks that a loader is bound. */
export interface ObjectDefinitionInput<Scene = unknown, Signal = unknown> {
  id: string; name: string; systemName: string; classification: ObjectClassification;
  /** What lists and cards call the body where its classification alone would mislead (a brown dwarf is placed as a star). */
  classificationLabel?: string;
  color: string; distance: NavigationDistance; route: string; description: string;
  loadScene(signal?: Signal): Promise<Scene>; worldFrame: unknown; discovery?: ObjectDiscovery;
}
export type ObjectEntry<Scene = unknown, Signal = unknown> = Readonly<Omit<ObjectDefinitionInput<Scene, Signal>, 'worldFrame' | 'discovery'> & { discovery: Readonly<ObjectDiscovery>; kind: 'scene'; worldFrame: ObjectWorldFrame }>;

const OBJECT_INPUT_KEYS = new Set([
  "id",
  "name",
  "systemName",
  "classification",
  "classificationLabel",
  "color",
  "distance",
  "route",
  "loadScene",
  "description",
  "worldFrame",
  "discovery",
]);

// Classification vocabulary, not a registry of object identities. Extend this
// list deliberately when a package introduces a new kind of body.
export const OBJECT_CLASSIFICATIONS = Object.freeze([
  "star", "planet", "satellite", "dwarf-planet", "asteroid", "trans-neptunian", "comet", "interstellar", "exoplanet", "black-hole",
]);

export function defineObject<Scene, Signal>(input: ObjectDefinitionInput<Scene, Signal>): ObjectEntry<Scene, Signal> {
  if (!input || typeof input !== "object" || isArray(input)) {
    throw new TypeError("Object definition must be an object.");
  }
  const unsupported = Object.keys(input).filter((key) =>
    !OBJECT_INPUT_KEYS.has(key));
  if (unsupported.length > 0) {
    throw new TypeError(`Unsupported object field: ${unsupported.join(", ")}.`);
  }

  const { id, name, systemName, classification, classificationLabel, color, distance, route, loadScene, description, worldFrame } = input;
  if (classificationLabel !== undefined && !/^[A-Z][a-z]*(?: [a-z]+)*$/u.test(classificationLabel)) throw new TypeError(`Invalid classification label for ${id}: ${JSON.stringify(classificationLabel)}.`);
  if (!safeId(id) || !nonEmpty(name) || !nonEmpty(systemName) || !OBJECT_CLASSIFICATIONS.includes(classification) ||
      !/^#[0-9a-f]{6}$/u.test(color ?? "") ||
      route !== `/${id}/` || typeof loadScene !== "function" ||
      !nonEmpty(description)) {
    throw new TypeError(`Invalid object definition: ${id ?? "unknown"}.`);
  }

  return Object.freeze({
    kind: 'scene',
    id,
    name,
    systemName,
    classification,
    ...(classificationLabel === undefined ? {} : { classificationLabel }),
    color,
    distance: parseNavigationDistance(distance),
    route,
    loadScene,
    description,
    worldFrame: parseWorldFrame(worldFrame),
    discovery: parseObjectDiscovery(input.discovery ?? { featured: false, imagery: false, illustration: false }),
  });
}

export function defineObjects<T extends { id: string; route: string }>(objects: readonly T[]): readonly T[] {
  if (!isArray(objects) || objects.length === 0) {
    throw new TypeError("Object registry must contain at least one object.");
  }
  const ids = new Set();
  const routes = new Set();
  for (const object of objects) {
    if (ids.has(object.id) || routes.has(object.route)) {
      throw new TypeError(`Duplicate object definition: ${object.id}.`);
    }
    ids.add(object.id);
    routes.add(object.route);
  }
  return Object.freeze([...objects]);
}

function safeId(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return /^[a-z][a-z0-9-]*$/u.test(value ?? "");
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
// Registry capability data is numeric; importing a renderer entry here would
// pull its native camera factory into every otherwise unrelated object route.
function parseWorldFrame(value: unknown): ObjectWorldFrame {
  const fields = ['referenceFrame', 'epochJdTt', 'originM', 'presentationToReference', 'metersPerUnit', 'bodyRadiusM', 'orbitUpReference'];
  const vector = (input: unknown, length: number): input is number[] => isArray(input) && input.length === length && Array.from(input).every(Number.isFinite);
  if (!isRecord(value) || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).some(key => !fields.includes(key)) ||
      !nonEmpty(value.referenceFrame) || !Number.isFinite(value.epochJdTt) || !vector(value.originM, 3) ||
      !vector(value.presentationToReference, 9) || typeof value.epochJdTt !== 'number' ||
      typeof value.metersPerUnit !== 'number' || !Number.isFinite(value.metersPerUnit) || value.metersPerUnit <= 0 ||
      typeof value.bodyRadiusM !== 'number' || !Number.isFinite(value.bodyRadiusM) || value.bodyRadiusM <= 0) throw new TypeError('Invalid prepared world frame.');
  const rotation = value.presentationToReference;
  for (let row = 0; row < 3; row++) for (let other = 0; other < 3; other++) {
    let dot = 0;
    for (let column = 0; column < 3; column++) dot += rotation[row * 3 + column] * rotation[other * 3 + column];
    if (Math.abs(dot - Number(row === other)) > 1e-9) throw new TypeError('World frame rotation must be orthonormal.');
  }
  const [a, b, c, d, e, f, g, h, i] = rotation;
  // CSS 3D space is left-handed, so the map from presentation to the reference frame reverses handedness.
  if (Math.abs(a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g) + 1) > 1e-9) {
    throw new TypeError('World frame presentation map must reverse handedness.');
  }
  if (value.orbitUpReference !== undefined && (!vector(value.orbitUpReference, 3) ||
      Math.abs(Math.hypot(...value.orbitUpReference) - 1) > 1e-9)) {
    throw new TypeError('Orbit up must be a unit vector.');
  }
  return Object.freeze({ referenceFrame: value.referenceFrame, epochJdTt: value.epochJdTt,
    originM: Object.freeze([...value.originM]) as ObjectPositionM, presentationToReference: Object.freeze([...rotation]) as readonly number[],
    metersPerUnit: value.metersPerUnit, bodyRadiusM: value.bodyRadiusM,
    ...(value.orbitUpReference === undefined ? {} : { orbitUpReference: Object.freeze([...(value.orbitUpReference as number[])]) as ObjectPositionM }) });
}
