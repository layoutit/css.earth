// The two globes and the one pointer stream between them. Left: a CesiumJS globe with Cesium's own camera controller.
// Right: cssEarth's drag controller (ours.mts), its orientation drawn by a second Cesium globe that takes no input.
// Both stand at the same pole, distance and field of view. Nothing on the left runs cssEarth code.
import { cesiumLibrary } from './cesium.mts';
import type { Camera, Widget } from './cesium.mts';
import { createOurs } from './ours.mts';
import type { Columns, Geometry, V3 } from './ours.mts';

const RADIUS = 6378137;
export const DEGREES = 180 / Math.PI;
/** Earth's opening view in the app at 1280 x 800, measured on 2026-10-01: pole 17.6 degrees toward the eye, leaning
 * 8 degrees on screen, eye at 7.992 radii, focal length 1829 px, disc radius 230.6 px, zoom alias 1.1. */
export const OPENING = Object.freeze({ rollDeg: -7.995, towardEyeDeg: 17.605, lonDeg: -60, distance: 7.992, focal: 1829, discRadius: 230.6, zoom: 1.1 });
/** Where a drag starts from: the pole's lean on screen, its angle toward the eye and the longitude under the eye. */
export interface View { rollDeg: number; towardEyeDeg: number; lonDeg: number; }
export interface Side { panel: HTMLElement; widget: Widget; camera: Camera; over: HTMLCanvasElement; input: HTMLElement; miss: HTMLElement; }
export type Point = [number, number];

export const rotZ = (columns: Columns, angle: number): Columns => {
  const c = Math.cos(angle), s = Math.sin(angle), turn = (v: V3): V3 => [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
  return [turn(columns[0]), turn(columns[1]), turn(columns[2])];
};
/** The angle of the single turn that carries one orientation onto the other, in degrees. */
export function turnBetween(a: Columns, b: Columns) {
  let trace = 0;
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) trace += a[j]![i]! * b[j]![i]!;
  return Math.acos(Math.min(1, Math.max(-1, (trace - 1) / 2))) * DEGREES;
}
/** The orientation of a view: the body's east, north and outward directions under the eye map to the pole's screen
 * right, its screen direction and +z. */
