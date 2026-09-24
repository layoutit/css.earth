import { mountPreparedVolumePlanes } from './prepared-volume-planes.js';
import { mountPreparedCssVolume } from './prepared-volume-runtime.js';
import { projectVolumeImpostors } from './volume-impostor-projection.js';
import type { PreparedVolumeMountOptions, PreparedVolumeRuntime, VolumeCameraPublication } from './types.js';
import { nativeProjectedLength, nativeProjectedFade, nativeProjectedMix } from '../rendering/native-projection.js';
import { validatePreparedCssVolume } from './validation.js';

const AXES = ['x', 'y', 'z'] as const;

export interface PreparedVolumeLodRuntime extends PreparedVolumeRuntime {
  /** Replace prepared pixels and atlas sampling on one retained spatial topology. */
  setPresentation(payload: PreparedVolumeMountOptions['payload']): void;
  /** Whether the slice stack may present at all. Denied, the billboard views carry the cloud at every size; the
   * universe denies its unselected galaxy, whose slices are for the observer who selected it. */
  setDetail(allowed: boolean): void;
}

/** Geometry equality excludes resource identity and atlas sampling, which are presentation material. */
export function samePreparedVolumeTopology(leftInput: PreparedVolumeMountOptions['payload'], rightInput: PreparedVolumeMountOptions['payload']): boolean {
  const left = validatePreparedCssVolume(leftInput), right = validatePreparedCssVolume(rightInput);
  if (!frameEquals(left.frame, right.frame) || !anchorsEqual(left.anchors, right.anchors)) return false;
  for (const axis of AXES) {
    const a = left.stacks.find(stack => stack.axis === axis), b = right.stacks.find(stack => stack.axis === axis);
    if (!a || !b || !vectorEquals(a.normalUnits, b.normalUnits) || a.leaves.length !== b.leaves.length) return false;
    for (let index = 0; index < a.leaves.length; index++) {
      const x = a.leaves[index]!, y = b.leaves[index]!;
      if (x.id !== y.id || x.widthPx !== y.widthPx || x.heightPx !== y.heightPx ||
          !vectorEquals(x.centerUnits, y.centerUnits) || x.style.width !== y.style.width || x.style.height !== y.style.height ||
          x.style.transform !== y.style.transform || !boundsEqual(x.boundsCssPixels, y.boundsCssPixels)) return false;
    }
  }
  const leftPlanes = left.detailPlanes ?? [], rightPlanes = right.detailPlanes ?? [];
  if (leftPlanes.length !== rightPlanes.length || leftPlanes.some((leaf, index) => {
    const other = rightPlanes[index]!;
    return leaf.id !== other.id || leaf.widthPx !== other.widthPx || leaf.heightPx !== other.heightPx ||
      !vectorEquals(leaf.centerUnits, other.centerUnits) || leaf.style.width !== other.style.width ||
      leaf.style.height !== other.style.height || leaf.style.transform !== other.style.transform ||
      !boundsEqual(leaf.boundsCssPixels, other.boundsCssPixels);
  })) return false;
  const a = left.impostors, b = right.impostors;
  if (!a || !b) return a === b;
  if (a.radiusUnits !== b.radiusUnits || a.fullBelowDiameterPixels !== b.fullBelowDiameterPixels ||
      a.volumeAboveDiameterPixels !== b.volumeAboveDiameterPixels || a.views.length !== b.views.length) return false;
  return a.views.every((view, index) => {
    const other = b.views[index]!;
    return view.id === other.id && vectorEquals(view.back, other.back) && vectorEquals(view.right, other.right) && vectorEquals(view.down, other.down);
  });
}

