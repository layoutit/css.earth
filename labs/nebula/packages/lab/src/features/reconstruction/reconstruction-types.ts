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
}
export interface ReconstructionCandidate {
  imageId: string; label: string; sourcePageUrl: string; credit: string;
  sourcePreviewSha256: string; removalResultId?: string;
  placement: OverlayPlacement; placementBasis: string;
  ready: boolean; reason?: string; prepared?: PreparedReconstruction;
}
export interface ReconstructionCatalogue {
  subjectId: string; overlayCatalogue: string; candidates: ReconstructionCandidate[];
}
export interface ReconstructionWork {
  schema: 'cssearth-nebula-reconstruction-work@1';
  id: string; imageId: string; name: string; outputDirectory: string;
  appearance?: CloudAppearance;
  source: { path: string; sha256: string; width: number; height: number };
  original: { path: string; sha256: string; removalResultId: string };
  overlay: { widthPx: number; heightPx: number; transform: string; pivotCssPx: number[]; placement: OverlayPlacement };
  frame: DensityVolumeFrame;
  stellarPrior: { path: string; sha256: string };
  stars?: { path: string; sha256: string };
  cloud?: { descriptor:{path:string;sha256:string}; slices:{path:string;sha256:string};
    provenance:{path:string;sha256:string}; starAlignment?:ReconstructionStarsInput['reference'] };
  sourcePageUrl: string; credit: string;
}
