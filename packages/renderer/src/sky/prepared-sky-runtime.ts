import { fromEyeM } from '@cssearth/engine';
import { type PreparedLeafBounds, type PreparedCssSky, validatePreparedCssSky, validatePreparedSkyParallax, type PreparedCssVolume } from '@cssearth/objects';
import { createPreparedLeafFrustum, preparedLeafMayContribute } from '../rendering/prepared-leaf-frustum.js';
import { cssViewFromOrientation, worldRotationCss } from '../navigation/world-camera-math.js';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';

import { afterStartup, startupOpen } from '../rendering/startup-gate.js';

/** Transports retained celestial images through the shared physical observer pose. The cube is the diffuse Milky Way
 * only; stars are drawn as their own points. */
export function mountPreparedCssSky({ host, before, payload: input, resources, resolveResource }: {
  host: HTMLElement; before: Element; payload: PreparedCssSky; resources: PreparedCssVolume['resources']; resolveResource(path: string): string;
}) {
  const payload = validatePreparedCssSky(input, resources), document = host.ownerDocument;
  const root = document.createElement('div');
  root.className = 'prepared-celestial-sky'; root.ariaHidden = 'true';
  Object.assign(root.style, { position: 'absolute', inset: '0', pointerEvents: 'none', transformStyle: 'flat', background: '#000', visibility: 'hidden' });
  // The root carries the background opacity above the retained 3D camera.
  const camera = document.createElement('div'), scene = document.createElement('div');
  camera.className = 'prepared-celestial-sky-camera';
  Object.assign(camera.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', transformStyle: 'preserve-3d', transformOrigin: '0 0' });
  scene.className = 'prepared-celestial-sky-scene';
  Object.assign(scene.style, { position: 'absolute', left: '50%', top: '50%', width: '0', height: '0', pointerEvents: 'none', transformStyle: 'preserve-3d', transformOrigin: '0 0' });
  // A face starts hidden and sets its image the first time it enters the view: a hidden element still fetches its
  // background, and the camera sees at most three of a cube's six faces.
  const boundedFaces: { node: HTMLElement; bounds: PreparedLeafBounds | undefined; shown: boolean; image: string | null }[] = [];
  for (const face of payload.faces) {
    const node = document.createElement('s'); node.dataset.skyFace = face.id;
    Object.assign(node.style, { position: 'absolute', left: '0', top: '0', display: 'block', pointerEvents: 'none', transformOrigin: '0 0',
      backfaceVisibility: 'visible', backgroundRepeat: 'no-repeat', textDecoration: 'none', ...face.style, visibility: 'hidden' });
    scene.appendChild(node);
    boundedFaces.push({ node, bounds: face.boundsCssPixels, shown: false, image: `url("${escapeUrl(resolveResource(face.texturePath))}")` });
  }
  camera.appendChild(scene); root.appendChild(camera);
  host.insertBefore(root, before);
  let destroyed = false, previousTransform = '', previousPerspective = '', previousOrigin = '', previousClipView = '';
  // During a body's first view the faces in view wait, and take their images once it is interactive (startup-gate.ts).
  let imagesWaiting = false;
  const showImages = () => {
    imagesWaiting = false;
    if (destroyed) return;
    for (const face of boundedFaces) if (face.shown && face.image) { face.node.style.backgroundImage = face.image; face.image = null; }
  };
  return Object.freeze({ root,
    publish(world: WorldCameraPose, viewport: WorldCameraViewport, visible = true): void {
      if (destroyed) return;
      if (world.referenceFrame !== payload.referenceFrame || world.epochJdTt !== payload.epochJdTt) throw new TypeError('Prepared sky and observer reference frames differ.');
      const pose = preparedSkyCameraPose(world, viewport, payload.parallax);
      const transform = skyTransformCss(pose);
      const visibility = visible ? 'visible' : 'hidden';
      if (root.style.visibility !== visibility) root.style.visibility = visibility;
      if (!visible) return;
      const perspective = `${format(viewport.focalPixels)}px`, origin = `calc(50% + ${format(viewport.principalOffsetPixels[0])}px) calc(50% + ${format(viewport.principalOffsetPixels[1])}px)`;
      if (perspective !== previousPerspective) { camera.style.perspective = perspective; previousPerspective = perspective; }
      if (origin !== previousOrigin) { camera.style.perspectiveOrigin = origin; previousOrigin = origin; }
      if (transform !== previousTransform) { scene.style.transform = transform; previousTransform = transform; }
      const clipView = `${transform}|${perspective}|${origin}|${viewport.widthPixels}|${viewport.heightPixels}`;
      if (clipView !== previousClipView) {
        previousClipView = clipView;
        // Faces follow the view edge exactly, even while the camera coasts: a face's layer is about 85 MB at 3x, so
        // staging one ahead or keeping one through a spin would multiply memory (motion-freezes-membership.md).
        const planes = createPreparedLeafFrustum(pose.rotation, pose.translation, viewport);
        for (const face of boundedFaces) {
          const shown = preparedLeafMayContribute(face.bounds, planes);
          if (shown === face.shown) continue;
          face.shown = shown;
          if (shown && face.image) {
            if (startupOpen(document.defaultView)) { face.node.style.backgroundImage = face.image; face.image = null; }
            else if (!imagesWaiting) { imagesWaiting = true; afterStartup(document.defaultView, showImages); }
          }
          face.node.style.visibility = shown ? '' : 'hidden';
        }
      }
    },
    destroy(): void { if (destroyed) return; destroyed = true; root.remove(); },
  });
}

export function preparedSkyCameraTransform(world: WorldCameraPose, viewport: WorldCameraViewport, parallax?: PreparedCssSky['parallax']): string {
  return skyTransformCss(preparedSkyCameraPose(world, viewport, parallax));
}

function preparedSkyCameraPose(world: WorldCameraPose, viewport: WorldCameraViewport, parallax?: PreparedCssSky['parallax']) {
  if (!Number.isFinite(viewport.focalPixels) || viewport.focalPixels <= 0 || viewport.principalOffsetPixels.length !== 2 || !viewport.principalOffsetPixels.every(Number.isFinite) ||
      !Array.isArray(world.pose.positionM) || world.pose.positionM.length !== 3 || !world.pose.positionM.every(Number.isFinite) ||
      world.pose.orientationXyzw.length !== 4 || !world.pose.orientationXyzw.every(Number.isFinite) || Math.abs(Math.hypot(...world.pose.orientationXyzw) - 1) > 1e-9) {
    throw new TypeError('Prepared sky observer or projection is invalid.');
  }
  const view = cssViewFromOrientation(world.pose.orientationXyzw);
  // Prepared PolyCSS vertices are [ICRF y, ICRF x, ICRF z]. This is the same
  // single renderer reflection as the shared volume camera.
  const rotation = [view[1], view[0], view[2], view[4], view[3], view[5], view[7], view[6], view[8]];
  const translation = [viewport.principalOffsetPixels[0], viewport.principalOffsetPixels[1], viewport.focalPixels];
  if (parallax !== undefined) {
    validatePreparedSkyParallax(parallax);
    const displacement = fromEyeM(world.pose, parallax.originM).map(n => (0 - n) / parallax.metersPerCssPixel);
    for (let row = 0; row < 3; row++) translation[row] -= view[row * 3] * displacement[0] + view[row * 3 + 1] * displacement[1] + view[row * 3 + 2] * displacement[2];
    if (!translation.every(Number.isFinite)) throw new TypeError('Prepared sky observer displacement is invalid.');
  }
  return { rotation, translation };
}

function skyTransformCss({ rotation, translation }: ReturnType<typeof preparedSkyCameraPose>): string {
  return `translate3d(${format(translation[0])}px,${format(translation[1])}px,${format(translation[2])}px) ${worldRotationCss(rotation)}`;
}
function format(value: number): string { return Math.abs(value) < 1e-9 ? '0' : Number(value.toFixed(6)).toString(); }
function escapeUrl(value: string): string { return value.replace(/["\\\n\r]/gu, character => `\\${character}`); }