/** Retain the full geometry, but publish it only when depth can occupy visible screen pixels. */
export function mountPreparedVolumeLod(options: PreparedVolumeMountOptions, completedOpacity: (runtime: PreparedVolumeRuntime) => number): PreparedVolumeLodRuntime {
  const initial = validatePreparedCssVolume(options.payload), bank = initial.impostors;
  const materials = (payload: PreparedVolumeMountOptions['payload']) => AXES.flatMap(axis =>
    payload.stacks.find(stack => stack.axis === axis)!.leaves.map(leaf => ({
      textureUrl: options.resolveResource(leaf.texturePath),
      backgroundSize: leaf.style.backgroundSize,
      backgroundPosition: leaf.style.backgroundPosition,
    })));
  if (!bank) {
    // Without impostors the full volume is the only presentation; it is built on the first publication, which a
    // bank sends only while it is visible.
    let runtime: ReturnType<typeof mountPreparedCssVolume> | null = null, current = initial, destroyed = false;
    const roots: HTMLElement[] = [];
    const build = () => { runtime = mountPreparedCssVolume({ ...options, payload: current }); roots.push(...runtime.roots); return runtime; };
    if (!options.lazyDetail) build();
    return Object.freeze({ roots, publish(publication: VolumeCameraPublication) {
      if (destroyed) return;
      (runtime ?? build()).publish(publication);
    }, setPresentation(payload: PreparedVolumeMountOptions['payload']) {
      const next = validatePreparedCssVolume(payload);
      if (!samePreparedVolumeTopology(initial, next)) throw new TypeError('Prepared volume presentation has a different topology.');
      current = next;
      runtime?.setMaterials(materials(next));
    }, setDetail(allowed: boolean) {
      if (!allowed) throw new TypeError('A volume without impostor views has only its slices to show.');
    }, destroy() { if (destroyed) return; destroyed = true; runtime?.destroy(); } });
  }
  const document = options.host.ownerDocument;
  const create = options.createElement ?? ((tag: string) => document.createElement(tag));
  // The fade resolves the viewport in CSS, so the projected diameter alone does not say whether a presentation
  // contributes. Resolving the focal length through a registered length property reads the value the fade uses,
  // without a layout measurement, and only a viewport change can alter it.
  const FOCAL_PROPERTY = '--native-volume-focal';
  let focalKey = '', focalCssPixels = Number.NaN, focalProperty: boolean | null = null;
  const resolveFocalPixels = (viewport: VolumeCameraPublication['viewport']): number => {
    const view = document.defaultView;
    if (options.nativeFocalCss === undefined || !view) return Number.NaN;
    if (focalProperty === null) {
      focalProperty = typeof view.CSS?.registerProperty === 'function';
      // Another mount in the same document registers the same property; that throw means it is already available.
      if (focalProperty) try { view.CSS.registerProperty({ name: FOCAL_PROPERTY, syntax: '<length>', inherits: false, initialValue: '0px' }); } catch { /* already registered */ }
    }
    if (!focalProperty) return Number.NaN;
    const key = viewport.widthPixels + 'x' + viewport.heightPixels;
    if (key !== focalKey) {
      focalKey = key;
      options.host.style.setProperty(FOCAL_PROPERTY, options.nativeFocalCss);
      focalCssPixels = Number.parseFloat(view.getComputedStyle(options.host).getPropertyValue(FOCAL_PROPERTY));
    }
    return focalCssPixels;
  };
  const full = create('div'), distant = create('div');
  full.className = 'css-volume-detail'; distant.className = 'css-volume-impostors';
  for (const node of [full, distant]) Object.assign(node.style, {
    position: 'absolute', inset: '0', pointerEvents: 'none', display: 'none', transformStyle: 'flat',
  });
  const marker = create('span'); marker.hidden = true; full.append(marker);
  let planes: ReturnType<typeof mountPreparedVolumePlanes> | null = null;
  options.host.insertBefore(full, options.before); options.host.insertBefore(distant, options.before);
  let presentation = initial;
  // The full volume is built the first time it contributes: at impostor sizes, and while the cloud is off screen,
  // its thousands of slice leaves would sit hidden in the document. `roots` stays one array and fills in then.
  let runtime: ReturnType<typeof mountPreparedCssVolume> | null = null;
  const roots: HTMLElement[] = [];
  const detail = () => {
    if (runtime) return runtime;
    if (presentation.detailPlanes) planes = mountPreparedVolumePlanes({ ...options, payload: presentation, host: full, before: marker });
    runtime = mountPreparedCssVolume({ ...options, payload: presentation, host: full, before: marker });
    // The universe must remain visible outside the prepared cloud footprint.
    for (const root of runtime.roots) { root.style.background = 'transparent'; roots.push(root); }
    return runtime;
  };
  // Eager mounts keep the original creation order: the slice renderer before the impostor views.
  if (!options.lazyDetail) detail();
  const views = new Map(bank.views.map(view => {
    const node = create('s');
    node.dataset.volumeImpostor = view.id;
    Object.assign(node.style, { position: 'absolute', left: '50%', top: '50%', display: 'none',
      pointerEvents: 'none', transformOrigin: '50% 50%', backgroundRepeat: 'no-repeat', backgroundSize: '100% 100%' });
    distant.append(node);
    return [view.id, node] as const;
  }));
  let destroyed = false, active: readonly string[] = [...views.keys()], detailAllowed = true;
  const publish = (publication: VolumeCameraPublication) => {
    if (destroyed) return;
    const projection = projectVolumeImpostors(publication, options.payload.frame, bank,
      !detailAllowed || options.nativeFocalCss !== undefined);
    const { visible, volumeMix, diameterPixels, x, y } = projection;
    // Test hooks: rounded and written only on change, so a steady frame writes no attributes.
    const mixHook = String(Math.round(volumeMix * 1000) / 1000), diameterHook = String(Math.round(diameterPixels * 10) / 10);
    if (options.host.dataset.volumeDetailMix !== mixHook) options.host.dataset.volumeDetailMix = mixHook;
    if (options.host.dataset.volumeDiameterPixels !== diameterHook) options.host.dataset.volumeDiameterPixels = diameterHook;
    const responsive = options.nativeFocalCss !== undefined && Number.isFinite(diameterPixels);
    // A presentation faded to zero still rasterises every node it keeps displayed: on an iPhone the full slice
    // volume cost hundreds of milliseconds a frame while its CSS opacity was 0. An impostor-sized cloud now leaves
    // rendering and its billboard views carry it. An unresolvable focal length keeps the earlier always-on behaviour.
    const nativeMix = responsive ? nativeProjectedMix(diameterPixels, publication.viewport.focalPixels,
      resolveFocalPixels(publication.viewport), bank.fullBelowDiameterPixels, bank.volumeAboveDiameterPixels) : Number.NaN;
    const mix = Number.isFinite(nativeMix) ? nativeMix : responsive ? Number.NaN : volumeMix;
    // With detail denied the billboard is the whole presentation, at full weight, whatever the projected size.
    const detailVisible = detailAllowed && visible && (Number.isNaN(mix) || mix > 0);
    const impostorsVisible = visible && (!detailAllowed || Number.isNaN(mix) || mix < 1);
    full.style.display = detailVisible ? 'block' : 'none';
    distant.style.display = impostorsVisible ? 'block' : 'none';
    if (responsive) options.host.style.setProperty('--native-volume-mix', nativeProjectedFade(diameterPixels,
      publication.viewport.focalPixels, options.nativeFocalCss!, bank.fullBelowDiameterPixels, bank.volumeAboveDiameterPixels));
    if (detailVisible) {
      const volume = detail();
      volume.publish(publication);
      planes?.publish(publication);
      full.style.opacity = responsive ? `calc(var(--native-volume-mix) * ${completedOpacity(volume)})` : String(volumeMix * completedOpacity(volume));
    }
    distant.style.opacity = !detailAllowed ? '' : responsive ? 'calc(1 - var(--native-volume-mix))' : String(1 - volumeMix);
    const next = projection.views.map(view => view.id);
    for (const id of active) if (!next.includes(id)) views.get(id)!.style.display = 'none';
    // Only the few contributing projections receive screen transforms. Textures and cloud geometry stay fixed.
    for (const view of projection.views) {
      const node = views.get(view.id)!;
      if (!node.style.backgroundImage) {
        const texture = presentation.impostors!.views.find(candidate => candidate.id === view.id)!;
        node.style.backgroundImage = `url("${escapeUrl(options.resolveResource(texture.texturePath))}")`;
      }
      node.style.display = 'block';
      node.style.opacity = String(view.weight);
      const length = (value: number) => responsive ? nativeProjectedLength(value, publication.viewport.focalPixels, options.nativeFocalCss!) : `${value}px`;
      node.style.width = length(diameterPixels); node.style.height = length(diameterPixels);
      node.style.transform = `translate(${length(x - diameterPixels / 2)},${length(y - diameterPixels / 2)}) matrix(${view.matrix.join(',')},0,0)`;
    }
    active = next;
    if (distant.dataset.activeViews !== String(next.length)) distant.dataset.activeViews = String(next.length);
  };
  return Object.freeze({ roots, publish, setDetail(allowed: boolean) { detailAllowed = allowed; }, setPresentation(payload: PreparedVolumeMountOptions['payload']) {
    const next = validatePreparedCssVolume(payload);
    if (!samePreparedVolumeTopology(initial, next)) throw new TypeError('Prepared volume presentation has a different topology.');
    presentation = next;
    planes?.setPresentation(next);
    runtime?.setMaterials(materials(next));
    for (const node of views.values()) node.style.backgroundImage = '';
  }, destroy() {
    if (destroyed) return; destroyed = true;
    runtime?.destroy(); planes?.destroy(); full.remove(); distant.remove();
  } });
}

