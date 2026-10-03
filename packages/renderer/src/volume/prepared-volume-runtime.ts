import { type PreparedLeafBounds, type PreparedCssVolume, type VolumeVector, validatePreparedCssVolume } from '@cssearth/objects';
import { createPreparedLeafFrustum, preparedLeafMayContribute } from '../rendering/prepared-leaf-frustum.js';
import { presentPhysicalPoseInVolume } from '@cssearth/engine';
import { cssViewFromOrientation, worldRotationFromQuaternion, worldRotationCss } from '@cssearth/engine';
import type { PreparedVolumeMountOptions, PreparedMaterialVolumeRuntime, VolumeCameraPublication, VolumeLocalCamera, PreparedVolumeCameraTransform } from './types.js';

import { revealLayer } from '../rendering/layer-reveal.js';
import { createSettlePacer } from '../rendering/settle-pacer.js';

/** A leaf image this large decodes off the main thread before it shows again (layer-reveal.ts). */
export const LARGE_IMAGE_PIXELS = 1 << 20;

const AXES = ['x', 'y', 'z'] as const;

/** Mounts fixed projective slice geometry. It owns DOM transforms only; all geometry and pixels are prepared. */
export function mountPreparedCssVolume(options: PreparedVolumeMountOptions): PreparedMaterialVolumeRuntime {
  const payload = validatePreparedCssVolume(options.payload);
  if (options.host?.nodeType !== 1 || options.before?.nodeType !== 1 || options.before.ownerDocument !== options.host.ownerDocument || typeof options.resolveResource !== 'function') {
    throw new TypeError('Prepared CSS volume mount needs a host, insertion point and resource resolver.');
  }
  const unitScale = options.unitScale ?? 50;
  if (!Number.isFinite(unitScale) || unitScale <= 0) throw new TypeError('Prepared CSS volume unit scale must be positive.');
  const { min, max } = payload.frame.boundsUnits;
  // Older banks declare whole-volume bounds but no per-slice bounds. Reuse
  // those in the renderer's [y,x,z] coordinates to reject an offscreen bank.
  const frameBounds: PreparedLeafBounds = {
    min: [min[1] * unitScale, min[0] * unitScale, min[2] * unitScale],
    max: [max[1] * unitScale, max[0] * unitScale, max[2] * unitScale],
  };
  const document = options.host.ownerDocument;
  const create = options.createElement ?? ((tag: string) => document.createElement(tag));
  const roots: HTMLElement[] = [];
  const cameras: HTMLElement[] = [];
  const scenes: HTMLElement[] = [];
  // `large`: the image of a leaf big enough that a synchronous decode shows (layer-reveal.ts), or null.
  // `hidden`: a retirement hid its nodes, so its return shows them again.
  const boundedLeaves: { nodes: HTMLElement[]; bounds: PreparedLeafBounds | undefined; shown: boolean | null; hidden: boolean; axis: number; large: string | null }[] = [];
  const pendingTextures = AXES.map(() => new Map<{ nodes: HTMLElement[]; shown: boolean | null }, string>());
  const materialLeaves: { axis: number; leaf: typeof boundedLeaves[number] }[] = [];
  // `resident`: the copy's nodes are displayed; `hidden`: how many of them a retirement in progress has already hidden.
  const opticalCopies: { nodes: HTMLElement[][]; alpha: number[]; resident: boolean[]; hidden: number[] }[] = [];
  for (const axis of AXES) {
    const stack = payload.stacks.find(candidate => candidate.axis === axis);
    if (!stack) throw new TypeError(`Prepared CSS volume has no ${axis} stack.`);
    const root = create('div');
    const camera = create('div');
    const scene = create('div');
    const mesh = create('div');
    root.className = 'css-volume-projection';
    camera.className = 'css-volume-camera';
    scene.className = 'css-volume-scene';
    // The camera turns this scene every frame. Without the hint Chrome re-rastered each slice
    // layer whenever its projected scale moved: thousands of layers a second during a drag.
    scene.style.willChange = 'transform';
    mesh.className = 'css-volume-mesh';
    root.style.opacity = '0';
    // A stack that has never been published, or one whose axis carries no weight, stays out of the layer tree. Hidden
    // is not free: on an iPhone each unpublished stack kept its slices composited, and the compositor re-committed
    // them on every camera change.
    root.style.display = 'none';
    root.style.visibility = 'hidden';
    const copies = { nodes: [[], []] as HTMLElement[][], alpha: [NaN, NaN], resident: [false, false], hidden: [0, 0] };
    opticalCopies.push(copies);
    for (const leaf of stack.leaves) {
      const textureUrl = options.resolveResource(leaf.texturePath);
      const bounded = { nodes: [] as HTMLElement[], bounds: leaf.boundsCssPixels ?? frameBounds, shown: null as boolean | null, hidden: false,
        axis: AXES.indexOf(axis), large: leaf.widthPx * leaf.heightPx >= LARGE_IMAGE_PIXELS ? textureUrl : null };
      boundedLeaves.push(bounded);
      materialLeaves.push({ axis: AXES.indexOf(axis), leaf: bounded });
      pendingTextures[AXES.indexOf(axis)]!.set(bounded, textureUrl);
      // Coincident copies reuse the same prepared pixels and transform. They
      // increase optical length without intersecting another axis's planes.
      for (let copy = 0; copy < 3; copy++) {
        const node = createLeaf(create, leaf, copy);
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
  // What the turning camera no longer needs leaves once it has stopped (docs/performance/motion-freezes-membership.md):
  // an axis stack whose weight reached zero, an optical copy whose alpha did, a slice that left the view. Until then each
  // stays as it is at opacity 0 or out of view. Hiding them as the camera turned dropped and remade hundreds of layers in
  // a frame: one throw of a drag at the Milky Way flipped `display` on 2,016 slices while it coasted (2026-10-03).
  // What the camera turns towards still shows at once.
  const rootDisplayed = roots.map(() => false), leavingLeaves = new Set<typeof boundedLeaves[number]>();
  const retire = createSettlePacer((budget, moving) => {
    if (destroyed || moving) return 0;
    let written = 0;
    roots.forEach((root, index) => {
      if (rootVisible[index] !== false || !rootDisplayed[index]) return;
      // A zero-weight axis stack leaves layout and compositing, not just paint.
      root.style.visibility = 'hidden'; root.style.display = 'none'; rootDisplayed[index] = false; written++;
    });
    for (const leaf of leavingLeaves) {
      if (written >= budget) return written;
      leavingLeaves.delete(leaf);
      if (leaf.shown === false) { leaf.hidden = true; for (const node of leaf.nodes) { node.style.visibility = 'hidden'; written++; } }
    }
    for (const copies of opticalCopies) for (let copy = 0; copy < 2; copy++) {
      if (!copies.resident[copy] || copies.alpha[copy]! > 0) continue;
      const nodes = copies.nodes[copy]!;
      while (copies.hidden[copy]! < nodes.length) {
        if (written >= budget) return written;
        nodes[copies.hidden[copy]!++]!.style.display = 'none'; written++;
      }
      copies.resident[copy] = false; copies.hidden[copy] = 0;
    }
    return written;
  });
  const publish = ({ world, viewport }: VolumeCameraPublication) => {
    if (destroyed) return;
    if (world.referenceFrame !== payload.frame.referenceFrame || world.epochJdTt !== payload.frame.epochJdTt) {
      throw new TypeError('Prepared volume and world camera use different reference frames.');
    }
    if (!(viewport.focalPixels > 0) || viewport.principalOffsetPixels.length !== 2 || !viewport.principalOffsetPixels.every(Number.isFinite)) {
      throw new TypeError('Prepared volume camera viewport is invalid.');
    }
    const transform = preparedVolumeCameraTransform({ world, viewport }, payload.frame, unitScale);
    const translation = transform.translationCssPixels.map((value, axis) => options.nativeFocalCss && axis === 2 ? `calc(${options.nativeFocalCss} + ${format(value - transform.focalPixels)}px)` : `${format(value)}px`);
    const cssTransform = `translate3d(${translation.join(',')}) ${worldRotationCss(transform.rotation)}`;
    const [principalX, principalY] = viewport.principalOffsetPixels;
    const perspectiveOrigin = `calc(50% + ${format(principalX)}px) calc(50% + ${format(principalY)}px)`;
    const perspective = options.nativeFocalCss ?? `${format(transform.focalPixels)}px`;
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
        const first = leaf.shown === null;
        leaf.shown = shown;
        // A large image returning to the view decodes off the main thread first: M31's 3,700 px detail slice decoded
        // inside one 170 ms paint each time it came back on the iPad (2026-09-30).
        if (!shown) { leavingLeaves.add(leaf); retire.request(); continue; }
        leavingLeaves.delete(leaf);
        if (first || leaf.hidden) for (const node of leaf.nodes) if (leaf.large) revealLayer(node, leaf.large); else if (leaf.hidden) node.style.visibility = '';
        leaf.hidden = false;
      }
    }
    const strengths = axisWeights(presentPhysicalPoseInVolume(world.pose, payload.frame), payload.stacks, payload.frame.boundsUnits);
    for (const [axis, pending] of pendingTextures.entries()) {
      if (strengths[axis]!.weight <= 0) continue;
      for (const [leaf, url] of pending) {
        if (!leaf.shown) continue;
        const image = `url("${escapeUrl(url)}")`;
        for (const node of leaf.nodes) node.style.backgroundImage = image;
        pending.delete(leaf);
      }
    }
    // Optical length and stack mixing depend on direction, not observer
    // translation. Publish changed coefficients directly to their retained
    // optical copies; base slices and ancestors do not inherit animated state.
    if (previousOrientation && previousOrientation.every((value, axis) => value === world.pose.orientationXyzw[axis])) return;
    previousOrientation = [...world.pose.orientationXyzw];
    retire.published();

    let total = 0;
    for (let index = 0; index < roots.length; index++) {
      const root = roots[index]!;
      const { weight, opticalGain } = strengths[index]!;
      total += weight;
      const visible = weight > 0, opacity = total > 0 ? String(weight / total) : '0';
      if (rootVisible[index] !== visible) {
        rootVisible[index] = visible;
        if (!visible) retire.request();
        else if (!rootDisplayed[index]) {
          root.style.visibility = 'visible'; root.style.display = 'block'; rootDisplayed[index] = true;
          for (const leaf of boundedLeaves) if (leaf.axis === index && leaf.large && leaf.shown !== false) for (const node of leaf.nodes) revealLayer(node, leaf.large);
        }
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
        const value = String(alpha), nodes = copies.nodes[copy - 1]!;
        for (const node of nodes) node.style.opacity = value;
        if (alpha > 0) {
          // Some of its nodes may already be hidden by a retirement the camera interrupted.
          if (!copies.resident[copy - 1] || copies.hidden[copy - 1]! > 0) for (const node of nodes) node.style.display = '';
          copies.resident[copy - 1] = true; copies.hidden[copy - 1] = 0;
        } else if (copies.resident[copy - 1]) retire.request();
      }
    }
  };
  const setTexture = (index: number, url: string) => {
    if (!Number.isInteger(index) || !materialLeaves[index] || typeof url !== 'string' || !url)
      throw new TypeError('Prepared material texture index or URL is invalid.');
    if (destroyed) return;
    const { axis, leaf } = materialLeaves[index]!;
    if (leaf.large) leaf.large = url;
    if (pendingTextures[axis]!.has(leaf)) pendingTextures[axis]!.set(leaf, url);
    else for (const node of leaf.nodes) node.style.backgroundImage = `url("${escapeUrl(url)}")`;
  };
  return Object.freeze({ publish, setTexture, setTextures(urls: readonly string[]) {
    if (urls.length !== materialLeaves.length || urls.some(url => typeof url !== 'string' || !url))
      throw new TypeError('Prepared material texture count or URL is invalid.');
    urls.forEach((url, index) => setTexture(index, url));
  }, setMaterials(materials: readonly { textureUrl: string; backgroundSize: string; backgroundPosition: string }[]) {
    if (materials.length !== materialLeaves.length || materials.some(material => !material || typeof material.textureUrl !== 'string' || !material.textureUrl ||
        typeof material.backgroundSize !== 'string' || !material.backgroundSize || typeof material.backgroundPosition !== 'string' || !material.backgroundPosition)) {
      throw new TypeError('Prepared volume material count or CSS is invalid.');
    }
    if (destroyed) return;
    materials.forEach((material, index) => {
      const { axis, leaf } = materialLeaves[index]!;
      for (const node of leaf.nodes) {
        // Detach the former resource immediately. The selected material is attached
        // only by the next visible publication, through the ordinary demand gate.
        node.style.backgroundImage = '';
        node.style.backgroundSize = material.backgroundSize;
        node.style.backgroundPosition = material.backgroundPosition;
      }
      pendingTextures[axis]!.set(leaf, material.textureUrl);
      if (leaf.large) leaf.large = material.textureUrl;
    });
  }, roots: Object.freeze(roots), destroy() {
    if (destroyed) return;
    destroyed = true; retire.destroy();
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

function createLeaf(create: (tag: string) => HTMLElement, leaf: PreparedCssVolume['stacks'][number]['leaves'][number], copy: number): HTMLElement {
  const node = create('s');
  // A zero-alpha optical copy contributes nothing; it stays out of layout and compositing.
  if (copy > 0) { node.style.opacity = '0'; node.style.display = 'none'; }
  node.style.width = leaf.style.width;
  node.style.height = leaf.style.height;
  node.style.transform = leaf.style.transform;
  node.style.backgroundSize = leaf.style.backgroundSize;
  node.style.backgroundPosition = leaf.style.backgroundPosition;
  return node;
}

function cssVolumeRotation(camera: VolumeLocalCamera): readonly number[] {
  const view = cameraView(camera);
  // PolyCSS receives prepared vertices in [y,x,z] order. This is the single
  // renderer-owned CSS reflection; the physical quaternion remains proper.
  return [view[1]!, view[0]!, view[2]!, view[4]!, view[3]!, view[5]!, view[7]!, view[6]!, view[8]!];
}

function cameraView(camera: VolumeLocalCamera): readonly number[] {
  return cssViewFromOrientation(camera.orientationXyzw);
}

/** Texture demand uses the same axis weights and prepared frustum bounds as publication. */
export function preparedVolumeTexturePaths(payload: PreparedCssVolume, publication: VolumeCameraPublication): readonly string[] {
  const strengths = axisWeights(presentPhysicalPoseInVolume(publication.world.pose, payload.frame), payload.stacks, payload.frame.boundsUnits);
  const transform = preparedVolumeCameraTransform(publication, payload.frame, 50);
  const planes = createPreparedLeafFrustum(transform.rotation, transform.translationCssPixels, publication.viewport);
  const paths = new Set<string>();
  for (const [index, axis] of AXES.entries()) {
    if (strengths[index]!.weight <= 0) continue;
    for (const leaf of payload.stacks.find(stack => stack.axis === axis)!.leaves) {
      if (preparedLeafMayContribute(leaf.boundsCssPixels, planes)) paths.add(leaf.texturePath);
    }
  }
  return [...paths];
}

function axisWeights(camera: VolumeLocalCamera, stacks: PreparedCssVolume['stacks'],
  bounds: PreparedCssVolume['frame']['boundsUnits']): readonly { weight: number; opticalGain: number }[] {
  const matrix = worldRotationFromQuaternion(camera.orientationXyzw);
  const back: VolumeVector = [matrix[2]!, matrix[5]!, matrix[8]!];
  const length = Math.hypot(...back);
  const cosines = AXES.map((axis, index) => {
    const normal = stacks.find(stack => stack.axis === axis)?.normalUnits;
    return Math.abs(normal ? normal.reduce((sum, value, i) => sum + value * back[i]!, 0) : back[index]!) / length;
  });
  // A slab is a cut across the volume's other two axes. Through a flat volume (the Milky Way is 20 × 20 × 2.5 units)
  // a slab standing across the thin axis holds only a strip, and at an oblique view successive strips part into stripes.
  // Each axis is scaled by √(thinnest extent / its extent), so a thin axis keeps its slabs until √(2.5/20) ≈ 0.35 of the
  // view lies along it (20° from edge-on), where three optical copies still carry its gain. Equal extents are unscaled.
  const extents = AXES.map((_, index) => bounds.max[index]! - bounds.min[index]!), thinnest = Math.min(...extents);
  const strengths = cosines.map((cosine, index) => cosine * Math.sqrt(thinnest / extents[index]!));
  const maximum = Math.max(...strengths);
  return strengths.map((value, index) => {
    const t = Math.max(0, Math.min(1, (value - maximum + 0.16) / 0.16));
    const weight = t * t * (3 - 2 * t);
    // Crossing count is |d_i|*L/pitch_i, but each texture integrates pitch_i.
    // Restore the missing central-ray length before the normalized image mix; copies cap the gain at 3.
    return { weight, opticalGain: weight > 0 ? Math.max(1, 1 / cosines[index]!) : 1 };
  });
}

function escapeUrl(value: string): string { return value.replace(/["\\\n\r]/gu, character => `\\${character}`); }
function format(value: number): string { return Math.abs(value) < 1e-9 ? '0' : Number(value.toFixed(6)).toString(); }
function dot(matrix: readonly number[], offset: number, point: VolumeVector): number {
  return matrix[offset]! * point[0] + matrix[offset + 1]! * point[1] + matrix[offset + 2]! * point[2];
}
