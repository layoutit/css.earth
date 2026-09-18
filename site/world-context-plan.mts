import { parsePreparedWorldContext } from '../src/renderers/css/dist/index.js';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// The application's prepared world context, validated once. Startup, framing and
// every detail mount share this immutable plan. The browser fetches the prepared
// file instead of bundling it as a module, so only the validated plan stays
// resident: a retained JSON module kept a second full copy alive on the heap.
// `source` stays import.meta.url-relative so Vite's static asset analysis bundles
// it for the browser; Node's own read below resolves against the working
// directory instead, since once this module is bundled into
// `dist/.prerender/chunks` its own URL no longer sits beside the project root.
const source = new URL('../src/objects/sun/prepared/world-context.json', import.meta.url);
/** The same prepared file, for the world planner worker to read its own copy. */
export const APPLICATION_WORLD_CONTEXT_URL = source.href;
async function readPreparedWorldContext(): Promise<unknown> {
  // Node tools, tests and the prerender build read the checked-in file directly.
  if (source.protocol === 'file:') {
    const path = resolve(process.cwd(), 'src/objects/sun/prepared/world-context.json');
    return (await import(/* @vite-ignore */ pathToFileURL(path).href, { with: { type: 'json' } })).default;
  }
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Prepared world context request failed: ${response.status}.`);
  return response.json();
}
export const APPLICATION_WORLD_CONTEXT = parsePreparedWorldContext(await readPreparedWorldContext());
