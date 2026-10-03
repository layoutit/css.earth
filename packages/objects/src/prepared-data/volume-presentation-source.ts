import type { ProductInputEvidence } from '../provenance/product-input-evidence.js';

export const VOLUME_PRESENTATION_SOURCE_SCHEMA = 'cssearth-volume-presentation-source@2';

type Crop = { left: number; top: number; width: number; height: number };
/** A preview whose file is in this repository (authored here, or a download kept beside its source) is identified by that
 * file; a preview fetched into the ignored cache is named by its path there. */
export interface TrackedVolumeSourcePreview { path: string; url?: string; authoredFrom?: string; crop?: Crop; }
interface CachedVolumeSourcePreview { path: string; url?: string; skyBands?: { path: string }; crop?: Crop; }
export type VolumeSourcePreview = TrackedVolumeSourcePreview | CachedVolumeSourcePreview;
export interface VolumeDatasetSource {
  id: string; label: string; title: string; description: string; summary: string; detail: string;
  facts: { id: string; label: string; value: string }[]; input: string; preview: VolumeSourcePreview;
  /** Further inputs this one dataset was built from, each with its role, beyond its own image and the shared inputs. */
  inputEvidence: ProductInputEvidence[];
}
export interface VolumePresentationSource {
  objectId: string; name: string; defaultDataset: string; bank: { path: string };
  sharedInputs: string[]; inputEvidence: ProductInputEvidence[]; datasets: VolumeDatasetSource[];
}
