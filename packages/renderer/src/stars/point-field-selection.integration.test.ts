import { expect, it } from 'vitest';
import { selectPreparedPointField, selectVisiblePreparedStars } from '@cssearth/engine';
import { readCanonicalPointField } from '../../../../src/renderers/css/preparation/stars/canonical-point-field-fixture.js';

const field = readCanonicalPointField();
const rotation = [1, 0, 0, 0, 1, 0, 0, 0, 1] as const;

it('selects the real 109389-star hierarchy at four observer distances', () => {
  const views = [1, 10, 100, 1000].map(distance => ({ eyeUnits: [0, 0, distance] as const }));
  const started = performance.now();
  const selections = views.map(({ eyeUnits }) => selectPreparedPointField({
    stars: field.stars, nodes: field.nodes, eyeUnits, viewRotation: rotation,
    focalPx: 900, viewportHalfWidthPx: 720, viewportHalfHeightPx: 450,
    maxRepresentatives: 2048, targetErrorPx: 2,
  }));
  const elapsedMs = performance.now() - started;
  for (const selection of selections) {
    expect(selection.representatives.length).toBeLessThanOrEqual(2048);
    expect(selection.coveredCount).toBe(field.stars.length);
    const members = new Set<number>();
    for (const reference of selection.representatives) {
      expect(reference.kind).toBe('star');
      expect(reference.index).toBeGreaterThanOrEqual(0);
      expect(reference.index).toBeLessThan(field.stars.length);
      members.add(reference.index);
    }
    expect(members.size).toBe(selection.representatives.length);
  }
  console.log(JSON.stringify({ elapsedMs: Number(elapsedMs.toFixed(2)),
    views: selections.map(selection => ({ representatives: selection.representatives.length,
      maxProjectedErrorPx: selection.maxProjectedErrorPx, budgetLimited: selection.budgetLimited })) }));
});

function bruteTop(eye: readonly [number, number, number], rotation: readonly number[]): number[] {
  return field.stars.map((star, index) => {
    const dx = star.positionUnits[0] - eye[0], dy = star.positionUnits[1] - eye[1], dz = star.positionUnits[2] - eye[2];
    const x = rotation[0]! * dx + rotation[1]! * dy + rotation[2]! * dz;
    const y = rotation[3]! * dx + rotation[4]! * dy + rotation[5]! * dz;
    const depth = -(rotation[6]! * dx + rotation[7]! * dy + rotation[8]! * dz);
    const distance = Math.hypot(dx, dy, dz);
    const visible = depth > 0 && Math.abs(x) <= 720 * depth / 900 && Math.abs(y) <= 450 * depth / 900;
    return { index, visible, magnitude: star.absoluteMagnitude + 5 * Math.log10(Math.max(distance, Number.EPSILON)) - 5 };
  }).filter(star => star.visible && star.magnitude <= 20)
    .sort((a, b) => a.magnitude - b.magnitude || a.index - b.index)
    .slice(0, 128).map(star => star.index);
}

it('matches brute-force visible-brightness top-K across six directions and four observer distances', () => {
  const views = [
    { axis: [1, 0, 0] as const, rotation: [0, 1, 0, 0, 0, 1, 1, 0, 0] },
    { axis: [-1, 0, 0] as const, rotation: [0, 1, 0, 0, 0, 1, -1, 0, 0] },
    { axis: [0, 1, 0] as const, rotation: [1, 0, 0, 0, 0, 1, 0, 1, 0] },
    { axis: [0, -1, 0] as const, rotation: [1, 0, 0, 0, 0, 1, 0, -1, 0] },
    { axis: [0, 0, 1] as const, rotation },
    { axis: [0, 0, -1] as const, rotation: [1, 0, 0, 0, 1, 0, 0, 0, -1] },
  ];
  for (const distance of [1, 10, 100, 1000]) for (const view of views) {
    const eye: [number, number, number] = [view.axis[0] * distance, view.axis[1] * distance, view.axis[2] * distance];
    const selected = selectVisiblePreparedStars({ stars: field.stars, nodes: field.nodes, eyeUnits: eye,
      viewRotation: view.rotation, focalPx: 900, viewportHalfWidthPx: 720, viewportHalfHeightPx: 450,
      maxRepresentatives: 128, targetErrorPx: 2, limitingMagnitude: 20 });
    expect(selected.representatives.map(reference => reference.index)).toEqual(bruteTop(eye, view.rotation));
  }
});
