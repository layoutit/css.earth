/** Transfer limits that follow from each frame's measured pixel footprint and the source mesh error, instead of per-format constants. */
import type { ObservationFrame, TransferLimits } from './contract.mts';

/** The most diagonal pixel footprints a contributor may lie from the sampled point. It caps a per-sample footprint limit, and a fixed
 * limit may not exceed it for the coarsest frame at the emission limit. */
export const MAXIMUM_SEPARATION_FOOTPRINTS = 4;

/** Report the authored limits beside the limits the frames support, and list every authored limit that exceeds them. */
export function deriveLimits(transfer: TransferLimits & { interpretation?: string }, frames: readonly ObservationFrame[], meshErrorMeters: number) {
  const coarsestNadirFootprintMeters = Math.max(...frames.map(frame => frame.footprint.nadirMedianMeters));
  const emissionStretch = Math.sqrt(1 + 1 / Math.cos(transfer.maximumEmissionDegrees * Math.PI / 180) ** 2);
  // Archive backplanes come from the archive's own shape model, which may differ from the source mesh by up to its error.
  const shapeAllowanceMeters = frames.some(frame => frame.geometrySource === 'archive-backplanes') ? meshErrorMeters : 0;
  const derived = { maximumSeparationMeters: shapeAllowanceMeters + MAXIMUM_SEPARATION_FOOTPRINTS * coarsestNadirFootprintMeters * emissionStretch,
    coarsestNadirFootprintMeters, emissionStretch, separationFootprints: MAXIMUM_SEPARATION_FOOTPRINTS, shapeAllowanceMeters,
    rule: 'A fixed contributor separation may not exceed four diagonal pixel footprints of the coarsest frame at the emission limit, plus the mesh error when the backplanes come from the archive\'s own shape model. A per-sample separation scales with each footprint\'s own range and emission. Every displayed point samples its closest source point.' };
  const exceeded = transfer.maximumSeparationMeters !== undefined && transfer.maximumSeparationMeters > derived.maximumSeparationMeters ? ['maximumSeparationMeters'] : [];
  return { report: { ...transfer, derived }, exceeded };
}
