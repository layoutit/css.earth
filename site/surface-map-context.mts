import type { PositionM } from '@cssearth/engine';
import type { ObjectWorldNavigation } from '@cssearth/renderer/runtime/world-navigation-types.ts';
import type { BrowserWindow } from './browser-types.mts';
import { requiredElement } from './browser-types.mts';
import { isRecord } from '@cssearth/core';
import type { SurfaceAxes } from './surface-minimap-math.mts';
/** Axes and the map's left edge longitude: latitude and longitude sit where the prepared feature labels place them. */
export interface SurfaceMapConfig extends SurfaceAxes { readonly surfaceSelector: string; readonly mapLeftEdgeLongitudeDeg: number; }
export interface SurfaceCamera { readonly navigation?: ObjectWorldNavigation; }
export interface MapViewport { left: number; right: number; top: number; bottom: number; }
export type SurfaceMapReader = ReturnType<typeof createSurfaceMapReader>;
export function parseSurfaceMapConfig(source: string | undefined): SurfaceMapConfig {
  const value: unknown = JSON.parse(source ?? 'null');
  if (!isRecord(value) || typeof value.surfaceSelector !== 'string' || !value.surfaceSelector) throw new TypeError('Surface map requires a selector.');
  const axis = (input: unknown): PositionM => {
    if (!Array.isArray(input) || input.length !== 3 || !input.every(component => typeof component === 'number' && Number.isFinite(component))) throw new TypeError('Surface map requires finite three-component axes.');
    return [input[0], input[1], input[2]];
  };
  if (typeof value.mapLeftEdgeLongitudeDeg !== 'number' || !Number.isFinite(value.mapLeftEdgeLongitudeDeg)) throw new TypeError('Surface map requires its left edge longitude.');
  return { surfaceSelector: value.surfaceSelector, prime: axis(value.prime), east: axis(value.east), north: axis(value.north), mapLeftEdgeLongitudeDeg: value.mapLeftEdgeLongitudeDeg };
}
interface MapEntry {
  source: string | undefined; config: SurfaceMapConfig; body: HTMLElement; scene: HTMLElement; nodes: HTMLElement[];
  stage: Element | null; frame: ObjectWorldNavigation['frame']; axes: SurfaceAxes | null;
  animations: (Animation & { effect: KeyframeEffect })[] | null; times: (CSSNumberish | null | undefined)[];
}
import { rotateWorldPosition } from '@cssearth/renderer/navigation';

// Read the package's prepared map axes in the current shared world frame.
export function surfaceMapContext(config: SurfaceMapConfig | undefined, camera: SurfaceCamera | null, documentTarget: Document, windowTarget: BrowserWindow) {
  if (!camera?.navigation || !config) return null;
  const body = documentTarget.querySelector<HTMLElement>(config.surfaceSelector);
  const scene = body?.closest<HTMLElement>('.polycss-scene');
  if (!body || !scene) return null;
  return surfaceSnapshot(body, scene, config, camera.navigation, windowTarget);
}

function surfaceAxes(body: HTMLElement, scene: HTMLElement, config: SurfaceMapConfig, navigation: ObjectWorldNavigation, windowTarget: BrowserWindow) {
  let matrix = new windowTarget.DOMMatrix();
  for (let node: HTMLElement | null = body; node && node !== scene; node = node.parentElement) {
    matrix = new windowTarget.DOMMatrix(windowTarget.getComputedStyle(node).transform).multiply(matrix);
  }
  const transform = (direction: PositionM) => {
    const p = matrix.transformPoint({ x: direction[0], y: direction[1], z: direction[2], w: 0 });
    const length = Math.hypot(p.x, p.y, p.z);
    return rotateWorldPosition(navigation.frame.presentationToReference, [p.x / length, p.y / length, p.z / length]);
  };
  return { prime: transform(config.prime), east: transform(config.east), north: transform(config.north) };
}

function surfaceSnapshot(body: HTMLElement, scene: HTMLElement, config: SurfaceMapConfig, navigation: ObjectWorldNavigation, windowTarget: BrowserWindow, axes = surfaceAxes(body, scene, config, navigation, windowTarget)) {
  const world = navigation.capture();
  const relative: PositionM = [0, 1, 2].map(i => world.pose.positionM[i] - navigation.frame.originM[i]) as [number, number, number];
  return { world, relative, axes, scene, mapLeftEdgeLongitudeDeg: config.mapLeftEdgeLongitudeDeg };
}

/** One shell-content owner shares the rendered surface axes between its consumers.
 * Camera transforms are outside the surface chain. Native animation times also
 * catch paused seeks/restores, without polling computed styles while orbiting.
 */
