import type { PreparedMaterialSelection, PreparedMaterialTrack } from '../runtime/runtime-material-types.js';
import type { PreparedAssets, PreparedAssetOrigin } from '../runtime/runtime-resource-types.js';
import type { PitchCalibration } from '../camera/runtime-camera-types.js';
export type PreparedWrite = { target: number; name: string } & (
  { kind: "attribute"; value: string | null } | { kind: "class"; value: boolean } |
  { kind: "style"; value: string } | { kind: "texture"; resource: string | null; quoted: boolean }
);

export interface PreparedSelectionNavigation { maximumZoom: number; camera?: { controlPitch: number; controlYaw: number; controlRoll?: number; zoom: number; transition?: { durationMilliseconds: number; preserveZoom: boolean } } | null; }

export interface PreparedVariant { when: Readonly<Record<string, string | number | boolean | null>>; required: readonly string[]; materials: readonly PreparedMaterialSelection[]; writes: readonly PreparedWrite[]; navigation?: PreparedSelectionNavigation;
  /** Containers this selection does not show. Server markup for it omits their descendants; the runtime builds any it adopts without. */
  hiddenSubtrees?: readonly number[]; }

export interface PreparedTree {
  /** Offline first-paint batches. Runtime restores these exact retained leaves. */
  activationGroups?: readonly (readonly number[])[];
  /** The texture slots: the elements that draw each selected image, found offline. A texture write names its slot, and the
   * page writes `background-image` on each element listed; no custom property carries an image. */
  textureBindings?: readonly { target: number; name: string; leaves: readonly number[] }[];
  nodes: readonly { tag: string; parent: number; className: string | null; style: string; properties: readonly number[]; attributes: Readonly<Record<string, string>> }[];
  properties: readonly { name: string; value: string; custom: boolean }[]; camera: number; scene: number; stageClasses: readonly string[];
}

export type PreparedViewBinding = { target: number } & (
  { kind: "view-attribute"; property: string; source: "scene-pitch" | "control-yaw" | "zoom" | "level-of-detail-stage" | "scene-matrix"; precision: number | null } |
  { kind: "view-property"; property: string; source: "billboard-opacity" | "marker-opacity"; precision: number | null } |
  { kind: "silhouette-fit"; minimumRadius: number; unitScale: number } |
  ({ kind: "interior-disc" } & PreparedInteriorDisc) |
  ({ kind: "silhouette-step-property"; property: string; placements?: PreparedTexturePlacements;
    /** Leaf boxes (prepared-leaf-box-blocks.ts): the leaves that share each published step, by block or `property`. */
    groups?: Readonly<Record<string, readonly number[]>>; groupSizes?: Readonly<Record<string, readonly number[]>>;
    /** The step or outset in force before the camera publishes one. */
    initial?: string;
    /** Leaf boxes as prepared records (prepared-leaf-box-direct.ts). */
    boxes?: readonly PreparedLeafBox[] } & PreparedSilhouetteSteps) |
  { kind: "counter-rotation"; systemTransform: string | null }
);

export type PreparedPoseKeyframe = { offset: number; transform: string };

export interface PreparedPresentationDefinition {
  textureLevels?: PreparedTextureLevels;
  /** The resource catalogue; presentation reads only its capability fallbacks. */
  assets?: PreparedAssets;
  camera: PitchCalibration; tree: PreparedTree; variants: readonly PreparedVariant[]; materials: readonly PreparedMaterialTrack[];
  /** Datasets whose tables travel in their own transport and have not arrived (dataset-tables.ts). Their variants stand
   * in without demand or textures until `adoptPreparedDatasetTables` replaces them. */
  deferredDatasets?: readonly string[];
  resourceOrder?: "materials-first" | "content-first"; viewBindings: readonly PreparedViewBinding[]; motionFrame?: readonly number[];
  animations: readonly { target: number; id: string; mode: "pose" | "motion"; keyframes: PreparedPoseKeyframe[]; duration: number; sourceMinimum: number; millisecondsPerDegree: number }[];
  /** Infinite motion: a spin resolved from source CSS, or a star's light curve as opacity. */
  motion?: readonly { target: number; id: string; keyframes: ({ offset: number; transform: string } | { offset: number; opacity: string })[]; duration: number; timings: readonly { when: Readonly<Record<string, string | number | boolean | null>>; duration: number }[] }[];
  features?: PreparedSurfaceFeaturePlan;
  depthPartitions?: PreparedDepthPartitions;
  surfaceHit?: PreparedSurfaceHit;
  assetOrigin?: PreparedAssetOrigin;
}

export interface PreparedInteriorDisc {
  readonly sceneFromBody: readonly number[];
  readonly radii: readonly [number, number, number];
  /** A smaller ellipsoid keeps the complete disc within the prepared mesh. */
  readonly inset: number;
}

export type LeafBoxComponent = number | string;

