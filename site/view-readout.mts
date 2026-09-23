import type { PreparedCatalogObject } from '@cssearth/catalog';
import type { WorldCameraPose } from '../src/renderers/css/navigation/world-camera.js';
import type { PositionM } from '@cssearth/engine';
import type { BrowserWindow, ShellCamera, PlaybackState } from './browser-types.mts';
import { requiredElement } from './browser-types.mts';
import type { SurfaceAxes } from './surface-minimap-math.mts';
import type { MapViewport, SurfaceMapReader } from './surface-map-context.mts';
import { parseSurfaceMapConfig } from './surface-map-context.mts';
import type { WorldRotation } from '../src/renderers/css/navigation/world-camera-math.js';
import type { OverviewScope } from './overview-context.mts';
type PreparedFocus = Pick<PreparedCatalogObject, 'name' | 'positionM'>;
interface ViewReadout { setPreparedFocus(record: PreparedFocus | null): void; setCamera(camera: ShellCamera | null): void; setOverviewScope(scope: OverviewScope): void; setPlaybackState(state: PlaybackState): void; setNavigationInFlight(active: boolean): void; destroy(): void; }
import Ellipsoid from '@cesium/engine/Source/Core/Ellipsoid.js';
import { cssCameraAxesFromOrientation, rotateWorldPosition, worldRotationFromQuaternion } from '../src/renderers/css/dist/navigation.js';
import { minimapCamera } from './surface-minimap-rectangle.mts';
import { surfaceMapContext, surfaceMapViewport } from './surface-map-context.mts';
import { viewDistance } from './overview-context.mts';

const referenceAxes: SurfaceAxes = { prime: [1, 0, 0], east: [0, 1, 0], north: [0, 0, 1] };
const dot = (a: PositionM, b: PositionM) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const units: readonly (readonly [number, string])[] = [[299792458 * 31557600, 'ly'], [149597870700, 'AU'], [1000, 'km'], [1, 'm']];
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const compactNumber = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });
const wholeNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const distanceUnit = (meters: number): readonly [number, string] => units.find(([size]) => meters >= size) ?? units[units.length - 1];

export function formatViewDate(epochJdTt: number) {
  if (!Number.isFinite(epochJdTt)) return '—';
  // Format the prepared TT calendar date without applying the browser's local timezone.
  const calendar = new Date((epochJdTt - 2440587.5) * 86400000).toISOString();
  return `${calendar.slice(0, 16).replace('T', ' ')} TT`;
}

export function formatViewDistance(meters: number) {
  const [size, unit] = distanceUnit(meters);
  return `${(unit === 'km' ? wholeNumber : number).format(meters / size)} ${unit}`;
}

export function formatViewCoordinate(degrees: number, positive: string, negative: string) {
  const hundredths = Math.round(Math.abs(degrees) * 360000);
  const d = Math.floor(hundredths / 360000), m = Math.floor(hundredths / 6000) % 60;
  const s = ((hundredths % 6000) / 100).toFixed(2).padStart(5, '0');
  return `${d}°${String(m).padStart(2, '0')}′${s}″ ${degrees < 0 ? negative : positive}`;
}

export function viewScale(metersPerPixel: number, maxWidth = 80) {
  if (!(metersPerPixel > 0) || !Number.isFinite(metersPerPixel)) return null;
  const [unitSize, unit] = distanceUnit(metersPerPixel * maxWidth);
  const maximum = metersPerPixel * maxWidth / unitSize;
  const power = 10 ** Math.floor(Math.log10(maximum));
  const value = ([5, 2, 1].find(step => step * power <= maximum) ?? 1) * power;
  const measurePixels = value * unitSize / metersPerPixel;
  const labelNumber = value >= 1e6 ? compactNumber : number;
  return { label: `${labelNumber.format(value)} ${unit}`, pixels: maxWidth, measurePixels };
}

