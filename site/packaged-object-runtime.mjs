import { createObjectRuntime, createNavigableObjectMount,
  createWorldContextObjectRuntime, prepareObjectResources } from '../src/renderers/css/dist/index.js';
import applicationContext from '../src/planets/sun/prepared/world-context.json' with { type: 'json' };
import * as runtimePolicy from './runtime-policy.mjs';

// The application supplies its shell nodes and authoritative input policy.
// The CSS renderer consumes prepared content; the engine supplies numeric behavior.
export function bindPackagedObject(definition, mount = createObjectRuntime(definition)) {
  return (stage, options) => mount(stage, {
    ...options,
    runtimePolicy,
    inputSurface: stage.ownerDocument.querySelector('.planet-input-surface'),
    mobilePreviewElement: stage.ownerDocument.querySelector('.planet-sidebar'),
    diagnostics: import.meta.env?.DEV === true,
  });
}

export function bindContextualObject(definition, context, frame = context.frame) {
  const mount = bindPackagedObject(definition, createWorldContextObjectRuntime({ definition, context, frame }));
  return Object.assign(mount, { navigation: Object.freeze({ frame,
    async prepare({ signal } = {}) {
      const resources = prepareObjectResources(definition.assets, { signal });
      await resources.ready;
      return { frame, definition, resources };
    },
  }) });
}

export async function loadPackagedObject(descriptorInput) {
  return createNavigableObjectMount(descriptorInput, {
    async read(reference) {
      // Vite emits the prepared bytes as assets. The inventory is used only
      // during mount; loading the registry never requests renderer content.
      const preparedAssets = import.meta.glob('../src/planets/*/prepared/object.json', {
        query: '?url', import: 'default', eager: true,
      });
      const url = preparedAssets[`../src/planets/${descriptorInput.id}/${reference}`];
      if (typeof url !== 'string') throw new Error(`Prepared object asset is not available: ${reference}.`);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Prepared object asset request failed: ${response.status}.`);
      return response.arrayBuffer();
    },
  }, definition => bindContextualObject(definition, applicationContext, descriptorInput.properties.worldFrame));
}
