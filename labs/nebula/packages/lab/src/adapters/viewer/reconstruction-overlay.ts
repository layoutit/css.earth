/** A fixed prepared image plane; the same world-camera publication as the retained cloud. */
import type { DensityVolumeFrame } from '@cssearth/objects';
import { preparedVolumeCameraTransform } from '@cssearth/renderer/volume/prepared-volume-runtime.ts';
import type { VolumeCameraPublication } from '@cssearth/renderer/volume/types.ts';
import { worldRotationCss } from '@cssearth/engine';
import { parseOverlayCatalogue, sameOverlayFrame, type DensityOverlay } from '../../features/legacy-viewer/overlay-catalogue';
import { defaultOverlayPlacement } from '@cssearth/bake/volume';

import { mountImagePlane } from '@cssearth/volume-viewer/scene/image-plane';
import { prepareOverlayGeometry } from '../renderer/overlay-geometry.ts';
import { skyPlanePoint } from '../renderer/sky-plane.ts';
export { skyPlanePoint };

/**
 * The saved result's registered original-image plane, validated against the mounted Earth frame. Any other
 * image prepared in the same dataset frame (the difference map) reuses this plane's registration unchanged.
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

/** A plate dataset's photograph as the same registered original-image plane a saved reconstruction shows: its corners'
 * sight lines (from the bake's `imageLayerView`, served by the lab) placed in the mounted bank's frame. */
export async function loadPlateOverlay(object: string, picture: 'original' | 'starless' | `candidate:${string}`, url: (path: string) => string, frame: DensityVolumeFrame) {
  const candidate = picture.startsWith('candidate:') ? picture.slice('candidate:'.length) : null;
  const query = candidate ? `picture=candidate&candidate=${encodeURIComponent(candidate)}` : `picture=${picture}`;
  const response = await fetch(`/__nebula/plate-original?object=${encodeURIComponent(object)}&${query}`, { cache: 'no-store' });
  const body: unknown = await response.json();
  if (!response.ok || !body || typeof body !== 'object') throw new Error(String((body as { error?: unknown } | null)?.error ?? `The photograph is unavailable (HTTP ${response.status}).`));
  const value = body as { id: string; file: string; texturePath?: string; widthPx: number; heightPx: number; credit: string; sourcePageUrl: string; corners: number[][]; registrationNote?: string };
  if (typeof value.file !== 'string' || !Array.isArray(value.corners) || value.corners.length !== 4) throw new TypeError('Invalid plate photograph registration.');
  const geometry = prepareOverlayGeometry(value.corners.map(ray => skyPlanePoint(ray, frame)), value.widthPx, value.heightPx);
  const overlay: DensityOverlay = { id: candidate ? `${value.id}-candidate` : `${value.id}-${picture}`, label: candidate ? 'Candidate image' : picture === 'original' ? 'Original image' : 'Without stars', texturePath: value.file,
    widthPx: value.widthPx, heightPx: value.heightPx, pivotCssPx: [0, 0, 0], sourcePageUrl: value.sourcePageUrl, credit: value.credit,
    registrationNote: value.registrationNote ?? 'The photograph on the sky plane through the object, by the recipe observation the bake places its layers with.',
    style: { width: `${value.widthPx}px`, height: `${value.heightPx}px`, transform: `matrix3d(${geometry.matrix})`,
      backgroundSize: `${value.widthPx}px ${value.heightPx}px`, backgroundPosition: '0px 0px' } };
  return { overlay, textureUrl: url(value.texturePath ?? `${object}/source/${value.file}`) };
}

/** A site volume dataset's original photograph as the same registered plane: the registration the lab workspace that
 * made the dataset holds (served by the lab), checked against the mounted dataset's frame. */
export async function loadVolumeOverlay(object: string, dataset: string, url: (path: string) => string, frame: DensityVolumeFrame) {
  const response = await fetch(`/__nebula/volume-original?object=${encodeURIComponent(object)}&dataset=${encodeURIComponent(dataset)}`, { cache: 'no-store' });
  const body: unknown = await response.json();
  if (!response.ok || !body || typeof body !== 'object') throw new Error(String((body as { error?: unknown } | null)?.error ?? `The original is unavailable (HTTP ${response.status}).`));
  const { texture, catalogue: raw } = body as { texture?: unknown; catalogue?: unknown };
  const catalogue = parseOverlayCatalogue(raw);
  if (typeof texture !== 'string' || !sameOverlayFrame(catalogue.frame, frame) || catalogue.overlays.length !== 1)
    throw new TypeError('Original image does not share this dataset’s prepared frame.');
  const overlay = catalogue.overlays[0]!;
  if (overlay.initialPlacement && JSON.stringify(overlay.initialPlacement) !== JSON.stringify(defaultOverlayPlacement()))
    throw new TypeError('Original overlay must include registration in its prepared geometry.');
  return { overlay, textureUrl: url(texture) };
}
