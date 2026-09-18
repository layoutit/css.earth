import { parsePreparedWorldContext } from '../src/renderers/css/dist/index.js';

// The application's prepared world context, validated once. Startup, framing and
// every detail mount share this immutable plan. The browser fetches the prepared
// file instead of bundling it as a module, so only the validated plan stays
// resident: a retained JSON module kept a second full copy alive on the heap.
// `source` stays import.meta.url-relative so Vite's static asset analysis bundles
// it for the browser; Node's own read below resolves against the discovered
// project root instead, since neither `process.cwd()` (a workspace-filtered
// script runs elsewhere) nor this module's own bundled URL (Astro's prerender
// moves it into `dist/.prerender/chunks`) reliably sit beside the project root.
// This module is itself part of the browser bundle (reached from every mounted
// object through `application-world-context.mts`), so the Node-only path lookup
// lives in its own module and is reached only through a dynamic import, inside
// the `file:`-only branch: a real browser never takes that branch, but Vite
// still externalizes a *static* `node:` import for the client build and throws
// on first property access, even when the call site itself is unreachable at
// runtime. The dynamic import keeps that module's `node:` imports out of the
// client's static graph; Vite still emits it as a small chunk nothing loads.
// The JSON-attributed import stays here, so the Node read can only yield data.
const source = new URL('../src/objects/sun/prepared/world-context.json', import.meta.url);
/** The same prepared file, for the world planner worker to read its own copy. */
export const APPLICATION_WORLD_CONTEXT_URL = source.href;
async function readPreparedWorldContext(): Promise<unknown> {
  // Node tools, tests and the prerender build read the checked-in file directly.
  if (source.protocol === 'file:') {
    const { nodeProjectFileUrl } = await import('../tools/prepared-world-context-node-source.mts');
    return (await import(/* @vite-ignore */ nodeProjectFileUrl(import.meta.url, 'src/objects/sun/prepared/world-context.json'), { with: { type: 'json' } })).default;
  }
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Prepared world context request failed: ${response.status}.`);
  return response.json();
}
export const APPLICATION_WORLD_CONTEXT = parsePreparedWorldContext(await readPreparedWorldContext());
