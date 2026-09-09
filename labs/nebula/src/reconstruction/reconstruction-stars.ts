/** Offline density support transfer, independent of every photographic image variant. */
import type { DensityVolumeFrame } from '@cssearth/objects';
import { parsePreparedLmcStars, type PreparedLmcStars } from '../stars/lmc-stars.js';

type Rgb = [number, number, number];
export interface ReconstructionStarsInput {
  frame: DensityVolumeFrame;
  /** The caller verifies these original catalogue bytes before parsing them. */
  source: { path: string; sha256: string };
  /** Both callbacks receive the unchanged physical XYZ, in frame units. */
  sampleDensity(x: number, y: number, z: number): number;
  /** Normalized observer-ray density column; never photographic RGB or image coverage. */
  sampleProjectedDensitySignal(x: number, y: number, z: number): number;
}

/** Exact same inputs produce the same catalogue for every image applied to this density cloud. */
export function prepareReconstructionStars(
  existing: PreparedLmcStars, input: ReconstructionStarsInput,
): PreparedLmcStars {
  parsePreparedLmcStars(existing, input.frame);
  if (!input.source.path || !/^[0-9a-f]{64}$/.test(input.source.sha256))
    throw new TypeError('Reconstruction stars require their pinned original catalogue.');
  const stars = existing.stars.flatMap(star => {
    const density = input.sampleDensity(...star.positionUnits);
    if (!Number.isFinite(density) || density < 0) throw new TypeError('Invalid reconstruction density at a catalogue star.');
    if (density === 0) return [];
    const signal = input.sampleProjectedDensitySignal(...star.positionUnits);
    if (!Number.isFinite(signal) || signal <= 0 || signal > 1)
      throw new TypeError('A density-supported star requires a positive normalized density column.');
    return [{ ...star, positionUnits: [...star.positionUnits] as Rgb, cloudSignal: signal, cloudPartIds: ['all-light'] }];
  });
  if (!stars.length) throw new TypeError('No catalogue stars have positive density support.');
  const result: PreparedLmcStars = {
    ...existing,
    frame: structuredClone(input.frame),
    stars,
    depthAssumption: `${existing.depthAssumption} This density catalogue retains those exact prepared XYZ positions, independently of any photographic image, color or coverage. No new stellar distances or membership are inferred.`,
    provenance: {
      schema: 'cssearth-nebula-reconstruction-stars@1',
      inheritedCatalogue: { ...input.source },
      inheritedProvenance: structuredClone(existing.provenance),
      inputStars: existing.stars.length,
      retainedStars: stars.length,
      excludedStars: existing.stars.length - stars.length,
      positions: 'Unchanged prepared XYZ; measured angular coordinates and photometry, previously inferred display depths.',
      support: 'Strictly positive density at XYZ; normalized observer-ray density column governs cutoff. Membership is all-light. No image, photographic signal, color, texture or footprint is consulted.',
      limitation: 'Inherited incomplete massive-star sample and original footprint. No new stars or depths are generated for wider image coverage.',
    },
  };
  return parsePreparedLmcStars(result, input.frame);
}
