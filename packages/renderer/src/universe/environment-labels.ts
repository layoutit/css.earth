import { writeStyle } from '../rendering/retained-write.js';
import { screenPicking } from '../navigation/screen-picking.js';
import { DEFAULT_CONTEXT_LABEL_OPACITY } from '../labels/label-presentation.js';
import { presentPhysicalPoseInVolume } from '@cssearth/engine';
import { type DensityVolumeFrame, type PreparedCssSurfaceShell, type PreparedCssVolume } from '@cssearth/objects';
import { labelRectsOverlap } from '../labels/screen-label-layout.js';
import type { LabelScreenRect } from '../labels/screen-label-layout.js';
import { cssCameraAxesFromOrientation } from '@cssearth/engine';
import type { WorldCameraPose } from '@cssearth/objects';
import type { WorldCameraViewport } from '../navigation/world-camera.js';
import type { OpacityClock } from '../stars/opacity-clock.js';
import { createOpacityFader } from '../stars/opacity-fader.js';
import type { PreparedSurfaceShellStats } from '../shell/prepared-shell-runtime.js';

import { projectGalaxyCaptionAnchor } from './galaxy-caption-anchor.js';

const LABEL_GAP_PX = 8;
const LABEL_FADE_MS = 200;

export interface EnvironmentLabelPublication {
  readonly labelBudget?: import('../labels/universe-label-policy.js').LabelBudget;
  readonly world: WorldCameraPose;
  readonly viewport: WorldCameraViewport;
  readonly shellStats: readonly PreparedSurfaceShellStats[];
  readonly volumeLabelOpacity?: number;
  readonly blockerRects?: readonly LabelScreenRect[];
}

export interface EnvironmentLabelsRuntime {
  readonly root: HTMLElement;
  publish(publication: EnvironmentLabelPublication): readonly LabelScreenRect[];
  /** Caption an optional shell mounted after startup. */
  addShell(shell: PreparedCssSurfaceShell): void;
  labelExclusionRects(): readonly LabelScreenRect[];
  inspect(): Readonly<Record<string, HTMLElement>>;
  destroy(): void;
}

