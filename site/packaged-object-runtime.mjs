import { createObjectRuntime, createDeferredObjectMount, loadPreparedCssObject } from '../src/renderers/css/dist/index.js';
import * as runtimePolicy from './runtime-policy.mjs';

// The application supplies its shell nodes and authoritative input policy.
// The CSS renderer consumes prepared content; the engine supplies numeric behavior.
export function bindPackagedObject(definition) {
  const mount = createObjectRuntime(definition);
  return (stage, options) => mount(stage, {
    ...options,
    runtimePolicy,
    inputSurface: stage.ownerDocument.querySelector('.planet-input-surface'),
    mobilePreviewElement: stage.ownerDocument.querySelector('.planet-sidebar'),
    diagnostics: import.meta.env?.DEV === true,
  });
}

export async function loadPackagedObject(descriptorInput) {
  return createDeferredObjectMount(() => loadPreparedCssObject(descriptorInput, {
    async read(reference) {
      // Vite emits the prepared bytes as assets. The inventory is used only
      // during mount; loading the registry never requests renderer content.
      const preparedAssets = import.meta.glob('../objects/prepared/*.json', {
        query: '?url', import: 'default', eager: true,
      });
      const url = preparedAssets[`../objects/${reference}`];
      if (typeof url !== 'string') throw new Error(`Prepared object asset is not available: ${reference}.`);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Prepared object asset request failed: ${response.status}.`);
      return response.arrayBuffer();
    },
  }), bindPackagedObject);
}
