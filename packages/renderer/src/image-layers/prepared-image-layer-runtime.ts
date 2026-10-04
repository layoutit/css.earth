import { presentPhysicalPoseInVolume, worldRotationCss, worldRotationFromQuaternion } from '@cssearth/engine';
import { preparedVolumeCameraTransform, LARGE_IMAGE_PIXELS, STACK_OPACITY_CEILING } from '../volume/prepared-volume-runtime.js';
import type { VolumeCameraPublication } from '../volume/types.js';
import type { PreparedCssImageLayers, PreparedImageLayerView } from '@cssearth/objects';
import { revealLayer } from '../rendering/layer-reveal.js';

/** Transparent prepared layer banks. No opaque viewport matte is allowed here. */
export function mountPreparedCssImageLayers({ host, before, payload, resolveResource }: {
  host: HTMLElement; before: Element; payload: PreparedCssImageLayers; resolveResource(path: string): string;
}) {
  const document = host.ownerDocument, root = document.createElement('div');
  root.className = 'prepared-image-layer-bank'; root.dataset.imageLayerObject = payload.id;
  // The bank fills the universe root; its projections are transparent and their scenes composite once (volume.css).
  // A stack without leaves draws nothing: it is not mounted and takes no part in the choice of view.
  const drawn = payload.stacks.filter(stack => stack.leaves.length > 0);
  const views = payload.bankViews.filter(view => drawn.some(stack => stack.axis === view.axis));
  const banks = drawn.map(stack => {
    const projection = document.createElement('div');
    projection.className = 'css-volume-projection';
    projection.dataset.imageLayerAxis = stack.axis;
    projection.style.opacity = '0'; projection.style.visibility = 'hidden';
    // Same camera-driven scene as a volume: its will-change keeps slice raster scales through rotation. A stack is one
    // scene, or the runs of leaves its view names (sceneSizes): each run under a camera of its own in the stack's
    // projection, painted in the stack's order, so the browser sorts and cuts only one run's leaves against each other.
    const textures: { element: HTMLElement; path: string; large: boolean }[] = [], scenes: { camera: HTMLElement; scene: HTMLElement }[] = [];
    let next = 0;
    for (const size of views.find(view => view.axis === stack.axis)?.sceneSizes ?? [stack.leaves.length]) {
      const camera = document.createElement('div'), scene = document.createElement('div'), mesh = document.createElement('div');
      camera.className = 'css-volume-camera'; scene.className = 'css-volume-scene'; mesh.className = 'css-volume-mesh';
      for (const leaf of stack.leaves.slice(next, next + size)) {
        const element = document.createElement('s');
        element.dataset.imageLayerLeaf = leaf.id;
        Object.assign(element.style, leaf.style);
        textures.push({ element, path: leaf.texturePath, large: leaf.widthPx * leaf.heightPx >= LARGE_IMAGE_PIXELS });
        mesh.appendChild(element);
      }
      next += size;
      scene.appendChild(mesh); camera.appendChild(scene); projection.appendChild(camera); scenes.push({ camera, scene });
    }
    root.appendChild(projection);
    return { axis: stack.axis, projection, scenes, textures, loaded: false, perspective: '', perspectiveOrigin: '', transform: '' };
  });
  host.insertBefore(root, before);
  let destroyed = false;
  const url = (path: string) => resolveResource(path).replace(/["\\\n\r]/g, char => `\\${char}`);
  // A large leaf coming back decodes off the main thread first: M31's 7,085 px detail layer decoded inside one 168 ms
  // paint each time its bank or the whole bank came back on the iPad (2026-09-30).
  const revealLarge = (bank: (typeof banks)[number]) => {
    if (bank.loaded) for (const texture of bank.textures) if (texture.large) revealLayer(texture.element, resolveResource(texture.path));
  };
  return Object.freeze({ root,
    /** The bank root is shown again: its large leaves wait for their decode (layer-reveal.ts). */
    revealLarge() { for (const bank of banks) if (bank.projection.style.display !== 'none') revealLarge(bank); },
    publish(publication: VolumeCameraPublication) {
      if (destroyed) return;
      const transform = preparedVolumeCameraTransform(publication, payload.frame);
      const cssTransform = `translate3d(${transform.translationCssPixels.map(value => `${value}px`).join(',')}) ${worldRotationCss(transform.rotation)}`;
      const local = presentPhysicalPoseInVolume(publication.world.pose, payload.frame);
      const weights = imageLayerAxisWeights(local.orientationXyzw, views);
      const [ox, oy] = publication.viewport.principalOffsetPixels;
      const perspective = `${transform.focalPixels}px`, perspectiveOrigin = `calc(50% + ${ox}px) calc(50% + ${oy}px)`;
      for (const bank of banks) {
        // Every write is on change: this publishes every camera frame (motion-freezes-membership.md). A stack's scenes
        // share one camera, so what was last written is kept once for the stack, not read back from each scene.
        const set = (element: HTMLElement, property: 'opacity' | 'visibility' | 'display', value: string) => {
          if (element.style[property] !== value) element.style[property] = value;
        };
        if (bank.perspective !== perspective) { bank.perspective = perspective; for (const { camera } of bank.scenes) camera.style.perspective = perspective; }
        if (bank.perspectiveOrigin !== perspectiveOrigin) { bank.perspectiveOrigin = perspectiveOrigin; for (const { camera } of bank.scenes) camera.style.perspectiveOrigin = perspectiveOrigin; }
        if (bank.transform !== cssTransform) { bank.transform = cssTransform; for (const { scene } of bank.scenes) scene.style.transform = cssTransform; }
        const weight = weights[bank.axis];
        const returning = weight > 0 && bank.projection.style.display === 'none';
        if (weight > 0 && !bank.loaded) {
          // Leaves cut from one atlas share its address.
          const images = new Map<string, string>();
          for (const { element, path } of bank.textures) {
            let image = images.get(path);
            if (image === undefined) images.set(path, image = `url("${url(path)}")`);
            element.style.backgroundImage = image;
          }
          bank.loaded = true;
        }
        if (returning) revealLarge(bank);
        // Never 1 (STACK_OPACITY_CEILING): a drag across M31 had its longest frame at 108 to 111 ms with a bank's opacity
        // reaching 1, and 67 to 72 ms under the ceiling (iPad, 2026-10-04).
        set(bank.projection, 'opacity', String(Math.min(STACK_OPACITY_CEILING, weight)));
        set(bank.projection, 'visibility', weight > 0 ? 'visible' : 'hidden');
        // A zero-weight axis contributes nothing; its 3D leaves leave compositing.
        set(bank.projection, 'display', weight > 0 ? '' : 'none');
      }
    },
    destroy() { if (destroyed) return; destroyed = true; root.remove(); },
  });
}

/** Narrow continuous transitions keep near-edge-on faces out of the chosen projection. A view alone keeps the whole
 * weight, seen edge-on too. */
export function imageLayerAxisWeights(orientation: readonly [number, number, number, number], views: readonly PreparedImageLayerView[]) {
  const matrix = worldRotationFromQuaternion(orientation);
  const strengths = views.map(view => Math.abs(matrix[2] * view.normalUnits[0] + matrix[5] * view.normalUnits[1] +
    matrix[8] * view.normalUnits[2]) / view.samplingStepUnits);
  const maximum = Math.max(...strengths);
  const weights = strengths.map(value => {
    const t = Math.max(0, Math.min(1, ((maximum > 0 ? value / maximum : 1) - 1 + .16) / .16));
    return t * t * (3 - 2 * t);
  });
  const total = weights.reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(views.map((view, index) => [view.axis, weights[index] / total])) as Record<'x' | 'y' | 'z', number>;
}
