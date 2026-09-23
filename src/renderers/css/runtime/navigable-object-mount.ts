import { parseObjectDescriptor } from '@cssearth/objects';
import { loadPreparedCssObject } from '../loader.js';
import type { PreparedCssTransport } from '../loader.js';
import { parsePreparedWorldCameraFrame } from '../validation/world-frame.js';
import type { ObjectSceneLifecycle } from './object-scene.js';
import type { ObjectRuntimeDefinition } from './object-runtime-types.js';
import { createPreparedObjectNavigation } from './prepared-object-navigation.js';

type Bind<Options> = (definition: ObjectRuntimeDefinition) => (stage: HTMLElement, options: Options) => ObjectSceneLifecycle;

/** Loading yields a native factory, not another mounted lifecycle. Preflight and mount share its definition. */
export async function loadNavigableObject<Options>(input: unknown, transport: PreparedCssTransport, bind: Bind<Options>, signal?: AbortSignal) {
  const descriptor = parseObjectDescriptor(input);
  const frame = parsePreparedWorldCameraFrame(descriptor.properties.worldFrame);
  const definition = await loadPreparedCssObject(descriptor, transport, { signal });
  signal?.throwIfAborted();
  const mount = (stage: HTMLElement, options: Options) => {
    if (stage.dataset?.preparedObject && stage.dataset.preparedObject !== descriptor.id) {
      throw new TypeError('Initial view belongs to another prepared object.');
    }
    return bind(definition)(stage, { ...options, ...(frame ? { worldFrame: frame } : {}) });
  };
  return Object.assign(mount, { navigation: frame ? createPreparedObjectNavigation(async () => definition, frame) : null });
}
