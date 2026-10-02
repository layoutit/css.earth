import { parseObjectDescriptor, parsePreparedWorldCameraFrame, type ObjectRuntimeDefinition } from '@cssearth/objects';

import { loadPreparedCssObject } from '../loader.js';
import type { PreparedCssTransport } from '../loader.js';

import type { ObjectSceneLifecycle } from './object-scene.js';

import { createPreparedObjectNavigation } from './prepared-object-navigation.js';

type Bind<Options> = (definition: ObjectRuntimeDefinition, frame: import('@cssearth/objects').PreparedWorldCameraFrame) => (stage: HTMLElement, options: Options) => ObjectSceneLifecycle;

/** Loading yields a native factory, not another mounted lifecycle. Preflight and mount share its definition. */
export async function loadNavigableObject<Options>(input: unknown, transport: PreparedCssTransport, bind: Bind<Options>, signal?: AbortSignal) {
  const descriptor = parseObjectDescriptor(input);
  const frame = parsePreparedWorldCameraFrame(descriptor.properties.worldFrame);
  if (!frame) throw new TypeError('A navigable object requires a prepared world frame.');
  const definition = await loadPreparedCssObject(descriptor, transport, { signal });
  signal?.throwIfAborted();
  const mount = (stage: HTMLElement, options: Options) => {
    if (stage.dataset?.preparedObject && stage.dataset.preparedObject !== descriptor.id) {
      throw new TypeError('Initial view belongs to another prepared object.');
    }
    return bind(definition, frame)(stage, options);
  };
  return Object.assign(mount, { navigation: createPreparedObjectNavigation(async () => definition, frame) });
}
