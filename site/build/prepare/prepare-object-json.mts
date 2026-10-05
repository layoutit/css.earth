import { OBJECT_SCHEMA, OBJECT_RUNTIME_SCHEMA, parseObjectDescriptor, parsePreparedObjectRuntime, readObjectDescriptorRecord } from '@cssearth/objects';

// Entry script: node site/build/prepare/prepare-object-json.mts [<object-id>...] [--keep-bindings].

import {requireObjectRuntimeDefinition, pinPreparedObject} from '@cssearth/bake/contract';
import {requireRecord,hasErrorCode} from '@cssearth/core';
import type {CheckedObjectRuntimeDefinition} from '@cssearth/bake/contract';
import type {RecompiledPresentation} from '@cssearth/bake/prepared-presentation';
/** `keepBindings` re-derives the world frame and default camera over an already bound runtime and keeps its presentation
 * bindings (facing planes, depth partitions, interior fill). Facing planes are browser-measured against the solved
 * system node, so this is only safe when that solve did not move: refuse rather than publish stale geometry. */
type BindingOptions=Omit<Parameters<typeof preparePresentationBindings>[2], 'pageStyles'> & {keepBindings?: boolean};

/** `--keep-bindings` keeps browser-measured facing planes and depth partitions from before this navigation pass.
 * Those are only trustworthy if the solved system transform they were measured against did not move: prepared
 * navigation's own `{from, to}` pair (prepare-world-navigation.ts's `replaceSystemTransform`) already names the
 * bound (`from`) and freshly solved (`to`) copies. Refuse loudly instead of publishing stale geometry. */
