import { formatViewDate, formatViewDistance, formatViewCoordinate, viewScale } from './view-format.mts';
import type { PreparedCatalogObject } from '@cssearth/catalog';
import type { WorldCameraPose } from '../src/renderers/css/navigation/world-camera.js';
import type { PositionM } from '@cssearth/engine';
import type { BrowserWindow, ShellCamera, PlaybackState } from './browser-types.mts';
import { requiredElement } from './browser-types.mts';
import type { SurfaceMapReader } from './surface-map-context.mts';
import { parseSurfaceMapConfig } from './surface-map-context.mts';
import type { OverviewScope } from './overview-context.mts';
import { cssCameraAxesFromOrientation, rotateWorldPosition, worldRotationFromQuaternion } from '../src/renderers/css/dist/navigation.js';
import { loadSurfaceGeometry, loadedSurfaceGeometry } from './surface-geometry.mts';
import { surfaceMapContext, surfaceMapViewport } from './surface-map-context.mts';
import { viewDistance } from './overview-context.mts';
import { dotN as dot } from '../src/platform/vector3.mts';
type PreparedFocus = Pick<PreparedCatalogObject, 'name' | 'positionM'>;
interface ViewReadout { setPreparedFocus(record: PreparedFocus | null): void; setCamera(camera: ShellCamera | null): void; setOverviewScope(scope: OverviewScope): void; setPlaybackState(state: PlaybackState): void; setNavigationInFlight(active: boolean): void; destroy(): void; }

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
  let camera: ShellCamera | null = null, unsubscribe: (() => void) | null = null, frame: number | null = null; let playing = false, flying = false;
  let timer: number | null = null, dateDay: number | null = null, playbackReason: string | null = null; let lastRender = -Infinity;
  let overviewScope: OverviewScope = 'system';
  let preparedFocus: PreparedFocus | null = null;
  const write = (element: HTMLElement, value: string) => { if (element.textContent !== value) element.textContent = value; };
  /** Drop a scheduled render: the page hid, a flight began, or the readout retired. */
  const cancelPending = () => {
    if (timer !== null) windowTarget.clearTimeout(timer);
    if (frame !== null) windowTarget.cancelAnimationFrame(frame);
    timer = frame = null;
  };
  /** A reading that no longer describes the view. Without a camera the scene date goes too. */
  const clearReading = ({ date }: { date: boolean }) => {
    if (date) dateGroup.hidden = true;
    coordinates.hidden = true; scale.hidden = true; write(altitude, '—');
  };
  function render() {
    frame = null;
    if (events.signal.aborted || documentTarget.hidden) return;
    lastRender = windowTarget.performance.now();
    const navigation = camera?.navigation;
    const scene = documentTarget.querySelector<HTMLElement>('.polycss-scene');
    if (!navigation || !scene) { clearReading({ date: true }); return; }
    const map = maps.find(map => !map.closest<HTMLElement>('[data-lens-details]')?.hidden) ?? maps[0];
    const surface = preparedFocus ? null : surfaceReader ? surfaceReader.read(map, camera)
      : surfaceMapContext(map ? configs.get(map) : undefined, camera, documentTarget, windowTarget);
    const world = navigation.capture(), optics = navigation.optics();
    dateGroup.hidden = !Number.isFinite(world.epochJdTt);
    const day = Number.isFinite(world.epochJdTt) ? Math.floor(world.epochJdTt + .5) : null;
    if (day !== dateDay) { dateDay = day; write(date, formatViewDate(world.epochJdTt)); }
    // The surface picking math loads after the first frame; the readout fills in when it arrives.
    const geometry = preparedFocus ? null : loadedSurfaceGeometry();
    if (!preparedFocus && !geometry) void loadSurfaceGeometry().then(refresh);
    const value = preparedFocus ? measurePreparedFocusView(world, preparedFocus, optics.focalPixels) : geometry?.measureView({
      eyeM: [world.pose.positionM[0] - navigation.frame.originM[0], world.pose.positionM[1] - navigation.frame.originM[1], world.pose.positionM[2] - navigation.frame.originM[2]],
      radiusM: navigation.frame.bodyRadiusM, rotation: cssCameraAxesFromOrientation(world.pose.orientationXyzw),
      view: surfaceMapViewport(scene, optics), focalPixels: optics.focalPixels, axes: surface?.axes, mapLeftEdgeLongitudeDeg: surface?.mapLeftEdgeLongitudeDeg,
    });
    const distance = viewDistance(world, navigation.frame, overviewScope, undefined, preparedFocus);
    write(altitude, formatViewDistance(distance.meters));
    if (distanceLabel) write(distanceLabel, distance.label);
    if (distanceGroup) distanceGroup.title = distance.title;
    coordinates.hidden = !value?.coordinates;
    if (value?.coordinates) {
      write(latitude, formatViewCoordinate(value.coordinates.latitude, 'N', 'S'));
      write(longitude, formatViewCoordinate(value.coordinates.longitude, 'E', 'W'));
    }
    scale.hidden = !value?.scale;
    if (value?.scale) {
      write(scaleLabel, value.scale.label);
      ruler.style.width = `${value.scale.pixels.toFixed(2)}px`;
      measure.style.width = `${value.scale.measurePixels.toFixed(2)}px`;
      scale.title = `${value.scaleTitle}. Distance is measured from the left edge to the moving tick.`;
    }
    if (playing) schedule();
  }
  function schedule(immediate = false) {
    // A fly-to holds the readout still; arrival refreshes it once.
    if (events.signal.aborted || documentTarget.hidden || flying) return;
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
    if (documentTarget.hidden) cancelPending();
    else refresh();
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
      cancelPending();
      // The departure's distance and coordinates go stale as soon as the camera moves; its date still holds.
      clearReading({ date: false });
    },
    destroy() {
      events.abort(); unsubscribe?.(); cancelPending();
    },
  };
}
