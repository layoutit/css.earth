import { fromEyeM, cssCameraAxesFromOrientation, rotateWorldPosition, worldRotationFromQuaternion } from '@cssearth/engine';
import { formatViewDate, formatViewDistance, formatViewCoordinate, viewScale } from '../minimap/view-format.mts';
import type { WorldCameraPose, PositionM } from '@cssearth/engine';
import type { BrowserWindow, ShellCamera, PlaybackState } from '../browser/browser-types.mts';
import { requiredElement } from '../browser/browser-types.mts';
import { sectionElements } from '@cssearth/renderer';
import type { SurfaceMapReader } from '../minimap/surface-map-context.mts';
import { parseSurfaceMapConfig, surfaceMapContext, surfaceMapViewport } from '../minimap/surface-map-context.mts';
import type { ZoomScope } from '../world/zoom-scope.mts';
import { measureView } from '../minimap/view-measure.mts';
import { viewDistance } from '../world/zoom-scope.mts';
import { dotN as dot } from '@cssearth/core';
/** A subject with no surface (a galaxy, a cluster, a nebula): the readout measures to its centre, not above a radius. */
type ExtendedSubject = { readonly name: string; readonly positionM: readonly [number, number, number] };
interface ViewReadout { bindObject(): void; setExtendedSubject(record: ExtendedSubject | null): void; setCamera(camera: ShellCamera | null): void; setOverviewScope(scope: ZoomScope | null): void; setPlaybackState(state: PlaybackState): void; setNavigationInFlight(active: boolean): void; destroy(): void; }

export function measureExtendedSubjectView(world: WorldCameraPose, focus: ExtendedSubject, focalPixels: number) {
  const forward = rotateWorldPosition(worldRotationFromQuaternion(world.pose.orientationXyzw), [0, 0, -1]);
  const relative = fromEyeM(world.pose, focus.positionM);
  return { coordinates: null, scale: viewScale(dot(relative, forward) / focalPixels),
    scaleTitle: `Scale at the distance of ${focus.name}` };
}

