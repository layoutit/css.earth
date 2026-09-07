import { describe, expect, it } from 'vitest';
import { selectPreparedPointField, selectVisiblePreparedStars, type Node, type Point } from './prepared-point-field.js';

const stars: readonly Point[] = Array.from({ length: 8 }, (_, index) => ({
  id: `star-${index}`, name: `Star ${index}`, positionUnits: index < 4
    ? [-2 + index * .2, 0, -10] : [20 + index, 0, -100],
  absoluteMagnitude: index, colorIndex: index,
}));

const nodes: readonly Node[] = [
  { positionUnits: [9, 0, -55], radiusUnits: 65, absoluteMagnitude: 0, colorIndex: 0, first: 0, count: 8, children: [1, 2] },
  { positionUnits: [-1.7, 0, -10], radiusUnits: 1.2, absoluteMagnitude: 0, colorIndex: 0, first: 0, count: 4, children: [3, 4] },
  { positionUnits: [23.5, 0, -100], radiusUnits: 5, absoluteMagnitude: 0, colorIndex: 0, first: 4, count: 4, children: [] },
  { positionUnits: [-1.7, 0, -10], radiusUnits: .5, absoluteMagnitude: 0, colorIndex: 0, first: 0, count: 2, children: [] },
  { positionUnits: [-1.3, 0, -10], radiusUnits: .5, absoluteMagnitude: 0, colorIndex: 0, first: 2, count: 2, children: [] },
];

function select(maxRepresentatives = 2048, targetErrorPx = 2) {
  return selectPreparedPointField({ stars, nodes, eyeUnits: [0, 0, 0],
    viewRotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], focalPx: 100,
    viewportHalfWidthPx: 500, viewportHalfHeightPx: 500, maxRepresentatives, targetErrorPx });
}

describe('prepared point-field selector', () => {
  it('refines the largest projected node and preserves exact star references', () => {
    const result = select();
    expect(result.coveredCount).toBe(stars.length);
    expect(result.representatives).toEqual([
      { kind: 'star', index: 0 }, { kind: 'star', index: 1 },
      { kind: 'star', index: 2 }, { kind: 'star', index: 3 },
      { kind: 'star', index: 4 }, { kind: 'star', index: 5 },
      { kind: 'star', index: 6 }, { kind: 'star', index: 7 },
    ]);
    expect(result.maxProjectedErrorPx).toBe(0);
    expect(result.budgetLimited).toBe(false);
  });

  it('reports budget pressure while emitting only exact star references', () => {
    const result = select(2, 0);
    expect(result.representatives).toEqual([{ kind: 'star', index: 0 }, { kind: 'star', index: 1 }]);
    expect(result.coveredCount).toBe(8);
    expect(result.budgetLimited).toBe(true);
    expect(result.representatives.every(reference => reference.kind === 'star')).toBe(true);
  });

  it('keeps eye-crossing spheres finite and frustum-bounded', () => {
    const result = selectPreparedPointField({ stars, nodes, eyeUnits: [0, 0, 0],
      viewRotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], focalPx: 100,
      viewportHalfWidthPx: 500, viewportHalfHeightPx: 500, maxRepresentatives: 2,
      targetErrorPx: 0 });
    expect(Number.isFinite(result.maxProjectedErrorPx)).toBe(true);
    expect(result.maxProjectedErrorPx).toBeLessThanOrEqual(Math.hypot(500, 500) + 1e-9);
  });

  it('selects exact visible stars by apparent magnitude and retains anchors', () => {
    const result = selectVisiblePreparedStars({ stars, nodes, eyeUnits: [0, 0, 0],
      viewRotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], focalPx: 100,
      viewportHalfWidthPx: 500, viewportHalfHeightPx: 500, maxRepresentatives: 2,
      limitingMagnitude: 0.2, coverageAnchorIndices: [7] });
    expect(result.consideredCount).toBe(8);
    expect(result.drawnCount).toBe(2);
    expect(result.representatives).toEqual([{ kind: 'star', index: 7 }, { kind: 'star', index: 0 }]);
    expect(result.representatives.every(reference => reference.kind === 'star')).toBe(true);
  });

  it('keeps catalogue coverage while omitting culled coarse proxies', () => {
    const result = selectPreparedPointField({ stars, nodes, eyeUnits: [0, 0, 0],
      viewRotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], focalPx: 100,
      viewportHalfWidthPx: 10, viewportHalfHeightPx: 10, maxRepresentatives: 8, targetErrorPx: 0 });
    expect(result.coveredCount).toBe(8);
    expect(result.representatives.every(reference => reference.kind === 'star')).toBe(true);
  });

  it('is deterministic and rejects overlapping hierarchy ranges', () => {
    expect(select(5).representatives).toEqual(select(5).representatives);
    expect(() => selectPreparedPointField({ stars, nodes: nodes.map((node, index) => index === 2
      ? { ...node, first: 3 } : node), eyeUnits: [0, 0, 0],
      viewRotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], focalPx: 100,
      viewportHalfWidthPx: 500, viewportHalfHeightPx: 500 })).toThrow();
  });

  it('handles translated and rotated observers without losing catalogue coverage', () => {
    const first = selectPreparedPointField({ stars, nodes, eyeUnits: [10, 2, 20],
      viewRotation: [0, 0, -1, 0, 1, 0, 1, 0, 0], focalPx: 160,
      viewportHalfWidthPx: 80, viewportHalfHeightPx: 60, maxRepresentatives: 8, targetErrorPx: 1 });
    const second = selectPreparedPointField({ stars, nodes, eyeUnits: [-12, 0, 35],
      viewRotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], focalPx: 160,
      viewportHalfWidthPx: 80, viewportHalfHeightPx: 60, maxRepresentatives: 8, targetErrorPx: 1 });
    expect(first.coveredCount).toBe(8);
    expect(second.coveredCount).toBe(8);
    expect(first.representatives).not.toEqual(second.representatives);
  });
});
