import { presentPhysicalPoseInVolume } from '@cssearth/engine';
import { worldRotationFromQuaternion, worldRotationCss } from '../navigation/world-camera-math.js';
import type { PreparedVolumeMountOptions, PreparedVolumeRuntime, PreparedCssVolume, VolumeCameraPublication, VolumeLocalCamera, VolumeVector, PreparedVolumeCameraTransform } from './types.js';
import { validatePreparedCssVolume } from './validation.js';

const AXES = ['x', 'y', 'z'] as const;

/** Mounts fixed projective slice geometry. It owns DOM transforms only; all geometry and pixels are prepared. */
export function mountPreparedCssVolume(options: PreparedVolumeMountOptions): PreparedVolumeRuntime {
  const payload = validatePreparedCssVolume(options.payload);
  if (!(options.host instanceof HTMLElement) || !(options.before instanceof Element) || typeof options.resolveResource !== 'function') {
    throw new TypeError('Prepared CSS volume mount needs a host, insertion point and resource resolver.');
  }
  const unitScale = options.unitScale ?? 50;
  if (!Number.isFinite(unitScale) || unitScale <= 0) throw new TypeError('Prepared CSS volume unit scale must be positive.');
  const document = options.host.ownerDocument;
  const roots: HTMLElement[] = [];
  const cameras: HTMLElement[] = [];
  const scenes: HTMLElement[] = [];
  for (const axis of AXES) {
    const stack = payload.stacks.find(candidate => candidate.axis === axis);
    if (!stack) throw new TypeError(`Prepared CSS volume has no ${axis} stack.`);
    const root = element(document, 'div', { 'data-volume-id': payload.id, 'data-volume-axis': axis });
    const camera = element(document, 'div', { 'data-volume-camera': axis });
    const scene = element(document, 'div', { 'data-volume-scene': axis });
    const mesh = element(document, 'div', { 'data-volume-mesh': axis });
    root.className = 'css-volume-projection';
    camera.className = 'css-volume-camera';
    scene.className = 'css-volume-scene';
    mesh.className = 'css-volume-mesh';
    root.style.opacity = '0';
    root.style.display = 'block';
    root.style.visibility = 'hidden';
    for (const leaf of stack.leaves) mesh.append(createLeaf(document, leaf, options.resolveResource));
    scene.append(mesh);
    camera.append(scene);
    root.append(camera);
    options.host.insertBefore(root, options.before);
    roots.push(root); cameras.push(camera); scenes.push(scene);
  }
  let destroyed = false;
  const publish = ({ world, viewport }: VolumeCameraPublication) => {
    if (destroyed) return;
    if (world.referenceFrame !== payload.frame.referenceFrame || world.epochJdTt !== payload.frame.epochJdTt) {
      throw new TypeError('Prepared volume and world camera use different reference frames.');
    }
    if (!(viewport.focalPixels > 0) || viewport.principalOffsetPixels.length !== 2 || !viewport.principalOffsetPixels.every(Number.isFinite)) {
      throw new TypeError('Prepared volume camera viewport is invalid.');
    }
    const transform = preparedVolumeCameraTransform({ world, viewport }, payload.frame, unitScale);
    const cssTransform = `translate3d(${transform.translationCssPixels.map(value => `${format(value)}px`).join(',')}) ${worldRotationCss(transform.rotation)}`;
    const [principalX, principalY] = viewport.principalOffsetPixels;
    const perspectiveOrigin = `calc(50% + ${format(principalX)}px) calc(50% + ${format(principalY)}px)`;
    for (const camera of cameras) {
      camera.style.perspective = `${format(transform.focalPixels)}px`;
      camera.style.perspectiveOrigin = perspectiveOrigin;
    }
    for (const scene of scenes) scene.style.transform = cssTransform;
    const local = presentPhysicalPoseInVolume(world.pose, payload.frame);
    const strengths = axisWeights(local);
    let total = 0;
    for (let index = 0; index < roots.length; index++) {
      const root = roots[index]!;
      const weight = strengths[index] ?? 0;
      total += weight;
      root.style.visibility = weight > 0 ? 'visible' : 'hidden';
      root.style.opacity = total > 0 ? String(weight / total) : '0';
    }
  };
  return Object.freeze({ publish, roots: Object.freeze(roots), destroy() {
    if (destroyed) return;
    destroyed = true;
    for (const root of roots) root.remove();
  }});
}

