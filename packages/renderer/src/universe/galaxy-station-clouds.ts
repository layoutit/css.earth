import { worldRotationCss } from '@cssearth/engine';
import { encodeCloudPatches, readCloudPatches, type PreparedCloudPatches } from '@cssearth/objects';
import { preparedVolumeCameraTransform } from '../volume/prepared-volume-runtime.js';
import type { VolumeCameraPublication } from '../volume/types.js';

/** Fixed geometry, prepared texture and no look-direction selection. Build detached; the station owner mounts it. */
export function createGalaxyStationClouds({ document, payload, resolveResource }: {
  document: Document; payload: PreparedCloudPatches; resolveResource(file: string): string;
}) {
  payload = readCloudPatches(encodeCloudPatches(payload), `galaxy station ${payload.id}`);
  const root = document.createElement('div'), camera = document.createElement('div'), scene = document.createElement('div'), mesh = document.createElement('div');
  root.className = 'css-volume-projection'; root.dataset.galaxyStationClouds = payload.id;
  root.style.background = 'transparent';
  camera.className = 'css-volume-camera'; scene.className = 'css-volume-scene'; mesh.className = 'css-volume-mesh';
  scene.style.willChange = 'transform'; camera.append(scene); scene.append(mesh); root.append(camera);
  const address = resolveResource(payload.atlas.file), quoted = address.replace(/["\\\n\r]/gu, value => `\\${value}`);
  for (let i = 0; i < payload.count; i++) {
    const node = document.createElement('s'), o = i * 12, m = payload.matrices;
    node.dataset.stationCloudPiece = String(i);
    node.style.cssText = `width:${payload.cellPx}px;height:${payload.cellPx}px;background-image:url("${quoted}");` +
      `background-size:${payload.atlas.width}px ${payload.atlas.height}px;background-position:${-payload.cells[i * 2]!}px ${-payload.cells[i * 2 + 1]!}px;` +
      `transform:matrix3d(${m[o]},${m[o + 1]},${m[o + 2]},0,${m[o + 3]},${m[o + 4]},${m[o + 5]},0,${m[o + 6]},${m[o + 7]},${m[o + 8]},0,${m[o + 9]},${m[o + 10]},${m[o + 11]},1)`;
    mesh.append(node);
  }
  let perspective = '', origin = '', transform = '';
  return { root, count: payload.count,
    publish(publication: VolumeCameraPublication) {
      const view = preparedVolumeCameraTransform(publication, payload.frame), [x, y] = publication.viewport.principalOffsetPixels;
      const nextPerspective = `${view.focalPixels}px`, nextOrigin = `calc(50% + ${x}px) calc(50% + ${y}px)`;
      const nextTransform = `translate3d(${view.translationCssPixels.map(value => `${value}px`).join(',')}) ${worldRotationCss(view.rotation)}`;
      if (perspective !== nextPerspective) camera.style.perspective = perspective = nextPerspective;
      if (origin !== nextOrigin) camera.style.perspectiveOrigin = origin = nextOrigin;
      if (transform !== nextTransform) scene.style.transform = transform = nextTransform;
    },
    destroy() { root.remove(); },
  };
}