/** Retained captions for prepared environment geometry; this does not own a scene or navigation. */
export function mountEnvironmentLabels({ host, before, volume, shells, names = {}, links = {}, pickingHost = host, opacityClock, extentRadiusM }: {
  readonly host: HTMLElement;
  readonly before: Element;
  readonly volume: PreparedCssVolume;
  readonly shells: readonly PreparedCssSurfaceShell[];
  readonly opacityClock?: OpacityClock;
  readonly pickingHost?: HTMLElement;
  readonly links?: Readonly<Record<string, string>>;
  readonly names?: Readonly<Record<string, string>>;
  /** The volume's published stellar extent: its caption hangs under what is drawn of it, and hides inside this radius. */
  readonly extentRadiusM?: number;
}): EnvironmentLabelsRuntime {
  if (!host?.ownerDocument || before?.parentNode !== host) throw new TypeError('Environment labels need a host and child insertion point.');
  const document = host.ownerDocument, root = document.createElement('div');
  root.className = 'prepared-environment-labels';
  root.ariaHidden = Object.keys(links).length ? 'false' : 'true';
  // Zero-size root at the stage centre, children placed from it (world-context.css): a full-screen box above the globe
  // became a full-screen layer.
  const picking = screenPicking(pickingHost);
  const shellList = [...shells];
  const shellEntries = shellList.map(shell => createEntry(document, 'shell', shell.id, authoredName(names[shell.id]) ?? humanizeId(shell.id), shell.frame));
  const volumeEntry = createEntry(document, 'volume', volume.id, authoredName(names[volume.id]) ?? humanizeId(volume.id), volume.frame, links[volume.id]);
  const entries = [...shellEntries, volumeEntry];
  if (extentRadiusM !== undefined && !(extentRadiusM > 0 && Number.isFinite(extentRadiusM))) throw new TypeError(`${volume.id}: stellar extent must be a positive radius in metres, got ${extentRadiusM}.`);
  const extentUnits = extentRadiusM === undefined ? 0 : extentRadiusM / volume.frame.metersPerUnit;
  const drawnUnits = drawnRadiusUnits(volume);
  for (const entry of entries) root.appendChild(entry.element);
  host.insertBefore(root, before);
  let destroyed = false, accepted: readonly LabelScreenRect[] = Object.freeze([]);
  const fader = createOpacityFader(host.ownerDocument.defaultView!, opacityClock);
  // Captions are measured when first shown, not at mount: reading their size
  // then forced a layout of the whole starting page for labels drawn far out.
  const measure = () => { for (const entry of entries) entry.measured = false; };
  const fonts = host.ownerDocument.fonts;
  fonts?.addEventListener('loadingdone', measure);
  return Object.freeze({ root,
    publish(publication: EnvironmentLabelPublication) {
      if (destroyed) return accepted;
      picking.publish(root, []);
      for (const entry of entries) entry.pickRect = null;
      if ([volume.frame, ...shellList.map(shell => shell.frame)].some(frame => publication.world.referenceFrame !== frame.referenceFrame ||
          publication.world.epochJdTt !== frame.epochJdTt)) throw new TypeError('Environment labels and world camera use different prepared frames.');
      if (!(publication.viewport.focalPixels > 0) || publication.viewport.principalOffsetPixels.length !== 2 ||
          !publication.viewport.principalOffsetPixels.every(Number.isFinite)) throw new TypeError('Environment label viewport is invalid.');
      const width = publication.viewport.widthPixels ?? host.clientWidth;
      const height = publication.viewport.heightPixels ?? host.clientHeight;
      if (!(width > 0) || !(height > 0)) { accepted = hideAll(entries, fader); return accepted; }
      if (publication.shellStats.length !== shellList.length) throw new TypeError('Environment label shell statistics must align with prepared shells.');
      const blockers = publication.blockerRects ?? [], next: LabelScreenRect[] = [];
      for (let index = 0; index < shellList.length; index++) {
        const shell = shellList[index]!, stats = publication.shellStats[index]!;
        const visible = stats.visible && stats.opacity > 0 && stats.distanceM > shell.visibility.hiddenInsideM && stats.distanceM < shell.visibility.hiddenBeyondM;
        admit(shellEntries[index]!, visible ? stats.opacity : 0, publication, width, height, [...blockers, ...next], next, fader);
      }
      const radius = frameRadius(volume.frame);
      const local = presentPhysicalPoseInVolume(publication.world.pose, volume.frame);
      const distance = Math.hypot(...local.positionUnits);
      const volumeOpacity = smoothstep(radius, 2 * radius, distance) * (publication.volumeLabelOpacity ?? 1);
      // With a published extent the caption hangs under what is drawn of the galaxy, and hides inside the extent.
      const anchor = extentUnits > 0 && volumeOpacity > 0 ? projectGalaxyCaptionAnchor(publication.world, publication.viewport, volume.frame, drawnUnits, extentUnits) : null;
      admit(volumeEntry, extentUnits > 0 && !anchor ? 0 : volumeOpacity, publication, width, height, [...blockers, ...next], next, fader,
        anchor ? [anchor.x, anchor.y] : undefined);
      picking.publish(root, entries.flatMap(entry => entry.element.dataset.environmentNavigate && entry.pickRect && entry.targetOpacity > .1
        ? [{element:entry.element, rank:-2, shape:{kind:'rect' as const,...entry.pickRect}}] : []));
      accepted = Object.freeze(next);
      return accepted;
    },
    addShell(shell: PreparedCssSurfaceShell) {
      if (destroyed) return;
      const entry = createEntry(document, 'shell', shell.id, authoredName(names[shell.id]) ?? humanizeId(shell.id), shell.frame);
      shellList.push(shell); shellEntries.push(entry); entries.push(entry);
      root.insertBefore(entry.element, volumeEntry.element);
    },
    labelExclusionRects: () => accepted,
    inspect: () => Object.freeze(Object.fromEntries(entries.map(entry => [entry.id, entry.element]))),
    destroy() {
      if (destroyed) return;
      destroyed = true; accepted = Object.freeze([]); fonts?.removeEventListener('loadingdone', measure);
      for (const entry of entries) if (entry.hideTimer !== null) clearTimeout(entry.hideTimer);
      picking.remove(root); fader.destroy(); root.remove();
    },
  });
}

