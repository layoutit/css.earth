import { parsePreparedSystemViews } from '../src/renderers/css/dist/index.js';
import { APPLICATION_WORLD_CONTEXT } from './world-context-plan.mts';

// System framing's camera candidates, about three quarters of the world context by size, stay out of the summary
// every page waits for (`world-context-plan.mts`). The first system overview or navigation reads them
// (`site/system-framing.mts`). Node tests pass their own reader of the checked-out file.
const source = new URL('../src/objects/sun/prepared/world-system-views.json', import.meta.url);
async function fetchPreparedSystemViews(): Promise<unknown> {
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Prepared system views request ${source.pathname} failed: ${response.status}.`);
  return response.json();
}
export async function readApplicationSystemViews(read: () => Promise<unknown> = fetchPreparedSystemViews) {
  return parsePreparedSystemViews(await read(), APPLICATION_WORLD_CONTEXT);
}
