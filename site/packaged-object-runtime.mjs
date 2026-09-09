import { DIAGNOSTICS_ENABLED } from './diagnostics-policy.mjs';
import { createObjectRuntime, createNavigableObjectMount, preparedObjectCapabilities,
  createWorldContextObjectRuntime, createPreparedObjectNavigation } from '../src/renderers/css/dist/index.js';
import applicationContext from '../src/planets/sun/prepared/world-context.json' with { type: 'json' };
import * as runtimePolicy from './runtime-policy.mjs';

// The application supplies its shell nodes and authoritative input policy.
// The CSS renderer consumes prepared content; the engine supplies numeric behavior.
export function bindPackagedObject(definition, mount = createObjectRuntime(definition)) {
  return (stage, options) => mount(stage, {
    ...options,
    runtimePolicy,
    capabilities: preparedObjectCapabilities,
    inputSurface: stage.ownerDocument.querySelector('.planet-input-surface'),
    mobilePreviewElement: stage.ownerDocument.querySelector('.planet-sidebar'),
    diagnostics: DIAGNOSTICS_ENABLED,
  });
}

export function bindContextualObject(definition, context, frame = context.frame) {
  const mount = bindPackagedObject(definition, createWorldContextObjectRuntime({ definition, context, frame }));
  return Object.assign(mount, { navigation: createPreparedObjectNavigation(async () => definition, frame) });
}

export async function loadPackagedObject(descriptorInput) {
  return createNavigableObjectMount(descriptorInput, {
    async read(reference, signal) {
      // Static endpoints copy the pinned transport bytes during the build.
      // The bundler never needs to retain every scene as an eager URL asset.
      if (reference !== 'prepared/object.json' || reference !== descriptorInput.prepared?.url ||
          !/^[a-z][a-z0-9-]*$/u.test(descriptorInput.id) ||
          !/^[0-9a-f]{64}$/u.test(descriptorInput.prepared.sha256)) {
        throw new Error(`Prepared object asset is not available: ${reference}.`);
      }
      const url = `/objects/${descriptorInput.id}/${descriptorInput.prepared.sha256}.json`;
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error(`Prepared object asset request failed: ${response.status}.`);
      return response.arrayBuffer();
    },
  }, definition => descriptorInput.properties.worldFrame
    ? bindContextualObject(definition, applicationContext, descriptorInput.properties.worldFrame)
    : bindPackagedObject(definition));
}
