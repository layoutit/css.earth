import type { PreparedLeafBounds } from '../rendering/prepared-leaf-frustum.js';
import type { DensityVolumeFrame } from '@cssearth/objects';
import type { PhysicalCameraPose, PositionM } from '@cssearth/engine';
import type { WorldCameraViewport, WorldCameraPose } from '../navigation/world-camera.js';
import type { PreparedCssSky } from '../sky/types.js';

export type VolumeAxis = 'x' | 'y' | 'z';
export type VolumeVector = readonly [number, number, number];

export interface PreparedVolumeLeafStyle {
  readonly width: string;
  readonly height: string;
  readonly transform: string;
  readonly backgroundSize: string;
  readonly backgroundPosition: string;
}

export interface PreparedVolumeLeaf {
  readonly id: string;
  readonly centerUnits: VolumeVector;
  readonly texturePath: string;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly style: PreparedVolumeLeafStyle;
  readonly boundsCssPixels?: PreparedLeafBounds;
}

export interface PreparedVolumeStack {
  readonly axis: VolumeAxis;
  /** Prepared unit normal after an authored rigid model placement. */
  readonly normalUnits?: VolumeVector;
  readonly leaves: readonly PreparedVolumeLeaf[];
}

/** Offline projections of the same cloud, with its saved optical presentation. */
export interface PreparedVolumeImpostors {
  readonly schema: 'cssearth-volume-impostors@1';
  readonly radiusUnits: number;
  readonly fullBelowDiameterPixels: number;
  readonly volumeAboveDiameterPixels: number;
  readonly views: readonly {
    readonly id: string;
    readonly back: VolumeVector;
    readonly right: VolumeVector;
    readonly down: VolumeVector;
    readonly texturePath: string;
  }[];
}

export interface PreparedCssVolume {
  readonly schema: 'cssearth-css-volume@1';
  readonly id: string;
  readonly frame: DensityVolumeFrame;
  readonly anchors?: readonly { readonly id: string; readonly positionUnits: VolumeVector }[];
  readonly stacks: readonly PreparedVolumeStack[];
  readonly resources: readonly { readonly path: string; readonly sha256: string; readonly bytes: number; readonly width: number; readonly height: number }[];
  readonly provenance: unknown;
  readonly approximation: unknown;
  readonly sky?: PreparedCssSky;
  readonly impostors?: PreparedVolumeImpostors;
}

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
