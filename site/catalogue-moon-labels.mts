import { fromEyeM, cssViewFromOrientation, rotateWorldPosition, rayHitsSphereBefore } from '@cssearth/engine';
import { createOpacityFader } from '@cssearth/renderer';
import type { OpacityClock } from '@cssearth/renderer/stars/opacity-clock.ts';
import { admitStableLabels } from '@cssearth/renderer/labels/stable-label-layout.ts';
import prepared from './moon-labels.prepared.json' with { type: 'json' };
import { sourceArray, sourceId, sourceObject, sourceText, sourceUnique } from '@cssearth/objects/sources';
import type { LabelScreenRect } from '@cssearth/renderer/labels/screen-label-layout.ts';
import type { WorldCameraPose } from '@cssearth/engine';
import type { WorldCameraViewport } from '@cssearth/renderer/navigation/world-camera.ts';
import { createLabelBudget, labelExtentOpacity, type LabelBudget } from '@cssearth/renderer/labels/universe-label-policy.ts';

interface Point { id: string; positionM: readonly number[]; radiusM: number; orbit?: { centerBodyId: string }; }
interface Moon { id: string; name: string; parentId: string; positionM: readonly number[]; parentDistanceM: number; }
const finite = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Invalid prepared moon coordinate.');
  return value;
};
export function parseMoonLabels(input: unknown): readonly Moon[] {
  const data = sourceObject(input);
  if (data.schema !== 'cssearth-moon-labels@1') throw new TypeError('Invalid prepared moon labels.');
  const entries = sourceArray(data.moons, raw => {
    const moon = sourceObject(raw), id = sourceId(moon.id);
    if (moon.positionM === null) return null;
    const positionM = sourceArray(moon.positionM, finite), parentDistanceM = finite(moon.parentDistanceM);
    if (positionM.length !== 3 || parentDistanceM <= 0) throw new TypeError('Invalid prepared moon position.');
    return { id, name: sourceText(moon.name), parentId: sourceId(moon.parentId), positionM, parentDistanceM };
  }).filter((moon): moon is Moon => moon !== null);
  sourceUnique(entries.map(moon => moon.id), 'moon labels');
  return entries;
}

// The caption order is fixed for a moon list: sort it once, not with localeCompare on every frame.
const moonOrders = new WeakMap<readonly Moon[], readonly (readonly [number, Moon])[]>();
function moonOrder(moons: readonly Moon[]) {
  let ordered = moonOrders.get(moons);
  if (!ordered) moonOrders.set(moons, ordered = [...moons.entries()].sort(([, a], [, b]) => a.parentDistanceM - b.parentDistanceM || a.id.localeCompare(b.id)));
  return ordered;
}

/** Only project prepared points. These captions never join the object registry,
 * create a body, generate an orbit, or register a picking/navigation target. */
export function projectMoonLabels(moons: readonly Moon[], widths: readonly number[], parents: ReadonlyMap<string, Point>,
  selected: Point, world: WorldCameraPose, viewport: WorldCameraViewport, exclusions: readonly LabelScreenRect[],
  budget = createLabelBudget(viewport.widthPixels ?? 1000, viewport.heightPixels ?? 800, [], exclusions), previous: ReadonlySet<number> = new Set(),
  projectedPoints?: Map<number, { x: number; y: number }>, measurementDemand?: Set<number>) {
  const rotation = cssViewFromOrientation(world.pose.orientationXyzw);
  const eye = (point: readonly number[]) => rotateWorldPosition(rotation, fromEyeM(world.pose, point));
  const parentEyes = new Map([...parents].map(([id, point]) => [id, eye(point.positionM)]));
  const selectedEye = eye(selected.positionM);
  const halfWidth = (viewport.widthPixels ?? 1000) / 2, halfHeight = (viewport.heightPixels ?? 800) / 2;
  const placements: { index: number; x: number; y: number; opacity: number }[] = [];
  const candidates: Parameters<typeof admitStableLabels>[0][number][] = [];
  const ordered = moonOrder(moons);
  for (const [index, moon] of ordered) {
    if (moon.parentId !== selected.id && moon.parentId !== selected.orbit?.centerBodyId) continue;
    const parent = parents.get(moon.parentId), parentEye = parentEyes.get(moon.parentId);
    if (!parent || !parentEye) continue;
    // Match ordinary moon captions: a compact orbital neighbourhood has no labels.
    const extent = moon.parentDistanceM * viewport.focalPixels / Math.max(1, -parentEye[2]);
    const scaleOpacity = labelExtentOpacity(extent);
    const opacity = scaleOpacity * .4;

    const point = eye(moon.positionM);
    if (point[2] >= 0 || rayHitsSphereBefore(point, parentEye, parent.radiusM) ||
        (selected.id !== parent.id && rayHitsSphereBefore(point, selectedEye, selected.radiusM))) continue;
    const x = viewport.principalOffsetPixels[0] + viewport.focalPixels * point[0] / -point[2];
    const y = viewport.principalOffsetPixels[1] + viewport.focalPixels * point[1] / -point[2];
    const rect = { left: x - widths[index] / 2, right: x + widths[index] / 2, top: y - 9, bottom: y + 9 };
    projectedPoints?.set(index, { x: rect.left, y: rect.top });
    if (scaleOpacity <= (previous.has(index) ? .5 : .55) || rect.left < -halfWidth || rect.right > halfWidth || rect.top < -halfHeight || rect.bottom > halfHeight) continue;
    if (measurementDemand && widths[index] === 0) { measurementDemand.add(index); continue; }
    placements.push({ index, x: rect.left, y: rect.top, opacity });
    candidates.push({ id: moon.id, navigable: false, pinned: 0, priority: -moon.parentDistanceM,
      shown: previous.has(index), previousPlacement: 0, placements: [{ slot: 0, rect }] });
  }
  const admitted = new Set(admitStableLabels(candidates, budget).map(item => item.candidate.id));
  return placements.filter(point => admitted.has(moons[point.index].id));
}

