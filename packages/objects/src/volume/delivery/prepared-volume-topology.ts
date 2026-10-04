import { validatePreparedCssVolume } from './css-volume-validation.js';
import type { PreparedCssVolume } from './css-volume-types.js';
const AXES = ['x', 'y', 'z'] as const;

/** Geometry equality excludes resource identity and atlas sampling, which are presentation material. */
export function samePreparedVolumeTopology(leftInput: PreparedCssVolume, rightInput: PreparedCssVolume): boolean {
  const left = validatePreparedCssVolume(leftInput), right = validatePreparedCssVolume(rightInput);
  if (!frameEquals(left.frame, right.frame) || !anchorsEqual(left.anchors, right.anchors)) return false;
  for (const axis of AXES) {
    const a = left.stacks.find(stack => stack.axis === axis), b = right.stacks.find(stack => stack.axis === axis);
    if (!a || !b || !vectorEquals(a.normalUnits, b.normalUnits) || a.leaves.length !== b.leaves.length) return false;
    for (let index = 0; index < a.leaves.length; index++) {
      const x = a.leaves[index]!, y = b.leaves[index]!, prepared = x.style, other = y.style;
      if (x.id !== y.id || x.widthPx !== y.widthPx || x.heightPx !== y.heightPx ||
          !vectorEquals(x.centerUnits, y.centerUnits) || prepared.width !== other.width || prepared.height !== other.height ||
          prepared.transform !== other.transform || !boundsEqual(x.boundsCssPixels, y.boundsCssPixels)) return false;
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

function frameEquals(left: PreparedCssVolume['frame'], right: PreparedCssVolume['frame']): boolean {
  return left.referenceFrame === right.referenceFrame && left.epochJdTt === right.epochJdTt && left.metersPerUnit === right.metersPerUnit &&
    vectorEquals(left.originM, right.originM) && vectorEquals(left.localToReferenceXyzw, right.localToReferenceXyzw) &&
    vectorEquals(left.boundsUnits.min, right.boundsUnits.min) && vectorEquals(left.boundsUnits.max, right.boundsUnits.max);
}

function anchorsEqual(left: PreparedCssVolume['anchors'], right: PreparedCssVolume['anchors']): boolean {
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
