import type { DensityVolumeFrame } from '@cssearth/objects';
import type { PhysicalCameraPose, PositionM } from '@cssearth/engine';
import type { WorldCameraViewport, WorldCameraPose } from '../navigation/world-camera.js';

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
}

export interface PreparedVolumeStack {
  readonly axis: VolumeAxis;
  readonly leaves: readonly PreparedVolumeLeaf[];
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
}

export interface PreparedVolumeRuntime {
  publish(publication: VolumeCameraPublication): void;
  destroy(): void;
  readonly roots: readonly HTMLElement[];
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
