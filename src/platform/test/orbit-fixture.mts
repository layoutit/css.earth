import * as runtimePolicy from "../../../site/runtime-policy.mts";
import { createRetainedCubicSkyOrbit, type OrbitServices, type RetainedCubicSkyOrbit, type RetainedOrbitOptions } from "../../renderers/css/dist/platform/object-orbit.js";
import type { CameraPlan } from '../../renderers/css/navigation/types.ts';
import type { CameraSkyPlan } from '../../renderers/css/navigation/camera-orientation.ts';

type Listener = (event: PointerEvent) => void;
type DragOptions = Parameters<NonNullable<OrbitServices["createUnboundedMatrixDragControls"]>>[0];
type WheelOptions = Parameters<NonNullable<OrbitServices["createPreparedWheelZoomControls"]>>[0];
type PolicyOptions = Parameters<NonNullable<OrbitServices["bindResponsiveOrbitPolicy"]>>[0];
export type OrbitCallbacks = { drag?: DragOptions; wheel?: WheelOptions; policy?: PolicyOptions };
export class Surface {
  readonly listeners = new Map<string, Set<Listener>>();
  readonly style: { setProperty(name: string, value: string): void; removeProperty(name: string): string; [name: string]: unknown };
  readonly ownerDocument: { defaultView: Surface; querySelector(selector: string): null };
  readonly dataset: Record<string, string | undefined> = {};
  readonly frames = new Map<number, FrameRequestCallback>();
  nextFrame = 0;
  readonly captured = new Set<number>();
  readonly isConnected = true;
  constructor() { this.style = { setProperty(key: string, value: string) { this[key] = value; }, removeProperty(name: string) { delete this[name]; return ''; } }; this.ownerDocument = { defaultView: this, querySelector: () => null }; }
  // A controlled DOM boundary: tests retain the narrow surface API above.
  asElement(): HTMLElement { return this as unknown as HTMLElement; }
  addEventListener(name: string, callback: Listener): void { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name)?.add(callback); }
  removeEventListener(name: string, callback: Listener): void { this.listeners.get(name)?.delete(callback); }
  dispatchEvent(event: Event): boolean { this.dispatch(event.type, event as PointerEvent); return true; }
  listenerCount(): number { return [...this.listeners.values()].reduce((sum, set) => sum + set.size, 0); }
  dispatch(name: string, partial: Partial<PointerEvent & WheelEvent> = {}): void { const event = { type: name, isPrimary: true, preventDefault() {}, pointerId: 1, button: 0, clientX: 0, clientY: 0, timeStamp: 0, ...partial } as PointerEvent; for (const callback of this.listeners.get(name) ?? []) callback(event); }
  requestAnimationFrame(callback: FrameRequestCallback): number { const id = ++this.nextFrame; this.frames.set(id, callback); return id; }
  tick(time: number): void { const callbacks = [...this.frames.values()]; this.frames.clear(); callbacks.forEach(callback => callback(time)); }
  cancelAnimationFrame(id: number): void { this.frames.delete(id); }
  setPointerCapture(id: number): void { this.captured.add(id); }
  hasPointerCapture(id: number): boolean { return this.captured.has(id); }
  releasePointerCapture(id: number): void { this.captured.delete(id); }
}
class MediaQuery implements MediaQueryList {
  readonly matches = false;
  readonly media = '';
  onchange: ((this: MediaQueryList, event: MediaQueryListEvent) => unknown) | null = null;
  addListener(_listener: (this: MediaQueryList, event: MediaQueryListEvent) => unknown): void {}
  removeListener(_listener: (this: MediaQueryList, event: MediaQueryListEvent) => unknown): void {}
  addEventListener(_type: string, _listener: EventListenerOrEventListenerObject | null, _options?: boolean | AddEventListenerOptions): void {}
  removeEventListener(_type: string, _listener: EventListenerOrEventListenerObject | null, _options?: boolean | EventListenerOptions): void {}
  dispatchEvent(_event: Event): boolean { return true; }
}

