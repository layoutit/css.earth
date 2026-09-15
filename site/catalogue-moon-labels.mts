import prepared from './moon-labels.prepared.json' with { type: 'json' };
import { sourceArray, sourceId, sourceObject, sourceText, sourceUnique } from '../src/platform/source-catalog.mts';
import { worldRotationFromQuaternion, transposeWorldRotation, rotateWorldPosition } from '../src/renderers/css/navigation/world-camera-math.ts';
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
  budget = createLabelBudget(viewport.widthPixels ?? 1000, viewport.heightPixels ?? 800, [], exclusions)) {
  const rotation = transposeWorldRotation(worldRotationFromQuaternion(world.pose.orientationXyzw));
  const eye = (point: readonly number[]) => rotateWorldPosition(rotation, [point[0] - world.pose.positionM[0], point[1] - world.pose.positionM[1], point[2] - world.pose.positionM[2]]);
  const parentEyes = new Map([...parents].map(([id, point]) => [id, eye(point.positionM)]));
  const selectedEye = eye(selected.positionM);
  const halfWidth = (viewport.widthPixels ?? 1000) / 2, halfHeight = (viewport.heightPixels ?? 800) / 2;
  const placements: { index: number; x: number; y: number; opacity: number }[] = [];
  const ordered = [...moons.entries()].sort(([, a], [, b]) => a.parentDistanceM - b.parentDistanceM || a.id.localeCompare(b.id));
  for (const [index, moon] of ordered) {
    if (moon.parentId !== selected.id && moon.parentId !== selected.orbit?.centerBodyId) continue;
    const parent = parents.get(moon.parentId), parentEye = parentEyes.get(moon.parentId);
    if (!parent || !parentEye) continue;
    // Match ordinary moon captions: a compact orbital neighbourhood has no labels.
    const extent = moon.parentDistanceM * viewport.focalPixels / Math.max(1, -parentEye[2]);
    const scaleOpacity = labelExtentOpacity(extent);
    const opacity = scaleOpacity * .4;
    if (scaleOpacity <= .5) continue;
    const point = eye(moon.positionM);
    if (point[2] >= 0 || rayHitsSphereBefore(point, parentEye, parent.radiusM) ||
        (selected.id !== parent.id && rayHitsSphereBefore(point, selectedEye, selected.radiusM))) continue;
    const x = viewport.principalOffsetPixels[0] + viewport.focalPixels * point[0] / -point[2];
    const y = viewport.principalOffsetPixels[1] + viewport.focalPixels * point[1] / -point[2];
    const rect = { left: x - widths[index] / 2, right: x + widths[index] / 2, top: y - 9, bottom: y + 9 };
    if (rect.left < -halfWidth || rect.right > halfWidth || rect.top < -halfHeight || rect.bottom > halfHeight ||
        !budget.admit(rect)) continue;
    placements.push({ index, x: rect.left, y: rect.top, opacity });
  }
  return placements;
}

export function mountCatalogueMoonLabels(host: HTMLElement, bodies: readonly Point[], focus: Point) {
  const moons = parseMoonLabels(prepared), parents = new Map(bodies.filter(body => moons.some(moon => moon.parentId === body.id)).map(body => [body.id, body]));
  const root = host.ownerDocument.createElement('div');
  root.className = 'catalogue-moon-labels';
  const labels = moons.map(moon => {
    const label = host.ownerDocument.createElement('span');
    label.className = 'prepared-context-label catalogue-moon-label';
    label.dataset.catalogueMoon = moon.id; label.dataset.moonParent = moon.parentId;
    label.textContent = moon.name; label.setAttribute('aria-disabled', 'true');
    label.setAttribute('aria-label', `${moon.name}, not available`);
    label.style.visibility = 'hidden'; root.append(label); return label;
  });
  host.append(root);
  // Batch the one-time font measurements; publication never reads layout.
  const widths = labels.map(label => label.getBoundingClientRect().width);
  const last = labels.map(() => ({ shown: false, transform: '', opacity: '' }));
  let selected = focus;
  return {
    selectObject(id: string) { selected = bodies.find(body => body.id === id) ?? focus; },
    publish(world: WorldCameraPose, viewport: WorldCameraViewport, budget: LabelBudget) {
      const compatible = world.referenceFrame === prepared.referenceFrame && world.epochJdTt === prepared.epochJdTt;
      const placements = compatible ? projectMoonLabels(moons, widths, parents, selected, world, viewport, [], budget) : [];
      const shown = new Set(placements.map(point => point.index));
      for (const [index, label] of labels.entries()) if (last[index].shown !== shown.has(index)) {
        last[index].shown = shown.has(index); label.style.visibility = last[index].shown ? '' : 'hidden';
      }
      for (const point of placements) {
        const label = labels[point.index], previous = last[point.index];
        const transform = `translate(${point.x}px,${point.y}px)`, opacity = String(point.opacity);
        if (previous.transform !== transform) { label.style.transform = transform; previous.transform = transform; }
        if (previous.opacity !== opacity) { label.style.opacity = opacity; previous.opacity = opacity; }
      }
    },
    destroy() { root.remove(); },
  };
}
