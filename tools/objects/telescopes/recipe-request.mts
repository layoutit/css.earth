/** Band depth has three input windows. Keep their enclosing reduction range out of the measurement's band identity. */
import type { CapabilityRequest } from './query.mts';
import { requireArray, requireFiniteNumber } from '../../sources/source-values.mts';
export function inputWavelengths(request: CapabilityRequest): readonly [number,number] {
  if (!request.continuumMicrometres) return request.wavelengthMicrometres;
  if (request.kind && request.kind !== 'cube') throw new TypeError('Band-depth continuum windows require a cube.');
  const windows = requireArray(request.continuumMicrometres, 'continuum windows');
  if (windows.length !== 2) throw new TypeError('Band depth requires two continuum windows.');
  const [left,right] = windows.map(w => { const v=requireArray(w);if(v.length!==2)throw new TypeError('A continuum window has two bounds.');const a=requireFiniteNumber(v[0]),b=requireFiniteNumber(v[1]);if(!(a>0&&b>a))throw new TypeError('Continuum windows must be positive and increasing.');return [a,b] as const; });
  if(left![1]>request.wavelengthMicrometres[0] || right![0]<request.wavelengthMicrometres[1])throw new TypeError('Continuum windows must bracket the requested band.');
  return [left![0],right![1]];
}
