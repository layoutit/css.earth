/**
 * The published-model form of a photograph recipe's photometry block:
 * { model: "photometry/<id>.json", referenceDegrees: { incidence, emission, phase },
 *   limits: { maximumIncidenceDegrees, maximumEmissionDegrees, phaseDegrees: [min, max], minimumGain, maximumGain } }.
 * The model record is a pinned manifest document citing its publication with a
 * `method` binding; `source.verify()` has byte-verified it before any route runs.
 */
import { loadPhotometricModelRecord, parsePhotometryReference, createNormalization, possibleGeometry } from '@cssearth/bake/photometry';
import type { SourceManifest } from '../../../src/platform/source-manifest.mts';

export interface PublishedPhotometryBlock {
  model: string;
  referenceDegrees: { incidence: number; emission: number; phase: number };
  limits: { maximumIncidenceDegrees: number; maximumEmissionDegrees: number; phaseDegrees: number[]; minimumGain: number; maximumGain: number };
}

export interface ResolvedPhotometry {
  /** Gain carrying an observed pixel to the reference geometry, or null when the pixel is withheld. Angles in radians. */
  normalize(incidence: number, emission: number, phase: number | undefined): number | null;
  report: Record<string, unknown>;
  units: string;
}

/** Shape rules that need no record, for synchronous recipe validation; the record's fitted range is checked on load. */
export function validPublishedPhotometryShape(block: PublishedPhotometryBlock, maximumTransferEmissionDegrees: number): boolean {
  const r = block.referenceDegrees, l = block.limits, rad = Math.PI / 180;
  return /^photometry\/[a-z][a-z0-9-]*\.json$/u.test(block.model) &&
    [r.incidence, r.emission, r.phase].every(Number.isFinite) && r.incidence >= 0 && r.incidence < 90 && r.emission >= 0 && r.emission < 90 &&
    possibleGeometry({ incidence: r.incidence * rad, emission: r.emission * rad, phase: r.phase * rad }) &&
    l.maximumIncidenceDegrees > 0 && l.maximumIncidenceDegrees < 90 && l.maximumEmissionDegrees > 0 && l.maximumEmissionDegrees <= maximumTransferEmissionDegrees &&
    Array.isArray(l.phaseDegrees) && l.phaseDegrees.length === 2 && l.phaseDegrees[0] >= 0 && l.phaseDegrees[1] > l.phaseDegrees[0] && l.phaseDegrees[1] < 180 &&
    l.minimumGain > 0 && l.minimumGain <= 1 && l.maximumGain >= 1 && l.maximumGain <= 10 &&
    r.incidence <= l.maximumIncidenceDegrees && r.emission <= l.maximumEmissionDegrees && r.phase >= l.phaseDegrees[0] && r.phase <= l.phaseDegrees[1];
}

export async function resolvePublishedPhotometry(sourceDirectory: string, manifest: SourceManifest | undefined, block: PublishedPhotometryBlock): Promise<ResolvedPhotometry> {
  const document = manifest?.documents.find(entry => entry.path === block.model);
  if (!document) throw new Error(`Photometric model ${block.model} is not a pinned manifest document.`);
  const binding = document.sourceBinding;
  const citations = binding?.kind === 'catalogued' ? binding.references.filter(reference => reference.role === 'method').map(reference => reference.catalogueId) : [];
  if (!citations.length) throw new Error(`Photometric model ${block.model} must cite its publication with a method binding.`);
  const record = await loadPhotometricModelRecord(sourceDirectory, block.model);
  const normalization = parsePhotometryReference(block, record), gain = createNormalization(normalization);
  const r = block.referenceDegrees;
  return {
    normalize: (incidence, emission, phase) => phase === undefined ? null : gain({ incidence, emission, phase }),
    units: `relative brightness normalized to i=${r.incidence}°, e=${r.emission}°, g=${r.phase}° with photometric model ${record.id}; linear grayscale display`,
    report: {
      model: record.id, modelPath: block.model, citations, instrument: record.instrument, filter: record.filter, family: record.model.family, quantity: record.quantity,
      referenceDegrees: r, limits: block.limits, fittedPhaseDegrees: record.fit.phaseDegrees, extrapolatesPhase: normalization.extrapolatesPhase,
      formula: 'Brightness at the reference geometry = observed brightness × model(reference) / model(observed); pixels outside the angle, phase or gain limits are withheld.',
      applicationLighting: 'Uniform flood displays the normalized observation; Shadows applies the existing fixed-epoch Sun bank.',
      limitations: 'Published model fitted to its own data set; relative display brightness, not measured albedo. Baked Shadows lighting stays Lambert with cast shadows, because emission changes as the viewer rotates.',
    },
  };
}
