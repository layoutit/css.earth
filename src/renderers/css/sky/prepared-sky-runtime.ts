import { transposeWorldRotation, worldRotationCss, worldRotationFromQuaternion } from '../navigation/world-camera-math.js';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import type { PreparedCssVolume } from '../volume/types.js';
import type { PreparedCssSky } from './types.js';
import { validatePreparedCssSky } from './validation.js';

/** Transports fixed distant imagery using only the shared physical observer's orientation. */
export function mountPreparedCssSky({ host, before, payload: input, resources, resolveResource }: {
  host: HTMLElement; before: Element; payload: PreparedCssSky; resources: PreparedCssVolume['resources']; resolveResource(path: string): string;
}) {
  const payload = validatePreparedCssSky(input, resources), document = host.ownerDocument;
  const root = document.createElement('div'), camera = document.createElement('div'), scene = document.createElement('div');
  root.className = 'prepared-celestial-sky'; root.ariaHidden = 'true';
  Object.assign(root.style, { position: 'absolute', inset: '0', pointerEvents: 'none', transformStyle: 'flat', background: '#000', visibility: 'hidden' });
  camera.className = 'prepared-celestial-sky-camera';
  Object.assign(camera.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', transformStyle: 'preserve-3d', transformOrigin: '0 0' });
  scene.className = 'prepared-celestial-sky-scene';
  Object.assign(scene.style, { position: 'absolute', left: '50%', top: '50%', width: '0', height: '0', pointerEvents: 'none', transformStyle: 'preserve-3d', transformOrigin: '0 0' });
  for (const face of payload.faces) {
    const node = document.createElement('s'); node.dataset.skyFace = face.id;
    Object.assign(node.style, { position: 'absolute', left: '0', top: '0', display: 'block', pointerEvents: 'none', transformOrigin: '0 0',
      backfaceVisibility: 'visible', backgroundRepeat: 'no-repeat', textDecoration: 'none', ...face.style,
      backgroundImage: `url("${escapeUrl(resolveResource(face.texturePath))}")` });
    scene.appendChild(node);
  }
  camera.appendChild(scene); root.appendChild(camera); host.insertBefore(root, before);
  let destroyed = false, previousTransform = '', previousPerspective = '', previousOrigin = '';
  return Object.freeze({ root,
    publish(world: WorldCameraPose, viewport: WorldCameraViewport, visible = true): void {
      if (destroyed) return;
      if (world.referenceFrame !== payload.referenceFrame || world.epochJdTt !== payload.epochJdTt) throw new TypeError('Prepared sky and observer reference frames differ.');
      const transform = preparedSkyCameraTransform(world, viewport);
      root.style.visibility = visible ? 'visible' : 'hidden';
      if (!visible) return;
      const perspective = `${format(viewport.focalPixels)}px`, origin = `calc(50% + ${format(viewport.principalOffsetPixels[0])}px) calc(50% + ${format(viewport.principalOffsetPixels[1])}px)`;
      if (perspective !== previousPerspective) { camera.style.perspective = perspective; previousPerspective = perspective; }
      if (origin !== previousOrigin) { camera.style.perspectiveOrigin = origin; previousOrigin = origin; }
      if (transform !== previousTransform) { scene.style.transform = transform; previousTransform = transform; }
    },
    destroy(): void { if (destroyed) return; destroyed = true; root.remove(); },
  });
}

export function preparedSkyCameraTransform(world: WorldCameraPose, viewport: WorldCameraViewport): string {
  if (!Number.isFinite(viewport.focalPixels) || viewport.focalPixels <= 0 || viewport.principalOffsetPixels.length !== 2 || !viewport.principalOffsetPixels.every(Number.isFinite) ||
      world.pose.orientationXyzw.length !== 4 || !world.pose.orientationXyzw.every(Number.isFinite) || Math.abs(Math.hypot(...world.pose.orientationXyzw) - 1) > 1e-9) {
    throw new TypeError('Prepared sky observer or projection is invalid.');
  }
  const view = transposeWorldRotation(worldRotationFromQuaternion(world.pose.orientationXyzw));
  // Prepared PolyCSS vertices are [ICRF y, ICRF x, ICRF z]. This is the same
  // single renderer reflection as the shared volume camera, without parallax.
  const rotation = [view[1], view[0], view[2], view[4], view[3], view[5], view[7], view[6], view[8]];
  return `translate3d(${format(viewport.principalOffsetPixels[0])}px,${format(viewport.principalOffsetPixels[1])}px,${format(viewport.focalPixels)}px) ${worldRotationCss(rotation)}`;
}
function format(value: number): string { return Math.abs(value) < 1e-9 ? '0' : Number(value.toFixed(6)).toString(); }
function escapeUrl(value: string): string { return value.replace(/["\\\n\r]/gu, character => `\\${character}`); }
