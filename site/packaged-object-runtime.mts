import type { ObjectRuntimeDefinition } from '../src/renderers/css/runtime/object-runtime-types.js';
import type { PreparedWorldCameraFrame } from '../src/renderers/css/navigation/world-camera.js';
import type { SceneFactory } from './browser-types.mts';
import { requiredElement } from './browser-types.mts';
import { parseObjectDescriptor } from '@cssearth/objects';
import { DIAGNOSTICS_ENABLED } from './diagnostics-policy.mts';
import { loadNavigableObject, preparedObjectCapabilities,
  createWorldContextObjectRuntime } from '../src/renderers/css/dist/index.js';
import { APPLICATION_WORLD_CAMERA } from './world-camera.mts';
import * as runtimePolicy from './runtime-policy.mts';

// The application supplies its shell nodes and authoritative input policy.
// The CSS renderer consumes prepared content; the engine supplies numeric behavior.
export function bindPackagedObject(definition: ObjectRuntimeDefinition, frame: PreparedWorldCameraFrame): SceneFactory {
  const mount = createWorldContextObjectRuntime({ definition, context: APPLICATION_WORLD_CAMERA, frame });
  return (stage, options) => mount(stage, {
    ...options,
    runtimePolicy,
    capabilities: preparedObjectCapabilities,
    inputSurface: requiredElement(stage.ownerDocument, '.object-input-surface'),
    diagnostics: DIAGNOSTICS_ENABLED,
  });
}

export async function loadPackagedObject(input: unknown, signal?: AbortSignal) {
  const descriptorInput = parseObjectDescriptor(input);
  return loadNavigableObject(descriptorInput, {
    async read(reference, signal) {
      // Static endpoints copy the transport bytes during the build.
      // The bundler never needs to retain every scene as an eager URL asset.
      if (reference !== 'prepared/object.json' || reference !== descriptorInput.prepared?.url ||
          !/^[a-z][a-z0-9-]*$/u.test(descriptorInput.id)) {
        throw new Error(`Prepared object asset is not available: ${reference}.`);
      }
      const url = `/objects/${descriptorInput.id}/object.json`;
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error(`Prepared object asset request failed: ${response.status}.`);
      return response.arrayBuffer();
    },
  }, bindPackagedObject, signal);
}
