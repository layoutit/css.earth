/** Offline catalogue transfer onto an unchanged accepted cloud, independent of image material. */
import type { DensityVolumeFrame } from '@cssearth/objects';
import { parsePreparedLmcStars, type PreparedLmcStars } from '../stars/lmc-stars.js';

export interface ReconstructionStarsInput {
  frame: DensityVolumeFrame;
  /** The caller verifies these original catalogue bytes before parsing them. */
  source: { path: string; sha256: string };
  /** Must match the cloud object used by the inherited stellar depth/support model. */
  canonicalCloud: { path: string; sha256: string };
}

/** Repainting cannot select/reposition stars or replace the accepted cloud's prepared cutoff signal. */
export function prepareReconstructionStars(
  existing: PreparedLmcStars, input: ReconstructionStarsInput,
): PreparedLmcStars {
  parsePreparedLmcStars(existing, input.frame);
  if (Object.keys(input).some(key => !['frame', 'source', 'canonicalCloud'].includes(key)))
    throw new TypeError('Reconstruction stars accept only canonical cloud and catalogue inputs, not image or density resampling.');
  if (!input.source.path || !/^[0-9a-f]{64}$/.test(input.source.sha256))
    throw new TypeError('Reconstruction stars require their pinned original catalogue.');
  const inherited = existing.provenance as { depthModel?: { cloudObject?: { sha256?: unknown } } } | null;
  if (!input.canonicalCloud?.path || !/^[0-9a-f]{64}$/.test(input.canonicalCloud.sha256) ||
      inherited?.depthModel?.cloudObject?.sha256 !== input.canonicalCloud.sha256)
    throw new TypeError('Canonical cloud differs from the catalogue’s accepted cloud support model.');
  const stars = existing.stars.map(star => ({ ...structuredClone(star), cloudPartIds: ['all-light'] }));
  const result: PreparedLmcStars = {
    ...existing,
    frame: structuredClone(input.frame),
    stars,
    depthAssumption: `${existing.depthAssumption} Material variants retain the exact accepted-cloud XYZ positions and cloud cutoff signal, independently of photographic image, color or coverage. No new stellar distances or membership are inferred.`,
    provenance: {
      schema: 'cssearth-nebula-reconstruction-stars@2',
      inheritedCatalogue: { ...input.source },
      inheritedProvenance: structuredClone(existing.provenance),
      canonicalCloud: { ...input.canonicalCloud },
      inputStars: existing.stars.length,
      retainedStars: stars.length,
      excludedStars: 0,
      positions: 'Unchanged prepared XYZ, original observed RA/DEC and photometry, and previously inferred display depths.',
      support: 'Unchanged accepted-cloud cloudSignal; only contribution membership maps to all-light. No image or raw-density resampling, filtering, selection or repositioning occurs.',
      limitation: 'Inherited incomplete massive-star sample and original footprint. No new stars or depths are generated for wider image coverage.',
    },
  };
  return parsePreparedLmcStars(result, input.frame);
}
