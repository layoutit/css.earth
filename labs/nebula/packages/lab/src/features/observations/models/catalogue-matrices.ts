import type { StructureCatalogue } from './structures-model';
import { adjustedMatrix, savedObservationFit, unchanged } from './model';

/** Use the saved registration for each observed image in the catalogue's physical frame. */
export function catalogueMatrices(catalogue: StructureCatalogue, observationManifest?: string) {
  return Object.fromEntries(catalogue.images.map(image => [image.id,
    adjustedMatrix({ imageToFrame: image.imageToFrame, source: { width: image.nativeWidth, height: image.nativeHeight } }, catalogue.frame,
      observationManifest ? savedObservationFit(observationManifest, { id: image.id, source: { url: image.sourceUrl } }) : unchanged)]));
}
