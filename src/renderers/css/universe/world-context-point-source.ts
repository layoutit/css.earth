import { presentWorldCamera } from '../navigation/world-camera.js';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import { rotateWorldPosition, transposeWorldRotation, worldRotationFromQuaternion } from '../navigation/world-camera-math.js';
import { rayHitsSphereBefore } from '../solar-system/heliocentric-geometry.js';
import { bindObjectNavigationTarget } from '../solar-system/heliocentric-navigation.js';
import { pointPhotometry } from '../stars/prepared-point-field-runtime.js';
import type { PreparedCssPointField } from '../stars/types.js';
import type { PreparedWorldContext } from './prepared-world-context.js';

export interface PointSourcePublication {
  readonly opacity?: number;
  /** The detailed photosphere is mounted and owns the resolved disc. */
  readonly selectedDetail?: boolean;
  /** The selected opaque body may hide the focus point without changing its photometry. */
  readonly occluder?: { readonly positionM: readonly [number, number, number]; readonly radiusM: number };
}

export interface WorldContextPointAppearance {
  readonly x: number;
  readonly y: number;
  readonly diameterPx: number;
  readonly magnitude: number;
  readonly radiusPx: number;
  readonly luminance: number;
  readonly opacity: number;
  readonly colorIndex: number;
}

export interface WorldContextPointSourceGain {
  readonly radius: number;
  readonly brightness: number;
}

/** Shared point-to-photosphere handover using prepared LOD limits, never copied thresholds. */
export function worldContextPointSourceFade(diameterPx: number, plan: PreparedWorldContext): number {
  const lod = plan.camera.presentation.levelOfDetail, start = lod.markerFullDiscPixels, end = lod.billboardFadeStartDiscPixels;
  if (diameterPx <= start) return 1;
  if (diameterPx >= end) return 0;
  const t = (diameterPx - start) / (end - start);
  return 1 - t * t * (3 - 2 * t);
}

/** Authored log-distance gain stays in the shared PSF chain and retires before detailed geometry dominates. */
export function worldContextPointSourceGain(distanceM: number, plan: PreparedWorldContext): WorldContextPointSourceGain {
  const enhancement = plan.focus.pointSource?.proximityEnhancement;
  if (!enhancement || !(distanceM > 0) || !Number.isFinite(distanceM)) return Object.freeze({ radius: 1, brightness: 1 });
  const t = clamp((Math.log(distanceM) - Math.log(enhancement.fullDistanceM)) /
    (Math.log(enhancement.fadeOutDistanceM) - Math.log(enhancement.fullDistanceM)));
  const weight = 1 - t * t * (3 - 2 * t);
  return Object.freeze({ radius: 1 + (enhancement.radiusMultiplier - 1) * weight,
    brightness: 1 + (enhancement.brightnessMultiplier - 1) * weight });
}

/** One focus point uses the star field's prepared photometry and PSF atlas. */
export function worldContextPointAppearance(plan: PreparedWorldContext, field: PreparedCssPointField,
  world: WorldCameraPose, viewport: WorldCameraViewport, publication: PointSourcePublication = {}): WorldContextPointAppearance | null {
  const source = plan.focus.pointSource;
  if (!source || world.referenceFrame !== plan.frame.referenceFrame || world.epochJdTt !== plan.frame.epochJdTt) return null;
  if (publication.occluder && occludesFocus(world, plan, publication.occluder)) return null;
  const camera = presentWorldCamera(world, plan.frame, viewport), centre = camera.centerPixels, depth = camera.depthUnits;
  if (centre === null || !(depth > 0)) return null;
  const radiusUnits = plan.focus.radiusM / plan.frame.metersPerUnit;
  const diameterPx = depth > radiusUnits ? 2 * viewport.focalPixels * radiusUnits / Math.sqrt(depth * depth - radiusUnits * radiusUnits) : Infinity;
  const light = pointPhotometry(field, source.absoluteMagnitude, camera.distanceM / field.frame.metersPerUnit);
  const gain = worldContextPointSourceGain(camera.distanceM, plan);
  const detail = publication.selectedDetail === true ? worldContextPointSourceFade(diameterPx, plan) : 1;
  const opacity = clamp(publication.opacity ?? 1) * detail;
  const physicalRadiusPx = Number.isFinite(diameterPx) ? diameterPx / (2 * field.atlas.haloRadii) : 0;
  return Object.freeze({ x: centre[0], y: centre[1], diameterPx, magnitude: light.magnitude, radiusPx: Math.max(light.radiusPx * gain.radius, physicalRadiusPx),
    luminance: Math.min(1, light.luminance * gain.brightness),
    opacity, colorIndex: nearestAtlasColor(source.color, field.atlas.colors) });
}

