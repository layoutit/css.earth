import { presentWorldCamera } from '../../navigation/world-camera.js';
import type { WorldCameraPose, WorldCameraViewport } from '../../navigation/world-camera.js';
import { cssViewFromOrientation, rotateWorldPosition } from '../../navigation/world-camera-math.js';
import { rayHitsSphereBefore } from '../../solar-system/heliocentric-geometry.js';
import { bindObjectNavigationTarget } from '../../solar-system/heliocentric-navigation.js';
import { MINIMUM_BODY_MARKER_DIAMETER_PIXELS } from '../../solar-system/heliocentric-sprites.js';
import { screenPicking } from '../../navigation/screen-picking.js';
import type { ScreenPickTarget } from '../../navigation/screen-picking.js';
import { pointPhotometry } from '../../stars/point-field-projection.js';
import type { PreparedPointAppearance } from '../../stars/types.js';
import type { PreparedWorldContext } from '../../prepared-data/world-context.js';

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

/** One focus point uses prepared photometry and the PSF atlas, without catalogue rows. */
export function worldContextPointAppearance(plan: PreparedWorldContext, field: PreparedPointAppearance,
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
  // The atlas radius describes its bright core; its halo extends beyond that.
  // Combine the projected disc and optical spread smoothly instead of fitting
  // the whole halo inside the physical photosphere.
  const physicalRadiusPx = Number.isFinite(diameterPx) ? diameterPx / 2 : 0;
  // The focus remains a navigation marker after its light becomes unresolved.
  // Apply the same readable core floor as body sprites, not the smaller floor
  // for anonymous background stars; the surrounding PSF halo is not the core.
  const radiusPx = Math.max(MINIMUM_BODY_MARKER_DIAMETER_PIXELS / 2, field.photometry.minimumRadiusPx * gain.radius,
    Math.hypot(physicalRadiusPx, light.radiusPx * gain.radius));
  return Object.freeze({ x: centre[0], y: centre[1], diameterPx, magnitude: light.magnitude, radiusPx,
    // The focus also serves as a navigation landmark once its physical light is too faint.
    luminance: Math.max(.65 * worldContextPointSourceFade(diameterPx, plan), Math.min(1, light.luminance * gain.brightness)),
    opacity, colorIndex: nearestAtlasColor(source.color, field.atlas.colors) });
}

/** Retained single-node renderer. It consumes the checked point atlas; it creates no image or geometry. */
export function mountWorldContextPointSource({ host, before, plan, field, resolveResource, pickingHost = host }: {
  host: HTMLElement; before: Element; plan: PreparedWorldContext; field: PreparedPointAppearance; resolveResource(path: string): string; pickingHost?: HTMLElement;
}) {
  if (!plan.focus.pointSource) return null;
  const element = host.ownerDocument.createElement('s');
  element.dataset.worldContextPointSource = plan.focus.id;
  // Its own 32 px layer: it moves and scales every camera frame and must not repaint the layer beneath it.
  element.style.cssText = `position:absolute;left:50%;top:50%;width:${field.atlas.tileSize}px;height:${field.atlas.tileSize}px;background-repeat:no-repeat;text-decoration:none;transform-origin:0 0;pointer-events:none;visibility:hidden;will-change:transform`;
  element.style.backgroundImage = `url(${JSON.stringify(resolveResource(field.atlas.path))})`;
  host.insertBefore(element, before);
  const navigation = bindObjectNavigationTarget(element, host);
  const picking = screenPicking(pickingHost);
  let navigationEnabled = true, target: ScreenPickTarget[] = [];
  let destroyed = false;
  return Object.freeze({ element,
    setNavigationEnabled(enabled: boolean) { navigationEnabled = enabled; picking.publish(element, enabled ? target : []); },
    publish(world: WorldCameraPose, viewport: WorldCameraViewport, publication: PointSourcePublication = {}) {
      if (destroyed) return;
      const appearance = worldContextPointAppearance(plan, field, world, viewport, publication);
      if (!appearance || appearance.opacity <= 0 || appearance.luminance <= 0) {
        target = []; picking.publish(element, target);
        element.style.visibility = 'hidden'; navigation.update(null); return;
      }
      const size = appearance.radiusPx * 2 * field.atlas.haloRadii;
      element.style.visibility = '';
      element.style.backgroundPosition = `${-(appearance.colorIndex % field.atlas.columns) * field.atlas.tileSize}px ${-Math.floor(appearance.colorIndex / field.atlas.columns) * field.atlas.tileSize}px`;
      element.style.transform = `translate(${appearance.x - size / 2}px,${appearance.y - size / 2}px) scale(${size / field.atlas.tileSize})`;
      const alpha = appearance.opacity * appearance.luminance;
      element.style.opacity = String(alpha);
      navigation.update(alpha > .1 ? plan.focus.id : null, plan.focus.name);
      target = alpha > .1 ? [{ element, rank: -1, shape: { kind: 'rect', left: appearance.x - size / 2,
        top: appearance.y - size / 2, right: appearance.x + size / 2, bottom: appearance.y + size / 2 } }] : [];
      picking.publish(element, navigationEnabled ? target : []);
      const diameterHook = String(Math.round(appearance.diameterPx * 10) / 10);
      if (element.dataset.pointSourceDiameter !== diameterHook) element.dataset.pointSourceDiameter = diameterHook;
    },
    destroy() { if (!destroyed) { destroyed = true; picking.remove(element); navigation.destroy(); element.remove(); } },
  });
}

function nearestAtlasColor(color: string, palette: PreparedPointAppearance['atlas']['colors']): number {
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
  const rotation = cssViewFromOrientation(world.pose.orientationXyzw);
  const toEye = (positionM: readonly [number, number, number]) => rotateWorldPosition(rotation, [
    positionM[0] - world.pose.positionM[0], positionM[1] - world.pose.positionM[1], positionM[2] - world.pose.positionM[2],
  ]);
  return rayHitsSphereBefore(toEye(plan.focus.positionM), toEye(occluder.positionM), occluder.radiusM);
}