/** `bodies` gives the world's bodies as they stand: a moon joins when its planet's system is read. */
export function mountCatalogueMoonLabels(host: HTMLElement, worldBodies: readonly Point[] | (() => readonly Point[]), focus: Point, clock?: OpacityClock, requestPublication?: () => boolean, depthBase = 0) {
  const bodiesNow = typeof worldBodies === 'function' ? worldBodies : () => worldBodies, bodies = bodiesNow();
  const moons = parseMoonLabels(prepared), parents = new Map(bodies.filter(body => moons.some(moon => moon.parentId === body.id)).map(body => [body.id, body]));
  const root = host.ownerDocument.createElement('div');
  root.className = 'catalogue-moon-labels';
  root.style.zIndex = String(depthBase);
  const labels = moons.map(moon => {
    const label = host.ownerDocument.createElement('span');
    label.className = 'prepared-context-label catalogue-moon-label';
    label.dataset.catalogueMoon = moon.id; label.dataset.moonParent = moon.parentId;
    label.textContent = moon.name; label.setAttribute('aria-disabled', 'true');
    label.setAttribute('aria-label', `${moon.name}, not available`);
    label.ariaHidden = 'true'; label.style.opacity = '0'; label.style.visibility = 'hidden'; return label;
  });
  const widths = labels.map(() => 0);
  const indices = new Map<Element, number>(labels.map((label, index) => [label, index]));
  // Browser-delivered sizes include font changes without a read after the
  // world's DOM writes. The first publication used to flush the whole scene.
  const observer = new ResizeObserver(entries => {
    let changed = false;
    for (const entry of entries) {
      const index = indices.get(entry.target);
      if (index === undefined) continue;
      const width = entry.contentRect.width;
      if (width <= 0 || widths[index] === width) continue;
      changed = true; widths[index] = width;
    }
    if (changed) requestPublication?.();
  });
  const fader = createOpacityFader(host.ownerDocument.defaultView!, clock, { hideAtZero: true });
  const last = labels.map(() => ({ shown: false, transform: '' }));
  let selected = focus, previous: ReadonlySet<number> = new Set(), coasting = false;
  return {
    selectObject(id: string) { selected = bodiesNow().find(body => body.id === id) ?? focus; },
    /** While the camera coasts the shown captions only move: none is admitted, retired or measured until it stops
     * (docs/performance/motion-freezes-membership.md). */
    setCoasting(active: boolean) { coasting = active; fader.holdHiding(active); },
    publish(world: WorldCameraPose, viewport: WorldCameraViewport, budget: LabelBudget) {
      const compatible = world.referenceFrame === prepared.referenceFrame && world.epochJdTt === prepared.epochJdTt;
      const points = new Map<number, { x: number; y: number }>();
      const measurements = new Set<number>();
      const placements = compatible ? projectMoonLabels(moons, widths, parents, selected, world, viewport, [], budget, previous, points, measurements) : [];
      if (coasting) {
        for (const [index, label] of labels.entries()) {
          const point = last[index].shown ? points.get(index) : undefined;
          if (!point) continue;
          const transform = `translate(${point.x}px,${point.y}px)`;
          if (last[index].transform !== transform) { label.style.transform = transform; last[index].transform = transform; }
        }
        return;
      }
      for (const index of measurements) {
        const label = labels[index];
        if (label.parentNode) continue;
        root.append(label);
        if (!root.parentNode) host.append(root);
        observer.observe(label);
      }
      const admitted = new Map(placements.map(point => [point.index, point]));
      previous = new Set(admitted.keys());
      for (const [index, label] of labels.entries()) {
        if (!label.parentNode) continue;
        const placement = admitted.get(index);
        // A shown caption moves as its own small layer; a hidden one has none.
        if (last[index].shown !== Boolean(placement)) { last[index].shown = Boolean(placement); label.ariaHidden = String(!placement); label.style.willChange = placement ? 'transform' : ''; }
        fader.set(label, placement?.opacity ?? 0, 200);
        const point = placement ?? (fader.current(label) > 0 ? points.get(index) : undefined);
        if (!point) continue;
        const transform = `translate(${point.x}px,${point.y}px)`;
        if (last[index].transform !== transform) { label.style.transform = transform; last[index].transform = transform; }
      }
    },
    destroy() { observer.disconnect(); fader.destroy(); root.remove(); },
  };
}
