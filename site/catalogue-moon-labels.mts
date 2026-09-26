import { createOpacityFader } from '../src/renderers/css/dist/index.js';
import type { OpacityClock } from '../src/renderers/css/stars/opacity-clock.ts';
import { admitStableLabels } from '../src/renderers/css/labels/stable-label-layout.ts';
import prepared from './moon-labels.prepared.json' with { type: 'json' };
import { sourceArray, sourceId, sourceObject, sourceText, sourceUnique } from '../src/platform/source-catalog.mts';
import { cssViewFromOrientation, rotateWorldPosition } from '../src/renderers/css/navigation/world-camera-math.ts';
import { rayHitsSphereBefore } from '../src/renderers/css/solar-system/heliocentric-geometry.ts';
import type { LabelScreenRect } from '../src/renderers/css/labels/screen-label-layout.ts';
import type { WorldCameraPose, WorldCameraViewport } from '../src/renderers/css/navigation/world-camera.ts';
import { createLabelBudget, labelExtentOpacity, type LabelBudget } from '../src/renderers/css/labels/universe-label-policy.ts';

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

/** Only project prepared points. These captions never join the object registry,
 * create a body, generate an orbit, or register a picking/navigation target. */
export function projectMoonLabels(moons: readonly Moon[], widths: readonly number[], parents: ReadonlyMap<string, Point>,
  selected: Point, world: WorldCameraPose, viewport: WorldCameraViewport, exclusions: readonly LabelScreenRect[],
  budget = createLabelBudget(viewport.widthPixels ?? 1000, viewport.heightPixels ?? 800, [], exclusions), previous: ReadonlySet<number> = new Set(),
  projectedPoints?: Map<number, { x: number; y: number }>) {
  const rotation = cssViewFromOrientation(world.pose.orientationXyzw);
  const eye = (point: readonly number[]) => rotateWorldPosition(rotation, [point[0] - world.pose.positionM[0], point[1] - world.pose.positionM[1], point[2] - world.pose.positionM[2]]);
  const parentEyes = new Map([...parents].map(([id, point]) => [id, eye(point.positionM)]));
  const selectedEye = eye(selected.positionM);
  const halfWidth = (viewport.widthPixels ?? 1000) / 2, halfHeight = (viewport.heightPixels ?? 800) / 2;
  const placements: { index: number; x: number; y: number; opacity: number }[] = [];
  const candidates: Parameters<typeof admitStableLabels>[0][number][] = [];
  const ordered = [...moons.entries()].sort(([, a], [, b]) => a.parentDistanceM - b.parentDistanceM || a.id.localeCompare(b.id));
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
    placements.push({ index, x: rect.left, y: rect.top, opacity });
    candidates.push({ id: moon.id, navigable: false, pinned: 0, priority: -moon.parentDistanceM,
      shown: previous.has(index), previousPlacement: 0, placements: [{ slot: 0, rect }] });
  }
  const admitted = new Set(admitStableLabels(candidates, budget).map(item => item.candidate.id));
  return placements.filter(point => admitted.has(moons[point.index].id));
}

export function mountCatalogueMoonLabels(host: HTMLElement, bodies: readonly Point[], focus: Point, clock?: OpacityClock) {
  const moons = parseMoonLabels(prepared), parents = new Map(bodies.filter(body => moons.some(moon => moon.parentId === body.id)).map(body => [body.id, body]));
  const root = host.ownerDocument.createElement('div');
  root.className = 'catalogue-moon-labels';
  const labels = moons.map(moon => {
    const label = host.ownerDocument.createElement('span');
    label.className = 'prepared-context-label catalogue-moon-label';
    label.dataset.catalogueMoon = moon.id; label.dataset.moonParent = moon.parentId;
    label.textContent = moon.name; label.setAttribute('aria-disabled', 'true');
    label.setAttribute('aria-label', `${moon.name}, not available`);
    label.ariaHidden = 'true'; label.style.opacity = '0'; label.style.visibility = 'hidden'; root.append(label); return label;
  });
  host.append(root);
  let widths: number[] = [], measured = false;
  const invalidate = () => { measured = false; };
  host.ownerDocument.fonts?.addEventListener('loadingdone', invalidate);
  const fader = createOpacityFader(host.ownerDocument.defaultView!, clock, { hideAtZero: true });
  const last = labels.map(() => ({ shown: false, transform: '' }));
  let selected = focus, previous: ReadonlySet<number> = new Set(), coasting = false;
  return {
    selectObject(id: string) { selected = bodies.find(body => body.id === id) ?? focus; },
    /** While the camera coasts the shown captions only move: none is admitted, retired or measured until it stops
     * (docs/performance/motion-freezes-membership.md). */
    setCoasting(active: boolean) { coasting = active; fader.holdHiding(active); },
    publish(world: WorldCameraPose, viewport: WorldCameraViewport, budget: LabelBudget) {
      if (coasting && !measured) return;
      if (!measured) { widths = labels.map(label => label.getBoundingClientRect().width); measured = true; }
      const compatible = world.referenceFrame === prepared.referenceFrame && world.epochJdTt === prepared.epochJdTt;
      const points = new Map<number, { x: number; y: number }>();
      const placements = compatible ? projectMoonLabels(moons, widths, parents, selected, world, viewport, [], budget, previous, points) : [];
      if (coasting) {
        for (const [index, label] of labels.entries()) {
          const point = last[index].shown ? points.get(index) : undefined;
          if (!point) continue;
          const transform = `translate(${point.x}px,${point.y}px)`;
          if (last[index].transform !== transform) { label.style.transform = transform; last[index].transform = transform; }
        }
        return;
      }
      const admitted = new Map(placements.map(point => [point.index, point]));
      previous = new Set(admitted.keys());
      for (const [index, label] of labels.entries()) {
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
    destroy() { host.ownerDocument.fonts?.removeEventListener('loadingdone', invalidate); fader.destroy(); root.remove(); },
  };
}
