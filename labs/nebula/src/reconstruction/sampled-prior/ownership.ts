/** Shared browser/CLI boundary for the extra owners of a sampled-volume preparation. */
export interface SampledOwnerPin { path: string; sha256: string }
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
function pin(v: unknown): SampledOwnerPin {
  if (!record(v) || typeof v.path !== 'string' || !(/^(labs\/nebula\/|\.local\/nebula-lab\/)/.test(v.path) || v.path === 'tools/fits.mts') ||
      /[\\?#\s]/.test(v.path) || v.path.split('/').some(p => !p || p === '..') || typeof v.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(v.sha256))
    throw new TypeError('Invalid sampled preparation owner.');
  return { path: v.path, sha256: v.sha256 };
}
export function sampledOwnerPins(method: unknown, recipePath: string): SampledOwnerPin[] {
  if (!record(method) || !record(method.sampledPrior) || !Array.isArray(method.inputPins) || method.inputPins.length < 3 || method.inputPins.length > 30 ||
      !Array.isArray(method.extraImplementation) || !method.extraImplementation.length || method.extraImplementation.length > 40)
    throw new TypeError('Missing sampled preparation input/implementation ownership.');
  const inputs = method.inputPins.map(pin), implementations = method.extraImplementation.map(pin);
  for (const implementation of implementations) if (implementation.path !== 'tools/fits.mts' && !/^labs\/nebula\/src\/reconstruction\/(sampled-prior\/[a-z0-9-]+|getsf-fits)\.ts$/.test(implementation.path))
    throw new TypeError('Invalid sampled implementation path.');
  const snapshot = pin(method.sampledPrior.recipe), evidence = pin(method.sampledPrior.evidence), source = pin(method.sampledPrior.source);
  if (!snapshot.path.startsWith('.local/nebula-lab/compiler/') || !evidence.path.startsWith('.local/nebula-lab/compiler/') ||
      !inputs.some(p => p.path === recipePath && p.sha256 === snapshot.sha256) ||
      !inputs.some(p => p.path.startsWith('labs/nebula/models/') && p.sha256 === evidence.sha256) ||
      !inputs.some(p => p.path === source.path && p.sha256 === source.sha256)) throw new TypeError('Sampled snapshots differ from their source owners.');
  const all = [...inputs, ...implementations];
  if (new Set(all.map(p => p.path)).size !== all.length) throw new TypeError('Duplicate sampled source ownership.');
  return all;
}
