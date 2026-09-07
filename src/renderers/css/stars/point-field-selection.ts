import { selectVisiblePreparedStars } from '@cssearth/engine';
import type { PreparedPointFieldSelection, VisiblePreparedPointFieldInput } from '@cssearth/engine';
import type { PreparedCssPointField } from './types.js';

export type PointFieldView = Pick<VisiblePreparedPointFieldInput, 'eyeUnits' | 'viewRotation' | 'focalPx' |
  'viewportHalfWidthPx' | 'viewportHalfHeightPx'>;

/** One immutable prepared catalogue, many observer views. No DOM or generated scene assets. */
export function createPointFieldSelection(payload: PreparedCssPointField) {
  const field = { stars: payload.stars, nodes: payload.nodes,
    maxRepresentatives: payload.policy.activeSlots, targetErrorPx: payload.policy.maxErrorPx,
    limitingMagnitude: payload.photometry.limitingMagnitude,
    distanceScalePc: payload.frame.metersPerUnit / 3.085677581491367e16,
    coverageAnchorIndices: payload.stars.flatMap((star, index) => star.coverageAnchor ? [index] : []) };
  return (view: PointFieldView): PreparedPointFieldSelection => selectVisiblePreparedStars({ ...field, ...view });
}
