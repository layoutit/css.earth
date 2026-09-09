import type { DensityVolumeFrame } from '@cssearth/objects';
import type { OverlayPlacement } from '../alignment/overlay-placement';
import type { LabSubjectRecord } from '../viewer/viewer';

export interface ReconstructionRequest {
  action: 'apply'; subjectId: string; imageId: string;
  removalResultId: string; placement: OverlayPlacement;
}
export interface PreparedReconstruction {
  schema: 'cssearth-nebula-reconstruction@1'; resultId: string;
  imageId: string; removalResultId: string; placement: OverlayPlacement;
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
  source: { path: string; sha256: string; width: number; height: number };
  original: { path: string; sha256: string; removalResultId: string };
  overlay: { widthPx: number; heightPx: number; transform: string; pivotCssPx: number[]; placement: OverlayPlacement };
  frame: DensityVolumeFrame;
  stellarPrior: { path: string; sha256: string };
  sourcePageUrl: string; credit: string;
}
