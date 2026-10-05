// The CesiumJS global that index.html loads from the pinned 1.145.0 build, with the members the oracle uses. The lab
// installs no Cesium package, so the shapes are written out here and checked when the page starts. The members named
// with an underscore are Cesium's own private state: the oracle resets them between drags and reads its drag mode.
export interface Cartesian2 { x: number; y: number; }
export interface Cartesian3 { x: number; y: number; z: number; }
export interface Camera {
  right: Cartesian3; up: Cartesian3; direction: Cartesian3; position: Cartesian3; frustum: { fov: number };
  setView(options: { destination: Cartesian3; orientation: { direction: Cartesian3; up: Cartesian3 } }): void;
}
export interface CameraController {
  enableZoom: boolean; enableTilt: boolean; enableLook: boolean; enableTranslate: boolean; enableInputs: boolean; inertiaSpin: number;
  _rotating: boolean; _looking: boolean; _rotateMousePosition: Cartesian2;
  _aggregator: { _pressTime: Record<string, unknown>; _releaseTime: Record<string, unknown> };
}
interface FrameEvent { addEventListener(listener: () => void): void; }
export interface Scene {
  camera: Camera; screenSpaceCameraController: CameraController; preRender: FrameEvent; postRender: FrameEvent;
  globe: { showGroundAtmosphere: boolean; enableLighting: boolean; tilesLoaded: boolean }; fog: { enabled: boolean }; backgroundColor: unknown;
  /** The part of a frame that updates the camera from input, without drawing. */
  initializeFrame(): void;
}
export interface Widget { scene: Scene; canvas: HTMLCanvasElement; useDefaultRenderLoop: boolean;
  /** Sizes the canvas and the camera's aspect ratio to the page, as a drawn frame does first. */
  resize(): void; }
export interface CesiumLibrary {
  Ellipsoid: { new (x: number, y: number, z: number): unknown; default: unknown };
  CesiumWidget: new (container: Element, options: Record<string, unknown>) => Widget;
  ImageryLayer: { fromProviderAsync(provider: unknown): unknown };
  TileMapServiceImageryProvider: { fromUrl(url: string): unknown };
  buildModuleUrl(path: string): string;
  Color: { BLACK: unknown };
  Cartesian3: { new (x: number, y: number, z: number): Cartesian3 };
}

export function cesiumLibrary(): CesiumLibrary {
  const library: unknown = Reflect.get(globalThis, 'Cesium');
  if (!library || typeof library !== 'object') throw new Error('CesiumJS did not load.');
  for (const name of ['Ellipsoid', 'CesiumWidget', 'ImageryLayer', 'TileMapServiceImageryProvider', 'buildModuleUrl', 'Cartesian3']) {
    if (typeof Reflect.get(library, name) !== 'function') throw new Error(`CesiumJS has no ${name}.`);
  }
  return library as CesiumLibrary;
}
