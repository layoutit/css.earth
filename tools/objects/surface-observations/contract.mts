/**
 * The surface-observation contract. Every photograph lens is prepared in the same stages:
 *
 *   decode → camera → pixel geometry → photometry → footprint → surface transfer → report
 *
 * A format adapter owns decoding, the camera and the pixel geometry for one kind of archive
 * product and hands the rest of the pipeline an ObservationFrame. Everything after the frame is
 * shared: the bilinear footprint, the closest source point, visibility, selection, level matching,
 * the display range, area coverage, the preview and the report.
 */
import type { RadialSurface, SourceAccess, SurfaceConfig } from '../terrestrial-layers/contracts.mts';
import type { SourceInput } from '../../../src/platform/source-manifest.mts';
import type { BandColorDisplay } from '../color-transfer.mts';

/** A decoded photograph: calibrated values and the archive's own verdict on each pixel. */
export interface ObservationImage {
  width: number; height: number; values: ArrayLike<number>;
  /** Registered filter planes shown together as colour: interpolated like the values and displayed on one common linear scale. */
  colorValues?: readonly ArrayLike<number>[];
  /** Why the detector or the archive's quality data disqualify a pixel, or null. Geometry and photometry are judged later. */
  reject(index: number): string | null;
  /** Whether a qualified pixel was lossily compressed; counted in the report only. */
  lossy?(index: number): boolean;
  startTime: string; filter: string;
  /** Scales interpolated values into the displayed quantity, such as OSIRIS radiance to I/F. */
  radianceFactor?: { factor: number; solarDistanceAu: number; solarFlux: number };
  report: Record<string, unknown>;
}

/** Where a camera comes from. Every kind projects and casts rays the same way. */
export type CameraKind = 'backplane-fit' | 'archived-closure' | 'kernels' | 'control-network' | 'orthographic-registration';

/** A camera in body-fixed metres. project() returns zero-based detector coordinates and depth; null or depth ≤ 0 is behind the camera. */
export interface ObservationCamera {
  kind: CameraKind;
  project(point: readonly number[]): readonly number[] | null;
  ray(x: number, y: number): readonly number[];
  positionMeters: readonly number[]; positionKm: readonly number[];
  sunDirection?: readonly number[];
  /** Whether detector bounds may be taken from projected mesh vertices; false for cameras with lens distortion. */
  pinhole: boolean;
  /** The pixel scale the camera's source states at the target, used to rank finest-resolution selection. */
  nominalPixelScaleMeters?: number;
  report: Record<string, unknown>;
}

/** Per-pixel surface geometry. Angles are radians. */
export interface PixelGeometry {
  source: 'archive-backplanes' | 'source-mesh-rays';
  /** Why a pixel has no qualified surface point, or null. */
  reject(index: number): string | null;
  /** Distance from the pixel's surface point to a point, in metres, computed in the geometry's own units. */
  distanceMeters(index: number, point: readonly number[]): number;
  /** Distance from the camera to the pixel's surface point, in metres. */
  rangeMeters(index: number): number;
  incidence(index: number): number; emission(index: number): number; phase(index: number): number | undefined;
  /** Whether the pixel's surface point lies in a cast shadow, when the geometry can trace a ray toward the Sun. */
  shadowed?(index: number): boolean;
  report: Record<string, unknown>;
}

/** The photometry stage: the gain carrying a pixel to the displayed brightness, or null when the pixel is withheld. */
export interface ObservationPhotometry {
  gain(incidence: number, emission: number, phase: number | undefined): number | null;
  report: Record<string, unknown>;
  units?: string;
  /** Whether displayed brightness keeps the acquisition illumination. A normalizing model cannot invert a cast shadow, so its lens withholds shadowed pixels. */
  retainsIllumination: boolean;
}

/** Transfer limits after validation. Separation is either a fixed distance or a multiple of the contributors' measured footprint. */
export interface TransferLimits {
  maximumSeparationMeters?: number;
  maximumSeparationFootprints?: number;
  visibilityToleranceMeters: number;
  maximumEmissionDegrees: number;
}

export type FootprintSample =
  { reason: string; separationMeters?: number; radiance?: never; gain?: never; maximumEmissionDegrees?: never; maximumIncidenceDegrees?: never } |
  { reason?: undefined; radiance: number; color?: number[]; gain: number; separationMeters: number; maximumEmissionDegrees: number; maximumIncidenceDegrees: number };

/** One qualified photograph, ready for the shared surface transfer. */
export interface ObservationFrame {
  id: string; startTime: string; filter: string; positionKm: readonly number[];
  cameraKind: CameraKind; geometrySource: PixelGeometry['source'] | 'registered-posts';
  nominalPixelScaleMeters?: number;
  /** Sample at a source-surface point in metres. */
  sample(point: readonly number[]): FootprintSample;
  /** Whether the frame's camera sees a source-surface point without obstruction. */
  visible(point: readonly number[]): boolean;
  /** Measured footprint: nadir-equivalent ground size of one pixel, from the camera's pixel angle and each pixel's range. */
  footprint: FrameFootprint;
  report: Record<string, unknown>;
}

export interface FrameFootprint { pixelAngleMicroradians: number; nadirMedianMeters: number; nadirMinimumMeters: number; sampledPixels: number }

/** What a route decides once for all its frames. */
export interface SurfacePolicy {
  format: string;
  selection: 'single' | 'lowest-emission' | 'recipe-order' | 'finest-resolution';
  levelMatching?: { maximumAngleDegrees?: number; minimumPairs: number; maximumGain: number; samplesPerTriangle?: number };
  samplesPerTriangle: number;
  /** An authored palette replaces the linear grey of a monochrome lens; the display levels are unchanged. */
  display: ({ range: 'surface-samples'; percentiles: readonly number[]; units: string } | { range: 'authored'; low: number; high: number; units: string; colorDisplay?: BandColorDisplay }) & { palette?: readonly string[] };
  photometry: Record<string, unknown>;
  limits: Record<string, unknown>;
  limitations?: string;
  /** Evidence the format measured once for the whole lens, such as filter camera registration. */
  registration?: Record<string, unknown>;
}

export interface LoadContext { sourceDirectory: string; source: SourceAccess; radial: RadialSurface; config: SurfaceConfig; entries: readonly SourceInput[] }

/** A format adapter: the recipe shape it accepts, the pinned paths it consumes and how it builds frames. `exceeded` names every
 * authored transfer limit that is looser than the frames' measured footprint and the mesh error allow. */
export interface SurfaceObservationFormat {
  validate(recipe: unknown, geometry: unknown): void;
  paths(recipe: unknown): string[];
  load(recipe: unknown, context: LoadContext): Promise<{ frames: ObservationFrame[]; policy: SurfacePolicy; exceeded: string[] }>;
}