export function viewColumns({ rollDeg, towardEyeDeg, lonDeg }: View): Columns {
  const roll = rollDeg / DEGREES, lat = towardEyeDeg / DEGREES, lon = lonDeg / DEGREES;
  const east = [-Math.sin(lon), Math.cos(lon), 0], north = [-Math.sin(lat) * Math.cos(lon), -Math.sin(lat) * Math.sin(lon), Math.cos(lat)];
  const out = [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
  const up = [Math.sin(roll), -Math.cos(roll), 0], right = [-up[1]!, up[0]!, 0], toEye = [0, 0, 1];
  const column = (j: number): V3 => [0, 1, 2].map(i => east[j]! * right[i]! + north[j]! * up[i]! + out[j]! * toEye[i]!) as V3;
  return [column(0), column(1), column(2)];
}

export function createOracle(document: Document) {
  const C = cesiumLibrary();
  // A sphere, as cssEarth's pan uses: the comparison is about the drag, not the flattening.
  const sphere = new C.Ellipsoid(RADIUS, RADIUS, RADIUS);
  C.Ellipsoid.default = sphere;
  const side = (id: string): Side => {
    const panel = document.getElementById(id);
    const globe = panel?.querySelector('.globe'), over = panel?.querySelector('canvas.over'), input = panel?.querySelector('.input'), miss = panel?.querySelector('.miss');
    if (!panel || !globe || !(over instanceof HTMLCanvasElement) || !(input instanceof HTMLElement) || !(miss instanceof HTMLElement)) throw new Error(`Panel ${id} is incomplete.`);
    const widget = new C.CesiumWidget(globe, { ellipsoid: sphere, skyBox: false, skyAtmosphere: false, scene3DOnly: true,
      baseLayer: C.ImageryLayer.fromProviderAsync(C.TileMapServiceImageryProvider.fromUrl(C.buildModuleUrl('Assets/Textures/NaturalEarthII'))) });
    widget.scene.globe.showGroundAtmosphere = false; widget.scene.globe.enableLighting = false; widget.scene.fog.enabled = false;
    widget.scene.backgroundColor = C.Color.BLACK;
    // The replayed pointer is no device pointer; the input layer above holds the real capture.
    widget.canvas.setPointerCapture = () => {}; widget.canvas.releasePointerCapture = () => {};
    return { panel, widget, camera: widget.scene.camera, over, input, miss };
  };
  const left = side('left'), right = side('right');
  const controller = left.widget.scene.screenSpaceCameraController;
  controller.enableZoom = controller.enableTilt = controller.enableLook = controller.enableTranslate = false;
  const cesiumInertia = controller.inertiaSpin;
  right.widget.scene.screenSpaceCameraController.enableInputs = false;

  // ---- one screen for both: the body centred in the panel, the same focal length and distance ------------------------
  let distance: number = OPENING.distance;
  // cssEarth leans its pole on screen and its drags keep that lean. Cesium keeps north up, and a rolled Cesium camera
  // loses its roll at the poles. So Cesium runs with north up and the two meet through this turn about the line of
  // sight: a point on cssEarth's screen is the same point on Cesium's, turned back by the lean.
  let roll = 0;
  const geometry = (of: Side = right): Geometry => {
    // Cesium casts its rays over the canvas's whole-pixel client size; both sides use that same screen.
    const box = of.panel.getBoundingClientRect(), width = of.widget.canvas.clientWidth, height = of.widget.canvas.clientHeight;
    // The app's own pixel size where the panel is large enough; otherwise the same picture scaled to fit.
    const scale = Math.min(1, Math.min(width, height) * .44 / OPENING.discRadius), focal = OPENING.focal * scale;
    const disc = focal / Math.sqrt(distance * distance - 1);
    return { left: box.left, top: box.top, width, height, focal, distance, disc, zoom: OPENING.zoom * disc / scale / OPENING.discRadius };
  };
  const frame = (of: Side) => { const g = geometry(of); of.camera.frustum.fov = 2 * Math.atan(Math.max(g.width, g.height) / 2 / g.focal); };
  const turned = ([x, y]: Point, angle: number, g: Geometry): Point => {
    const c = Math.cos(angle), s = Math.sin(angle), u = x - g.width / 2, v = y - g.height / 2;
    return [g.width / 2 + u * c - v * s, g.height / 2 + u * s + v * c];
  };
  const columnsOf = ({ right: r, up: u, direction: d }: Camera): Columns => [[r.x, -u.x, -d.x], [r.y, -u.y, -d.y], [r.z, -u.z, -d.z]];
  const setCamera = (camera: Camera, c: Columns) => {
    const row = (i: number, sign: number, length = 1) => new C.Cartesian3(c[0][i]! * sign * length, c[1][i]! * sign * length, c[2][i]! * sign * length);
    camera.setView({ destination: row(2, 1, distance * RADIUS), orientation: { direction: row(2, -1), up: row(1, -1) } });
  };
  /** Cesium's orientation as cssEarth's screen shows it. */
  const cesiumColumns = () => rotZ(columnsOf(left.camera), roll);

  const surface = document.createElement('div');
  surface.style.cssText = 'position:fixed;width:0;height:0;';
  surface.setPointerCapture = () => {}; surface.releasePointerCapture = () => {}; surface.hasPointerCapture = () => false;
  document.body.append(surface);
  const ours = createOurs(surface, () => geometry(right));

  // ---- one pointer stream, copied to both controllers at the same place on each screen -------------------------------
  const POINTER = 99; // no such device pointer: neither side can capture it
  let inertia = true, startTogether = true;
  let pressed: { grabCesium: V3 | null; grabOurs: V3 | null; released: boolean } | null = null;
  let pointer: Point | null = null;
  /** `source` is the real event a hand drag came from: the app samples its coalesced moves with their own timestamps. */
  const send = (type: 'pointerdown' | 'pointermove' | 'pointerup', [x, y]: Point, source: PointerEvent | null) => {
    const down = type !== 'pointerup';
    for (const to of [left, right]) {
      const box = to.panel.getBoundingClientRect(), [px, py] = to === left ? turned([x, y], -roll, geometry(left)) : [x, y];
      // The app coasts only after a pointerup; a cancelled pointer ends its drag where it is.
      const event = new PointerEvent(!down && to === right && !inertia ? 'pointercancel' : type, { bubbles: true, cancelable: true, pointerId: POINTER,
        pointerType: 'mouse', isPrimary: true, button: type === 'pointermove' ? -1 : 0, buttons: down ? 1 : 0, clientX: box.left + px, clientY: box.top + py });
      if (to === left) { to.widget.canvas.dispatchEvent(event); continue; }
      // A replayed event takes the page's clock, which a stress run steps by hand.
      Object.defineProperty(event, 'timeStamp', { value: source ? source.timeStamp : performance.now() });
      if (source && source.currentTarget instanceof Element) {
        const own = source.currentTarget.getBoundingClientRect(), onLeft = source.currentTarget === left.input, g = geometry(left);
        const samples = type === 'pointermove' ? source.getCoalescedEvents() : [];
        event.getCoalescedEvents = () => samples.map(sample => {
          const p: Point = [sample.clientX - own.left, sample.clientY - own.top], q = onLeft ? turned(p, roll, g) : p;
          const copy = new PointerEvent('pointermove', { clientX: box.left + q[0], clientY: box.top + q[1] });
          Object.defineProperty(copy, 'timeStamp', { value: sample.timeStamp });
          return copy;
        });
      }
      surface.dispatchEvent(event);
    }
  };
  /** The surface point under a point of cssEarth's screen, in body axes; null off the disc. */
  const bodyPoint = (columns: Columns, [x, y]: Point): V3 | null => {
    const g = geometry(), ray = [x - g.width / 2, y - g.height / 2, -g.focal], n = Math.hypot(...ray), u = ray.map(v => v / n);
    const along = -u[2]! * distance, discriminant = along * along - (distance * distance - 1);
    if (discriminant < 0) return null;
    const t = along - Math.sqrt(discriminant), p: V3 = [u[0]! * t, u[1]! * t, u[2]! * t + distance];
    return [0, 1, 2].map(j => columns[j]![0] * p[0] + columns[j]![1] * p[1] + columns[j]![2] * p[2]) as V3;
  };
  const place = (view: View, at = distance) => {
    ours.stop();
    distance = Math.min(16, Math.max(1.2, at));
    // Cesium's inertia replays the last stroke from its press and release times, and carries a drag's mode into the next
    // press at the same pixel; a placement starts clean.
    for (const times of [controller._aggregator._pressTime, controller._aggregator._releaseTime]) for (const key of Object.keys(times)) delete times[key];
    controller._rotateMousePosition.x = controller._rotateMousePosition.y = -1; controller._rotating = controller._looking = false;
    roll = view.rollDeg / DEGREES;
    const columns = viewColumns(view);
    ours.place(columns); setCamera(left.camera, rotZ(columns, -roll));
    pressed = null; pointer = null;
  };

  return {
    left, right, controller, ours, geometry, frame, turned, columnsOf, setCamera, cesiumColumns, place,
    get roll() { return roll; }, get distance() { return distance; }, get pressed() { return pressed; }, get pointer() { return pointer; },
    set inertia(on: boolean) { inertia = on; controller.inertiaSpin = on ? cesiumInertia : 0; },
    set startTogether(on: boolean) { startTogether = on; },
    /** The eye moves along its line of sight; the orientation stays. */
    setDistance(value: number) {
      distance = Math.min(16, Math.max(1.2, value));
      setCamera(left.camera, columnsOf(left.camera)); ours.invalidate();
    },
    press(at: Point, source: PointerEvent | null = null) {
      // Each drag starts from Cesium's orientation, so one drag's difference does not carry into the next.
      if (startTogether) ours.place(cesiumColumns());
      pressed = { grabCesium: bodyPoint(cesiumColumns(), at), grabOurs: bodyPoint(ours.columns, at), released: false };
      pointer = at; send('pointerdown', at, source);
    },
    move(at: Point, source: PointerEvent | null = null) { pointer = at; send('pointermove', at, source); },
    release(at: Point, source: PointerEvent | null = null) { send('pointerup', at, source); if (pressed) pressed.released = true; },
    /** How far apart the two orientations are: the whole turn, the longitude under the eye and the pole's direction. */
    state() {
      const a = cesiumColumns(), b = ours.columns, lon = (c: Columns) => Math.atan2(c[1][2], c[0][2]) * DEGREES;
      const poles = a[2][0] * b[2][0] + a[2][1] * b[2][1] + a[2][2] * b[2][2];
      return { apartDeg: turnBetween(a, b), poleApartDeg: Math.acos(Math.min(1, Math.max(-1, poles))) * DEGREES, longitudeApartDeg: ((lon(b) - lon(a) + 540) % 360) - 180,
        cesium: { lonDeg: lon(a), latDeg: Math.asin(a[2][2]) * DEGREES }, ours: { lonDeg: lon(b), latDeg: Math.asin(b[2][2]) * DEGREES } };
    },
  };
}
export type Oracle = ReturnType<typeof createOracle>;
