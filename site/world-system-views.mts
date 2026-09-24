import { parsePreparedSystemView } from '../src/renderers/css/dist/index.js';
import { APPLICATION_WORLD_CONTEXT } from './world-context-plan.mts';

// One system's camera candidates, fetched when navigation frames that system (`site/system-framing.mts`), from the
// per-host copy the build serves (`pages/world/system-views/[id].json.ts`). Node tests pass their own reader of the
// prepared file.
async function fetchPreparedSystemView(id: string): Promise<unknown> {
  const response = await fetch(`/world/system-views/${id}.json`);
  if (!response.ok) throw new Error(`Prepared system view request for ${id} failed: ${response.status}.`);
  return response.json();
}
export async function readApplicationSystemView(id: string, read: (id: string) => Promise<unknown> = fetchPreparedSystemView) {
  return parsePreparedSystemView(await read(id), APPLICATION_WORLD_CONTEXT, id);
}
