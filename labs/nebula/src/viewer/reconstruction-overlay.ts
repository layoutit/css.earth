/** A fixed prepared image plane; the same world-camera publication as the retained cloud. */
import type { DensityVolumeFrame } from '@cssearth/objects';
import { preparedVolumeCameraTransform } from '../../../../src/renderers/css/volume/prepared-volume-runtime';
import type { VolumeCameraPublication } from '../../../../src/renderers/css/volume/types';
import { worldRotationCss } from '../../../../src/renderers/css/navigation/world-camera-math';
import type { DensityOverlay } from './viewer';

export function mountReconstructionOverlay({ host, before, frame, overlay, url }: {
  host: HTMLElement; before: Node; frame: DensityVolumeFrame; overlay: DensityOverlay; url: string;
}) {
  const document = host.ownerDocument;
  const root = document.createElement('div'), camera = document.createElement('div');
  const scene = document.createElement('div'), mesh = document.createElement('div'), image = document.createElement('s');
  root.className = 'css-volume-projection reconstruction-original-projection';
  root.dataset.reconstructionOriginal = overlay.id;
  root.style.background = 'transparent'; root.style.visibility = 'hidden'; root.style.pointerEvents = 'none';
  camera.className = 'css-volume-camera'; scene.className = 'css-volume-scene'; mesh.className = 'css-volume-mesh';
  image.dataset.reconstructionOriginalLeaf = overlay.id;
  Object.assign(image.style, overlay.style);
  image.style.backgroundImage = `url(${JSON.stringify(url)})`;
  mesh.append(image); scene.append(mesh); camera.append(scene); root.append(camera); host.insertBefore(root, before);
  return {
    root,
    publish(publication: VolumeCameraPublication) {
      const transform = preparedVolumeCameraTransform(publication, frame, 50);
      camera.style.perspective = `${transform.focalPixels}px`;
      const [x, y] = publication.viewport.principalOffsetPixels;
      camera.style.perspectiveOrigin = `calc(50% + ${x}px) calc(50% + ${y}px)`;
      scene.style.transform = `translate3d(${transform.translationCssPixels.map(value => `${value}px`).join(',')}) ${worldRotationCss(transform.rotation)}`;
    },
    setVisible(enabled: boolean, opacity: number) { root.style.visibility = enabled ? 'visible' : 'hidden'; root.style.opacity = String(opacity); },
    destroy() { root.remove(); },
  };
}
