import Ellipsoid from '@cesium/engine/Source/Core/Ellipsoid.js';
import { rotateWorldPosition, worldRotationFromQuaternion } from '../src/renderers/css/dist/navigation.js';
import { minimapCamera } from './surface-minimap-rectangle.mjs';
import { surfaceMapContext, surfaceMapViewport } from './surface-map-context.mjs';
import { viewDistance } from './overview-context.mjs';

const referenceAxes = { prime: [1, 0, 0], east: [0, 1, 0], north: [0, 0, 1] };
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const units = [[9460730472580800, 'ly'], [149597870700, 'AU'], [1000, 'km'], [1, 'm']];
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const wholeNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const calendarDate = new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeZone: 'UTC' });
const distanceUnit = meters => units.find(([size]) => meters >= size) ?? units.at(-1);

export function formatViewDate(epochJdTt) {
  if (!Number.isFinite(epochJdTt)) return '—';
  // Format the prepared TT calendar date without applying the browser's local timezone.
  return calendarDate.format(new Date((epochJdTt - 2440587.5) * 86400000));
}

export function formatViewDistance(meters) {
  const [size, unit] = distanceUnit(meters);
  return `${(unit === 'km' ? wholeNumber : number).format(meters / size)} ${unit}`;
}

export function formatViewCoordinate(degrees, positive, negative) {
  const hundredths = Math.round(Math.abs(degrees) * 360000);
  const d = Math.floor(hundredths / 360000), m = Math.floor(hundredths / 6000) % 60;
  const s = ((hundredths % 6000) / 100).toFixed(2).padStart(5, '0');
  return `${d}°${String(m).padStart(2, '0')}′${s}″ ${degrees < 0 ? negative : positive}`;
}

export function viewScale(metersPerPixel, maxWidth = 80) {
  if (!(metersPerPixel > 0) || !Number.isFinite(metersPerPixel)) return null;
  const [unitSize, unit] = distanceUnit(metersPerPixel * maxWidth);
  const maximum = metersPerPixel * maxWidth / unitSize;
  const power = 10 ** Math.floor(Math.log10(maximum));
  const value = [5, 2, 1].find(step => step * power <= maximum) * power;
  const measurePixels = value * unitSize / metersPerPixel;
  return { label: `${number.format(value)} ${unit}`, pixels: maxWidth, measurePixels };
}

export function measureView({ eyeM, radiusM, rotation, view, focalPixels, axes }) {
  const camera = minimapCamera({ eye: eyeM.map(value => value / radiusM), rotation, view, axes: axes ?? referenceAxes });
  const pick = x => {
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
      longitude: Math.atan2(center.y, center.x) * 180 / Math.PI,
    } : null,
    scale: viewScale(metersPerPixel), scaleTitle,
  };
}

export function measurePreparedFocusView(world, focus, focalPixels) {
  const forward = rotateWorldPosition(worldRotationFromQuaternion(world.pose.orientationXyzw), [0, 0, -1]);
  const relative = focus.positionM.map((value, axis) => value - world.pose.positionM[axis]);
  return { coordinates: null, scale: viewScale(dot(relative, forward) / focalPixels),
    scaleTitle: `Scale at the distance of ${focus.name}` };
}

export function createViewReadout({ drawer, documentTarget, windowTarget }) {
  const root = documentTarget.querySelector('.planet-view-readout');
  if (!root) return { setCamera() {}, setPreparedFocus() {}, setOverviewScope() {}, setPlaybackState() {}, destroy() {} };
  const dateGroup = root.querySelector('.planet-view-date'), date = root.querySelector('[data-view-date]');
  const coordinates = root.querySelector('.planet-view-coordinates');
  const latitude = root.querySelector('[data-view-latitude]'), longitude = root.querySelector('[data-view-longitude]');
  const altitude = root.querySelector('[data-view-altitude]');
  const distanceLabel = root.querySelector('[data-view-distance-label]');
  const distanceGroup = root.querySelector('.planet-view-altitude');
  const scale = root.querySelector('.planet-view-scale'), scaleLabel = root.querySelector('[data-view-scale-label]');
  const ruler = root.querySelector('.planet-view-ruler');
  const measure = root.querySelector('.planet-view-measure');
  const maps = [...drawer.querySelectorAll('[data-surface-minimap]')];
  const configs = new Map(maps.map(map => [map, JSON.parse(map.dataset.surfaceMinimap)]));
  const events = new AbortController();
  let camera = null, unsubscribe = null, frame = null, playing = false, disposed = false;
  let overviewScope = 'solar-system';
  let preparedFocus = null;
  const write = (element, value) => { if (element.textContent !== value) element.textContent = value; };
  function render() {
    frame = null;
    if (disposed) return;
    const navigation = camera?.navigation;
    const scene = documentTarget.querySelector('.polycss-scene');
    if (!navigation || !scene) { dateGroup.hidden = true; coordinates.hidden = true; scale.hidden = true; write(altitude, '—'); return; }
    const map = maps.find(map => !map.closest('[data-lens-details]')?.hidden) ?? maps[0];
    const surface = preparedFocus ? null : surfaceMapContext(configs.get(map), camera, documentTarget, windowTarget);
    const world = navigation.capture(), optics = navigation.optics();
    dateGroup.hidden = !Number.isFinite(world.epochJdTt);
    write(date, formatViewDate(world.epochJdTt));
    const value = preparedFocus ? measurePreparedFocusView(world, preparedFocus, optics.focalPixels) : measureView({
      eyeM: world.pose.positionM.map((x, i) => x - navigation.frame.originM[i]),
      radiusM: navigation.frame.bodyRadiusM, rotation: worldRotationFromQuaternion(world.pose.orientationXyzw),
      view: surfaceMapViewport(scene, optics), focalPixels: optics.focalPixels, axes: surface?.axes,
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
  function schedule() { if (!disposed && frame === null) frame = windowTarget.requestAnimationFrame(render); }
  windowTarget.addEventListener('resize', schedule, { signal: events.signal });
  return {
    setPreparedFocus(record) { preparedFocus = record; schedule(); },
    setOverviewScope(scope) { overviewScope = scope; schedule(); },
    setCamera(next) { unsubscribe?.(); camera = next; unsubscribe = next?.navigation?.subscribe(schedule) ?? null; schedule(); },
    setPlaybackState(state) { playing = state.allowed; schedule(); },
    destroy() { disposed = true; unsubscribe?.(); events.abort(); if (frame !== null) windowTarget.cancelAnimationFrame(frame); },
  };
}
