import { samePreparedVolumeTopology, validatePreparedCssVolume } from '@cssearth/objects';
import { presentPhysicalPoseInVolume } from '@cssearth/engine';
import { mountGalaxyBacking } from '../universe/galaxy/galaxy-backing.js';
import { writeStyle } from '../rendering/dom/retained-write.js';
import { axisWeights, completedStackOpacities, mountPreparedCssVolume } from './prepared-volume-runtime.js';
import { cylindricalSideSelection, cylindricalSideTransform } from './cylindrical-far-plane.js';
import { projectVolumeDiameter } from './volume-impostor-projection.js';
import type { PreparedVolumeLodRuntime, PreparedVolumeMountOptions, PreparedVolumeRuntime, VolumeCameraPublication } from './types.js';

const AXES = ['x', 'y', 'z'] as const;

/** Interpolate baked projected-light coefficients from the shared axis optical gain only. */
export function farGainOpacity(samples: readonly (readonly [number, number])[], gain: number): number {
  const effective = Math.max(1, gain);
  for (let index = 1; index < samples.length; index++) {
    const [g1, t1] = samples[index]!, [g0, t0] = samples[index - 1]!;
    if (effective <= g1) return Math.min(.999, Math.max(.001, t0 + (t1 - t0) * (effective - g0) / (g1 - g0)));
  }
  return samples.at(-1)![1];
}

/** The top pair is fixed; both side atlas slots share one cylindrical plane. Only one presentation is attached; a coast keeps the
 * resident presentation until a settled publication can exchange it. Neither bank is rebuilt on a zoom. */