function frameEquals(left: PreparedVolumeMountOptions['payload']['frame'], right: PreparedVolumeMountOptions['payload']['frame']): boolean {
  return left.referenceFrame === right.referenceFrame && left.epochJdTt === right.epochJdTt && left.metersPerUnit === right.metersPerUnit &&
    vectorEquals(left.originM, right.originM) && vectorEquals(left.localToReferenceXyzw, right.localToReferenceXyzw) &&
    vectorEquals(left.boundsUnits.min, right.boundsUnits.min) && vectorEquals(left.boundsUnits.max, right.boundsUnits.max);
}
function anchorsEqual(left: PreparedVolumeMountOptions['payload']['anchors'], right: PreparedVolumeMountOptions['payload']['anchors']): boolean {
  const a = left ?? [], b = right ?? [];
  return a.length === b.length && a.every((anchor, index) => anchor.id === b[index]!.id && vectorEquals(anchor.positionUnits, b[index]!.positionUnits));
}
function vectorEquals(left: readonly number[] | undefined, right: readonly number[] | undefined): boolean {
  return left === undefined || right === undefined ? left === right : left.length === right.length && left.every((value, index) => value === right[index]);
}
function boundsEqual(left: { min: readonly number[]; max: readonly number[] } | undefined,
  right: { min: readonly number[]; max: readonly number[] } | undefined): boolean {
  return left === undefined || right === undefined ? left === right : vectorEquals(left.min, right.min) && vectorEquals(left.max, right.max);
}
function escapeUrl(value: string): string { return value.replace(/["\\\n\r]/gu, character => `\\${character}`); }
