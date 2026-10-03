import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
export interface SystemOrbitsRecipe {
  kind: 'system-orbits'; id: string; title: string; description: string; output: string; metadata: Record<string, unknown>;
  /** The host star's id, and the planet drawn brighter. */
  system: string; highlight: string;
}

export function parseSystemOrbits(value: unknown): SystemOrbitsRecipe {
  const r = requireRecord(value, 'system-orbits chart'), id = requireString(r.id, 'chart id');
  if (r.kind !== 'system-orbits' || !/^[a-z][a-z0-9-]*$/.test(id)) throw new TypeError(`${id}: a system-orbits chart has kind system-orbits and a lowercase id.`);
  return { kind: 'system-orbits', id, title: requireString(r.title, 'title'), description: requireString(r.description, 'description'), output: requireString(r.output, 'output'),
    metadata: requireRecord(r.metadata, 'chart metadata'), system: requireString(r.system, `${id}.system`), highlight: requireString(r.highlight, `${id}.highlight`) };
}

