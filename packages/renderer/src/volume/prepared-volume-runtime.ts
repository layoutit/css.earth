import {hybridOpticalOpacity} from '@cssearth/core';
import { type PreparedLeafBounds, type PreparedCssVolume, type VolumeVector, type VolumeOpticalRole, validatePreparedCssVolume } from '@cssearth/objects';
import { createPreparedLeafFrustum, preparedLeafMayContribute } from '../rendering/culling/prepared-leaf-frustum.js';
import { presentPhysicalPoseInVolume, cssViewFromOrientation, worldRotationFromQuaternion, worldRotationCss } from '@cssearth/engine';
import type { PreparedVolumeMountOptions, PreparedMaterialVolumeRuntime, VolumeCameraPublication, VolumeLocalCamera, PreparedVolumeCameraTransform } from './types.js';

import { revealLayer } from '../rendering/dom/layer-reveal.js';
import { createSettlePacer } from '../rendering/loading/settle-pacer.js';
import { mountPreparedVolumeComponents, preparedVolumeParts } from './prepared-volume-components.js';

/** A leaf image this large decodes off the main thread before it shows again (layer-reveal.ts). */
export const LARGE_IMAGE_PIXELS = 1 << 20;

const AXES = ['x', 'y', 'z'] as const;
/** The most a stack's root is ever opaque: never 1. Safari paints every slice displayed under a root again when the
 * root's opacity leaves or reaches 1. On the iPad, with the camera still and 88 slices displayed, 1 to 0.99 made a frame
 * of 54 to 55 ms, 0.999 to 1 one of 30, and 0.99 to 0.98 one of 17, which is no cost; a drag across M42 had 179 and 490
 * paints in one frame at its changes of axis, and with this ceiling its longest frame mid-drag fell from 77 to 79 ms
 * to 39 to 41 (2026-10-04). Against the same views at opacity 1, at rest: headless WebKit drew M42 and the Milky Way
 * the same to the pixel and 174 to 517 pixels of M31 differently, by at most 6 of 255; headless Chromium drew 1.3% to
 * 3.3% of an M42 view's pixels and 1.2% to 4.0% of an M31 view's differently, nearly all by 1 and at most by 15. */
export const STACK_OPACITY_CEILING = 0.999;
/** A stack joins every JOIN_STRIDE-th slice first, so one part of the way in is the whole cloud thinner, not a part of it. */
const JOIN_STRIDE = 8;
/** What a slice joining the layer tree costs the pacer, in its units, and how many slices join in a frame. */
const JOIN_UNITS = 2, JOIN_SLICES = 8;

