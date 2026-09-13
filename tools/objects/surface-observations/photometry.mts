/** The photometry stage: every route's brightness treatment as one gain function with its report. */
import type { ObservationPhotometry } from './contract.mts';
import type { DiskPhotometry } from '../terrestrial-layers/contracts.mts';
import type { SourceManifest } from '../../../src/platform/source-manifest.mts';
import { observationGain } from '../terrestrial-layers/osiris-geo.mts';
import { resolvePublishedPhotometry, type PublishedPhotometryBlock } from '../terrestrial-layers/published-photometry.mts';

/** A published model record carries every pixel to its reference geometry. */
export async function publishedPhotometry(sourceDirectory: string, manifest: SourceManifest | undefined, block: PublishedPhotometryBlock): Promise<ObservationPhotometry> {
  const resolved = await resolvePublishedPhotometry(sourceDirectory, manifest, block);
  return { gain: resolved.normalize, report: resolved.report, units: resolved.units, retainsIllumination: false };
}

const DISK_FORMULAS: Readonly<Record<string, string>> = {
  minnaert: 'D=cos(i)^k*cos(e)^(k-1); k=coefficient+phaseCoefficientPerDegree*phaseDegrees; linear reflectance divided by D before interpolation; D(0,0)=1.',
  'lunar-lambert': 'D=(1-w)*cos(i)+2*w*cos(i)/(cos(i)+cos(e)); linear radiance divided by D before interpolation; D(0,0)=1.',
};

/** The historical disk functions: Lommel-Seeliger, Lunar-Lambert with its weight, Minnaert with its phase slope, or the retained acquisition illumination within angle limits. */
export function diskPhotometry(block: DiskPhotometry): ObservationPhotometry {
  const retained = block.model === 'retained-observation';
  return { gain: (incidence, emission, phase) => observationGain(incidence, emission, block, phase), retainsIllumination: retained, report: { ...block,
    formula: retained ? 'Original acquisition illumination retained; no photometric disk correction.' : DISK_FORMULAS[block.model ?? '']
      ?? 'D=2*cos(i)/(cos(i)+cos(e)); linear radiance divided by D before interpolation; reference D(0,0)=1.',
    applicationLighting: retained ? 'Uniform flood displays the acquisition illumination; Shadows applies the existing fixed-epoch Sun bank.'
      : 'Uniform flood displays the normalized observation; Shadows applies the existing fixed-epoch Sun bank.',
    limitations: block.phaseCorrection
      ? 'Approximate single-scattering phase normalization; no Hapke roughness, multiple-scattering correction or cast-shadow recovery. Relative display brightness, not measured albedo.'
      : 'No phase correction, Hapke roughness correction or cast-shadow recovery. Relative display brightness, not measured albedo.' } };
}

/** The photograph's own shading, with no angle limits beyond the transfer's. */
export function observedPhotometry(report: Record<string, unknown>): ObservationPhotometry {
  return { gain: () => 1, retainsIllumination: true, report: { ...report, limitations: 'Original acquisition shading retained; bounded relative display levels only, not albedo.' } };
}
