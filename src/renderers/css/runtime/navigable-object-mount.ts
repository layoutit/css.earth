import { parseObjectDescriptor } from '@cssearth/objects';
import { loadPreparedCssObject } from '../loader.js';
import type { PreparedCssTransport } from '../loader.js';
import { parsePreparedWorldCameraFrame } from '../validation/world-frame.js';
import { createDeferredObjectMount } from './deferred-object-mount.js';
import type { ObjectSceneLifecycle } from './deferred-object-mount.js';
import type { ObjectRuntimeDefinition, ObjectMountOptions } from './object-runtime-types.js';
import { prepareObjectResources } from './prepared-resource-lease.js';

type Bind = (definition: ObjectRuntimeDefinition) => (stage: HTMLElement, options: ObjectMountOptions) => ObjectSceneLifecycle;

/** One decoded definition feeds preflight and the eventual single scene mount. */
export function createNavigableObjectMount(input: unknown, transport: PreparedCssTransport, bind: Bind) {
  const descriptor = parseObjectDescriptor(input);
  const frame = parsePreparedWorldCameraFrame(descriptor.properties.worldFrame);
  let loading: Promise<ObjectRuntimeDefinition> | null = null;
  function load() {
    if (!loading) {
      const request = loadPreparedCssObject(descriptor, transport);
      loading = request;
      request.catch(() => { if (loading === request) loading = null; });
    }
    return loading;
  }
  const mount = createDeferredObjectMount(load, definition => (stage: HTMLElement, options: ObjectMountOptions) =>
    bind(definition)(stage, { ...options, ...(frame ? { worldFrame: frame } : {}) }));
  const navigation = frame ? Object.freeze({ frame,
    async prepare({ signal }: { signal: AbortSignal }) {
      const definition = await abortable(load(), signal);
      const resources = prepareObjectResources(definition.assets, { signal });
      try { await resources.ready; return Object.freeze({ frame, definition, resources }); }
      catch (error) { resources.destroy(); throw error; }
    },
  }) : null;
  return Object.assign(mount, { navigation });
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('Navigation was cancelled.', 'AbortError'));
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    promise.then(value => { signal.removeEventListener('abort', abort); resolve(value); },
      error => { signal.removeEventListener('abort', abort); reject(error); });
  });
}
