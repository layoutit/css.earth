import { presentPhysicalPoseInVolume } from '@cssearth/engine';
import { preparedVolumeCameraTransform } from '../volume/prepared-volume-runtime.js';
import { worldRotationCss, worldRotationFromQuaternion } from '../navigation/world-camera-math.js';
import type { VolumeCameraPublication } from '../volume/types.js';
import type { PreparedCssImageLayers, PreparedImageLayerView } from './loader.js';

/** Transparent prepared layer banks. No opaque viewport matte is allowed here. */
export function mountPreparedCssImageLayers({ host, before, payload, resolveResource }: {
  host: HTMLElement; before: Element; payload: PreparedCssImageLayers; resolveResource(path: string): string;
}) {
  const document = host.ownerDocument, root = document.createElement('div');
  root.className = 'prepared-image-layer-bank'; root.dataset.imageLayerObject = payload.id;
  root.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  const banks = payload.stacks.map(stack => {
    const projection = document.createElement('div'), camera = document.createElement('div');
    const scene = document.createElement('div'), mesh = document.createElement('div');
    projection.className = 'css-volume-projection';
    projection.dataset.imageLayerAxis = stack.axis;
    projection.style.background = 'transparent';
    projection.style.opacity = '0'; projection.style.visibility = 'hidden';
    camera.className = 'css-volume-camera'; scene.className = 'css-volume-scene'; mesh.className = 'css-volume-mesh';
    // Same camera-driven scene as a volume: keep slice raster scales through rotation.
    scene.style.willChange = 'transform';
    const textures: { element: HTMLElement; path: string }[] = [];
    for (const leaf of stack.leaves) {
      const element = document.createElement('s');
      element.dataset.imageLayerLeaf = leaf.id;
      Object.assign(element.style, leaf.style);
      textures.push({ element, path: leaf.texturePath });
      mesh.appendChild(element);
    }
    scene.appendChild(mesh); camera.appendChild(scene); projection.appendChild(camera); root.appendChild(projection);
    return { axis: stack.axis, projection, camera, scene, textures, loaded: false };
  });
  host.insertBefore(root, before);
  let destroyed = false;
  return Object.freeze({ root,
    publish(publication: VolumeCameraPublication) {
      if (destroyed) return;
      const transform = preparedVolumeCameraTransform(publication, payload.frame);
      const cssTransform = `translate3d(${transform.translationCssPixels.map(value => `${value}px`).join(',')}) ${worldRotationCss(transform.rotation)}`;
      const local = presentPhysicalPoseInVolume(publication.world.pose, payload.frame);
      const weights = imageLayerAxisWeights(local.orientationXyzw, payload.bankViews);
      const [ox, oy] = publication.viewport.principalOffsetPixels;
      for (const bank of banks) {
        bank.camera.style.perspective = `${transform.focalPixels}px`;
        bank.camera.style.perspectiveOrigin = `calc(50% + ${ox}px) calc(50% + ${oy}px)`;
        bank.scene.style.transform = cssTransform;
        const weight = weights[bank.axis];
        if (weight > 0 && !bank.loaded) {
          for (const { element, path } of bank.textures) {
            const url = resolveResource(path).replace(/["\\\n\r]/g, char => `\\${char}`);
            element.style.backgroundImage = `url("${url}")`;
          }
          bank.loaded = true;
        }
        bank.projection.style.opacity = String(weight);
        bank.projection.style.visibility = weight > 0 ? 'visible' : 'hidden';
        // A zero-weight axis contributes nothing; its 3D leaves leave compositing.
        bank.projection.style.display = weight > 0 ? '' : 'none';
      }
    },
    destroy() { if (destroyed) return; destroyed = true; root.remove(); },
  });
}

/** Narrow continuous transitions keep near-edge-on faces out of the chosen projection. */
export function imageLayerAxisWeights(orientation: readonly [number, number, number, number], views: readonly PreparedImageLayerView[]) {
  const matrix = worldRotationFromQuaternion(orientation);
  const strengths = views.map(view => Math.abs(matrix[2] * view.normalUnits[0] + matrix[5] * view.normalUnits[1] +
    matrix[8] * view.normalUnits[2]) / view.samplingStepUnits);
  const maximum = Math.max(...strengths);
  const weights = strengths.map(value => {
    const t = Math.max(0, Math.min(1, (value / maximum - 1 + .16) / .16));
    return t * t * (3 - 2 * t);
  });
  const total = weights.reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(views.map((view, index) => [view.axis, weights[index] / total])) as Record<'x' | 'y' | 'z', number>;
}