export function mountPreparedVolumeFarPlanes(options: PreparedVolumeMountOptions,
  completedOpacity: (runtime: PreparedVolumeRuntime) => number): PreparedVolumeLodRuntime {
  const initial = validatePreparedCssVolume(options.payload), bank = initial.farPlanes!;
  const document = options.host.ownerDocument;
  // The slabs mount into the host exactly as they do without far pictures: any box between them flashed the galaxy black mid-zoom.
  const farHost = document.createElement('div');
  Object.assign(farHost.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
  farHost.className = 'css-volume-far-planes';
  let pending: PreparedVolumeMountOptions['payload'] | null = null;
  let current = initial, full: ReturnType<typeof mountPreparedCssVolume> | null = null;
  let pictures: { root: HTMLElement; layers: ReturnType<typeof mountGalaxyBacking>[] }[] = [];
  const roots: HTMLElement[] = [];
  let selected: 'far' | 'full' | null = null, allowed = true, destroyed = false;
  let focalKey = '', focalCssPixels = Number.NaN, heldView: number | null = null, heldOffset: number | null = null;
  let last: VolumeCameraPublication | null = null;
  // A crossing is a crossfade of the pictures over the slabs, both black-matted: the slabs are placed under the pictures,
  // and only the pictures' opacity moves, towards 1 for the pictures and 0 for the slabs, over FADE_MILLISECONDS of
  // animation frames. The outgoing presentation leaves when the fade ends, waiting out a coast.
  const FADE_MILLISECONDS = 250;
  let fade = 1, fadeFrom = 1, fadeTo = 1, fadeStart = 0, fadeFrame = 0;
  const clock = () => document.defaultView?.performance?.now() ?? Date.now();
  // The pictures take over only once decoded, or after three seconds of trying: until then the slabs keep drawing the
  // galaxy. Readiness publishes the last camera again, so the exchange does not wait for the next motion.
  let picturesReady = false;
  const ready = () => { if (picturesReady) return; picturesReady = true; if (last && !destroyed && !options.coasting?.()) publish(last); };
  const view = document.defaultView as (Window & { Image?: typeof Image }) | null;
  const pictureUrls = [...bank.stacks[0]!.leaves.map(leaf => leaf.texturePath), bank.side.leaf.texturePath, bank.side.highTexturePath]
    .map(path => options.resolveResource(path));
  if (view?.Image && typeof view.Image.prototype.decode === 'function') {
    void Promise.race([Promise.all(pictureUrls.map(url => { const image = new view.Image!(); image.src = url; return image.decode().catch(() => {}); })),
      new Promise(resolve => view.setTimeout(resolve, 3000))]).then(ready);
  } else picturesReady = true;
  function detail() {
    if (!full) {
      full = mountPreparedCssVolume({ ...options, payload: current, residentStacks: true });
      // Off document until a publication selects them; the swap puts them back where they were mounted.
      for (const root of full.roots) root.remove();
    }
    return full;
  }
  function distant() {
    if (!pictures.length) pictures = ['side-0', 'side-1', 'z'].map(axis => {
      const root = document.createElement('div');
      Object.assign(root.style, { position: 'absolute', inset: '0', background: '#000', pointerEvents: 'none' });
      root.dataset.volumeFarAxis = axis;
      farHost.append(root);
      const side = current.farPlanes!.side;
      const leaves = axis === 'z' ? current.farPlanes!.stacks[0]!.leaves : [side.leaf, { ...side.leaf, texturePath: side.highTexturePath }];
      const layers = leaves.map((leaf, index) =>
        mountGalaxyBacking({ host: root, before: null, payload: { id: `${current.id}-far-${axis}-${index}`, frame: current.frame, leaf },
          resolveResource: options.resolveResource, unitScale: options.unitScale, nativeFocalCss: options.nativeFocalCss, atlasColumns: axis === 'z' ? 1 : side.views, coasting: options.coasting }));
      return { root, layers };
    });
    return pictures;
  }
  const publish = (publication: VolumeCameraPublication) => {
    if (destroyed) return;
    last = publication;
    if (pending && !options.coasting?.()) applyPresentation(pending);
    // The transform owner validates reference frame and viewport for either presentation.
    const projection = projectVolumeDiameter(publication, current.frame, bank.radiusUnits);
    let diameter = projection.diameterPixels;
    if (options.nativeFocalCss && document.defaultView) {
      const key = `${publication.viewport.widthPixels}x${publication.viewport.heightPixels}`;
      if (key !== focalKey && !options.coasting?.()) {
        focalKey = key;
        options.host.style.setProperty('outline-offset', options.nativeFocalCss);
        const resolved = document.defaultView.getComputedStyle?.(options.host).getPropertyValue('outline-offset').trim();
        focalCssPixels = resolved && /^\d*\.?\d+px$/u.test(resolved) ? Number.parseFloat(resolved) : Number.NaN;
        if (!Number.isFinite(focalCssPixels)) options.host.style.removeProperty('outline-offset');
      }
      if (Number.isFinite(focalCssPixels)) diameter *= focalCssPixels / publication.viewport.focalPixels;
    }
    // A tenth of hysteresis: a zoom resting on the threshold does not exchange the presentations every frame.
    const threshold = selected === 'full' ? bank.belowDiameterPixels * .9 : bank.belowDiameterPixels;
    // Denied detail, the pictures are the whole presentation, decoded or not.
    const wanted = allowed && (diameter >= threshold || !picturesReady) ? 'full' : 'far';
    if (wanted !== selected && !options.coasting?.()) {
      // The first presentation shows at once; a crossing keeps the outgoing one until the fade ends.
      const first = selected === null;
      if (wanted === 'full' || !first) detail();
      if (wanted === 'far' || !first) distant();
      if (!full!.roots[0]!.isConnected && (wanted === 'full' || !first)) for (const root of full!.roots) options.host.insertBefore(root, farHost.isConnected ? farHost : options.before);
      if (!farHost.isConnected && (wanted === 'far' || !first)) options.host.insertBefore(farHost, options.before);
      selected = wanted; fadeTo = wanted === 'far' ? 1 : 0;
      fadeFrom = first ? fadeTo : fade; fade = fadeFrom; fadeStart = clock();
      if (fade !== fadeTo) step();
      shown();
    }
    if (full?.roots[0]?.isConnected) full.publish(publication);
    if (farHost.isConnected) {
      const local = presentPhysicalPoseInVolume(publication.world.pose, current.frame);
      const strengths = axisWeights(local, current.stacks, current.frame.boundsUnits);
      const centre = current.frame.boundsUnits.min.map((value, i) => (value + current.frame.boundsUnits.max[i]!) / 2);
      const delta = local.positionUnits.map((value, i) => value - centre[i]!);
      const azimuth = Math.atan2(delta[1]!, delta[0]!);
      const elevation = Math.atan2(delta[2]!, Math.hypot(delta[0]!, delta[1]!));
      // A coast keeps the two resident views and clamps their mix: it never changes which views are drawn.
      const coast = options.coasting?.() ?? false;
      const selection = cylindricalSideSelection(current.farPlanes!.side, azimuth, elevation, coast ? heldView : null, coast ? heldOffset : null);
      heldView = selection.indices[0]!; heldOffset = selection.offset;
      const sideWeight = strengths[0]!.weight + strengths[1]!.weight;
      const opacities = completedStackOpacities([sideWeight * (1 - selection.mix), sideWeight * selection.mix, strengths[2]!.weight]);
      for (const [index, picture] of pictures.entries()) {
        for (const layer of picture.layers) layer.publish(publication);
        if (index < 2) {
          for (const layer of picture.layers) {
            layer.setPlaneTransform(cylindricalSideTransform(current.farPlanes!.side.leaf, azimuth));
            layer.setFrame(selection.indices[index]!);
          }
          picture.layers[0]!.setOpacity(selection.coefficients[index]![0]);
          picture.layers[1]!.setOpacity(selection.coefficients[index]![1]);
        } else {
          picture.layers[0]!.setOpacity(.999);
          picture.layers[1]!.setOpacity(farGainOpacity(current.farPlanes!.gainBlend[0]!.samples, strengths[2]!.opticalGain));
        }
        writeStyle(picture.root, 'opacity', String(opacities[index]));
      }
      writeStyle(farHost, 'opacity', String(fade * completedOpacity(runtime)));
    }
  };
  function shown() {
    roots.splice(0, roots.length, ...(full?.roots[0]?.isConnected ? full.roots : []), ...(farHost.isConnected ? pictures.map(picture => picture.root) : []));
  }
  // The fade's animation frames write only the pictures' opacity; the faded-out presentation then leaves the document.
  function step() {
    const view = document.defaultView;
    if (fadeFrame || destroyed) return;
    if (!view || typeof view.requestAnimationFrame !== 'function') { retire(); return; }
    const advance = () => {
      fadeFrame = 0;
      if (destroyed) return;
      const t = Math.min(1, (clock() - fadeStart) / FADE_MILLISECONDS);
      fade = fadeFrom + (fadeTo - fadeFrom) * t * t * (3 - 2 * t);
      if (farHost.isConnected) writeStyle(farHost, 'opacity', String(fade * completedOpacity(runtime)));
      if (t < 1 || options.coasting?.()) fadeFrame = view.requestAnimationFrame(advance);
      else retire();
    };
    fadeFrame = view.requestAnimationFrame(advance);
  }
  function retire() {
    fade = fadeTo;
    if (fadeTo === 1) { for (const root of full?.roots ?? []) root.remove(); writeStyle(farHost, 'opacity', String(completedOpacity(runtime))); }
    else farHost.remove();
    shown();
  }
  function applyPresentation(next: PreparedVolumeMountOptions['payload']) {
    current = next; pending = null;
    full?.setMaterials(AXES.flatMap(axis => next.stacks.find(stack => stack.axis === axis)!.leaves.map(leaf => ({
      textureUrl: options.resolveResource(leaf.texturePath), backgroundSize: leaf.style.backgroundSize, backgroundPosition: leaf.style.backgroundPosition,
    }))));
    for (const [index, picture] of pictures.entries()) for (const [level, layer] of picture.layers.entries()) {
      const bank = next.farPlanes!;
      layer.setTexture(index === 2 ? bank.stacks[0]!.leaves[level]!.texturePath : level ? bank.side.highTexturePath : bank.side.leaf.texturePath);
    }
  }
  const runtime: PreparedVolumeLodRuntime = Object.freeze({ roots, publish,
    setDetail(value: boolean) { allowed = value; },
    setPresentation(payload: PreparedVolumeMountOptions['payload']) {
      const next = validatePreparedCssVolume(payload);
      if (!samePreparedVolumeTopology(initial, next)) throw new TypeError('Prepared volume presentation has a different topology.');
      pending = next;
      if (!options.coasting?.()) applyPresentation(next);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true; if (fadeFrame) document.defaultView?.cancelAnimationFrame?.(fadeFrame); full?.destroy(); for (const picture of pictures) for (const layer of picture.layers) layer.destroy(); farHost.remove();
    },
  });
  // Prepare the next depth presentation ahead of a driven crossing, keeping every slab off document until selected.
  if (!options.lazyDetail) detail();
  return runtime;
}
