import { type ObjectRuntimeDefinition, type PreparedWorldCameraFrame, parseObjectDescriptor } from '@cssearth/objects';

import type { SceneFactory } from '../browser/browser-types.mts';
import { requiredElement } from '../browser/browser-types.mts';

import { DIAGNOSTICS_ENABLED } from '../browser/diagnostics-policy.mts';
import { loadNavigableObject, preparedObjectCapabilities,
  createWorldContextObjectRuntime } from '@cssearth/renderer';
import { APPLICATION_WORLD_CAMERA } from '../world/world-camera.mts';
import * as runtimePolicy from '../browser/runtime-policy.mts';
import { startupFetch } from '../directory/startup-requests.mts';
/** Started at boot (`startup-boot.mts`), so the decoding worker's script loads beside the first object's bytes. */
export { prestartPreparedObjectDecoding as prestartObjectDecoding } from '@cssearth/renderer';
import { preparedObjectUrl } from '../prepared/prepared-object-path.mts';
import { insideViewDescriptor } from '../world/inside-view.mts';

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

// The page's own body mounts first over its server markup, so it reads the transport without the styles that markup
// already carries (`first-view-transport.mts`). Once only: any later mount builds its tree from the complete transport.
let serverMarkup = typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('.object-stage[data-prepared-object]');
function adoptsServerMarkup(id: string) {
  const stage = serverMarkup;
  if (stage?.dataset.preparedObject !== id) return false;
  serverMarkup = null;
  // A dataset response renders another selection; only the page's initial one matches the first-view transport.
  return stage.dataset.preparedDataset === undefined && stage.dataset.preparedSettings === undefined;
}

export async function loadPackagedObject(input: unknown, signal?: AbortSignal) {
  // An object seen from inside is seen around the star the zoom is centred on (inside-view.mts).
  const descriptorInput = parseObjectDescriptor(await insideViewDescriptor(input));
  return loadNavigableObject(descriptorInput, {
    async read(reference, signal) {
      // Static endpoints copy the transport bytes during the build.
      // The bundler never needs to retain every scene as an eager URL asset.
      if (descriptorInput.prepared?.url !== 'prepared/object.json' || !/^[a-z][a-z0-9-]*$/u.test(descriptorInput.id)) {
        throw new Error(`Prepared object asset is not available: ${reference}.`);
      }
      const url = reference === 'prepared/object.json' && adoptsServerMarkup(descriptorInput.id)
        ? `/objects/${descriptorInput.id}/first-view.json` : preparedObjectUrl(descriptorInput.id, reference);
      const response = await startupFetch(url, { signal });
      if (!response.ok) throw new Error(`Prepared object asset request failed: ${response.status}.`);
      return response.arrayBuffer();
    },
  }, bindPackagedObject, signal);
}
