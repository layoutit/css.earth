import type { PreparedCssSky } from '../sky/types.js';

/** One surface panorama: a published 360° image resampled into a sky cube, placed where the rover stood. */
export interface PreparedSurfacePanorama {
  readonly id: string;
  readonly title: string;
  /** First and last sol of its images. */
  readonly sols: readonly [number, number];
  readonly camera: string;
  readonly credit: string;
  readonly pageUrl: string;
  readonly site: { readonly latitudeDeg: number; readonly longitudeDegEast: number; readonly localization: string };
  /** Degrees of elevation the published image spans. */
  readonly spanDeg: number;
  /** The strip around the horizon the list shows, a `/scenes/` address. */
  readonly thumbnail: string;
  /** Each cube face's `/scenes/` address, in the cube's face order. */
  readonly faces: readonly string[];
  readonly sky: PreparedCssSky;
  readonly resources: readonly { readonly path: string; readonly width: number; readonly height: number; readonly bytes: number }[];
}

export interface PreparedSurfacePanoramas {
  readonly schema: 'cssearth-surface-panorama-plan@1';
  readonly source: { readonly label: string; readonly url: string };
  /** The cube's own frame: x north, y west, z up at the camera. */
  readonly frame: string;
  readonly panoramas: readonly PreparedSurfacePanorama[];
}
