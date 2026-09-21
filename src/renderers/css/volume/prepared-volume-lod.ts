import { mountPreparedCssVolume } from './prepared-volume-runtime.js';
import { projectVolumeImpostors } from './volume-impostor-projection.js';
import type { PreparedVolumeMountOptions, PreparedVolumeRuntime, VolumeCameraPublication } from './types.js';
import { nativeProjectedLength, nativeProjectedFade } from '../rendering/native-projection.js';
import { validatePreparedCssVolume } from './validation.js';

const AXES = ['x', 'y', 'z'] as const;

export interface PreparedVolumeLodRuntime extends PreparedVolumeRuntime {
  /** Replace prepared pixels and atlas sampling on one retained spatial topology. */
  setPresentation(payload: PreparedVolumeMountOptions['payload']): void;
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
    const runtime = mountPreparedCssVolume({ ...options, payload: initial });
    return Object.freeze({ ...runtime, setPresentation(payload: PreparedVolumeMountOptions['payload']) {
      const next = validatePreparedCssVolume(payload);
      if (!samePreparedVolumeTopology(initial, next)) throw new TypeError('Prepared volume presentation has a different topology.');
      runtime.setMaterials(materials(next));
    } });
  }
  const document = options.host.ownerDocument;
  const create = options.createElement ?? ((tag: string) => document.createElement(tag));
  const full = create('div'), distant = create('div');
  full.className = 'css-volume-detail'; distant.className = 'css-volume-impostors';
  for (const node of [full, distant]) Object.assign(node.style, {
    position: 'absolute', inset: '0', pointerEvents: 'none', display: 'none', transformStyle: 'flat',
  });
  const marker = create('span'); marker.hidden = true; full.append(marker);
  options.host.insertBefore(full, options.before); options.host.insertBefore(distant, options.before);
  const runtime = mountPreparedCssVolume({ ...options, payload: initial, host: full, before: marker });
  // The universe must remain visible outside the prepared cloud footprint.
  for (const root of runtime.roots) root.style.background = 'transparent';
  const views = new Map(bank.views.map(view => {
    const node = create('s');
    node.dataset.volumeImpostor = view.id;
    Object.assign(node.style, { position: 'absolute', left: '50%', top: '50%', display: 'none',
      pointerEvents: 'none', transformOrigin: '50% 50%', backgroundRepeat: 'no-repeat', backgroundSize: '100% 100%' });
    distant.append(node);
    return [view.id, node] as const;
  }));
  let presentation = initial;
  let destroyed = false, active: readonly string[] = [...views.keys()];
  const publish = (publication: VolumeCameraPublication) => {
    if (destroyed) return;
    const projection = projectVolumeImpostors(publication, options.payload.frame, bank, options.nativeFocalCss !== undefined);
    const { visible, volumeMix, diameterPixels, x, y } = projection;
    // Test hooks: rounded and written only on change, so a steady frame writes no attributes.
    const mixHook = String(Math.round(volumeMix * 1000) / 1000), diameterHook = String(Math.round(diameterPixels * 10) / 10);
    if (options.host.dataset.volumeDetailMix !== mixHook) options.host.dataset.volumeDetailMix = mixHook;
    if (options.host.dataset.volumeDiameterPixels !== diameterHook) options.host.dataset.volumeDiameterPixels = diameterHook;
    const responsive = options.nativeFocalCss !== undefined && Number.isFinite(diameterPixels);
    full.style.display = visible && (responsive || volumeMix > 0) ? 'block' : 'none';
    distant.style.display = visible && (responsive || volumeMix < 1) ? 'block' : 'none';
    if (responsive) options.host.style.setProperty('--native-volume-mix', nativeProjectedFade(diameterPixels,
      publication.viewport.focalPixels, options.nativeFocalCss!, bank.fullBelowDiameterPixels, bank.volumeAboveDiameterPixels));
    if (visible && (responsive || volumeMix > 0)) {
      runtime.publish(publication);
      full.style.opacity = responsive ? `calc(var(--native-volume-mix) * ${completedOpacity(runtime)})` : String(volumeMix * completedOpacity(runtime));
    }
    distant.style.opacity = responsive ? 'calc(1 - var(--native-volume-mix))' : String(1 - volumeMix);
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
  return Object.freeze({ roots: runtime.roots, publish, setPresentation(payload: PreparedVolumeMountOptions['payload']) {
    const next = validatePreparedCssVolume(payload);
    if (!samePreparedVolumeTopology(initial, next)) throw new TypeError('Prepared volume presentation has a different topology.');
    presentation = next;
    runtime.setMaterials(materials(next));
    for (const node of views.values()) node.style.backgroundImage = '';
  }, destroy() {
    if (destroyed) return; destroyed = true;
    runtime.destroy(); full.remove(); distant.remove();
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
