import { parseObjectDescriptor } from '@cssearth/objects';
import { loadPreparedCssObject } from '../loader.js';
import type { PreparedCssTransport } from '../loader.js';
import { parsePreparedWorldCameraFrame } from '../validation/world-frame.js';
import { createDeferredObjectMount } from './deferred-object-mount.js';
import type { ObjectSceneLifecycle } from './deferred-object-mount.js';
import type { ObjectRuntimeDefinition, ObjectMountOptions } from './object-runtime-types.js';
import { createPreparedObjectNavigation } from './prepared-object-navigation.js';

type Bind = (definition: ObjectRuntimeDefinition) => (stage: HTMLElement, options: ObjectMountOptions) => ObjectSceneLifecycle;

/** One decoded definition feeds preflight and the eventual single scene mount. */
export function createNavigableObjectMount(input: unknown, transport: PreparedCssTransport, bind: Bind) {
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
  const mount = createDeferredObjectMount(load, definition => (stage: HTMLElement, options: ObjectMountOptions) =>
    bind(definition)(stage, { ...options, ...(frame ? { worldFrame: frame } : {}) }));
  const navigation = frame ? createPreparedObjectNavigation(load, frame) : null;
  return Object.assign(mount, { navigation });
}