export function measureView({ eyeM, radiusM, rotation, view, focalPixels, axes, mapLeftEdgeLongitudeDeg = 0 }: { eyeM: PositionM; radiusM: number; rotation: WorldRotation; view: MapViewport; focalPixels: number; axes?: SurfaceAxes; mapLeftEdgeLongitudeDeg?: number }) {
  const camera = minimapCamera({ eye: [eyeM[0] / radiusM, eyeM[1] / radiusM, eyeM[2] / radiusM], rotation, view, axes: axes ?? referenceAxes });
  const pick = (x: number) => {
    const point = camera.pickEllipsoid({ x, y: .5 }, Ellipsoid.UNIT_SPHERE);
    // At interstellar distances a subpixel globe may be below float precision.
    return point && Math.abs(Math.hypot(point.x, point.y, point.z) - 1) < 1e-5 ? point : null;
  };
  const center = pick(.5);
  const width = (view.right - view.left) * focalPixels;
  const a = pick(.5 - .5 / width), b = pick(.5 + .5 / width);
  let metersPerPixel, scaleTitle;
  if (a && b) {
    const cross = [a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x];
    metersPerPixel = Math.atan2(Math.hypot(...cross), a.x * b.x + a.y * b.y + a.z * b.z) * radiusM;
    scaleTitle = 'Approximate surface scale at the center of the view';
  } else {
    const forward = rotateWorldPosition(rotation, [0, 0, -1]);
    metersPerPixel = -dot(eyeM, forward) / focalPixels;
    scaleTitle = 'Scale at the distance of the selected object';
  }
  return {
    altitudeM: Math.max(0, Math.hypot(...eyeM) - radiusM),
    coordinates: center && axes ? {
      latitude: Math.asin(Math.max(-1, Math.min(1, center.z / Math.hypot(center.x, center.y, center.z)))) * 180 / Math.PI,
      // The axes count longitude from the map's left edge, as the feature labels do.
      longitude: ((Math.atan2(center.y, center.x) * 180 / Math.PI + mapLeftEdgeLongitudeDeg) % 360 + 540) % 360 - 180,
    } : null,
    scale: viewScale(metersPerPixel), scaleTitle,
  };
}

export function measurePreparedFocusView(world: WorldCameraPose, focus: PreparedFocus, focalPixels: number) {
  const forward = rotateWorldPosition(worldRotationFromQuaternion(world.pose.orientationXyzw), [0, 0, -1]);
  const relative: PositionM = [focus.positionM[0] - world.pose.positionM[0], focus.positionM[1] - world.pose.positionM[1], focus.positionM[2] - world.pose.positionM[2]];
  return { coordinates: null, scale: viewScale(dot(relative, forward) / focalPixels),
    scaleTitle: `Scale at the distance of ${focus.name}` };
}