interface Entry { readonly kind: 'shell' | 'volume'; readonly id: string; readonly element: HTMLElement; readonly frame: DensityVolumeFrame;
  pickRect: LabelScreenRect | null; width: number; height: number; measured: boolean; targetOpacity: number; hideTimer: ReturnType<typeof setTimeout> | null; }

function createEntry(document: Document, kind: Entry['kind'], id: string, name: string, frame: DensityVolumeFrame, href?: string): Entry {
  const element = document.createElement(href ? 'a' : 'span');
  if (href) { element.setAttribute('href', href); element.dataset.environmentNavigate = 'true'; }
  element.dataset.environmentLabel = id;
  element.className = 'prepared-context-label';
  element.dataset.environmentKind = kind;
  element.textContent = name;
  // Its place and inert pointer are world-context.css rules, a link's cursor too; the fade owns visibility and opacity.
  element.style.cssText = 'visibility:hidden;opacity:0';
  return { kind, id, element, frame, pickRect: null, width: 0, height: 0, measured: false, targetOpacity: 0, hideTimer: null };
}

/** Place and fade one caption; true when it shows. A volume caption given an anchor hangs from it (just below what
 * is drawn of it) instead of from its projected frame. */
function admit(entry: Entry, opacity: number, publication: EnvironmentLabelPublication, width: number, height: number,
  blockers: readonly LabelScreenRect[], accepted: LabelScreenRect[], fader: ReturnType<typeof createOpacityFader>,
  anchor?: readonly [number, number]): boolean {
  const point = anchor ?? projectAnchor(entry, publication.world, publication.viewport, height);
  if (!point) { hideNow(entry, fader); return false; }
  if (!(opacity > 0)) { fadeTo(entry, 0, fader); return false; }
  if (!entry.measured) { entry.width = entry.element.offsetWidth; entry.height = entry.element.offsetHeight; entry.measured = true; }
  const [x, y] = point, bottom = entry.kind === 'volume' ? y + LABEL_GAP_PX + entry.height : y - LABEL_GAP_PX;
  const rect: LabelScreenRect = { left: x - entry.width / 2, right: x + entry.width / 2, top: bottom - entry.height, bottom };
  writeStyle(entry.element, 'transform', `translate(${format(x)}px,${format(bottom)}px) translate(-50%,-100%)`);
  if (rect.left < -width / 2 || rect.right > width / 2 || rect.top < -height / 2 || rect.bottom > height / 2 ||
      !(opacity > 0)) { fadeTo(entry, 0, fader); return false; }
  if (blockers.some(blocker => labelRectsOverlap(rect, blocker))) { fadeTo(entry, 0, fader); return false; }
  if (publication.labelBudget && !publication.labelBudget.admit(rect)) { fadeTo(entry, 0, fader); return false; }
  fadeTo(entry, Math.min(1, opacity) * DEFAULT_CONTEXT_LABEL_OPACITY, fader);
  entry.pickRect = rect;
  accepted.push(Object.freeze(rect));
  return true;
}

function projectAnchor(entry: Entry, world: WorldCameraPose, viewport: WorldCameraViewport, viewportHeight: number): readonly [number, number] | null {
  const camera = presentPhysicalPoseInVolume(world.pose, entry.frame);
  const rotation = cssCameraAxesFromOrientation(camera.orientationXyzw);
  const distance = Math.hypot(...camera.positionUnits), radius = frameRadius(entry.frame);
  const offset = Math.min(.75 * radius, distance * viewportHeight / (2 * viewport.focalPixels) * .78) * (entry.kind === 'volume' ? -1 : 1);
  // Volume labels use camera-down; shell labels retain their camera-up anchor.
  const dx = -rotation[1] * offset - camera.positionUnits[0];
  const dy = -rotation[4] * offset - camera.positionUnits[1];
  const dz = -rotation[7] * offset - camera.positionUnits[2];
  const eyeX = rotation[0] * dx + rotation[3] * dy + rotation[6] * dz;
  const eyeY = rotation[1] * dx + rotation[4] * dy + rotation[7] * dz;
  const eyeZ = rotation[2] * dx + rotation[5] * dy + rotation[8] * dz;
  if (!(eyeZ < 0)) return null;
  return [viewport.principalOffsetPixels[0] + viewport.focalPixels * eyeX / -eyeZ,
    viewport.principalOffsetPixels[1] + viewport.focalPixels * eyeY / -eyeZ];
}

