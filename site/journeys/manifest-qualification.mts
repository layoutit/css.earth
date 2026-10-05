/** Tracked status requires a date-free measurement contract, never an ignored file's existence. */
import { profiles } from './harness/profiles.mts';
export type Status = 'qualified' | 'experimental';
export interface QualificationMeasure { captures: 40; engines: ('chromium' | 'webkit')[]; batches: [10, 10, 10, 10]; boundaries: 3; measures: ['trace', 'rgba', 'observed-ids'] }
export interface Declaration { status: Status; measure?: QualificationMeasure }
export function validateDeclaration(input: unknown, profile: string): Declaration {
  if (!input || typeof input !== 'object' || !('status' in input) || (input.status !== 'qualified' && input.status !== 'experimental')
    || Object.keys(input).some(key => !['status', 'measure'].includes(key)) || !profiles[profile]) throw new Error('Invalid qualification declaration');
  if (input.status === 'experimental') return { status: 'experimental' };
  const measure: unknown = 'measure' in input ? input.measure : undefined;
  if (!measure || typeof measure !== 'object' || !('captures' in measure) || measure.captures !== 40
    || !('engines' in measure) || !Array.isArray(measure.engines) || !measure.engines.length
    || !measure.engines.every(engine => engine === 'chromium' || engine === 'webkit') || !measure.engines.includes(profiles[profile]!.engine)
    || new Set(measure.engines).size !== measure.engines.length || !('batches' in measure) || JSON.stringify(measure.batches) !== '[10,10,10,10]'
    || !('boundaries' in measure) || measure.boundaries !== 3 || !('measures' in measure) || JSON.stringify(measure.measures) !== '["trace","rgba","observed-ids"]'
    || Object.keys(measure).some(key => !['captures', 'engines', 'batches', 'boundaries', 'measures'].includes(key))) throw new Error('Qualified status requires a date-free qualification measure');
  return { status: 'qualified', measure: { captures: 40, engines: measure.engines, batches: [10, 10, 10, 10], boundaries: 3, measures: ['trace', 'rgba', 'observed-ids'] } };
}
const measured: Declaration = { status: 'qualified', measure: { captures: 40, engines: ['chromium', 'webkit'], batches: [10, 10, 10, 10], boundaries: 3, measures: ['trace', 'rgba', 'observed-ids'] } };
/** These recipes have instrumented 10+30 evidence in both desktop engines. */
export const declarations: Record<string, Record<string, Declaration>> = Object.fromEntries([
  'neptune-system', 'asteroid-2001-sn263-system', 'abell-1689', 'centaurus-cluster', 'great-attractor', 'local-group',
].map(id => [id, { 'chromium-desktop': measured, 'webkit-desktop': measured }]));
