/** Portable transport and mount only. The shared object runtime owns all rendering and interaction. */
import { createWorldContextObjectRuntime } from '../../../src/renderers/css/universe/world-context-runtime.ts';
import { parsePreparedObjectRuntime } from '../../../src/renderers/css/validation/index.ts';
import { parsePreparedWorldCameraFrame } from '../../../src/renderers/css/validation/world-frame.ts';
import { prepareObjectResources } from '../../../src/renderers/css/runtime/prepared-resource-lease.ts';
import { createPreparedResidency } from '../../../src/renderers/css/rendering/prepared-residency.ts';
import * as runtimePolicy from '../../../site/runtime-policy.mts';

async function start() {
  const stage = document.getElementById('stage'), status = document.getElementById('status');
  const payload = document.getElementById('prepared');
  if (!stage || !status || !payload?.textContent) throw new Error('Sphere document is incomplete');
  const data: unknown = JSON.parse(payload.textContent);
  if (!data || typeof data !== 'object' || !('definition' in data) || !('worldFrame' in data) || !('context' in data) || !('embeddedAssets' in data))
    throw new Error('Sphere payload is incomplete');
  const embedded = data.embeddedAssets;
  if (!embedded || typeof embedded !== 'object') throw new Error('Sphere has no embedded image bank');
  const images = new Map(Object.entries(embedded));
  const definition = parsePreparedObjectRuntime(data.definition);
  const worldFrame = parsePreparedWorldCameraFrame(data.worldFrame);
  if (!worldFrame) throw new Error('Sphere has no physical frame');
  const mount = createWorldContextObjectRuntime({ definition, context: data.context, frame: worldFrame });
  const onError = (error: unknown) => { status.textContent = String(error); console.error(error); };
  // Prepared /scenes identities stay intact; the resource lease supplies embedded bytes.
  const resources = prepareObjectResources(definition.assets, {
    createResources: options => createPreparedResidency({ ...options, assets: { ...options.assets,
      entries: options.assets.entries.map(entry => {
        const url: unknown = images.get(entry.url);
        if (typeof url !== 'string' || !/^data:image\/webp;base64,[A-Za-z0-9+/]+=*$/.test(url))
          throw new Error(`Missing embedded sphere image: ${entry.key}`);
        return { ...entry, url };
      }),
    } }),
  });
  try {
    await resources.ready;
    const object = mount(stage, {
      inputSurface: stage, runtimePolicy, onError, preparedResources: resources, worldFrame,
    });
    window.addEventListener('pagehide', () => object.destroy(), { once: true });
    await object.ready;
    status.textContent = '';
    object.resume();
  } finally {
    // A claimed lease belongs to the object; an unsuccessful mount releases it here.
    resources.destroy();
  }
}
start().catch(error => {
  const status = document.getElementById('status');
  if (status) status.textContent = String(error);
  console.error(error);
});
