import { createPreparedLeafFrustum, preparedLeafMayContribute, type PreparedLeafBounds } from '../rendering/prepared-leaf-frustum.js';
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
  const boundedLeaves: { nodes: HTMLElement[]; bounds: PreparedLeafBounds | undefined; shown: boolean }[] = [];
  const opticalCopies: { nodes: HTMLElement[][]; alpha: number[] }[] = [];
  for (const axis of AXES) {
    const stack = payload.stacks.find(candidate => candidate.axis === axis);
    if (!stack) throw new TypeError(`Prepared CSS volume has no ${axis} stack.`);
    const root = document.createElement('div');
    const camera = document.createElement('div');
    const scene = document.createElement('div');
    const mesh = document.createElement('div');
    root.className = 'css-volume-projection';
    camera.className = 'css-volume-camera';
    scene.className = 'css-volume-scene';
    mesh.className = 'css-volume-mesh';
    root.style.opacity = '0';
    root.style.display = 'block';
    root.style.visibility = 'hidden';
    const copies = { nodes: [[], []] as HTMLElement[][], alpha: [0, 0] };
    opticalCopies.push(copies);
    for (const leaf of stack.leaves) {
      const textureUrl = options.resolveResource(leaf.texturePath);
      const bounded = { nodes: [] as HTMLElement[], bounds: leaf.boundsCssPixels, shown: true };
      boundedLeaves.push(bounded);
      // Coincident copies reuse the same prepared pixels and transform. They
      // increase optical length without intersecting another axis's planes.
      for (let copy = 0; copy < 3; copy++) {
        const node = createLeaf(document, leaf, textureUrl, copy);
        mesh.append(node);
        bounded.nodes.push(node);
        if (copy > 0) copies.nodes[copy - 1]!.push(node);
      }
    }
    scene.append(mesh);
    camera.append(scene);
    root.append(camera);
    options.host.insertBefore(root, options.before);
    roots.push(root); cameras.push(camera); scenes.push(scene);
  }
  let destroyed = false;
  let previousPerspective = '', previousOrigin = '', previousTransform = '';
  let previousClipView = '';
  let previousOrientation: readonly number[] | null = null;
  const rootVisible: (boolean | null)[] = roots.map(() => null), rootOpacity = roots.map(() => '');
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
    const perspective = `${format(transform.focalPixels)}px`;
    if (perspective !== previousPerspective || perspectiveOrigin !== previousOrigin) {
      for (const camera of cameras) {
        if (perspective !== previousPerspective) camera.style.perspective = perspective;
        if (perspectiveOrigin !== previousOrigin) camera.style.perspectiveOrigin = perspectiveOrigin;
      }
      previousPerspective = perspective; previousOrigin = perspectiveOrigin;
    }
    if (cssTransform !== previousTransform) {
      for (const scene of scenes) scene.style.transform = cssTransform;
      previousTransform = cssTransform;
    }
    const clipView = `${cssTransform}|${perspective}|${perspectiveOrigin}|${viewport.widthPixels}|${viewport.heightPixels}`;
    if (clipView !== previousClipView) {
      previousClipView = clipView;
      const planes = createPreparedLeafFrustum(transform.rotation, transform.translationCssPixels, viewport);
      for (const leaf of boundedLeaves) {
        const shown = preparedLeafMayContribute(leaf.bounds, planes);
        if (shown === leaf.shown) continue;
        leaf.shown = shown;
        for (const node of leaf.nodes) node.style.visibility = shown ? '' : 'hidden';
      }
    }
    // Optical length and stack mixing depend on direction, not observer
    // translation. Publish changed coefficients directly to their retained
    // optical copies; base slices and ancestors do not inherit animated state.
    if (previousOrientation && previousOrientation.every((value, axis) => value === world.pose.orientationXyzw[axis])) return;
    previousOrientation = [...world.pose.orientationXyzw];
    const local = presentPhysicalPoseInVolume(world.pose, payload.frame);
    const strengths = axisWeights(local);
    let total = 0;
    for (let index = 0; index < roots.length; index++) {
      const root = roots[index]!;
      const { weight, opticalGain } = strengths[index]!;
      total += weight;
      const visible = weight > 0, opacity = total > 0 ? String(weight / total) : '0';
      if (rootVisible[index] !== visible) {
        root.style.visibility = visible ? 'visible' : 'hidden';
        // A zero-weight axis stack leaves layout and compositing, not just paint.
        root.style.display = visible ? 'block' : 'none';
        rootVisible[index] = visible;
      }
      if (rootOpacity[index] !== opacity) { root.style.opacity = opacity; rootOpacity[index] = opacity; }
      // Opacity belongs to atomic images, never the mesh (which flattens 3D).
      // n full copies plus a fraction f give T=(1-alpha)^n*(1-f*alpha).
      // Integer gains are exact; the fractional step linearly approximates alpha.
      const copies = opticalCopies[index]!;
      for (let copy = 1; copy < 3; copy++) {
        const alpha = Math.min(1, Math.max(0, opticalGain - copy));
        const previous = copies.alpha[copy - 1]!;
        if (alpha === previous) continue;
        copies.alpha[copy - 1] = alpha;
        const value = String(alpha), entering = (alpha > 0) !== (previous > 0);
        for (const node of copies.nodes[copy - 1]!) {
          node.style.opacity = value;
          if (entering) node.style.display = alpha > 0 ? '' : 'none';
        }
      }
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

function createLeaf(document: Document, leaf: PreparedCssVolume['stacks'][number]['leaves'][number], textureUrl: string, copy: number): HTMLElement {
  const node = document.createElement('s');
  // A zero-alpha optical copy contributes nothing; it stays out of layout and compositing.
  if (copy > 0) { node.style.opacity = '0'; node.style.display = 'none'; }
  node.style.width = leaf.style.width;
  node.style.height = leaf.style.height;
  node.style.transform = leaf.style.transform;
  node.style.backgroundSize = leaf.style.backgroundSize;
  node.style.backgroundPosition = leaf.style.backgroundPosition;
  node.style.backgroundImage = `url("${escapeUrl(textureUrl)}")`;
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

function axisWeights(camera: VolumeLocalCamera): readonly { weight: number; opticalGain: number }[] {
  const matrix = worldRotationFromQuaternion(camera.orientationXyzw);
  const back: VolumeVector = [matrix[2]!, matrix[5]!, matrix[8]!];
  const length = Math.hypot(...back);
  const strengths = back.map(value => Math.abs(value) / length);
  const maximum = Math.max(...strengths);
  return strengths.map(value => {
    const t = Math.max(0, Math.min(1, (value - maximum + 0.16) / 0.16));
    const weight = t * t * (3 - 2 * t);
    // Crossing count is |d_i|*L/pitch_i, but each texture integrates pitch_i.
    // Restore the missing central-ray length before the normalized image mix.
    // The active .16 band implies |d_i| > .465, hence gain <2.15: 3 copies suffice.
    return { weight, opticalGain: weight > 0 ? Math.max(1, 1 / value) : 1 };
  });
}

function escapeUrl(value: string): string { return value.replace(/["\\\n\r]/gu, character => `\\${character}`); }
function format(value: number): string { return Math.abs(value) < 1e-9 ? '0' : Number(value.toFixed(6)).toString(); }
function dot(matrix: readonly number[], offset: number, point: VolumeVector): number {
  return matrix[offset]! * point[0] + matrix[offset + 1]! * point[1] + matrix[offset + 2]! * point[2];
}
