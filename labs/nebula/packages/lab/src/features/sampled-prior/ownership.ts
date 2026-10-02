import { isRecord as coreIsRecord } from '@cssearth/core';
/** Shared browser/CLI boundary for the source owners of a sampled-volume preparation, named by path. Git identifies the code. */
export interface SampledOwnerPin { path: string }
/** The shared FITS reader a sampled preparation reads its point source through. */
export const isSampledFitsOwner = (path: string) => path === 'packages/fits/src/fits.ts' || path === 'packages/fits/src/transport.ts';
const record = coreIsRecord;
function pin(v: unknown, field: string): SampledOwnerPin {
  if (!record(v) || typeof v.path !== 'string' || !/^(labs\/nebula\/|\.local\/nebula-lab\/)/.test(v.path) ||
      /[\\?#\s]/.test(v.path) || v.path.split('/').some(p => !p || p === '..') || Object.keys(v).join() !== 'path')
    throw new TypeError(`Invalid sampled preparation owner in ${field}: ${JSON.stringify(v)}`);
  return { path: v.path };
}
/** The recipe, evidence and point source a saved sampled method was prepared from, and the snapshots it keeps of them. */
export function sampledOwnerPins(method: unknown, recipePath: string): SampledOwnerPin[] {
  if (!record(method) || !record(method.sampledPrior) || !Array.isArray(method.inputPins) || method.inputPins.length < 3 || method.inputPins.length > 30)
    throw new TypeError('Missing sampled preparation input ownership.');
  const inputs = method.inputPins.map(value => pin(value, 'inputPins'));
  const snapshot = pin(method.sampledPrior.recipe, 'sampledPrior.recipe'), evidence = pin(method.sampledPrior.evidence, 'sampledPrior.evidence');
  const source = pin(method.sampledPrior.source, 'sampledPrior.source');
  if (!snapshot.path.startsWith('.local/nebula-lab/compiler/') || !evidence.path.startsWith('.local/nebula-lab/compiler/') ||
      !inputs.some(p => p.path === recipePath) || !inputs.some(p => p.path.startsWith('labs/nebula/models/') && p.path !== recipePath) ||
      !inputs.some(p => p.path === source.path)) throw new TypeError(`Sampled snapshots of ${recipePath} differ from their source owners.`);
  if (new Set(inputs.map(p => p.path)).size !== inputs.length) throw new TypeError('Duplicate sampled source ownership.');
  return inputs;
}
