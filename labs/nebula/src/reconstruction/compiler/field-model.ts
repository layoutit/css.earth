import { jointRecord } from '../joint-fit/model';
import { readCompilerControls } from './model';
import type { EmissionComponent, EmissionFieldModel } from './field-types';
const triple = (v: unknown): v is [number, number, number] => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
function component(v: unknown): v is EmissionComponent {
  return jointRecord(v) && typeof v.id === 'string' && typeof v.basisId === 'string' && triple(v.center) && triple(v.sigma) && v.sigma.every(n => n > 0) &&
    typeof v.angleRadians === 'number' && Number.isFinite(v.angleRadians) && typeof v.projectedWeight === 'number' && Number.isFinite(v.projectedWeight) && v.projectedWeight >= 0 &&
    ['scaffold-near', 'scaffold-far', 'halo-near', 'halo-far', 'halo-diffuse', 'evidence-surface'].includes(String(v.depthAssignment)) && typeof v.velocityCovered === 'boolean' &&
    (v.depthGradient === undefined || Array.isArray(v.depthGradient) && v.depthGradient.length === 2 && v.depthGradient.every(n => Number.isFinite(n) && Math.abs(n) <= 100));
}
/** Decode the spatial field consumed by independent stellar/material preparation. Original provenance stays immutable. */
export function readRetainedEmissionField(v: unknown): EmissionFieldModel {
  if (!jointRecord(v) || v.schema !== 'cssearth-conditional-emission-field@1' || typeof v.identity !== 'string' ||
      !jointRecord(v.bounds) || !triple(v.bounds.min) || !triple(v.bounds.max) ||
      !Array.isArray(v.components) || v.components.length > 10000 || !v.components.every(component)) throw new TypeError('Invalid retained emission field.');
  const maximum = v.bounds.max;
  if (v.bounds.min.some((n, i) => n >= maximum[i]!)) throw new TypeError('Invalid retained emission bounds.');
  return { schema: v.schema, identity: v.identity, controls: readCompilerControls(v.controls), bounds: { min: v.bounds.min, max: v.bounds.max },
    components: v.components, skyBounds: { min: [v.bounds.min[0], v.bounds.min[1]], max: [v.bounds.max[0], v.bounds.max[1]] }, scaffold: null,
    assumptions: { kernel: 'retained source components', projectionUnits: 'arcseconds', depth: 'retained authored field', halo: 'retained source',
      haloRadiusArcsec: 1, equalNearFarSplit: true, velocityUncoveredComponents: 0 } };
}