export interface PreparedLeafBox {
  /** Absent on a seam-only leaf, whose box factor is always 1. */
  readonly node: number; readonly density?: number;
  readonly box?: readonly [number, number]; readonly atlas?: true;
  readonly backgroundSize?: readonly [LeafBoxComponent, LeafBoxComponent];
  readonly backgroundPosition?: readonly [LeafBoxComponent, LeafBoxComponent];
  readonly matrix: string; readonly seam?: readonly [number, number];
}

export type PreparedDepthOrder = { readonly group: number } | { readonly sequence: readonly PreparedDepthOrder[] } | {
  readonly plane: readonly [number, number, number, number];
  readonly back: PreparedDepthOrder; readonly front: PreparedDepthOrder;
};

export interface PreparedDepthPartitions {
  readonly groups: readonly { readonly root: number; readonly scene: number }[];
  readonly order: PreparedDepthOrder;
}

export interface PreparedTexturePlacements {
  body: { center: readonly [number, number, number]; radius: number };
  /** Keyed by the texture write's CSS name: the bounding sphere of its faces, their mean outward direction, and the
   * largest angle between that direction and any face corner's. */
  writes: Readonly<Record<string, { center: readonly [number, number, number]; radius: number; normal: readonly [number, number, number]; spread: number }>>;
}

export interface PreparedTextureLevels {
  hysteresis: number;
  fixedLevel?: number;
  /** `tiles`: at a small level every page of a bank is one tile of a shared sheet (paged-ellipsoid texture-levels.mts). */
  levels: readonly { minimumDiameter: number; resources: Readonly<Record<string, string>>; tiles?: Readonly<Record<string, PreparedTextureTile>> }[];
  /** A write whose faces are off screen or behind the body keeps the first level: sharper texels there are never seen,
   * and a browser decodes a whole image to draw any of it. */
  placements?: PreparedTexturePlacements;
  /** The leaves that draw each tiled page, as records (packages/bake/src/presentation/texture-tile-records.ts). */
  tileLeaves?: readonly PreparedTextureTileLeaves[];
}

export interface PreparedTextureTile { x: number; y: number; scale: number }

export interface PreparedTextureTileLeaves {
  target: number; name: string;
  /** Px per tile offset unit (negative: the sheet moves left and up), and the page's width in px. */
  unit: number; width: number;
  /** The tile preparation wrote on the target, which the leaves' prepared values already resolve. */
  initial?: PreparedTextureTile;
  /** [node, x, y]: each leaf's own background offset in its page, in px. */
  leaves: readonly (readonly [number, number, number])[];
}

export interface PreparedSilhouetteSteps {
  hysteresis: number;
  levels: readonly { minimumDiameter: number; value: string }[];
}

export type SurfacePoint = readonly [number, number, number];

export type SurfaceTriangle = readonly [SurfacePoint, SurfacePoint, SurfacePoint];

export type SurfaceFrontFace = 'clockwise' | 'counter-clockwise';

export interface PreparedSurfaceRange { readonly datasetId: string; readonly start: number; readonly count: number; }

export interface PreparedSurfaceHit { readonly target: number; readonly triangles: readonly SurfaceTriangle[]; readonly frontFace?: SurfaceFrontFace; readonly datasetRanges?: readonly PreparedSurfaceRange[]; }

export interface SurfaceFeaturePolicy {
  /** Share of the camera's logarithmic zoom range that must be reached before any label shows (1 = the last zoom only). */
  readonly minimumZoomShare: number;
  readonly minimumDiameterPixels: number; readonly alwaysVisibleCount: number; readonly maximumVisible: number; readonly limbCosine: number;
}

export interface SurfaceFeatureCatalogDescriptor {
  readonly url: string; readonly bytes: number; readonly count: number;
}

export interface SurfaceFeatureSelectionPlan {
  readonly count: number; readonly banks: readonly SurfaceFeatureCatalogDescriptor[];
}

export interface PreparedSurfaceFeaturePlan {
  readonly catalog: SurfaceFeatureCatalogDescriptor;
  readonly selection?: SurfaceFeatureSelectionPlan;
  /** Mesh radius in the target node's raw coordinates; anchors sit on this sphere. */
  readonly target: number; readonly datasetIds: readonly string[]; readonly meshRadiusUnits: number; readonly policy: SurfaceFeaturePolicy;
  /** Shape-model bodies: the radius band of the prepared picking mesh that every anchor and outline point lies within. */
  readonly surfaceRadiusUnits?: { readonly minimum: number; readonly maximum: number };
  /** Ellipsoidal bodies: the reference semi-axes in mesh units, the polar axis, and the normalised-radius band
   * (1 = on the ellipsoid) that every prepared anchor and outline point lies within on the rendered surface. */
  readonly surfaceEllipsoidUnits?: { readonly equatorial: number; readonly polar: number; readonly north: readonly [number, number, number]; readonly minimumShare: number; readonly maximumShare: number };
  /** Retained screen-space line pieces tracing the hovered feature's published diameter. */
  readonly outline: { readonly pieces: number };
}
