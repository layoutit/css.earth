/** A fixed prepared image plane; the same world-camera publication as the retained cloud. */
import type { DensityVolumeFrame } from '@cssearth/objects';
import { preparedVolumeCameraTransform } from '../../../../../../../src/renderers/css/volume/prepared-volume-runtime';
import type { VolumeCameraPublication } from '../../../../../../../src/renderers/css/volume/types';
import { worldRotationCss } from '../../../../../../../src/renderers/css/navigation/world-camera-math';
import type { DensityOverlay } from '../../features/legacy-viewer/controller';

import { mountImagePlane } from '@cssearth/volume-viewer/scene/image-plane';

export function mountReconstructionOverlay({ host, before, frame, overlay, url }: {
  host: HTMLElement; before: Node; frame: DensityVolumeFrame; overlay: DensityOverlay; url: string;
}) {
  const mounted = mountImagePlane({ host, before, style: overlay.style, url,
    classes: { root: 'css-volume-projection reconstruction-original-projection', camera: 'css-volume-camera', scene: 'css-volume-scene', mesh: 'css-volume-mesh' },
    project(publication: VolumeCameraPublication) {
      const transform = preparedVolumeCameraTransform(publication, frame, 50);
      return { focalPixels: transform.focalPixels, principalOffsetPixels: publication.viewport.principalOffsetPixels,
        transform: `translate3d(${transform.translationCssPixels.map(value => `${value}px`).join(',')}) ${worldRotationCss(transform.rotation)}` };
    },
  });
  mounted.root.dataset.reconstructionOriginal = overlay.id;
  mounted.image.dataset.reconstructionOriginalLeaf = overlay.id;
  return mounted;
}
