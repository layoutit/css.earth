/** What preparing a body's surface features reads (surface-features.ts, landmarks.ts): its directories, configuration, size,
 * retained tree and the surface its anchors are cast onto. */
import type { PreparedSurfaceFeaturePlan } from '@cssearth/objects';
import type { Vector3 } from './catalog.ts';

export interface SurfaceFeaturePreparationContext {
  readonly objectId: string; readonly sourceDirectory: string; readonly publicDirectory: string; readonly outputDirectory: string;
  readonly config: unknown; readonly maxEntries: number; readonly radiusKm: number; readonly meshRadiusUnits: number;
  readonly tree: { readonly nodes: readonly { readonly className: string | null; readonly parent: number; readonly style?: string }[]; readonly scene: number };
  readonly declaredDatasetIds: readonly string[];
  /** Explicit authored sphere; permits coordinate-only mission landmarks without a triangle hit mesh. */
  readonly referenceSphere?: true;
  /** The prepared picking mesh of a shape-model body: anchors and outline points are cast onto it instead of a reference sphere. */
  readonly hitMesh?: { readonly target: number; readonly triangles: readonly (readonly (readonly number[])[])[] };
  /** An ellipsoidal body: map directions are cast onto its rendered surface instead of the reference sphere (ellipsoid.ts). */
  readonly surface?: { readonly onSurface: (direction: Vector3) => Vector3; readonly plan: () => NonNullable<PreparedSurfaceFeaturePlan['surfaceEllipsoidUnits']> };
  /** A triaxial body drawn without a mesh: its semi-axes in mesh units along the map's prime, east and north axes, the
   * ones its leaves are built on (`solid-body-surface.ts`). Anchors are cast onto it, and the Gazetteer sphere is compared
   * with its volume-equivalent radius. */
  readonly triaxial?: readonly [number, number, number];
}
