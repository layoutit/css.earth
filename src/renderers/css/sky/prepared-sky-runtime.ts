import { createPreparedLeafFrustum, preparedLeafMayContribute, type PreparedLeafBounds } from '../rendering/prepared-leaf-frustum.js';
import { cssViewFromOrientation, worldRotationCss } from '../navigation/world-camera-math.js';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import type { PreparedCssVolume } from '../volume/types.js';
import type { PreparedCssSky } from './types.js';
import { validatePreparedCssSky, validatePreparedSkyParallax } from './validation.js';

/** Transports retained celestial images through the shared physical observer pose.
 * A sky with baked stars carries two cubes: the Sun's neighbour stars over the diffuse Milky Way. The star cube shows
 * at `near` opacity; the plain cube stays behind it and carries the background through the volume handoff. */
export function mountPreparedCssSky({ host, before, payload: input, resources, resolveResource }: {
  host: HTMLElement; before: Element; payload: PreparedCssSky; resources: PreparedCssVolume['resources']; resolveResource(path: string): string;
}) {
  const payload = validatePreparedCssSky(input, resources), document = host.ownerDocument;
  const root = document.createElement('div');
  root.className = 'prepared-celestial-sky'; root.ariaHidden = 'true';
  Object.assign(root.style, { position: 'absolute', inset: '0', pointerEvents: 'none', transformStyle: 'flat', background: '#000', visibility: 'hidden' });
  const mountCube = (faces: PreparedCssSky['faces'], className: string) => {
    // The background opacity belongs above the retained 3D camera.
    const wrapper = document.createElement('div'), camera = document.createElement('div'), scene = document.createElement('div');
    wrapper.className = className;
    Object.assign(wrapper.style, { position: 'absolute', inset: '0', pointerEvents: 'none', transformStyle: 'flat' });
    camera.className = 'prepared-celestial-sky-camera';
    Object.assign(camera.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', transformStyle: 'preserve-3d', transformOrigin: '0 0' });
    scene.className = 'prepared-celestial-sky-scene';
    Object.assign(scene.style, { position: 'absolute', left: '50%', top: '50%', width: '0', height: '0', pointerEvents: 'none', transformStyle: 'preserve-3d', transformOrigin: '0 0' });
    const boundedFaces: { node: HTMLElement; bounds: PreparedLeafBounds | undefined; shown: boolean }[] = [];
    for (const face of faces) {
      const node = document.createElement('s'); node.dataset.skyFace = face.id;
      Object.assign(node.style, { position: 'absolute', left: '0', top: '0', display: 'block', pointerEvents: 'none', transformOrigin: '0 0',
        backfaceVisibility: 'visible', backgroundRepeat: 'no-repeat', textDecoration: 'none', ...face.style,
        backgroundImage: `url("${escapeUrl(resolveResource(face.texturePath))}")` });
      scene.appendChild(node);
      boundedFaces.push({ node, bounds: face.boundsCssPixels, shown: true });
    }
    camera.appendChild(scene); wrapper.appendChild(camera); root.appendChild(wrapper);
    return { wrapper, camera, scene, boundedFaces, opacity: 1, shown: true };
  };
  const cubes = [mountCube(payload.faces, 'prepared-celestial-sky-far')];
  if (payload.nearFaces) {
    cubes.push(mountCube(payload.nearFaces, 'prepared-celestial-sky-near'));
    // The opaque star cube covers the plain one, which leaves layout, and so image loading, until the handoff needs it.
    cubes[0]!.shown = false; cubes[0]!.wrapper.style.display = 'none';
  }
  host.insertBefore(root, before);
  let destroyed = false, previousTransform = '', previousPerspective = '', previousOrigin = '', previousClipView = '';
  return Object.freeze({ root,
    /** `near` is the baked-star cube's opacity: 1 in the Sun's neighbourhood, 0 once its parallax shows. */
    publish(world: WorldCameraPose, viewport: WorldCameraViewport, visible = true, near = 1): void {
      if (destroyed) return;
      if (world.referenceFrame !== payload.referenceFrame || world.epochJdTt !== payload.epochJdTt) throw new TypeError('Prepared sky and observer reference frames differ.');
      const pose = preparedSkyCameraPose(world, viewport, payload.parallax);
      const transform = skyTransformCss(pose);
      root.style.visibility = visible ? 'visible' : 'hidden';
      if (!visible) return;
      if (cubes.length === 2) {
        const nearOpacity = Math.max(0, Math.min(1, near)), far = cubes[0]!, close = cubes[1]!;
        if (nearOpacity !== close.opacity) { close.opacity = nearOpacity; close.wrapper.style.opacity = nearOpacity === 1 ? '' : String(nearOpacity); }
        const farShown = nearOpacity < 1, closeShown = nearOpacity > 0;
        if (farShown !== far.shown) { far.shown = farShown; far.wrapper.style.display = farShown ? '' : 'none'; }
        if (closeShown !== close.shown) { close.shown = closeShown; close.wrapper.style.display = closeShown ? '' : 'none'; }
      }
      const perspective = `${format(viewport.focalPixels)}px`, origin = `calc(50% + ${format(viewport.principalOffsetPixels[0])}px) calc(50% + ${format(viewport.principalOffsetPixels[1])}px)`;
      if (perspective !== previousPerspective) { for (const cube of cubes) cube.camera.style.perspective = perspective; previousPerspective = perspective; }
      if (origin !== previousOrigin) { for (const cube of cubes) cube.camera.style.perspectiveOrigin = origin; previousOrigin = origin; }
      if (transform !== previousTransform) { for (const cube of cubes) cube.scene.style.transform = transform; previousTransform = transform; }
      const clipView = `${transform}|${perspective}|${origin}|${viewport.widthPixels}|${viewport.heightPixels}`;
      if (clipView !== previousClipView) {
        previousClipView = clipView;
        const planes = createPreparedLeafFrustum(pose.rotation, pose.translation, viewport);
        for (const cube of cubes) for (const face of cube.boundedFaces) {
          const shown = preparedLeafMayContribute(face.bounds, planes);
          if (shown === face.shown) continue;
          face.shown = shown;
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
    const displacement = world.pose.positionM.map((n, axis) => (n - parallax.originM[axis]) / parallax.metersPerCssPixel);
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
