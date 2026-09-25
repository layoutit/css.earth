/** A fixed prepared image plane; the same world-camera publication as the retained cloud. */
import type { DensityVolumeFrame } from '@cssearth/objects';
import { preparedVolumeCameraTransform } from '../../../../../../../src/renderers/css/volume/prepared-volume-runtime';
import type { VolumeCameraPublication } from '../../../../../../../src/renderers/css/volume/types';
import { worldRotationCss } from '../../../../../../../src/renderers/css/navigation/world-camera-math';
import type { DensityOverlay } from '../../features/legacy-viewer/controller';
import { parseOverlayCatalogue, sameOverlayFrame } from '../../features/legacy-viewer/overlay-catalogue';
import { defaultOverlayPlacement } from '@cssearth/bake/volume';

import { mountImagePlane } from '@cssearth/volume-viewer/scene/image-plane';

/**
 * The saved result's registered original-image plane, validated against the mounted Earth frame. Any other
 * image prepared in the same lens frame (the difference map) reuses this plane's registration unchanged.
 */
export async function loadRegisteredOverlay(manifestPath: string, url: (path: string) => string,
  expected: { frame: DensityVolumeFrame; distanceUnits: number | undefined }) {
  const response = await fetch(url(manifestPath));
  if (!response.ok) throw new Error(`Original image registration is unavailable (HTTP ${response.status}).`);
  const catalogue = parseOverlayCatalogue(await response.json()), distance = expected.distanceUnits;
  if (!sameOverlayFrame(catalogue.frame, expected.frame) || catalogue.overlays.length !== 1 ||
      typeof catalogue.referenceDistanceUnits !== 'number' || typeof distance !== 'number' ||
      Math.abs(catalogue.referenceDistanceUnits - distance) > 1e-12 * distance)
    throw new TypeError('Original image does not share this reconstruction’s prepared Earth frame.');
  const overlay = catalogue.overlays[0]!;
  if (overlay.initialPlacement && JSON.stringify(overlay.initialPlacement) !== JSON.stringify(defaultOverlayPlacement()))
    throw new TypeError('Original overlay must include registration in its prepared geometry.');
  return { overlay, textureUrl: url(`${manifestPath.slice(0, manifestPath.lastIndexOf('/') + 1)}${overlay.texturePath}`) };
}

export function mountReconstructionOverlay({ host, before, frame, overlay, url, kind = 'original' }: {
  host: HTMLElement; before: Node; frame: DensityVolumeFrame; overlay: DensityOverlay; url: string; kind?: 'original' | 'difference';
}) {
  // The overlay's style sizes the plane and its background at the original's pixel size, so a lower-resolution
  // image in the same frame stretches onto exactly the same registered quad.
  const mounted = mountImagePlane({ host, before, style: overlay.style, url,
    classes: { root: `css-volume-projection reconstruction-${kind}-projection`, camera: 'css-volume-camera', scene: 'css-volume-scene', mesh: 'css-volume-mesh' },
    project(publication: VolumeCameraPublication) {
      const transform = preparedVolumeCameraTransform(publication, frame, 50);
      return { focalPixels: transform.focalPixels, principalOffsetPixels: publication.viewport.principalOffsetPixels,
        transform: `translate3d(${transform.translationCssPixels.map(value => `${value}px`).join(',')}) ${worldRotationCss(transform.rotation)}` };
    },
  });
  if (kind === 'original') { mounted.root.dataset.reconstructionOriginal = overlay.id; mounted.image.dataset.reconstructionOriginalLeaf = overlay.id; }
  else { mounted.root.dataset.reconstructionDifference = overlay.id; mounted.image.dataset.reconstructionDifferenceLeaf = overlay.id; }
  return mounted;
}
