import type { ObjectDiscovery } from './object-discovery.mts';
import { record } from './browser-types.mts';
import { defineObject } from './object-schema.mts';
import type { ObjectClassification, ObjectDefinitionInput, ObjectEntry } from './object-schema.mts';
import type { NavigationDistance } from './navigation-distance.mts';

export interface CatalogContext { name?: string; color?: string; order?: number; }
export type CatalogEntry = ObjectEntry & { order?: number; context?: CatalogContext };

function classification(value: unknown): ObjectClassification {
  switch (value) {
    case 'star': case 'planet': case 'satellite': case 'dwarf-planet':
    case 'asteroid': case 'comet': case 'trans-neptunian': case 'interstellar': return value;
    default: throw new TypeError('Invalid catalogue classification.');
  }
}

function order(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new TypeError('Invalid catalogue order.');
  return value;
}

/** Decode package metadata at both the build and application boundaries. */
export function catalogEntry(input: unknown, loadScene: ObjectDefinitionInput['loadScene'], distance: NavigationDistance, discovery?: ObjectDiscovery): CatalogEntry {
  if (!record(input) || input.schema !== 'cssearth-object@1' || typeof input.id !== 'string' || !record(input.properties)) {
    throw new TypeError('Invalid catalogue descriptor.');
  }
  const catalog = input.properties.catalog;
  if (!record(catalog)) throw new TypeError(`Missing catalogue entry: ${input.id}.`);
  const { name, systemName, color, distanceAu, description } = catalog;
  const keys = ['name', 'systemName', 'classification', 'color', 'distanceAu', 'description', 'order', 'context', 'featured', 'illustrationLenses', 'orientationReference'];
  if (Object.keys(catalog).some(key => !keys.includes(key)) || typeof name !== 'string' || typeof systemName !== 'string' ||
      typeof color !== 'string' || typeof distanceAu !== 'number' || typeof description !== 'string') throw new TypeError(`Invalid catalogue metadata: ${input.id}.`);
  if (catalog.orientationReference !== undefined && (!Number.isInteger(catalog.orientationReference) || Number(catalog.orientationReference) < 1)) throw new TypeError(`Invalid orientation reference: ${input.id}.`);
  if (catalog.featured !== undefined && typeof catalog.featured !== 'boolean' || catalog.illustrationLenses !== undefined &&
      (!Array.isArray(catalog.illustrationLenses) || !catalog.illustrationLenses.every(id => typeof id === 'string' && /^[a-z][a-z0-9-]*$/u.test(id)))) throw new TypeError(`Invalid discovery metadata: ${input.id}.`);
  let context: CatalogContext | undefined;
  if (catalog.context !== undefined) {
    const value = catalog.context;
    if (!record(value) || Object.keys(value).some(key => !['name', 'color', 'order'].includes(key)) ||
        (value.name !== undefined && (typeof value.name !== 'string' || !value.name)) ||
        (value.color !== undefined && (typeof value.color !== 'string' || !/^#[0-9a-f]{6}$/u.test(value.color)))) {
      throw new TypeError(`Invalid context metadata: ${input.id}.`);
    }
    context = { ...(typeof value.name === 'string' ? { name: value.name } : {}),
      ...(typeof value.color === 'string' ? { color: value.color } : {}), order: order(value.order) };
  }
  // Legacy catalog.distanceAu mixes orbital references and positions. It is
  // validated as authored metadata but never published as a measured distance.
  return { ...defineObject({ id: input.id, name, systemName, color, distance, description,
    classification: classification(catalog.classification), route: `/${input.id}/`,
    worldFrame: input.properties.worldFrame, discovery, loadScene }), order: order(catalog.order), ...(context ? { context } : {}) };
}