type OrbitFailure = "drag" | "wheel" | "policy" | "fit" | "publish" | null | undefined;
type NativeOwner = { mobile: boolean; update(value: unknown): void; stop(): void; stats(): Record<string, never>; destroy(): void };
export function orbitFixture(failure: OrbitFailure, cleanupFailure = false, dependencies: Partial<OrbitServices> = {}) {
  const owners = new Set<string>(), callbacks: OrbitCallbacks = {}, stage = new Surface();
  const acquire = (name: string): NativeOwner => { if (failure === name) throw new Error(`${name} failure`); owners.add(name); return { mobile: false, update() {}, stop() {}, stats: () => ({}), destroy() { owners.delete(name); if (cleanupFailure && name === "wheel") throw new Error("wheel cleanup failure"); } }; };
  // These objects model only the browser boundary reached by this fixture.
  const controlled = {
    createPolyCamera(state: import("../../renderers/css/navigation/types.ts").NavigationCamera["state"]) { return { state, update(value: import("../../renderers/css/navigation/types.ts").CameraUpdate) { Object.assign(state, value); } }; },
    createCubicSkyCameraOrientation() { return { scene: () => "matrix3d(1)", sceneMatrix: (): never => { throw new Error('Perspective scene matrix is not used by this fixture.'); }, skybox: () => ({ matrix: "matrix3d(1)", sunViewDirection: [0, 0, 1] }), counterRotation: () => "matrix3d(1)", reset() {}, rotate() {}, rebaseScene() {}, prepareFlight: () => ({ angularDistance: 0, sample() {} }), restore() {}, snapshot: () => ({ schema: 'cssearth-camera-pose@1', scene: 'matrix3d(1)', skybox: 'matrix3d(1)', sunView: 'matrix3d(1)' }) }; },
    HTMLElement: { [Symbol.hasInstance](value: unknown): boolean { return value instanceof Surface; } },
    matchMedia: () => new MediaQuery(),
    createUnboundedMatrixDragControls(options: DragOptions) { callbacks.drag = options; acquire("drag"); return { flyTo: async () => ({ completed: false }), update() {}, stop() {}, stats: () => ({}), destroy() { owners.delete('drag'); if (cleanupFailure && failure === 'drag') throw new Error('drag cleanup failure'); }, invalidateTrackball() {} }; },
    createPreparedWheelZoomControls(options: WheelOptions) { callbacks.wheel = options; acquire("wheel"); return { update() {}, stop() {}, stats: () => ({}), destroy() { owners.delete('wheel'); if (cleanupFailure) throw new Error('wheel cleanup failure'); } }; },
    bindResponsiveOrbitPolicy(options: PolicyOptions) { callbacks.policy = options; return acquire("policy"); },
    selectPreparedResponsiveZoom() { if (failure === "fit") throw new Error("fit failure"); return { zoom: 1, model: "unit", widthShare: 0.5 }; },
  };
  // Adapt only the controlled native/service boundary; production uses the renderer services.
  const services = { ...controlled, ...dependencies } as unknown as OrbitServices;
  const create = (options: RetainedOrbitOptions): RetainedCubicSkyOrbit => createRetainedCubicSkyOrbit(options, services);
  const cameraPlan: CameraPlan = { cameraModel: "accumulated-matrix3d", pitchBounded: false, yawBounded: false, minimumControlPitchDegrees: 1, maximumControlPitchDegrees: 1, defaultControlPitchDegrees: 1, defaultControlYawDegrees: 1, initialScenePitchDegrees: 1, maximumScenePitchDegrees: 1, minimumZoom: 1, maximumZoom: 10, defaultZoom: 1, sceneScale: 1, logicalBodyDiameter: 1, responsiveFit: { model: 'unit', portraitBaseWidthShare: .5, narrowPortraitWidthShareGain: 0, landscapeWidthShareGain: 0, narrowPortraitAspectRatio: .5, portraitAspectRatio: 1, squareAspectRatio: 1, maximumHeightShare: 1, maximumMobilePreviewShare: 1, minimumZoom: 1, maximumZoom: 10 } };
  const skyPlan: CameraSkyPlan = { cameraPitchResponse: 1, presentationPitchOffsetDegrees: 0, presentationYawOffsetDegrees: 0 };
  const skyElement = stage.asElement() as HTMLDivElement;
  const cubicSky: RetainedOrbitOptions["cubicSky"] = { root: skyElement, cube: skyElement, orientation: skyElement, setOrientation() {}, destroy() {} };
  const arguments_: RetainedOrbitOptions = { runtimePolicy, onError(error: unknown): void { throw error; }, stage: stage.asElement(), inputSurface: stage.asElement(), cameraElement: new Surface().asElement(), sceneElement: new Surface().asElement(), cubicSky, skyPlan, cameraPlan, objectId: "unit", requireSun: false, onPublish() { if (failure === "publish") throw new Error("publish failure"); } };
  return { create, callbacks, owners, stage, arguments: arguments_ };
}
