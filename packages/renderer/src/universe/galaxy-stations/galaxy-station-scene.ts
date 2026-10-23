import { validatePreparedCssSky, type PreparedCssSky, type PreparedCssVolume, type PreparedCloudPatches } from '@cssearth/objects';
import { mountPreparedCssSky } from '../../sky/prepared-sky-runtime.js';
import { createGalaxyStationClouds } from './galaxy-station-clouds.js';
import type { PreparedGalaxyStationScene } from './galaxy-stations.js';
import { writeStyle } from '../../rendering/dom/retained-write.js';

/** A complete station is decoded while detached. Sky and clouds dissolve together after they are ready. */
export async function createGalaxyStationScene({ document, sky, resources, clouds, resolveResource, imageOpacity = 1, exposureOpacity = 1 }: {
  document: Document; sky: PreparedCssSky; resources: PreparedCssVolume['resources']; clouds: PreparedCloudPatches;
  resolveResource(file: string): string; imageOpacity?: number; exposureOpacity?: number;
}): Promise<PreparedGalaxyStationScene> {
  if (!Number.isFinite(imageOpacity) || imageOpacity <= 0 || imageOpacity > 1) throw new TypeError('Station image opacity must be positive and at most one.');
  if (!Number.isFinite(exposureOpacity) || exposureOpacity <= 0 || exposureOpacity > 1) throw new TypeError('Station reference exposure must be positive and at most one.');
  validatePreparedCssSky(sky, resources);
  if (sky.referenceFrame !== clouds.frame.referenceFrame || sky.epochJdTt !== clouds.frame.epochJdTt) {
    throw new TypeError('A station sky and its clouds must share their reference frame and epoch.');
  }
  const root = document.createElement('div'), image = document.createElement('div'), before = document.createElement('i');
  Object.assign(root.style, { position: 'absolute', inset: '0', transformStyle: 'flat', background: '#000' });
  image.dataset.galaxyStationImage = '';
  Object.assign(image.style, { position: 'absolute', inset: '0', transformStyle: 'flat', background: '#000', opacity: String(imageOpacity) });
  image.append(before); root.append(image);
  const Decoder = document.defaultView?.Image;
  if (!Decoder || typeof Decoder.prototype.decode !== 'function') throw new TypeError('Station loading requires image decode readiness.');
  const addresses = [...new Set([...sky.faces.map(face => resolveResource(face.texturePath)), resolveResource(clouds.atlas.file)])];
  const handles = addresses.map(address => { const image = new Decoder(); image.src = address; return image; });
  // A failed decode keeps the preceding station intact instead of presenting an empty replacement.
  await Promise.all(handles.map(image => image.decode()));
  const background = mountPreparedCssSky({ host: image, before, payload: sky, resources, resolveResource, opacityOnly: true });
  const cloudBank = createGalaxyStationClouds({ document, payload: clouds, resolveResource });
  image.insertBefore(cloudBank.root, before); before.remove();
  return { root,
    setExposure(opacity) { writeStyle(image, 'opacity', String(Math.min(1, imageOpacity * opacity / exposureOpacity))); },
    publish(publication) { background.publish(publication.world, publication.viewport); cloudBank.publish(publication); },
    destroy() {
      background.destroy(); cloudBank.destroy(); root.remove();
      for (const image of handles) image.src = '';
      handles.length = 0;
    },
  };
}
