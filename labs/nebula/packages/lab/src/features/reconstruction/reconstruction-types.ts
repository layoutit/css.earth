import type { ReconstructionProcessingCapability } from './reconstruction-capabilities.ts';
import type { DensityVolumeFrame } from '@cssearth/objects';
import type { ReconstructionStarsInput } from '../../server/workflows/density/reconstruction-stars.ts';
import type { OverlayPlacement } from '@cssearth/volume-core/coordinates/overlay-placement';
import type { LabSubjectRecord } from '@cssearth/nebula-lab/viewer/legacy';
import type { CloudAppearance } from '@cssearth/volume-core/materials/cloud-appearance';

export interface ReconstructionRequest {
  action: 'apply'; subjectId: string; imageId: string;
  removalResultId: string; placement: OverlayPlacement;
  appearance?: CloudAppearance;
}
export interface PreparedReconstruction {
  schema: 'cssearth-nebula-reconstruction@1'; resultId: string;
  imageId: string; removalResultId: string; placement: OverlayPlacement;
  appearance?: CloudAppearance;
  subject: LabSubjectRecord;
  processing?: ReconstructionProcessingCapability;
  /** Image material attached to one shared finite model geometry. */
  finiteMaterial?: { modelResultId: string; sourceResultId: string };
}
export interface ReconstructionCandidate {
  imageId: string; label: string; sourcePageUrl: string; credit: string;
  sourcePreviewSha256: string; removalResultId?: string;
  placement: OverlayPlacement; placementBasis: string;
  ready: boolean; reason?: string; prepared?: PreparedReconstruction;
  /** Why this image cannot be displayed for the current model; it stays listed. */
  unavailable?: string;
}
export interface ReconstructionCatalogue {
  subjectId: string; overlayCatalogue: string; candidates: ReconstructionCandidate[];
  /** The newest finite model whose baked lenses replace per-image density repaints. */
  finiteModel?: { modelResultId: string; bundle: string; skipped?: { modelResultId: string; reason: string }[] };
}
export interface ReconstructionWork {
  schema: 'cssearth-nebula-reconstruction-work@1';
  id: string; imageId: string; name: string; outputDirectory: string;
  appearance?: CloudAppearance;
  source: { path: string; width: number; height: number };
  original: { path: string; removalResultId: string };
  overlay: { widthPx: number; heightPx: number; transform: string; pivotCssPx: number[]; placement: OverlayPlacement };
  frame: DensityVolumeFrame;
  stellarPrior: { path: string };
  stars?: { path: string };
  cloud?: { descriptor:{path:string}; slices:{path:string};
    provenance:{path:string}; modelPlacement?:{path:string}; starAlignment?:ReconstructionStarsInput['reference'] };
  sourcePageUrl: string; credit: string;
}