export function preparedVolumeCameraTransform(publication: VolumeCameraPublication, frame: PreparedCssVolume['frame'], unitScale = 50): PreparedVolumeCameraTransform {
  if (publication.world.referenceFrame !== frame.referenceFrame || publication.world.epochJdTt !== frame.epochJdTt) {
    throw new TypeError('Prepared volume and world camera use different reference frames.');
  }
  const { viewport } = publication;
  if (!(unitScale > 0) || !Number.isFinite(unitScale) || !(viewport.focalPixels > 0) ||
      viewport.principalOffsetPixels.length !== 2 || !viewport.principalOffsetPixels.every(Number.isFinite)) {
    throw new TypeError('Prepared volume camera transform inputs are invalid.');
  }
  const local = presentPhysicalPoseInVolume(publication.world.pose, frame);
  const view = cameraView(local);
  const [px, py, pz] = local.positionUnits;
  const [ox, oy] = viewport.principalOffsetPixels;
  const rotation = cssVolumeRotation(local);
  return Object.freeze({ rotation: Object.freeze([...rotation]),
    translationCssPixels: Object.freeze([
      ox - dot(view, 0, [px, py, pz]) * unitScale,
      oy - dot(view, 3, [px, py, pz]) * unitScale,
      viewport.focalPixels - dot(view, 6, [px, py, pz]) * unitScale,
    ] as [number, number, number]), focalPixels: viewport.focalPixels });
}

function createLeaf(document: Document, leaf: PreparedCssVolume['stacks'][number]['leaves'][number], resolveResource: (path: string) => string): HTMLElement {
  const node = document.createElement('s');
  node.dataset.volumeSlice = leaf.id;
  node.style.width = leaf.style.width;
  node.style.height = leaf.style.height;
  node.style.transform = leaf.style.transform;
  node.style.backgroundSize = leaf.style.backgroundSize;
  node.style.backgroundPosition = leaf.style.backgroundPosition;
  node.style.backgroundImage = `url("${escapeUrl(resolveResource(leaf.texturePath))}")`;
  return node;
}

function cssVolumeRotation(camera: VolumeLocalCamera): readonly number[] {
  const view = cameraView(camera);
  // PolyCSS receives prepared vertices in [y,x,z] order. This is the single
  // renderer-owned CSS reflection; the physical quaternion remains proper.
  return [view[1]!, view[0]!, view[2]!, view[4]!, view[3]!, view[5]!, view[7]!, view[6]!, view[8]!];
}

function cameraView(camera: VolumeLocalCamera): readonly number[] {
  const cameraToVolume = worldRotationFromQuaternion(camera.orientationXyzw);
  return [cameraToVolume[0]!, cameraToVolume[3]!, cameraToVolume[6]!,
    cameraToVolume[1]!, cameraToVolume[4]!, cameraToVolume[7]!,
    cameraToVolume[2]!, cameraToVolume[5]!, cameraToVolume[8]!];
}

function axisWeights(camera: VolumeLocalCamera): readonly number[] {
  const matrix = worldRotationFromQuaternion(camera.orientationXyzw);
  const back: VolumeVector = [matrix[2]!, matrix[5]!, matrix[8]!];
  const strengths = [Math.abs(back[0]), Math.abs(back[1]), Math.abs(back[2])];
  const maximum = Math.max(...strengths);
  return strengths.map(value => {
    const t = Math.max(0, Math.min(1, (value - maximum + 0.16) / 0.16));
    return t * t * (3 - 2 * t);
  });
}

function element(document: Document, tag: string, data: Record<string, string>): HTMLElement {
  const result = document.createElement(tag);
  for (const [key, value] of Object.entries(data)) result.setAttribute(key, value);
  return result;
}
function escapeUrl(value: string): string { return value.replace(/["\\\n\r]/gu, character => `\\${character}`); }
function format(value: number): string { return Math.abs(value) < 1e-9 ? '0' : Number(value.toFixed(6)).toString(); }
function dot(matrix: readonly number[], offset: number, point: VolumeVector): number {
  return matrix[offset]! * point[0] + matrix[offset + 1]! * point[1] + matrix[offset + 2]! * point[2];
}