/** How far from its centre a volume is drawn: a hybrid volume's core radius, where its prepared support reaches zero,
 * else the half extent of its frame. */
function drawnRadiusUnits(volume: PreparedCssVolume): number {
  const approximation = volume.approximation;
  const hybrid = approximation && typeof approximation === 'object' && 'hybrid' in approximation ? approximation.hybrid : undefined;
  const core = hybrid && typeof hybrid === 'object' && 'coreRadiusUnits' in hybrid ? hybrid.coreRadiusUnits : undefined;
  if (core === undefined) return frameRadius(volume.frame);
  if (typeof core !== 'number' || !(core > 0) || !Number.isFinite(core)) throw new TypeError(`${volume.id}: prepared hybrid coreRadiusUnits must be a positive number, got ${String(core)}.`);
  return core;
}
function frameRadius(frame: DensityVolumeFrame): number {
  return Math.max(...[0, 1].map(axis => (frame.boundsUnits.max[axis]! - frame.boundsUnits.min[axis]!) / 2));
}
function smoothstep(lo: number, hi: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
}
function authoredName(value: string | undefined): string | undefined { return value?.trim() || undefined; }
function humanizeId(id: string): string {
  return id.split('-').filter(Boolean).map(word => word[0]?.toUpperCase() + word.slice(1)).join(' ');
}
function fadeTo(entry: Entry, opacity: number, fader: ReturnType<typeof createOpacityFader>): void {
  if (entry.element.dataset.environmentNavigate) {
    const pointerEvents = opacity > .1 ? 'auto' : 'none', tabIndex = opacity > .1 ? 0 : -1;
    if (entry.element.style.pointerEvents !== pointerEvents) entry.element.style.pointerEvents = pointerEvents;
    if (entry.element.tabIndex !== tabIndex) entry.element.tabIndex = tabIndex;
  }
  if (entry.targetOpacity === opacity) { if (opacity > 0) show(entry); fader.set(entry.element, opacity, LABEL_FADE_MS); return; }
  if (entry.hideTimer !== null) { clearTimeout(entry.hideTimer); entry.hideTimer = null; }
  entry.targetOpacity = opacity;
  if (opacity > 0) show(entry);
  fader.set(entry.element, opacity, LABEL_FADE_MS);
  if (opacity === 0 && entry.element.style.visibility !== 'hidden') entry.hideTimer = setTimeout(() => {
    entry.hideTimer = null;
    if (entry.targetOpacity === 0) { entry.element.style.visibility = 'hidden'; entry.element.style.willChange = ''; }
  }, LABEL_FADE_MS);
}
/** A shown label moves on the compositor as its own small layer instead of repainting the layer it would paint into;
 * a hidden one has no layer, so hundreds of labels cost nothing until shown. */
function show(entry: Entry): void {
  if (entry.element.style.visibility !== '') entry.element.style.visibility = '';
  if (entry.element.style.willChange !== 'transform') entry.element.style.willChange = 'transform';
}
function hideNow(entry: Entry, fader: ReturnType<typeof createOpacityFader>): void {
  if (entry.hideTimer !== null) clearTimeout(entry.hideTimer);
  entry.hideTimer = null;
  // Only a link's fade writes pointer events (fadeTo); the stylesheet's inert default holds for the rest.
  if (entry.element.style.pointerEvents === 'auto') entry.element.style.pointerEvents = 'none';
  if (entry.element.tabIndex !== -1) entry.element.tabIndex = -1;
  entry.targetOpacity = 0; fader.set(entry.element, 0);
  if (entry.element.style.visibility !== 'hidden') entry.element.style.visibility = 'hidden';
  if (entry.element.style.willChange !== '') entry.element.style.willChange = '';
}
function hideAll(entries: readonly Entry[], fader: ReturnType<typeof createOpacityFader>): readonly LabelScreenRect[] {
  for (const entry of entries) hideNow(entry, fader);
  return Object.freeze([]);
}
function format(value: number): string { return Math.abs(value) < 1e-9 ? '0' : Number(value.toFixed(3)).toString(); }

export type { LabelScreenRect } from '../labels/screen-label-layout.js';
