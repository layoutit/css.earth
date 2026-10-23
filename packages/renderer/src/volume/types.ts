import { type PreparedCssVolume } from '@cssearth/objects';
import { type WorldCameraPose } from '@cssearth/engine';
import type { PhysicalCameraPose, PositionM } from '@cssearth/engine';
import type { WorldCameraViewport } from '../navigation/camera/world-camera.js';

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
  /** A background can coast to every stack: retain its full decoded bank, changing only transform/opacity. */
  readonly residentStacks?: boolean;
  /** Distant presentation membership waits until the owner's inertia coast stops. */
  readonly coasting?: () => boolean;
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

export type { PreparedVolumeCameraTransform } from '@cssearth/engine';

export interface VolumeLocalCamera {
  readonly positionUnits: PositionM;
  readonly orientationXyzw: PhysicalCameraPose['orientationXyzw'];
}

export interface PreparedVolumeLodRuntime extends PreparedVolumeRuntime {
  /** Replace prepared pixels and atlas sampling on one retained spatial topology. */
  setPresentation(payload: PreparedVolumeMountOptions['payload']): void;
  /** Whether the slice stack may present at all. Denied, the billboard views carry the cloud at every size; the
   * universe denies its unselected galaxy, whose slices are for the observer who selected it. */
  setDetail(allowed: boolean): void;
}
