import { presentPhysicalPoseInVolume } from '@cssearth/engine';
import type { DensityVolumeFrame } from '@cssearth/objects';
import { labelRectsOverlap } from '../labels/screen-label-layout.js';
import type { LabelScreenRect } from '../labels/screen-label-layout.js';
import { worldRotationFromQuaternion } from '../navigation/world-camera-math.js';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import type { OpacityClock } from '../stars/opacity-clock.js';
import { createOpacityFader } from '../stars/opacity-fader.js';
import type { PreparedSurfaceShellStats } from '../shell/prepared-shell-runtime.js';
import type { PreparedCssSurfaceShell } from '../shell/types.js';
import type { PreparedCssVolume } from '../volume/types.js';

const LABEL_GAP_PX = 8;
const LABEL_FADE_MS = 200;

export interface EnvironmentLabelPublication {
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
export function mountEnvironmentLabels({ host, before, volume, shells, names = {}, opacityClock }: {
  readonly host: HTMLElement;
  readonly before: Element;
  readonly volume: PreparedCssVolume;
  readonly shells: readonly PreparedCssSurfaceShell[];
  readonly opacityClock?: OpacityClock;
  readonly names?: Readonly<Record<string, string>>;
}): EnvironmentLabelsRuntime {
  if (!host?.ownerDocument || before?.parentNode !== host) throw new TypeError('Environment labels need a host and child insertion point.');
  const document = host.ownerDocument, root = document.createElement('div');
  root.className = 'prepared-environment-labels';
  root.ariaHidden = 'true';
  root.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:0';
  const shellList = [...shells];
  const shellEntries = shellList.map(shell => createEntry(document, 'shell', shell.id, authoredName(names[shell.id]) ?? humanizeId(shell.id), shell.frame));
  const volumeEntry = createEntry(document, 'volume', volume.id, authoredName(names[volume.id]) ?? humanizeId(volume.id), volume.frame);
  const entries = [...shellEntries, volumeEntry];
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
      const volumeOpacity = smoothstep(radius, 2 * radius, distance);
      admit(volumeEntry, volumeOpacity * (publication.volumeLabelOpacity ?? 1), publication, width, height, [...blockers, ...next], next, fader);
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
      fader.destroy(); root.remove();
    },
  });
}

interface Entry { readonly kind: 'shell' | 'volume'; readonly id: string; readonly element: HTMLElement; readonly frame: DensityVolumeFrame;
  width: number; height: number; measured: boolean; targetOpacity: number; hideTimer: ReturnType<typeof setTimeout> | null; }

function createEntry(document: Document, kind: Entry['kind'], id: string, name: string, frame: DensityVolumeFrame): Entry {
  const element = document.createElement('span');
  element.dataset.environmentLabel = id;
  element.dataset.environmentKind = kind;
  element.textContent = name;
  element.style.cssText = 'position:absolute;left:50%;top:50%;font:11px system-ui;color:#c2ccd8;white-space:nowrap;visibility:hidden;opacity:0;pointer-events:none';
  element.style.visibility = 'hidden'; element.style.opacity = '0';
  return { kind, id, element, frame, width: 0, height: 0, measured: false, targetOpacity: 0, hideTimer: null };
}

function admit(entry: Entry, opacity: number, publication: EnvironmentLabelPublication, width: number, height: number,
  blockers: readonly LabelScreenRect[], accepted: LabelScreenRect[], fader: ReturnType<typeof createOpacityFader>): void {
  const point = projectAnchor(entry, publication.world, publication.viewport, height);
  if (!point) { hideNow(entry, fader); return; }
  if (!(opacity > 0)) { fadeTo(entry, 0, fader); return; }
  if (!entry.measured) { entry.width = entry.element.offsetWidth; entry.height = entry.element.offsetHeight; entry.measured = true; }
  const [x, y] = point, bottom = y - LABEL_GAP_PX;
  const rect: LabelScreenRect = { left: x - entry.width / 2, right: x + entry.width / 2, top: bottom - entry.height, bottom };
  entry.element.style.transform = `translate(${format(x)}px,${format(bottom)}px) translate(-50%,-100%)`;
  if (rect.left < -width / 2 || rect.right > width / 2 || rect.top < -height / 2 || rect.bottom > height / 2 ||
      !(opacity > 0)) { fadeTo(entry, 0, fader); return; }
  if (blockers.some(blocker => labelRectsOverlap(rect, blocker))) { fadeTo(entry, 0, fader); return; }
  fadeTo(entry, Math.min(1, opacity), fader);
  accepted.push(Object.freeze(rect));
}

function projectAnchor(entry: Entry, world: WorldCameraPose, viewport: WorldCameraViewport, viewportHeight: number): readonly [number, number] | null {
  const camera = presentPhysicalPoseInVolume(world.pose, entry.frame);
  const rotation = worldRotationFromQuaternion(camera.orientationXyzw);
  const [qx, qy, qz, qw] = camera.orientationXyzw;
  const distance = Math.hypot(...camera.positionUnits), radius = frameRadius(entry.frame);
  const offset = Math.min(.75 * radius, distance * viewportHeight / (2 * viewport.focalPixels) * .78);
  // Galaxio's physical camera-up offset, reflected for this renderer's +Y-down camera convention.
  const dx = -2 * (qx * qy - qw * qz) * offset - camera.positionUnits[0];
  const dy = -(1 - 2 * (qx * qx + qz * qz)) * offset - camera.positionUnits[1];
  const dz = -2 * (qy * qz + qw * qx) * offset - camera.positionUnits[2];
  const eyeX = rotation[0] * dx + rotation[3] * dy + rotation[6] * dz;
  const eyeY = rotation[1] * dx + rotation[4] * dy + rotation[7] * dz;
  const eyeZ = rotation[2] * dx + rotation[5] * dy + rotation[8] * dz;
  if (!(eyeZ < 0)) return null;
  return [viewport.principalOffsetPixels[0] + viewport.focalPixels * eyeX / -eyeZ,
    viewport.principalOffsetPixels[1] + viewport.focalPixels * eyeY / -eyeZ];
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
  if (entry.targetOpacity === opacity) { if (opacity > 0) entry.element.style.visibility = ''; fader.set(entry.element, opacity, LABEL_FADE_MS); return; }
  if (entry.hideTimer !== null) { clearTimeout(entry.hideTimer); entry.hideTimer = null; }
  entry.targetOpacity = opacity;
  if (opacity > 0) entry.element.style.visibility = '';
  fader.set(entry.element, opacity, LABEL_FADE_MS);
  if (opacity === 0 && entry.element.style.visibility !== 'hidden') entry.hideTimer = setTimeout(() => {
    entry.hideTimer = null;
    if (entry.targetOpacity === 0) entry.element.style.visibility = 'hidden';
  }, LABEL_FADE_MS);
}
function hideNow(entry: Entry, fader: ReturnType<typeof createOpacityFader>): void {
  if (entry.hideTimer !== null) clearTimeout(entry.hideTimer);
  entry.hideTimer = null; entry.targetOpacity = 0; fader.set(entry.element, 0); entry.element.style.visibility = 'hidden';
}
function hideAll(entries: readonly Entry[], fader: ReturnType<typeof createOpacityFader>): readonly LabelScreenRect[] {
  for (const entry of entries) hideNow(entry, fader);
  return Object.freeze([]);
}
function format(value: number): string { return Math.abs(value) < 1e-9 ? '0' : Number(value.toFixed(3)).toString(); }

export type { LabelScreenRect } from '../labels/screen-label-layout.js';
