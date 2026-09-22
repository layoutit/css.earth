import { parseObjectDescriptor } from '@cssearth/objects';
import { loadPreparedCssObject } from '../loader.js';
import type { PreparedCssTransport } from '../loader.js';
import { parsePreparedWorldCameraFrame } from '../validation/world-frame.js';
import { createDeferredObjectMount } from './deferred-object-mount.js';
import type { DeferredMountOptions, ObjectSceneLifecycle } from './deferred-object-mount.js';
import type { ObjectRuntimeDefinition } from './object-runtime-types.js';
import { createPreparedObjectNavigation } from './prepared-object-navigation.js';

type Bind<Options extends DeferredMountOptions> = (definition: ObjectRuntimeDefinition) => (stage: HTMLElement, options: Options) => ObjectSceneLifecycle;

/** One decoded definition feeds preflight and the eventual single scene mount. */
export function createNavigableObjectMount<Options extends DeferredMountOptions>(input: unknown, transport: PreparedCssTransport, bind: Bind<Options>) {
  const descriptor = parseObjectDescriptor(input);
  const frame = parsePreparedWorldCameraFrame(descriptor.properties.worldFrame);
  let loading: Promise<ObjectRuntimeDefinition> | null = null;
  let loadingSignal: AbortSignal | undefined;
  function load(signal?: AbortSignal) {
    if (loadingSignal?.aborted) loading = null;
    if (!loading) {
      const request = loadPreparedCssObject(descriptor, transport, { signal });
      loading = request;
      loadingSignal = signal;
      request.then(() => { if (loading === request) loadingSignal = undefined; },
        () => { if (loading === request) { loading = null; loadingSignal = undefined; } });
    }
    return loading;
  }
  const mount = createDeferredObjectMount(load, definition => (stage: HTMLElement, options: Options) => {
    if (stage.dataset?.preparedObject && stage.dataset.preparedObject !== descriptor.id) {
      throw new TypeError('Initial view belongs to another prepared object.');
    }
    return bind(definition)(stage, { ...options, ...(frame ? { worldFrame: frame } : {}) });
  });
  const navigation = frame ? createPreparedObjectNavigation(load, frame) : null;
  return Object.assign(mount, { navigation });
}