/** Mounts fixed projective slice geometry. It owns DOM transforms only; all geometry and pixels are prepared. */
export function mountPreparedCssVolume(options: PreparedVolumeMountOptions): PreparedMaterialVolumeRuntime {
  const payload = validatePreparedCssVolume(options.payload);
  if (payload.components) return mountPreparedVolumeComponents({ ...options, payload }, mountPreparedCssVolume);
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
  // An axis stack's nodes by optical copy (0 is the slice itself), in the order they join; the `alpha` of copies 1 and 2;
  // whether each copy is `wanted`; and `shown`, how many of a copy's nodes are displayed: its first ones.
  const opticalCopies: { nodes: HTMLElement[][]; alpha: number[]; wanted: boolean[]; shown: number[] }[] = [];
  const hybridNodes: { node: HTMLElement; role: VolumeOpticalRole; opacity: number }[][] = [];
  // A bank whose images hold their three copies (mergedOpticalCopies) draws one layer a slice, at opacity gain / 3: on a
  // phone the 52/52/26 bank's 390 layers outran Chrome's 256 MB tile budget and drew empty in 248 frames of an 8 s turn.
  const merged = payload.mergedOpticalCopies === 3, copiesPerLeaf = merged ? 1 : 3;
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
    if (payload.stackCompositing === 'transparent-normalized') root.style.background = 'transparent';
    // A stack that has never been published, or one whose axis carries no weight, stays out of the layer tree. Hidden
    // is not free: on an iPhone each unpublished stack kept its slices composited, and the compositor re-committed
    // them on every camera change.
    root.style.display = options.residentStacks ? 'block' : 'none';
    root.style.visibility = options.residentStacks ? 'visible' : 'hidden';
    // Where each slice stands in its stack's joining order; the document keeps the prepared order.
    const joining = stack.leaves.map((_, order) => order).sort((a, b) => a % JOIN_STRIDE - b % JOIN_STRIDE || a - b);
    const place = new Map(joining.map((order, position) => [stack.leaves[order]!, position]));
    const copies = { nodes: [[], [], []] as HTMLElement[][], alpha: [NaN, NaN], wanted: [false, false, false], shown: [0, 0, 0] };
    opticalCopies.push(copies);
    const hybrid: typeof hybridNodes[number] = []; hybridNodes.push(hybrid);
    for (const leaf of stack.leaves) {
      const textureUrl = options.resolveResource(leaf.texturePath);
      const bounded = { nodes: [] as HTMLElement[], bounds: leaf.boundsCssPixels ?? frameBounds, shown: null as boolean | null, hidden: false,
        axis: AXES.indexOf(axis), large: leaf.widthPx * leaf.heightPx >= LARGE_IMAGE_PIXELS ? textureUrl : null };
      boundedLeaves.push(bounded);
      materialLeaves.push({ axis: AXES.indexOf(axis), leaf: bounded });
      pendingTextures[AXES.indexOf(axis)]!.set(bounded, textureUrl);
      // Coincident copies reuse the same prepared pixels and transform. They
      // increase optical length without intersecting another axis's planes.
      for (let copy = 0; copy < copiesPerLeaf; copy++) {
        const node = createLeaf(create, leaf, copy);
        if (options.residentStacks) { node.style.display = ''; node.style.visibility = ''; }
        mesh.append(node);
        bounded.nodes.push(node);
        copies.nodes[copy]![place.get(leaf)!] = node;
        if (leaf.opticalSlab) hybrid.push({ node, role: leaf.opticalSlab.role, opacity: NaN });
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
  let previousStrengths: ReturnType<typeof axisWeights> | null = null;
  let previousOrientation: readonly number[] | null = null;
  const rootVisible: (boolean | null)[] = roots.map(() => null), rootOpacity = roots.map(() => '');
  // What the turning camera no longer needs leaves once it has stopped (docs/performance/motion-freezes-membership.md):
  // an axis stack whose weight reached zero, an optical copy whose alpha did, a slice that left the view. Until then each
  // stays as it is at opacity 0 or out of view. Hiding them as the camera turned dropped and remade hundreds of layers in
  // a frame: one throw of a drag at the Milky Way flipped `display` on 2,016 slices while it coasted (2026-10-03).
  // A stack leaves whole, in one frame: a frame that removes any of a stack's layers costs by the layers still there.
  // On the iPad M42's 628 displayed slices left in one frame of 42 to 50 ms; 16 a frame, eight frames of 34 to 93 ms;
  // 64 a frame, 91 and 37 ms (2026-10-04, the camera still).
  const rootDisplayed = roots.map(() => Boolean(options.residentStacks)), leavingLeaves = new Set<typeof boundedLeaves[number]>();
  const retire = createSettlePacer((budget, moving) => {
    if (destroyed || moving || options.residentStacks) return 0;
    let written = 0;
    for (const leaf of leavingLeaves) {
      if (written >= budget) return written;
      leavingLeaves.delete(leaf);
      if (leaf.shown === false) { leaf.hidden = true; for (const node of leaf.nodes) { node.style.visibility = 'hidden'; written++; } }
    }
    for (const [index, copies] of opticalCopies.entries()) {
      if (written >= budget) return written;
      if (rootVisible[index] === false && rootDisplayed[index]) {
        // A zero-weight axis stack leaves layout and compositing, not just paint.
        roots[index]!.style.visibility = 'hidden'; roots[index]!.style.display = 'none'; rootDisplayed[index] = false; written++;
      }
      for (let copy = 0; copy < 3; copy++) {
        if (copies.wanted[copy]) continue;
        const nodes = copies.nodes[copy]!;
        for (let each = 0; each < copies.shown[copy]!; each++) nodes[each]!.style.display = 'none';
        written += copies.shown[copy]! * JOIN_UNITS; copies.shown[copy] = 0;
      }
    }
    return written;
  });
  // What the camera turns towards joins a share a frame, moving or not, and the first frames of a join the least: each
  // slice is a layer with a surface of its own, and a stack shown whole made hundreds in one frame. A drag across M42
  // (stacks of 314, 439 and 88 slices, each with its first copy) had three or four frames of 130 to 200 ms at each
  // change of axis on the iPad, spent making surfaces in the GPU process, Safari and the display server while the
  // page's own thread waited (2026-10-04). Paced, a change of axis still has a frame of 30 to 45 ms: the first change
  // to a stack's slices after half a second's pause (one slice shown, one slice's opacity) made a frame of 36 to 42 ms
  // with the camera still, the ones after it none.
  // Eight slices join a frame, whatever the pacer's budget is. The share used to double to 32: through three turns on
  // the iPad that cost the Crab (513 to 570 slices a stack) 726 ms beyond 17 ms a frame with 16 frames over 33 ms,
  // against 321 ms and 6 at eight a frame, and M42 (264 to 1,317 smaller slices) 430 ms and 11 frames against 218 and
  // 5 (six runs each, 2026-10-06). A share that followed the pacer's budget between 8 and 32 did no better than 32 on
  // the Crab (610 against 643 ms, four runs each), and a budget alone would join a slice a frame where every frame is
  // slow (headless Chromium showed 84 of a copy's 88 slices five seconds after a turn). The price is the time to
  // fill: a stack of 570 slices is whole at an eighth of its density after 9 frames and full after 71, where it was
  // full after 19. The numbers this replaced (2026-10-04: 8 a frame none over 21 ms, 32 a frame one of 33 ms) were
  // taken while Safari drew nothing of a stack that joined, so a join cost it nothing.
  // A stack's root is displayed in the frame its first slices are, never before: Safari does not draw a stack whose
  // camera was first displayed with no slice under it, however many join afterwards. M42's stack along x, shown empty
  // and then joined 16 slices a frame with the camera still, drew nothing on the iPad (its 628 slices displayed, in
  // view, their image decoded) until its camera was hidden and shown again; displayed together with its first 16
  // slices and joined at the same pace, it drew (2026-10-06). A reader who turned a nebula a quarter of the way round
  // lost it: in a recorded visit to M42 it was gone from the third turn to the end, 7 s, and the Crab for 11 s.
  const join = createSettlePacer(() => {
    if (destroyed || options.residentStacks) return 0;
    const allowed = JOIN_SLICES * JOIN_UNITS;
    let written = 0;
    for (const [index, copies] of opticalCopies.entries()) for (let copy = 0; copy < 3; copy++) {
      if (!copies.wanted[copy]) continue;
      const nodes = copies.nodes[copy]!;
      while (copies.shown[copy]! < nodes.length) {
        if (written >= allowed) return written;
        nodes[copies.shown[copy]!++]!.style.display = ''; written += JOIN_UNITS;
        if (!rootDisplayed[index]) displayRoot(index);
      }
    }
    return written;
  }, { holdWhile: 'never' });
  function displayRoot(index: number) {
    const root = roots[index]!;
    root.style.visibility = 'visible'; root.style.display = 'block'; rootDisplayed[index] = true;
    for (const leaf of boundedLeaves) if (leaf.axis === index && leaf.large && leaf.shown !== false) for (const node of leaf.nodes) revealLayer(node, leaf.large);
  }
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
    if (!options.residentStacks && clipView !== previousClipView) {
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
    const localCamera = presentPhysicalPoseInVolume(world.pose, payload.frame);
    const strengths = axisWeights(localCamera, payload.stacks, payload.frame.boundsUnits);
    for (const [axis, pending] of pendingTextures.entries()) {
      if (!options.residentStacks && strengths[axis]!.weight <= 0) continue;
      for (const [leaf, url] of pending) {
        if (!options.residentStacks && !leaf.shown) continue;
        const image = `url("${escapeUrl(url)}")`;
        for (const node of leaf.nodes) node.style.backgroundImage = image;
        pending.delete(leaf);
      }
    }
    // Optical length depends on direction; thin-volume mixing also follows
    // distance. Compare their values so pure zoom can update the handover while
    // unchanged coefficients still leave retained optical copies untouched.
    if (previousOrientation?.every((value, index) => value === world.pose.orientationXyzw[index]) &&
      previousStrengths && previousStrengths.every((value, index) =>
      value.weight === strengths[index]!.weight && value.opticalGain === strengths[index]!.opticalGain)) return;
    previousStrengths = strengths;
    previousOrientation = [...world.pose.orientationXyzw];
    retire.published();

    const opacities = payload.stackCompositing === 'transparent-normalized'
      ? transparentStackOpacities(strengths.map(value => value.weight)) : completedStackOpacities(strengths.map(value => value.weight));
    for (let index = 0; index < roots.length; index++) {
      const root = roots[index]!;
      const { weight, opticalGain } = strengths[index]!;
      const visible = weight > 0, opacity = String(opacities[index]);
      // A stack turned to is displayed by the join, with its first slices.
      if (rootVisible[index] !== visible) rootVisible[index] = visible;
      if (rootOpacity[index] !== opacity) { root.style.opacity = opacity; rootOpacity[index] = opacity; }
      // Opacity belongs to atomic images, never the mesh (which flattens 3D).
      // n full copies plus a fraction f give T=(1-alpha)^n*(1-f*alpha).
      // Integer gains are exact; the fractional step linearly approximates alpha.
      const copies = opticalCopies[index]!;
      // A shown copy keeps an 8-bit step of alpha inside [0.001, 0.999] and stays joined while its stack is visible, so a
      // turn never crosses opacity 0 or 1 and never changes the layer tree; each frame stays within 1/510 alpha of exact.
      // Copies crossing 0/1 and leaving or joining mid-turn made WebKit recomposite for 25-37 ms. iPad drag at the stripe
      // view, 390 frames, interleaved (2026-10-19): frames over 20 ms 7/5/6 against 12/13/27, over 33 ms 1/1/1 against
      // 5/6/13. A hidden stack's copies follow the exact value and retire as before.
      if (merged) {
        if (hybridNodes[index]!.length) {
          for (const entry of hybridNodes[index]!) {
            const alpha = visible ? hybridOpticalOpacity(entry.role, opticalGain) : 0;
            if (alpha !== entry.opacity) { entry.opacity = alpha; entry.node.style.opacity = String(alpha); }
          }
          if (visible !== copies.wanted[0]) { copies.wanted[0] = visible; if (visible) join.request(); else retire.request(); }
          continue;
        }
        // The image is three copies at alpha 1 - (1 - a)^3; gain / 3 of it stands for `gain` copies (exact where faint).
        const alpha = visible ? Math.min(0.999, Math.max(0.001, Math.round(Math.min(3, opticalGain) / 3 * 255) / 255)) : 0;
        if (alpha !== copies.alpha[0]) { copies.alpha[0] = alpha; const value = String(alpha); for (const node of copies.nodes[0]!) node.style.opacity = value; }
        if (visible !== copies.wanted[0]) { copies.wanted[0] = visible; if (visible) join.request(); else retire.request(); }
        continue;
      }
      for (let copy = 1; copy < 3; copy++) {
        const exact = Math.min(1, Math.max(0, opticalGain - copy));
        const alpha = visible ? Math.min(0.999, Math.max(0.001, Math.round(exact * 255) / 255)) : exact;
        const previous = copies.alpha[copy - 1]!;
        if (alpha === previous) continue;
        copies.alpha[copy - 1] = alpha;
        const value = String(alpha);
        for (const node of copies.nodes[copy]!) node.style.opacity = value;
      }
      for (let copy = 0; copy < 3; copy++) {
        const wanted = visible && (copy === 0 || copies.alpha[copy - 1]! > 0);
        if (wanted === copies.wanted[copy]) continue;
        copies.wanted[copy] = wanted;
        if (wanted) join.request(); else retire.request();
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
    destroyed = true; retire.destroy(); join.destroy();
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
  // A slice is out of layout and compositing until its stack is turned to and it joins (`join`); a zero-alpha optical
  // copy contributes nothing.
  node.style.display = 'none';
  if (copy > 0) node.style.opacity = '0';
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
  if (payload.components) return [...new Set(preparedVolumeParts(payload).flatMap(part => preparedVolumeTexturePaths(part, publication)))];
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

export function axisWeights(camera: VolumeLocalCamera, stacks: PreparedCssVolume['stacks'],
  bounds: PreparedCssVolume['frame']['boundsUnits']): readonly { weight: number; opticalGain: number }[] {
  const matrix = worldRotationFromQuaternion(camera.orientationXyzw);
  const back: VolumeVector = [matrix[2]!, matrix[5]!, matrix[8]!];
  const length = Math.hypot(...back);
  const cosines = AXES.map((axis, index) => {
    const normal = stacks.find(stack => stack.axis === axis)?.normalUnits;
    return Math.abs(normal ? normal.reduce((sum, value, i) => sum + value * back[i]!, 0) : back[index]!) / length;
  });
  const extents = AXES.map((_, index) => bounds.max[index]! - bounds.min[index]!), thinnest = Math.min(...extents);
  const thin = extents.indexOf(thinnest), aspect = thinnest / Math.max(...extents);
  let weights: number[];
  const drawn = AXES.map(axis => (stacks.find(stack => stack.axis === axis)?.leaves.length ?? 0) > 0);
  if (aspect < .5 && drawn.every(Boolean)) {
    // The thin stack owns oblique views. At shallow angles, dissolve side banks
    // across their azimuth bisector too: an argmax there swaps whole images at 45 degrees.
    const sideMaximum = Math.max(...cosines.filter((_, index) => index !== thin));
    const sideWeights = cosines.map((cosine, index) => {
      const t = index === thin ? 0 : Math.max(0, Math.min(1, (cosine - sideMaximum + .16) / .16));
      return t * t * (3 - 2 * t);
    });
    const sideTotal = sideWeights.reduce((sum, weight) => sum + weight, 0);
    // Perspective spreads local sight angles across a nearby thin volume. Keep
    // the side bank longer there; outside one long frame extent the accepted
    // far-view window is unchanged. Smoothstep gives zero slope at both ends.
    const distance = Math.hypot(...camera.positionUnits.map((value, index) => value - (bounds.min[index]! + bounds.max[index]!) / 2));
    const approach = Math.max(0, Math.min(1, 1 - distance / Math.max(...extents)));
    const proximity = approach * approach * (3 - 2 * approach);
    const edge = Math.max(.02, aspect) + .4 * proximity;
    const t = Math.max(0, Math.min(1, (cosines[thin]! - edge * .5) / (edge * .5)));
    const face = t * t * (3 - 2 * t);
    weights = AXES.map((_, index) => index === thin ? face : (1 - face) * sideWeights[index]! / sideTotal);
  } else {
    const strengths = cosines.map((value, index) => drawn[index] ? value * Math.sqrt(thinnest / extents[index]!) : 0);
    const maximum = Math.max(...strengths);
    weights = strengths.map((value, index) => {
      if (!drawn[index]) return 0;
      const t = Math.max(0, Math.min(1, (value - maximum + .16) / .16));
      return t * t * (3 - 2 * t);
    });
  }
  return weights.map((weight, index) => ({ weight, opticalGain: weight > 0 ? Math.max(1, 1 / cosines[index]!) : 1 }));
}

/** Opaque completed images, in DOM back-to-front order. Their total contribution is always the ceiling. */
export function completedStackOpacities(weights: readonly number[]): readonly number[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let front = 0;
  const result = weights.map(() => 0);
  for (let index = weights.length - 1; index >= 0; index--) {
    const share = total > 0 ? STACK_OPACITY_CEILING * weights[index]! / total : 0;
    result[index] = share / (1 - front);
    front += share;
  }
  return result;
}

/** Source-over of transparent groups is bounded by their normalized weighted sum, for every pixel alpha. */
export function transparentStackOpacities(weights: readonly number[]): readonly number[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return weights.map(weight => total > 0 ? STACK_OPACITY_CEILING * weight / total : 0);
}

function escapeUrl(value: string): string { return value.replace(/["\\\n\r]/gu, character => `\\${character}`); }
function format(value: number): string { return Math.abs(value) < 1e-9 ? '0' : Number(value.toFixed(6)).toString(); }
function dot(matrix: readonly number[], offset: number, point: VolumeVector): number {
  return matrix[offset]! * point[0] + matrix[offset + 1]! * point[1] + matrix[offset + 2]! * point[2];
}
