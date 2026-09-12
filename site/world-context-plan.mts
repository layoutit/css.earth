import { parsePreparedWorldContext } from '../src/renderers/css/dist/index.js';

// The application's prepared world context, validated once. Startup, framing and
// every detail mount share this immutable plan. The browser fetches the prepared
// file instead of bundling it as a module, so only the validated plan stays
// resident: a retained JSON module kept a second full copy alive on the heap.
const source = new URL('../src/planets/sun/prepared/world-context.json', import.meta.url);
/** The same prepared file, for the world planner worker to read its own copy. */
export const APPLICATION_WORLD_CONTEXT_URL = source.href;
async function readPreparedWorldContext(): Promise<unknown> {
  // Node tools and tests read the checked-in file directly.
  if (source.protocol === 'file:') return (await import(/* @vite-ignore */ source.href, { with: { type: 'json' } })).default;
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Prepared world context request failed: ${response.status}.`);
  return response.json();
}
export const APPLICATION_WORLD_CONTEXT = parsePreparedWorldContext(await readPreparedWorldContext());