export function refuseStaleKeptBindings(id: string, systemTransform: { readonly from: string; readonly to: string } | null): void {
  if (systemTransform && systemTransform.from !== systemTransform.to) {
    throw new TypeError(`${id}: --keep-bindings refused; the solved system transform moved (was ${systemTransform.from}, now ${
      systemTransform.to}), so the bound facing planes and depth partitions no longer match it. Re-run without --keep-bindings.`);
  }
}
import { access, readFile } from 'node:fs/promises';
import { basename, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { authoredObject } from '@cssearth/bake/sources';
import { preparePresentationBindings, withImageSizes } from '@cssearth/bake/prepared-presentation';
import { objectPageStyles } from '../../object-page-contract.mts';
import { readPreparedObjects } from '@cssearth/objects/node';

const SCENE_OBJECTS = readPreparedObjects(resolve(import.meta.dirname, '../../..')).sceneObjects;

const root = fileURLToPath(new URL('../../../', import.meta.url));

export async function writeObjectJson(id:string, definitionValue:unknown, options?:BindingOptions) {
  // A refusal names the body it stopped on: a run over hundreds of bodies otherwise leaves only the failing check.
  const finalized = await finalizeObjectJson(id, definitionValue, { projectRoot: root, objectDirectory: resolve(root, 'src/objects', id),
    preparedDirectory: resolve(root, 'src/objects', id, 'prepared'), descriptorPath: resolve(root, 'src/objects', id, 'object.json') }, options)
    .catch((error: unknown) => { throw new Error(`${id}: ${error instanceof Error ? error.message : String(error)}`, { cause: error }); });
  const { definition: _definition, ...pin } = finalized;
  return pin;
}

/** Each motion's target and first-keyframe transform: what the orientation solve reads of a definition's spins. */
export function spinStarts(definition: { readonly motion?: readonly { readonly target: number; readonly keyframes: readonly { readonly offset?: number | null; readonly transform?: unknown }[] }[] }): string {
  return JSON.stringify((definition.motion ?? []).map(motion => [motion.target, motion.keyframes.find(frame => frame.offset === 0)?.transform ?? null]));
}

/** Finalize into explicit destinations. Source/style reads still use the real project. */
export async function finalizeObjectJson(id: string, definitionValue: unknown, target: {
  projectRoot: string; objectDirectory: string; preparedDirectory: string; descriptorPath: string;
}, options?: BindingOptions) {
  let definition:RecompiledPresentation<CheckedObjectRuntimeDefinition>=requireObjectRuntimeDefinition(definitionValue);
  if (!SCENE_OBJECTS.some(object => object.id === id) || definition.id !== id || definition.schema !== OBJECT_RUNTIME_SCHEMA) {
    throw new TypeError('Prepared object identity does not match the application registry.');
  }
  const { projectRoot, objectDirectory, preparedDirectory } = target;
  const originalDescriptor = readObjectDescriptorRecord(JSON.parse(await readFile(resolve(objectDirectory, 'object.json'), 'utf8')));
  let descriptor = parseObjectDescriptor(originalDescriptor);
  if (descriptor.schema !== OBJECT_SCHEMA || descriptor.id !== id || typeof descriptor.type !== 'string') {
    throw new TypeError('Prepared object descriptor identity is invalid.');
  }
  const { prepareWorldNavigationDefinition, writeWorldNavigationArtifacts } = await import('./prepare-world-navigation.ts');
  let preparedNavigation = await prepareWorldNavigationDefinition({ objectDirectory, definition, projectRoot });
  const solvedSpins = spinStarts(definition);
  definition = requireObjectRuntimeDefinition(preparedNavigation.definition);
  if (options?.keepBindings) refuseStaleKeptBindings(id, preparedNavigation.systemTransform);
  else {
    definition = await preparePresentationBindings(definition, projectRoot, { ...options, pageStyles: objectPageStyles });
    // The solve reads each spin at its first keyframe, and the binding is what resolves the spins from the page's styles.
    // A fresh bake reaches here with none, and was solved as if the body did not spin: Mars came out 145° off, Pluto
    // 180°, Venus and Mercury 118° (2026-10-02). Solve again with the spins the binding found, and bind to that solve.
    if (spinStarts(definition) !== solvedSpins) {
      // The second solve replaces the first one's transform, so the scene on disk takes the first before it runs.
      await writeWorldNavigationArtifacts(preparedDirectory, { ...preparedNavigation, definition }, requireRecord(JSON.parse(await readFile(resolve(preparedDirectory, 'scene.json'), 'utf8'))));
      preparedNavigation = await prepareWorldNavigationDefinition({ objectDirectory, definition, projectRoot });
      definition = await preparePresentationBindings(requireObjectRuntimeDefinition(preparedNavigation.definition), projectRoot, { ...options, pageStyles: objectPageStyles });
    }
  }
  // Every image states its size, from the file the bake published (a staged scene directory holds them flat).
  definition = requireObjectRuntimeDefinition(await withImageSizes(definition, url => options?.publicDirectory ? resolve(options.publicDirectory, basename(url)) : resolve(projectRoot, 'public', url.replace(/^\//u, ''))));
  const scene:unknown = JSON.parse(await readFile(resolve(preparedDirectory, 'scene.json'), 'utf8'));
  await writeWorldNavigationArtifacts(preparedDirectory, { ...preparedNavigation, definition }, requireRecord(scene));
  descriptor = parseObjectDescriptor({ ...descriptor, properties: { ...descriptor.properties, worldFrame: preparedNavigation.frame } });
  const pin = await pinPreparedObject(id, originalDescriptor, { worldFrame: preparedNavigation.frame }, projectRoot, target);
  return { id, ...pin, definition };
}

/** Existing descriptors opt into JSON baking; planned objects get no fallback. */
export async function updateObjectJsonForPresentation(target:string|URL, presentation:unknown, controls:unknown) {
  const file = target instanceof URL ? fileURLToPath(target) : resolve(target);
  const match = file.split(sep).join('/').match(/\/src\/objects\/([a-z][a-z0-9-]*)\/runtime\/preparedPresentation\.mjs$/);
  if (!match) return null;
  const id = match[1];
  try { await access(resolve(root, 'src/objects', id, 'object.json')); }
  catch (error) { if (hasErrorCode(error,'ENOENT')) return null; throw error; }
  return writeObjectJson(id, { ...requireRecord(presentation), schema: OBJECT_RUNTIME_SCHEMA, id, controls });
}

export async function prepareObjectJson(ids?:readonly string[]|null, options?:BindingOptions) {
  const results = [];
  for (const object of SCENE_OBJECTS) {
    if (ids && !ids.includes(object.id)) continue;
    try { await access(resolve(root, 'src/objects', object.id, 'object.json')); }
    catch (error) { if (hasErrorCode(error,'ENOENT') && !ids) continue; throw error; }
    const runtimeDefinition:unknown = await authoredObject(object.id, root)
      ? parsePreparedObjectRuntime(JSON.parse(await readFile(resolve(root, 'src/objects', object.id, 'prepared/runtime.json'), 'utf8')), { parsedJson: true })
      : requireRecord(await import(pathToFileURL(resolve(root, `src/objects/${object.id}/runtime/definition.mjs`)).href)).runtimeDefinition;
    results.push(await writeObjectJson(object.id, runtimeDefinition, options));
  }
  if (ids && results.length !== new Set(ids).size) throw new TypeError('A requested object has no registered JSON descriptor.');
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  // --keep-bindings: a default camera or world frame change, which needs no browser or image work.
  const args = process.argv.slice(2), ids = args.filter(arg => arg !== '--keep-bindings');
  for (const result of await prepareObjectJson(ids.length ? ids : null, { keepBindings: args.includes('--keep-bindings') })) console.log(JSON.stringify(result));
}
