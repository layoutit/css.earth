import type { PreparedCssVolume } from '@cssearth/objects';
import type { PhysicalCameraPose, PositionM } from '@cssearth/engine';
import type { WorldCameraViewport, WorldCameraPose } from '../navigation/world-camera.js';

export interface VolumeCameraPublication {
  readonly world: WorldCameraPose;
  readonly viewport: WorldCameraViewport;
}

export interface PreparedVolumeMountOptions {
  readonly host: HTMLElement;
  readonly before: Element;
  readonly payload: PreparedCssVolume;
  readonly resolveResource: (path: string) => string;
  /** CSS pixels represented by one prepared volume unit. The compiler's tile scale is 50. */
  readonly unitScale?: number;
  readonly createElement?: (tag: string) => HTMLElement;
  readonly nativeFocalCss?: string;
  /** Build the full slice renderer on the first publication that needs it instead of at mount. Only for a mount that
   * adopts no server-rendered DOM: adoption requires the same nodes, created in the same order, as the server's render. */
  readonly lazyDetail?: boolean;
}

export interface PreparedVolumeRuntime {
  publish(publication: VolumeCameraPublication): void;
  destroy(): void;
  readonly roots: readonly HTMLElement[];
}

/** Material changes apply to full-resolution slices; impostor banks remain separate. */
export interface PreparedMaterialVolumeRuntime extends PreparedVolumeRuntime {
  setTextures(urls: readonly string[]): void;
  setTexture(index: number, url: string): void;
  /** Replace every slice material while retaining the prepared geometry nodes. */
  setMaterials(materials: readonly {
    readonly textureUrl: string;
    readonly backgroundSize: string;
    readonly backgroundPosition: string;
  }[]): void;
}

export interface PreparedVolumeCameraTransform {
  readonly rotation: readonly number[];
  readonly translationCssPixels: readonly [number, number, number];
  readonly focalPixels: number;
}

export interface VolumeLocalCamera {
  readonly positionUnits: PositionM;
  readonly orientationXyzw: PhysicalCameraPose['orientationXyzw'];
}
