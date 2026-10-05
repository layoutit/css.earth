import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import { OBJECT_SCHEMA, PREPARED_OBJECT_SCHEMA, OBJECT_RUNTIME_SCHEMA, parseObjectDescriptor, requireImageRecords, PREPARED_CSS_OBJECT_FORMAT } from '@cssearth/objects';

// Pinning a prepared object to its transport: the descriptor's `prepared` pin and page reference, and the body's inventory.
// The `prepared/object.json` transport and the page data are built from the runtime when read (@cssearth/objects/node
// prepared-transport), so no copy is written here. It prepares nothing; the world-navigation and spatial-context finalization that runs
// before it on a fresh bake stays with `site/build/prepare/prepare-object-json.mts`.
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { requireRecord } from '@cssearth/core';

import { inventoryPreparedAssets, readInventory } from '@cssearth/objects/node';

import { preparePageMetadata, writePreparedText } from '../delivery/index.ts';
import { requireObjectRuntimeDefinition } from './object-runtime-contract.ts';

/** The real checkout, found by the shared workspace-marker resolver from source and `dist/`. */
const root = checkoutProjectRoot(import.meta.url);
const format = PREPARED_CSS_OBJECT_FORMAT;

export function serializeObjectJson(descriptorValue:unknown, definitionValue:unknown) {
  const descriptor=requireRecord(descriptorValue),definition=requireRecord(definitionValue);
  if (descriptor.schema !== OBJECT_SCHEMA || typeof descriptor.type !== 'string' ||
      definition.id !== descriptor.id || definition.schema !== OBJECT_RUNTIME_SCHEMA) {
    throw new TypeError('Prepared object identity does not match its descriptor.');
  }
  return JSON.stringify({ schema: PREPARED_OBJECT_SCHEMA, id: descriptor.id,
    type: descriptor.type, format, data: definition });
}

/** Transport the prepared runtime and pin descriptor and page to it. */
export async function pinPreparedObject(id: string, originalDescriptor: Record<string, unknown>, properties: Record<string, unknown>, root: string,
  target = { preparedDirectory: resolve(root, 'src/objects', id, 'prepared'), descriptorPath: resolve(root, 'src/objects', id, 'object.json') }) {
  const { preparedDirectory, descriptorPath } = target;
  await mkdir(preparedDirectory, { recursive: true });
  const definition = requireObjectRuntimeDefinition(JSON.parse(await readFile(resolve(preparedDirectory, 'runtime.json'), 'utf8')));
  // What is pinned ships: its images are records, with no custom property left from the bindings' working form.
  requireImageRecords(definition);
  const runtime: unknown = JSON.parse(await readFile(resolve(preparedDirectory, 'runtime.json'), 'utf8'));
  const originalProperties = requireRecord(originalDescriptor.properties);
  const descriptor = parseObjectDescriptor({ ...originalDescriptor, properties: { ...originalProperties, ...properties } });
  const payload = serializeObjectJson(descriptor, runtime);
  const prepared = { format, url: 'prepared/object.json' };
  const page = preparePageMetadata(id, definition);
  // Validation may normalize key order. Retain the authored document's order
  // so an unchanged prepared object does not rewrite its descriptor.
  await writePreparedText(descriptorPath, `${JSON.stringify({ ...originalDescriptor,
    properties: { ...originalProperties, ...properties,
      page: { ...requireRecord(originalProperties.page), metadata: page.reference } }, prepared }, null, 2)}\n`);
  // Nothing under prepared/ is tracked. Every baked file moves to R2 through this inventory.
  await inventoryPreparedAssets({ objectId: id, objectDirectory: resolve(preparedDirectory, '..'), preparedRoot: preparedDirectory });
  return { bytes: Buffer.byteLength(payload), ...prepared };
}

/**
 * Rewrite a body's inventory after a tool wrote under prepared/ without a full bake (facts, reader text,
 * a content refresh). Nothing under prepared/ is tracked, so the inventory is the only record of the change; the
 * bytes still have to be published. Returns whether the inventory changed.
 */
export async function refreshPreparedInventory(id: string, projectRoot = root): Promise<boolean> {
  const objectDirectory = resolve(projectRoot, 'src/objects', id);
  const before = await readInventory(id, objectDirectory);
  if (before === null) return false;
  const after = await inventoryPreparedAssets({ objectId: id, objectDirectory });
  return JSON.stringify(after) !== JSON.stringify(before);
}

/** Re-pin an already prepared object to its transport without preparing anything. */
export async function repinObjectJson(id: string, projectRoot = root) {
  const descriptorPath = resolve(projectRoot, 'src/objects', id, 'object.json');
  const originalDescriptor = requireRecord(JSON.parse(await readFile(descriptorPath, 'utf8')));
  const before = JSON.stringify(originalDescriptor.prepared);
  const pin = await pinPreparedObject(id, originalDescriptor, {}, projectRoot);
  return before !== JSON.stringify({ format: pin.format, url: pin.url });
}