export function createViewReadout({ drawer, documentTarget, windowTarget, surfaceReader }: { drawer: HTMLElement; documentTarget: Document; windowTarget: BrowserWindow; surfaceReader?: SurfaceMapReader }): ViewReadout {
  // The footer holding the readout waits off the page on narrow layouts (layout-sections.mts); the readout keeps it current.
  const root = sectionElements(documentTarget, '.object-view-readout')[0];
  if (!root) return { bindObject() {}, setCamera() {}, setExtendedSubject() {}, setOverviewScope() {}, setPlaybackState() {}, setNavigationInFlight() {}, destroy() {} };
  const dateGroup = requiredElement(root, '.object-view-date'), date = requiredElement(root, '[data-view-date]');
  const coordinates = requiredElement(root, '.object-view-coordinates');
  const latitude = requiredElement(root, '[data-view-latitude]'), longitude = requiredElement(root, '[data-view-longitude]');
  const altitude = requiredElement(root, '[data-view-altitude]');
  const distanceLabel = requiredElement(root, '[data-view-distance-label]');
  const distanceGroup = requiredElement(root, '.object-view-altitude');
  const scale = requiredElement(root, '.object-view-scale'), scaleLabel = requiredElement(root, '[data-view-scale-label]');
  const ruler = requiredElement(root, '.object-view-ruler');
  const measure = requiredElement(root, '.object-view-measure');
  let maps = [...drawer.querySelectorAll<HTMLElement>('[data-surface-minimap]')];
  const configs = new Map(maps.map(map => [map, parseSurfaceMapConfig(map.dataset.surfaceMinimap)]));
  const events = new AbortController();
  let camera: ShellCamera | null = null, unsubscribe: (() => void) | null = null, frame: number | null = null; let playing = false, flying = false, moving = false;
  let timer: number | null = null, dateDay: number | null = null, playbackReason: string | null = null; let lastRender = -Infinity;
  // The scope the zoom frames; null on a body.
  let overviewScope: ZoomScope | null = null;
  let extendedSubject: ExtendedSubject | null = null;
  const hidden = (element: HTMLElement, value: boolean) => { if (element.hidden !== value) element.hidden = value; };
  const write = (element: HTMLElement, value: string) => { if (element.textContent !== value) element.textContent = value; };
  /** Drop a scheduled render: the page hid, a flight began, or the readout retired. */
  const cancelPending = () => {
    if (timer !== null) windowTarget.clearTimeout(timer);
    if (frame !== null) windowTarget.cancelAnimationFrame(frame);
    timer = frame = null;
  };
  /** A reading that no longer describes the view. Without a camera the scene date goes too. */
  const clearReading = ({ date }: { date: boolean }) => {
    if (date) hidden(dateGroup, true);
    hidden(coordinates, true); hidden(scale, true); write(altitude, '—');
  };
  function render() {
    frame = null;
    if (events.signal.aborted || documentTarget.hidden) return;
    lastRender = windowTarget.performance.now();
    const navigation = camera?.navigation;
    // A far body's scene waits off the page (perspective-dolly.ts); the readout still reads its frame.
    const scene = sectionElements(documentTarget, '.polycss-scene')[0];
    if (!navigation || !scene) { clearReading({ date: true }); return; }
    const map = maps.find(map => !map.closest<HTMLElement>('[data-dataset-details]')?.hidden) ?? maps[0];
    const surface = extendedSubject ? null : surfaceReader ? surfaceReader.read(map, camera)
      : surfaceMapContext(map ? configs.get(map) : undefined, camera, documentTarget, windowTarget);
    const world = navigation.capture(), optics = navigation.optics();
    hidden(dateGroup, !Number.isFinite(world.epochJdTt));
    const day = Number.isFinite(world.epochJdTt) ? Math.floor(world.epochJdTt + .5) : null;
    if (day !== dateDay) { dateDay = day; write(date, formatViewDate(world.epochJdTt)); }
    const value = extendedSubject ? measureExtendedSubjectView(world, extendedSubject, optics.focalPixels) : measureView({
      eyeM: fromEyeM(world.pose, navigation.frame.originM).map(value => 0 - value) as [number, number, number],
      radiusM: navigation.frame.bodyRadiusM, rotation: cssCameraAxesFromOrientation(world.pose.orientationXyzw),
      view: surfaceMapViewport(scene, optics), focalPixels: optics.focalPixels, axes: surface?.axes, mapLeftEdgeLongitudeDeg: surface?.mapLeftEdgeLongitudeDeg,
    });
    const distance = viewDistance(world, navigation.frame, overviewScope, undefined, extendedSubject);
    write(altitude, formatViewDistance(distance.meters));
    if (distanceLabel) write(distanceLabel, distance.label);
    if (distanceGroup && distanceGroup.title !== distance.title) distanceGroup.title = distance.title;
    hidden(coordinates, !value?.coordinates);
    if (value?.coordinates) {
      write(latitude, formatViewCoordinate(value.coordinates.latitude, 'N', 'S'));
      write(longitude, formatViewCoordinate(value.coordinates.longitude, 'E', 'W'));
    }
    hidden(scale, !value?.scale);
    if (value?.scale) {
      write(scaleLabel, value.scale.label);
      const rulerWidth = `${Number(value.scale.pixels.toFixed(2))}px`, measureWidth = `${Number(value.scale.measurePixels.toFixed(2))}px`;
      if (ruler.style.width !== rulerWidth) ruler.style.width = rulerWidth;
      if (measure.style.width !== measureWidth) measure.style.width = measureWidth;
      const title = `${value.scaleTitle}. Distance is measured from the left edge to the moving tick.`;
      if (scale.title !== title) scale.title = title;
    }
    if (playing) schedule();
  }
  function schedule(immediate = false) {
    // A fly-to holds the readout still; arrival refreshes it once.
    if (events.signal.aborted || documentTarget.hidden || flying || moving) return;
    if (immediate && timer !== null) { windowTarget.clearTimeout(timer); timer = null; }
    if (frame !== null || timer !== null) return;
    const wait = immediate ? 0 : 100 - (windowTarget.performance.now() - lastRender);
    if (wait > 0) timer = windowTarget.setTimeout(() => {
      timer = null; schedule(true);
    }, wait);
    else frame = windowTarget.requestAnimationFrame(render);
  }
  const refresh = () => schedule(true);
  // The footer holds still while the camera moves (drag, zoom, coast) and reads once it stops: its text and ruler would
  // otherwise restyle and lay out every frame (docs/performance/motion-freezes-membership.md). It keeps the last reading.
  documentTarget.addEventListener('objectmotionchange', event => {
    const active = event instanceof CustomEvent && (event.detail as { active?: unknown } | null)?.active === true;
    if (active === moving) return;
    moving = active;
    if (moving) cancelPending(); else refresh();
  }, { capture: true, signal: events.signal });
  windowTarget.addEventListener('resize', refresh, { signal: events.signal });
  documentTarget.addEventListener('visibilitychange', () => {
    if (documentTarget.hidden) cancelPending();
    else refresh();
  }, { signal: events.signal });
  return {
    bindObject() {
      const next = [...drawer.querySelectorAll<HTMLElement>('[data-surface-minimap]')];
      if (next.length === maps.length && next.every((map, index) => map === maps[index])) return;
      maps = next; configs.clear();
      for (const map of maps) configs.set(map, parseSurfaceMapConfig(map.dataset.surfaceMinimap));
      refresh();
    },
    setExtendedSubject(record) { extendedSubject = record; refresh(); },
    setOverviewScope(scope) { overviewScope = scope; refresh(); },
    setCamera(next) { if (camera === next) return; unsubscribe?.(); camera = next; unsubscribe = next?.navigation?.subscribe(() => schedule()) ?? null; refresh(); },
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
