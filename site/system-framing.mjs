import context from '../src/planets/sun/prepared/world-context.json' with { type: 'json' };
import { SYSTEM_FRAMING_MIN_MOON_RADIUS_SHARE, SYSTEM_FRAMING_PADDING_PIXELS } from './runtime-policy.mjs';
import { rotateWorldPosition, worldRotationFromQuaternion } from '../src/renderers/css/dist/navigation.js';

/** Camera framing consumes the prepared orbit bounds, never orbit vertices. */
export function systemFramingRadii(plan) {
  const parents = new Map([...(plan.focus?.systemView ? [plan.focus] : []), ...plan.bodies].map(body => [body.id, body]));
  const largestMoons = new Map();
  for (const moon of plan.bodies) {
    const parentId = moon.orbit?.centerBodyId;
    if (!parents.has(parentId) || !moon.orbit.bounds) continue;
    largestMoons.set(parentId, Math.max(largestMoons.get(parentId) ?? 0, moon.radiusM));
  }
  const radii = new Map();
  for (const moon of plan.bodies) {
    const parent = parents.get(moon.orbit?.centerBodyId), bounds = moon.orbit?.bounds;
    if (!parent || !bounds) continue;
    if (parent.systemView ? !parent.systemView.memberIds.includes(moon.id)
      : moon.radiusM < largestMoons.get(parent.id) * SYSTEM_FRAMING_MIN_MOON_RADIUS_SHARE) continue;
    const radius = Math.hypot(...bounds.centerM.map((value, axis) => value - parent.positionM[axis]))
      + bounds.radiusM + moon.radiusM;
    radii.set(parent.id, Math.max(radii.get(parent.id) ?? parent.radiusM, radius));
  }
  return radii;
}

export const SYSTEM_FRAMING_RADII = systemFramingRadii(context);
export const SYSTEM_VIEWS = new Map([context.focus, ...context.bodies].filter(body => body.systemView).map(body => [body.id, body.systemView]));

/** The same scale boundary governs both the system arrival and the card handoff. */
export function systemOverviewDistance(bodyRadiusM, systemRadiusM, optics) {
  return Math.sqrt(systemRadiusM * bodyRadiusM) * Math.hypot(1, optics.focalPixels / optics.framingRadiusPixels);
}

/** The scene stays centered; the fit respects the shell around that center. */
export function systemFramingRect(optics, documentTarget) {
  const width = optics.widthPixels ?? optics.framingRadiusPixels * 2;
  const height = optics.heightPixels ?? optics.framingRadiusPixels * 2;
  const rect = { ...(optics.visibleRect ?? { left: -width / 2, right: width / 2, top: -height / 2, bottom: height / 2 }) };
  const stage = documentTarget?.querySelector?.('.planet-stage')?.getBoundingClientRect();
  if (stage) {
    const cx = stage.left + stage.width / 2, cy = stage.top + stage.height / 2;
    // Read once on selection, never in the animation loop.
    for (const selector of ['.planet-sidebar', '.explorer-shell-header', '.planet-view-readout', '.planet-attribution-footer']) {
      const box = documentTarget.querySelector(selector)?.getBoundingClientRect();
      if (!box || !box.width || !box.height) continue;
      if (box.right < cx) rect.left = Math.max(rect.left, box.right - cx);
      else if (box.bottom <= cy) rect.top = Math.max(rect.top, box.bottom - cy);
      else if (box.top >= cy) rect.bottom = Math.min(rect.bottom, box.top - cy);
    }
  }
  const padding = Math.min(SYSTEM_FRAMING_PADDING_PIXELS, (rect.right - rect.left) / 8, (rect.bottom - rect.top) / 8,
    -rect.left / 2, rect.right / 2, -rect.top / 2, rect.bottom / 2);
  return { left: rect.left + padding, right: rect.right - padding,
    top: rect.top + padding, bottom: rect.bottom - padding };
}

/** Keep the departure angle and fit the prepared system around its new center. */
export function systemViewTarget(from, frame, optics, view, rect, minimumRangeM = 0) {
  if (from.referenceFrame !== frame.referenceFrame || from.epochJdTt !== frame.epochJdTt) {
    throw new TypeError('System selection requires a common frame and epoch.');
  }
  if (!(rect.left < 0 && rect.right > 0 && rect.top < 0 && rect.bottom > 0)) {
    throw new TypeError('System framing must leave room around the scene center.');
  }
  const cameraToReference = worldRotationFromQuaternion(from.pose.orientationXyzw);
  const referenceToCamera = worldRotationFromQuaternion(from.pose.orientationXyzw.map((value, axis) => axis < 3 ? -value : value));
  // Each prepared box encloses the complete system. Project their eight corners
  // at the current angle and use the tightest fit; none dictates a camera turn.
  const depth = Math.min(...view.candidates.map(candidate =>
    fitSystemDepth(frame, optics, candidate, rect, minimumRangeM, referenceToCamera)));
  if (!Number.isFinite(depth)) throw new TypeError('System framing requires prepared bounds.');
  const [ox, oy] = optics.principalOffsetPixels, focal = optics.focalPixels;
  const offset = rotateWorldPosition(cameraToReference, [ox / focal * depth, oy / focal * depth, depth]);
  return { referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt,
    pose: { positionM: frame.originM.map((value, axis) => value + offset[axis]),
      orientationXyzw: [...from.pose.orientationXyzw] } };
}

/** Fit the prepared bounds through the current perspective projection. */
function fitSystemDepth(frame, optics, view, rect, minimumRangeM, referenceToCamera) {
  const [ox, oy] = optics.principalOffsetPixels, focal = optics.focalPixels;
  const precision = 8 * Number.EPSILON * Math.max(minimumRangeM, ...frame.originM.map(Math.abs));
  let depth = Math.max(frame.bodyRadiusM * 2,
    minimumRangeM / Math.hypot(1, ox / focal, oy / focal) + precision);
  for (const bx of [view.minimumM[0], view.maximumM[0]])
    for (const by of [view.minimumM[1], view.maximumM[1]])
      for (const bz of [view.minimumM[2], view.maximumM[2]]) {
        const [x, y, z] = rotateWorldPosition(referenceToCamera,
          rotateWorldPosition(view.cameraToReference, [bx, by, bz]));
        const nx = focal * x - ox * z, ny = focal * y - oy * z;
        depth = Math.max(depth, z + Math.abs(frame.bodyRadiusM),
          z + nx / (nx < 0 ? rect.left : rect.right), z + ny / (ny < 0 ? rect.top : rect.bottom));
      }
  return depth;
}