export function createSurfaceMapReader({ documentTarget, windowTarget }: { documentTarget: Document; windowTarget: BrowserWindow }) {
  const entries = new Map<HTMLElement, MapEntry>();
  let disposed = false; let observer: MutationObserver | null = null;
  function invalidate(records?: MutationRecord[]) {
    for (const entry of entries.values()) {
      if (!records || records.some(record => entry.nodes.some(node => node === record.target) || record.target === entry.stage)) {
        entry.axes = null;
        entry.animations = null;
      }
    }
  }
  const resize = () => invalidate();
  return {
    read(map: HTMLElement | undefined, camera: SurfaceCamera | null) {
      if (disposed || !map || !camera?.navigation) return null;
      const records = observer?.takeRecords() ?? [];
      if (records.length) invalidate(records);
      const source = map.dataset.surfaceMinimap;
      let entry = entries.get(map);
      const config = entry && entry.source === source ? entry.config : parseSurfaceMapConfig(source);
      const body = documentTarget.querySelector<HTMLElement>(config.surfaceSelector);
      const scene = body?.closest<HTMLElement>('.polycss-scene');
      if (!body || !scene) return null;
      if (!entry || entry.source !== source || entry.body !== body || entry.scene !== scene || entry.frame !== camera.navigation.frame) {
        const nodes: HTMLElement[] = [];
        for (let node: HTMLElement | null = body; node && node !== scene; node = node.parentElement) nodes.push(node);
        entry = { source, config, body, scene, nodes, stage: scene.closest('.object-stage'),
          frame: camera.navigation.frame, axes: null, animations: null, times: [] };
        entries.set(map, entry);
        if (!observer) {
          observer = new windowTarget.MutationObserver(invalidate);
          windowTarget.addEventListener('resize', resize);
        }
        // Observe only the model chain, not camera transforms or surface leaves.
        // Rebind so a replaced body is no longer retained by the observer.
        observer.disconnect();
        for (const current of entries.values()) {
          for (const node of current.nodes) observer.observe(node, { attributes: true });
          if (current.stage) observer.observe(current.stage, { attributes: true, attributeFilter: ['class', 'style'] });
        }
      }
      entry.animations ??= entry.nodes.flatMap(node => node.getAnimations())
        .filter((animation): animation is Animation & { effect: KeyframeEffect } => animation.effect !== null && 'getKeyframes' in animation.effect && typeof animation.effect.getKeyframes === 'function' && animation.effect.getKeyframes().some((frame: ComputedKeyframe) => frame.transform !== undefined));
      // A duration change can alter the phase even while currentTime is paused.
      const times = entry.animations.flatMap(animation => [animation.currentTime, animation.effect.getComputedTiming().progress]);
      if (!entry.axes || times.some((time, i) => time !== entry.times[i])) {
        entry.axes = surfaceAxes(body, scene, config, camera.navigation, windowTarget);
        entry.times = times;
      }
      return surfaceSnapshot(body, scene, config, camera.navigation, windowTarget, entry.axes);
    },
    destroy() {
      disposed = true; observer?.disconnect(); entries.clear();
      if (observer) windowTarget.removeEventListener('resize', resize);
    },
  };
}

export function surfaceMapViewport(scene: HTMLElement, optics: ReturnType<ObjectWorldNavigation['optics']>): MapViewport {
  // The camera owns the measured visible rectangle. Shell consumers use the
  // same snapshot instead of forcing geometry reads after every camera write.
  if (optics.visibleRect) {
    const rect = optics.visibleRect, [ox, oy] = (optics.principalOffsetPixels ?? [0, 0]);
    return { left: (rect.left - ox) / optics.focalPixels, right: (rect.right - ox) / optics.focalPixels,
      top: (rect.top - oy) / optics.focalPixels, bottom: (rect.bottom - oy) / optics.focalPixels };
  }
  const root = requiredElement(scene.ownerDocument, '.polycss-camera').getBoundingClientRect();
  const stage = requiredElement(scene.ownerDocument, '.object-stage').getBoundingClientRect();
  const ox = root.x + root.width / 2 + (optics.principalOffsetPixels?.[0] ?? 0);
  const oy = root.y + root.height / 2 + (optics.principalOffsetPixels?.[1] ?? 0);
  return {
    left: (Math.max(root.left, stage.left) - ox) / optics.focalPixels,
    right: (Math.min(root.right, stage.right) - ox) / optics.focalPixels,
    top: (Math.max(root.top, stage.top) - oy) / optics.focalPixels,
    bottom: (Math.min(root.bottom, stage.bottom) - oy) / optics.focalPixels,
  };
}
