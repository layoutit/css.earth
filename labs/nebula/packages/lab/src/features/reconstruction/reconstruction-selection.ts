/** Selection rules for saved reconstructions: the catalogue's owning model decides, never whichever result is on screen. */
import { densityPreviewAllowed, reconstructionProcessingCapability, type ReconstructionProcessingCapability } from './reconstruction-capabilities.ts';
import type { ReconstructionCandidate, ReconstructionCatalogue } from './reconstruction-types.ts';

type Catalogue = Pick<ReconstructionCatalogue, 'finiteModel'> & { candidates: readonly Pick<ReconstructionCandidate, 'prepared'>[] };
/** Processing capability of the selected image; undefined means no saved result constrains a fresh density Preview. */
export function selectedProcessing(catalogue: Catalogue | null, row: Pick<ReconstructionCandidate, 'prepared'> | undefined): ReconstructionProcessingCapability | undefined {
  if (row?.prepared) return row.prepared.processing ?? reconstructionProcessingCapability(undefined);
  // A finite model owns this view: an image without its baked lens cannot fall back to density repainting.
  if (catalogue?.finiteModel) return reconstructionProcessingCapability('simulation-guided-finite-material@1');
  return undefined;
}
export function selectedPreviewAllowed(catalogue: Catalogue | null, row: Pick<ReconstructionCandidate, 'prepared'> | undefined): boolean {
  const capability = selectedProcessing(catalogue, row);
  return capability === undefined || densityPreviewAllowed(capability);
}
/** A linked or remembered saved result may be shown only if the current finite model (when present) baked it. */
export function acceptsSavedResult(catalogue: Catalogue, resultId: string): boolean {
  return !catalogue.finiteModel || catalogue.candidates.some(row => row.prepared?.resultId === resultId);
}