export function createViewReadout({ drawer, documentTarget, windowTarget, surfaceReader }: { drawer: HTMLElement; documentTarget: Document; windowTarget: BrowserWindow; surfaceReader?: SurfaceMapReader }): ViewReadout {
  const root = documentTarget.querySelector<HTMLElement>('.object-view-readout');
  if (!root) return { setCamera() {}, setPreparedFocus() {}, setOverviewScope() {}, setPlaybackState() {}, setNavigationInFlight() {}, destroy() {} };
  const dateGroup = requiredElement(root, '.object-view-date'), date = requiredElement(root, '[data-view-date]');
  const coordinates = requiredElement(root, '.object-view-coordinates');
  const latitude = requiredElement(root, '[data-view-latitude]'), longitude = requiredElement(root, '[data-view-longitude]');
  const altitude = requiredElement(root, '[data-view-altitude]');
  const distanceLabel = requiredElement(root, '[data-view-distance-label]');
  const distanceGroup = requiredElement(root, '.object-view-altitude');
  const scale = requiredElement(root, '.object-view-scale'), scaleLabel = requiredElement(root, '[data-view-scale-label]');
  const ruler = requiredElement(root, '.object-view-ruler');
  const measure = requiredElement(root, '.object-view-measure');
  const maps = [...drawer.querySelectorAll<HTMLElement>('[data-surface-minimap]')];
  const configs = new Map(maps.map(map => [map, parseSurfaceMapConfig(map.dataset.surfaceMinimap)]));
  const events = new AbortController();
  let camera: ShellCamera | null = null, unsubscribe: (() => void) | null = null, frame: number | null = null; let playing = false, disposed = false, flying = false;
  let timer: number | null = null, dateDay: number | null = null, playbackReason: string | null = null; let lastRender = -Infinity;
  let overviewScope: OverviewScope = 'system';
  let preparedFocus: PreparedFocus | null = null;
  const write = (element: HTMLElement, value: string) => { if (element.textContent !== value) element.textContent = value; };
  function render() {
    frame = null;
    if (disposed || documentTarget.hidden) return;
    lastRender = windowTarget.performance.now();
    const navigation = camera?.navigation;
    const scene = documentTarget.querySelector<HTMLElement>('.polycss-scene');
    if (!navigation || !scene) { dateGroup.hidden = true; coordinates.hidden = true; scale.hidden = true; write(altitude, '—'); return; }
    const map = maps.find(map => !map.closest<HTMLElement>('[data-lens-details]')?.hidden) ?? maps[0];
    const surface = preparedFocus ? null : surfaceReader ? surfaceReader.read(map, camera)
      : surfaceMapContext(map ? configs.get(map) : undefined, camera, documentTarget, windowTarget);
    const world = navigation.capture(), optics = navigation.optics();
    dateGroup.hidden = !Number.isFinite(world.epochJdTt);
    const day = Number.isFinite(world.epochJdTt) ? Math.floor(world.epochJdTt + .5) : null;
    if (day !== dateDay) { dateDay = day; write(date, formatViewDate(world.epochJdTt)); }
    const value = preparedFocus ? measurePreparedFocusView(world, preparedFocus, optics.focalPixels) : measureView({
      eyeM: [world.pose.positionM[0] - navigation.frame.originM[0], world.pose.positionM[1] - navigation.frame.originM[1], world.pose.positionM[2] - navigation.frame.originM[2]],
      radiusM: navigation.frame.bodyRadiusM, rotation: cssCameraAxesFromOrientation(world.pose.orientationXyzw),
      view: surfaceMapViewport(scene, optics), focalPixels: optics.focalPixels, axes: surface?.axes, mapLeftEdgeLongitudeDeg: surface?.mapLeftEdgeLongitudeDeg,
    });
    const distance = viewDistance(world, navigation.frame, overviewScope, undefined, preparedFocus);
    write(altitude, formatViewDistance(distance.meters));
    if (distanceLabel) write(distanceLabel, distance.label);
    if (distanceGroup) distanceGroup.title = distance.title;
    coordinates.hidden = !value.coordinates;
    if (value.coordinates) {
      write(latitude, formatViewCoordinate(value.coordinates.latitude, 'N', 'S'));
      write(longitude, formatViewCoordinate(value.coordinates.longitude, 'E', 'W'));
    }
    scale.hidden = !value.scale;
    if (value.scale) {
      write(scaleLabel, value.scale.label);
      ruler.style.width = `${value.scale.pixels.toFixed(2)}px`;
      measure.style.width = `${value.scale.measurePixels.toFixed(2)}px`;
      scale.title = `${value.scaleTitle}. Distance is measured from the left edge to the moving tick.`;
    }
    if (playing) schedule();
  }
  function schedule(immediate = false) {
    // A fly-to holds the readout still; arrival refreshes it once.
    if (disposed || documentTarget.hidden || flying) return;
    if (immediate && timer !== null) { windowTarget.clearTimeout(timer); timer = null; }
    if (frame !== null || timer !== null) return;
    const wait = immediate ? 0 : 100 - (windowTarget.performance.now() - lastRender);
    if (wait > 0) timer = windowTarget.setTimeout(() => {
      timer = null; schedule(true);
    }, wait);
    else frame = windowTarget.requestAnimationFrame(render);
  }
  const refresh = () => schedule(true);
  windowTarget.addEventListener('resize', refresh, { signal: events.signal });
  documentTarget.addEventListener('visibilitychange', () => {
    if (documentTarget.hidden) {
      if (timer !== null) windowTarget.clearTimeout(timer);
      if (frame !== null) windowTarget.cancelAnimationFrame(frame);
      timer = frame = null;
    } else refresh();
  }, { signal: events.signal });
  return {
    setPreparedFocus(record) { preparedFocus = record; refresh(); },
    setOverviewScope(scope) { overviewScope = scope; refresh(); },
    setCamera(next) { unsubscribe?.(); camera = next; unsubscribe = next?.navigation?.subscribe(() => schedule()) ?? null; refresh(); },
    setPlaybackState(state) {
      const changed = playing !== state.allowed || playbackReason !== state.reason;
      playing = state.allowed; playbackReason = state.reason;
      if (changed) refresh();
    },
    setNavigationInFlight(active) {
      if (flying === active) return;
      flying = active;
      if (!active) { refresh(); return; }
      if (timer !== null) windowTarget.clearTimeout(timer);
      if (frame !== null) windowTarget.cancelAnimationFrame(frame);
      timer = frame = null;
      // The departure's distance and coordinates go stale as soon as the camera moves.
      coordinates.hidden = true; scale.hidden = true; write(altitude, '—');
    },
    destroy() {
      disposed = true; unsubscribe?.(); events.abort();
      if (frame !== null) windowTarget.cancelAnimationFrame(frame);
      if (timer !== null) windowTarget.clearTimeout(timer);
    },
  };
}
