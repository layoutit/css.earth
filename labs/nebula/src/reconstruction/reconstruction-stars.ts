/** Offline, image-independent catalogue realization in the accepted Alignment density cloud. */
import type { DensityVolumeFrame } from '@cssearth/objects';
import { parsePreparedLmcStars, type PreparedLmcStars } from '../stars/lmc-stars.js';
import { sampleJointDepth } from '../cli/prepare-lmc-stars.js';
import { createObservationMapping } from '../density/observation-prior.js';
import { rayToOverlayPlane, type ImageWcs } from '../alignment/overlay-wcs.js';
import { createAlignedObservationMapping, type ReconstructionAlignment } from './reconstruction-geometry.js';
import type { VolumeSource } from '../../../../src/preparation/volume/source.js';

type Pin = { path: string; sha256: string };
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
const validPin = (pin: Pin | undefined) => Boolean(pin?.path && /^[0-9a-f]{64}$/.test(pin.sha256));

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
  const inherited = existing.provenance as { depthModel?: { object?: Pin; grid?: { sha256?: string; decodedSha256?: string } }; footprint?: { wcs?: ImageWcs } } | null;
  if (!validPin(input.canonicalCloud) || inherited?.depthModel?.object?.sha256 !== input.canonicalCloud.sha256 ||
      inherited.depthModel.grid?.sha256 !== input.densitySource.recipe.grid.sha256 ||
      inherited.depthModel.grid?.decodedSha256 !== input.densitySource.recipe.grid.decodedSha256)
    throw new TypeError('Canonical density differs from the catalogue’s pinned simulation source.');
  if (JSON.stringify(input.reference.wcs) !== JSON.stringify(inherited.footprint?.wcs))
    throw new TypeError('Canonical stellar reference must use the original catalogue image footprint.');
  const sourceMapping = createObservationMapping(input.reference.wcs, input.frame);
  const mapping = createAlignedObservationMapping(input.reference.alignment, input.frame);
  const cloud = { supportBoundsKpc: input.densitySource.recipe.grid.bounds,
    sample(_x: number, _y: number, _z: number, out: [number, number, number]) { out.fill(1); } };
  const stars: PreparedLmcStars['stars'] = [], unsupported: { id: string; reason: string }[] = [];
  for (const star of existing.stars) {
    const a = star.raDeg * Math.PI / 180, d = star.decDeg * Math.PI / 180;
    const tangent = rayToOverlayPlane([Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)], input.frame);
    const uv = sourceMapping.uvAtTangent(tangent[0], tangent[1]);
    if (!uv) { unsupported.push({ id: star.id, reason: 'Measured ray is outside the original reference footprint.' }); continue; }
    const [x, y] = mapping.tangentAtUv(...uv);
    try {
      // Unit cloud emission reuses the existing bounded CDF while conditioning
      // ONLY on decoded source density and the solid-angle volume Jacobian.
      const depth = sampleJointDepth({ source: input.densitySource, cloud, mapping }, x, y, star.id);
      const positionUnits = mapping.pointAtDepth(x, y, depth);
      const cloudSignal = input.sampleProjectedDensitySignal(...positionUnits);
      if (!Number.isFinite(cloudSignal) || cloudSignal < 0 || cloudSignal > 1)
        throw new TypeError('Star requires a normalized common projected density signal.');
      stars.push({ ...structuredClone(star), positionUnits, cloudSignal, cloudPartIds: ['all-light'] });
    } catch (error) { unsupported.push({ id: star.id, reason: error instanceof Error ? error.message : String(error) }); }
  }
  if (unsupported.length) throw new TypeError(`Cannot place ${unsupported.length}/${existing.stars.length} catalogue stars in canonical density: ${JSON.stringify(unsupported)}`);
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
