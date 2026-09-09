import { presentPhysicalPoseInVolume } from '@cssearth/engine';
import { worldRotationCss } from '../navigation/world-camera-math.js';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import { preparedVolumeCameraTransform } from '../volume/prepared-volume-runtime.js';
import type { PreparedCssSurfaceShell } from './types.js';
import { validatePreparedCssSurfaceShell } from './validation.js';
import { nearestFacingIndex, shellMaterialAddress } from './material-address.js';

export interface PreparedSurfaceShellStats {
  readonly visible: boolean;
  readonly visibleFaces: number;
  readonly totalFaces: number;
  readonly atlasFrames: number;
  readonly distanceM: number;
  readonly opacity: number;
}

/** Retains the prepared faces; publications only move the camera and address the material bank. */
export function mountPreparedCssSurfaceShell({ host, before, payload: input, resolveResource }: {
  host: HTMLElement; before: Element; payload: PreparedCssSurfaceShell; resolveResource(path: string): string;
}) {
  const payload = validatePreparedCssSurfaceShell(input);
  if (!host?.ownerDocument || before?.parentNode !== host || typeof resolveResource !== 'function') {
    throw new TypeError('Prepared CSS surface shell needs a host, child insertion point and resource resolver.');
  }
  const document = host.ownerDocument, root = document.createElement('div'), camera = document.createElement('div'), scene = document.createElement('div');
  root.className = 'prepared-surface-shell';
  root.dataset.shellId = payload.id;
  root.ariaHidden = 'true';
  // Opacity composites the finished camera image. It must stay outside the 3D context.
  Object.assign(root.style, { position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'visible', transformStyle: 'flat', visibility: 'hidden', opacity: '0' });
  camera.className = 'prepared-surface-shell-camera';
  Object.assign(camera.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', transformStyle: 'preserve-3d', transformOrigin: '0 0', pointerEvents: 'none' });
  scene.className = 'prepared-surface-shell-scene';
  Object.assign(scene.style, { position: 'absolute', left: '50%', top: '50%', width: '0', height: '0', transformOrigin: '0 0', transformStyle: 'preserve-3d', pointerEvents: 'none' });
  const atlasUrl = resolveResource(payload.atlas.path);
  const slots = payload.faces.map(face => {
    const element = document.createElement('s');
    element.dataset.shellFace = face.id;
    Object.assign(element.style, { display: 'block', position: 'absolute', left: '0', top: '0', transformOrigin: '0 0',
      transformStyle: 'preserve-3d', backfaceVisibility: 'visible', backgroundRepeat: 'no-repeat', pointerEvents: 'none',
      textDecoration: 'none', visibility: 'hidden', ...face.style, backgroundImage: `url("${escapeUrl(atlasUrl)}")` });
    scene.appendChild(element);
    return { face, element, frame: -1, permutation: 0, visible: false };
  });
  const facingLevels = payload.atlas.facingLevels;
  const vertexFrames = new Uint16Array(payload.vertices?.length ?? 0);
  camera.appendChild(scene); root.appendChild(camera); host.insertBefore(root, before);
  let destroyed = false;
  let state: PreparedSurfaceShellStats = Object.freeze({ visible: false, visibleFaces: 0, totalFaces: slots.length, atlasFrames: payload.atlas.frames, distanceM: 0, opacity: 0 });
  function publishStats(distanceM: number, opacity: number, visibleFaces: number): void {
    state = Object.freeze({ visible: opacity > 0, visibleFaces, totalFaces: slots.length, atlasFrames: payload.atlas.frames, distanceM, opacity });
    root.dataset.shellDistanceM = String(distanceM);
    root.dataset.shellVisibleFaces = String(visibleFaces);
    root.dataset.shellOpacity = String(opacity);
  }
  publishStats(0, 0, 0);
  function publish(world: WorldCameraPose, viewport: WorldCameraViewport, enabled = true): void {
    if (destroyed) return;
    if (world.referenceFrame !== payload.frame.referenceFrame || world.epochJdTt !== payload.frame.epochJdTt) throw new TypeError('Prepared CSS surface shell and camera reference frames differ.');
    if (!Number.isFinite(viewport.focalPixels) || viewport.focalPixels <= 0 || viewport.principalOffsetPixels.length !== 2 || !viewport.principalOffsetPixels.every(Number.isFinite)) {
      throw new TypeError('Prepared CSS surface shell camera viewport is invalid.');
    }
    const local = presentPhysicalPoseInVolume(world.pose, payload.frame);
    const distanceM = Math.hypot(...local.positionUnits) * payload.frame.metersPerUnit;
    const opacity = enabled ? distanceOpacity(distanceM, payload.visibility) : 0;
    write(root, 'opacity', String(opacity));
    write(root, 'visibility', opacity > 0 ? 'visible' : 'hidden');
    // Hidden shells retain their last material addresses and face visibility.
    // The outer zero-opacity composite also hides explicitly visible children.
    if (opacity === 0) { publishStats(distanceM, 0, 0); return; }
    const transform = preparedVolumeCameraTransform({ world, viewport }, payload.frame, payload.unitScale);
    write(camera, 'perspective', `${format(transform.focalPixels)}px`);
    write(camera, 'perspectiveOrigin', `calc(50% + ${format(viewport.principalOffsetPixels[0])}px) calc(50% + ${format(viewport.principalOffsetPixels[1])}px)`);
    write(scene, 'transform', `translate3d(${transform.translationCssPixels.map(value => `${format(value)}px`).join(',')}) ${worldRotationCss(transform.rotation)}`);
    if (facingLevels) for (let i = 0; i < vertexFrames.length; i++) {
      const vertex = payload.vertices![i]!, p = vertex.positionUnits, n = vertex.radialNormal;
      const x = local.positionUnits[0] - p[0], y = local.positionUnits[1] - p[1], z = local.positionUnits[2] - p[2];
      const length = Math.hypot(x, y, z);
      vertexFrames[i] = nearestFacingIndex(length > 0 ? (x * n[0] + y * n[1] + z * n[2]) / length : 0, facingLevels);
    }
    let visibleFaces = 0;
    for (const slot of slots) {
      const { face, element } = slot;
      const x = local.positionUnits[0] - face.centerUnits[0], y = local.positionUnits[1] - face.centerUnits[1], z = local.positionUnits[2] - face.centerUnits[2];
      const faceVisible = x * face.faceNormal[0] + y * face.faceNormal[1] + z * face.faceNormal[2] > 0;
      if (faceVisible !== slot.visible) { element.style.visibility = faceVisible ? 'visible' : 'hidden'; slot.visible = faceVisible; }
      if (!faceVisible) continue;
      visibleFaces++;
      let frame: number;
      if (facingLevels) {
        const indices = face.vertexIndices!;
        const address = shellMaterialAddress(vertexFrames[indices[0]]!, vertexFrames[indices[1]]!, vertexFrames[indices[2]]!, facingLevels.length);
        frame = Math.floor(address / 6);
        const permutation = address % 6;
        if (slot.permutation !== permutation) {
          element.style.transform = face.materialTransforms![permutation]!;
          slot.permutation = permutation;
        }
      } else {
        const facing = (x * face.radialNormal[0] + y * face.radialNormal[1] + z * face.radialNormal[2]) / Math.hypot(x, y, z);
        frame = Math.round(Math.max(0, Math.min(1, facing)) * (payload.atlas.frames - 1));
      }
      if (frame === slot.frame) continue;
      const column = frame % payload.atlas.columns, row = Math.floor(frame / payload.atlas.columns);
      element.style.backgroundPosition = `${format(face.atlasOriginPixels[0] - column * face.atlasStepPixels[0])}px ${format(face.atlasOriginPixels[1] - row * face.atlasStepPixels[1])}px`;
      element.dataset.shellFrame = String(frame);
      slot.frame = frame;
    }
    publishStats(distanceM, opacity, visibleFaces);
  }
  return Object.freeze({ root, publish, stats: (): PreparedSurfaceShellStats => state, destroy(): void {
    if (destroyed) return;
    destroyed = true; root.remove();
    publishStats(state.distanceM, 0, 0);
  } });
}

function distanceOpacity(distanceM: number, visibility: PreparedCssSurfaceShell['visibility']): number {
  if (distanceM <= visibility.hiddenInsideM || distanceM >= visibility.hiddenBeyondM) return 0;
  if (distanceM <= visibility.fullUntilM) return 1;
  const t = (distanceM - visibility.fullUntilM) / (visibility.hiddenBeyondM - visibility.fullUntilM);
  return 1 - t * t * (3 - 2 * t);
}
function write(element: HTMLElement, property: 'perspective' | 'perspectiveOrigin' | 'transform' | 'opacity' | 'visibility', value: string): void {
  if (element.style[property] !== value) element.style[property] = value;
}
function format(value: number): string { return Math.abs(value) < 1e-9 ? '0' : Number(value.toFixed(6)).toString(); }
function escapeUrl(value: string): string { return value.replace(/["\\\n\r]/gu, character => `\\${character}`); }
