import type { PreparedMaterialBank, PreparedMaterialAddress, PreparedMaterialTrack, PreparedMaterialFrameMapping, PreparedMaterialSelection, EllipsoidProjectionPlan } from '../runtime/runtime-material-types.js';
import type { PreparedVariant, PreparedSelectionNavigation } from './runtime-presentation-types.js';

export type PreparedContractRotation = {
  reference: "prepared" | "initial"; baseDegrees: number; zeroAtPole: boolean;
  onlyWhenEnabled?: boolean; publishWithAddress?: boolean; systemTransform?: string; polePolicy?: "azimuth";
  physical?: { width: number; height: number; systemTransform: string; projection: EllipsoidProjectionPlan };
} & ({ kind: "angle"; property: string } | { kind: "planar"; width: number; height: number } |
  { kind: "ellipsoid"; width: number; height: number; projection: EllipsoidProjectionPlan; systemTransform:string });
export interface PreparedContractBank extends Omit<PreparedMaterialBank, "default" | "fixed"> {
  default: PreparedMaterialAddress | null; fixed: PreparedMaterialAddress | null;
  rows?: readonly { row: number; resource: string; firstFrame: number; lastFrame: number }[];
}
export interface PreparedContractTrack extends Omit<PreparedMaterialTrack, "banks" | "rotation" | "frame" | "frameAttribute" | "modeAttribute"> {
  frame: PreparedMaterialFrameMapping & { count: number }; banks: readonly PreparedContractBank[];
  rotation: PreparedContractRotation | null; frameAttribute: string | null; modeAttribute: string | null;
}
export interface PreparedContractVariant extends Omit<PreparedVariant, "navigation" | "materials"> {
  navigation?: { maximumZoom: number; camera: NonNullable<PreparedSelectionNavigation["camera"]> | null };
  materials: readonly (PreparedMaterialSelection & { frameOverride: number | null })[];
}
