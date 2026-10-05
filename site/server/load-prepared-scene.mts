import { loadPreparedCssObject, serializePreparedScene } from '@cssearth/renderer';
import { readPreparedObjectBytes } from './object-page-data.mts';
import { withPreparedAssetOrigin } from '../server-assets/asset-origin.mts';

export async function loadPreparedSceneMarkup(id: string) {
  const { descriptor, bytes } = await readPreparedObjectBytes(id);
  // The origin map rides the descriptor (embedded per-page, never the transport),
  // so publishing an object's assets to R2 never requires a rebake. The build resolves the markup against every hash;
  // the page embeds only those its first view reads, including the textures this markup writes.
  const definition = await loadPreparedCssObject(await withPreparedAssetOrigin(descriptor, undefined, { every: true }), {
    async read() { return Uint8Array.from(bytes).buffer; },
  });
  const { textures, ...markup } = serializePreparedScene(definition);
  // The fields the page's startup cover fits its photograph with, before the scene's code arrives (startup-cover.mts).
  const { responsiveFit, logicalBodyDiameter, defaultZoom, framingScale, projection } = definition.camera;
  const coverPlan = { responsiveFit, logicalBodyDiameter, defaultZoom, framingScale, projection };
  return { ...markup, coverPlan, descriptor: await withPreparedAssetOrigin(descriptor, undefined, { addresses: textures.map(texture => texture.address) }) };
}