/** Retained single-node renderer. It consumes the checked point atlas; it creates no image or geometry. */
export function mountWorldContextPointSource({ host, before, plan, field, resolveResource }: {
  host: HTMLElement; before: Element; plan: PreparedWorldContext; field: PreparedCssPointField; resolveResource(path: string): string;
}) {
  if (!plan.focus.pointSource) return null;
  const element = host.ownerDocument.createElement('s');
  element.dataset.worldContextPointSource = plan.focus.id;
  element.style.cssText = `position:absolute;left:50%;top:50%;width:${field.atlas.tileSize}px;height:${field.atlas.tileSize}px;background-repeat:no-repeat;text-decoration:none;transform-origin:0 0;pointer-events:none;visibility:hidden`;
  element.style.backgroundImage = `url(${JSON.stringify(resolveResource(field.atlas.path))})`;
  host.insertBefore(element, before);
  const navigation = bindObjectNavigationTarget(element, host);
  let destroyed = false;
  return Object.freeze({ element,
    publish(world: WorldCameraPose, viewport: WorldCameraViewport, publication: PointSourcePublication = {}) {
      if (destroyed) return;
      const appearance = worldContextPointAppearance(plan, field, world, viewport, publication);
      if (!appearance || appearance.opacity <= 0 || appearance.luminance <= 0) {
        element.style.visibility = 'hidden'; navigation.update(null); return;
      }
      const size = appearance.radiusPx * 2 * field.atlas.haloRadii;
      element.style.visibility = '';
      element.style.backgroundPosition = `${-(appearance.colorIndex % field.atlas.columns) * field.atlas.tileSize}px ${-Math.floor(appearance.colorIndex / field.atlas.columns) * field.atlas.tileSize}px`;
      element.style.transform = `translate(${appearance.x - size / 2}px,${appearance.y - size / 2}px) scale(${size / field.atlas.tileSize})`;
      const alpha = appearance.opacity * appearance.luminance;
      element.style.opacity = String(alpha);
      navigation.update(alpha > .1 ? plan.focus.id : null, plan.focus.name);
      element.dataset.pointSourceDiameter = String(appearance.diameterPx);
    },
    destroy() { if (!destroyed) { destroyed = true; navigation.destroy(); element.remove(); } },
  });
}

function nearestAtlasColor(color: string, palette: PreparedCssPointField['atlas']['colors']): number {
  const red = Number.parseInt(color.slice(1, 3), 16), green = Number.parseInt(color.slice(3, 5), 16), blue = Number.parseInt(color.slice(5, 7), 16);
  let closest = 0, error = Infinity;
  for (let index = 0; index < palette.length; index++) { const sample = palette[index]!, distance = (sample[0] - red) ** 2 + (sample[1] - green) ** 2 + (sample[2] - blue) ** 2; if (distance < error) { error = distance; closest = index; } }
  return closest;
}
function clamp(value: number): number { return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0; }

function occludesFocus(world: WorldCameraPose, plan: PreparedWorldContext,
  occluder: NonNullable<PointSourcePublication['occluder']>): boolean {
  if (!(Number.isFinite(occluder.radiusM) && occluder.radiusM > 0) ||
      !occluder.positionM.every(Number.isFinite) ||
      (occluder.radiusM === plan.focus.radiusM && occluder.positionM.every((value, axis) => value === plan.focus.positionM[axis]))) return false;
  const rotation = transposeWorldRotation(worldRotationFromQuaternion(world.pose.orientationXyzw));
  const toEye = (positionM: readonly [number, number, number]) => rotateWorldPosition(rotation, [
    positionM[0] - world.pose.positionM[0], positionM[1] - world.pose.positionM[1], positionM[2] - world.pose.positionM[2],
  ]);
  return rayHitsSphereBefore(toEye(plan.focus.positionM), toEye(occluder.positionM), occluder.radiusM);
}
