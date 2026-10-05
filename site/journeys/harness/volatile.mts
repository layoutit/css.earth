/** Explicit bounded variation: only a declared concurrent module import's first caller may vary. */
import type { Json, Trace } from './trace.mts';
export interface VolatileInitiator { url: string; scripts: string[]; cause: string; }
export function boundInitiators(trace: Trace, declarations: VolatileInitiator[]): Trace {
  for (const declaration of declarations) {
    if (!declaration.url || declaration.scripts.length < 1 || !declaration.cause) throw new Error('Invalid volatile initiator declaration');
    for (const row of trace.observations.network) {
      const data = row.data;
      if (!data || typeof data !== 'object' || Array.isArray(data) || data.url !== declaration.url) continue;
      const initiator = data.initiator;
      if (!initiator || typeof initiator !== 'object' || Array.isArray(initiator) || !Array.isArray(initiator.scripts)) continue;
      const scripts = initiator.scripts;
      const withinBound = scripts.length === 1 && typeof scripts[0] === 'string' && declaration.scripts.includes(scripts[0]);
      const feature: Json = { feature: 'concurrent-module-first-importer', cause: declaration.cause,
        allowedScripts: [...declaration.scripts].sort(), count: scripts.length, withinBound };
      data.initiator = { ...initiator, scripts: withinBound ? feature : scripts, volatile: feature };
    }
  }
  trace.volatile = [...trace.volatile ?? [], ...declarations.map(declaration => ({ family: 'network', feature: 'concurrent-module-first-importer',
    subject: declaration.url, cause: declaration.cause, bound: { scriptCount: 1, scripts: [...declaration.scripts].sort() } }))];
  return trace;
}
