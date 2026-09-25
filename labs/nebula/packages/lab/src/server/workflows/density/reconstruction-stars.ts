import {realizeRegisteredStars} from '@cssearth/nebula-reconstruction/stars/registered-realization';
/** Offline, image-independent catalogue realization in the accepted Alignment density cloud. */
import type { DensityVolumeFrame } from '@cssearth/objects';
import { parsePreparedLmcStars, type PreparedLmcStars, rayToOverlayPlane, type ImageWcs, createAlignedObservationMapping, type ReconstructionAlignment } from '@cssearth/bake/volume';
import { sampleJointDepth } from '../../../cli/commands/prepare-lmc-stars.ts';
import { createObservationMapping } from '../../../adapters/preparation/observation-prior.ts';
import type { VolumeSource } from '@cssearth/volume-bake/compact-inputs/density-grid';

type Pin = { path: string };
export interface ReconstructionStarsInput {
  frame: DensityVolumeFrame;
  /** These catalogue/source/registration bytes are verified by the caller before parsing. */
  source: Pin;
  canonicalCloud: Pin;
  densitySource: VolumeSource;
  reference: { wcs: ImageWcs; alignment: ReconstructionAlignment; provenancePin: Pin };
  /** Common full-density observer-ray signal; no candidate image color/coverage. */
  sampleProjectedDensitySignal(x: number, y: number, z: number): number;
}
const validPin = (pin: Pin | undefined) => Boolean(pin?.path);

/**
 * Measured sky ray → native reference-image UV → accepted image-to-model fit.
 * One fixed source-ID quantile selects depth in the actual simulation density.
 * This is an authored display registration, not newly measured stellar astrometry.
 */
export function prepareReconstructionStars(existing: PreparedLmcStars, input: ReconstructionStarsInput): PreparedLmcStars {
  parsePreparedLmcStars(existing, input.frame);
  if (Object.keys(input).some(key => !['frame', 'source', 'canonicalCloud', 'densitySource', 'reference', 'sampleProjectedDensitySignal'].includes(key)))
    throw new TypeError('Reconstruction stars accept only the fixed reference registration and density, not candidate image inputs.');
  if (!validPin(input.source) || !validPin(input.reference?.provenancePin))
    throw new TypeError('Reconstruction stars require pinned original catalogue and reference alignment.');
  const inherited = existing.provenance as { depthModel?: { object?: Pin }; footprint?: { wcs?: ImageWcs } } | null;
  if (!validPin(input.canonicalCloud) || inherited?.depthModel?.object?.path !== input.canonicalCloud.path)
    throw new TypeError('Canonical density differs from the catalogue’s simulation source.');
  if (JSON.stringify(input.reference.wcs) !== JSON.stringify(inherited.footprint?.wcs))
    throw new TypeError('Canonical stellar reference must use the original catalogue image footprint.');
  const sourceMapping = createObservationMapping(input.reference.wcs, input.frame);
  const mapping = createAlignedObservationMapping(input.reference.alignment, input.frame);
  const cloud = { supportBoundsKpc: input.densitySource.recipe.grid.bounds,
    sample(_x: number, _y: number, _z: number, out: [number, number, number]) { out.fill(1); } };
  const stars=realizeRegisteredStars(existing.stars,{frame:input.frame,sourceMapping,mapping,depthAt:(x,y,id)=>sampleJointDepth({source:input.densitySource,cloud,mapping},x,y,id),sampleSignal:input.sampleProjectedDensitySignal});
  const result: PreparedLmcStars = { ...existing, frame: structuredClone(input.frame), stars,
    depthAssumption: 'Original observed RA/DEC and photometry are retained as catalogue data. Rays are registered through the fixed reference-image WCS and its accepted Alignment fit to the simulation cloud. Depths are a deterministic density-conditioned display realization, not measured stellar distances or new astrometry. Candidate image material never selects or moves stars.',
    provenance: { schema: 'cssearth-nebula-reconstruction-stars@3', inheritedCatalogue: { ...input.source },
      inheritedProvenance: structuredClone(existing.provenance), canonicalCloud: { ...input.canonicalCloud },
      reference: structuredClone(input.reference), densityGrid: structuredClone(input.densitySource.recipe.grid),
      inputStars: existing.stars.length, retainedStars: stars.length, excludedStars: 0,
      belowProjectionQuantization: stars.filter(star => star.cloudSignal === 0).length,
      positions: 'One common measured-ray to reference-UV to fitted-model-ray transport; IDs, original RA/DEC and photometry are unchanged.',
      depth: 'Existing 1536-interval conditional CDF with fixed SHA256 source-ID quantile; PDF is decoded stellar density times (1+z/D)^2. Every selected point must have strictly positive source support.',
      support: 'The common encoded full-density projected signal controls cutoff; membership is all-light. Physically supported stars below projection quantization retain zero signal and remain visible at cutoff0. No candidate image, color, texture or coverage input exists.',
      limitation: 'An authored image/simulation registration and inferred depth realization; rendered model rays after the fit are not claimed as measured celestial coordinates.' } };
  return parsePreparedLmcStars(result, input.frame);
}
