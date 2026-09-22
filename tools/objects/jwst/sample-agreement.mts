/** Numerical reproduction of an aligned image or cube, not a test of the underlying astrophysics.
 * The absolute floor is the archive's median nonzero brightness, so noise near zero cannot
 * dominate the ratio. Both products must cover exactly the same samples. */
import { requireRecord } from '../../sources/source-values.mts';
export function sampleAgreement(value: unknown, kind: 'cube' | 'image' = 'cube') {
  const samples = requireRecord(value, 'comparison samples');
  const finite = (key: string) => typeof samples[key] === 'number' && Number.isFinite(samples[key]);
  const tolerance = 1e-5;
  const accepted = finite('both') && Number(samples.both) > 0 && samples.onlyOurs === 0 && samples.onlyMast === 0
    && finite('maximumNormalizedDifference') && Number(samples.maximumNormalizedDifference) >= 0 && Number(samples.maximumNormalizedDifference) <= tolerance;
  return { policy: `jwst-${kind}-samples@${kind === 'cube' ? 2 : 1}`, tolerance, normalization: kind === 'cube' ? 'max(abs(archive sample), archive median nonzero absolute brightness); zero reference scale requires exact zero' : 'max(abs(archive sample), archive median absolute brightness)', accepted };
}
