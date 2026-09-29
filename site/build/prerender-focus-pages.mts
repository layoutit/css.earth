// Entry script: node site/build/prerender-focus-pages.mts (in build:deploy, after bundle-netlify-functions.mts)
/**
 * A catalogue focus's page is its host scene's page with the focus selected (site/pages/[id].astro). The search function
 * renders that selection (card, lenses and camera) into the page for any query URL. This renders it into each focus's
 * static page once, through the same bundled function, so the page opens on its subject with or without JavaScript.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import focuses from '../prepared-focus-objects.json' with { type: 'json' };

const root = resolve(import.meta.dirname, '../..'), dist = resolve(root, 'dist');
const origin = 'https://prerender.invalid';
const types: Readonly<Record<string, string>> = { '.html': 'text/html; charset=utf-8', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.bin': 'application/octet-stream' };
// The function reads the pages and prepared files it renders from over HTTP; here they are the build's own output. Files at
// the asset origin, when the build names one, are fetched from it as the deployed function would.
const network = globalThis.fetch;
globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.origin !== origin) return network(input, init);
  const path = resolve(dist, `.${decodeURIComponent(url.pathname)}${url.pathname.endsWith('/') ? 'index.html' : ''}`);
  if (!path.startsWith(dist + sep)) return new Response(`${url.pathname} is outside the build.`, { status: 404 });
  try { return new Response(await readFile(path), { headers: { 'content-type': types[extname(path)] ?? 'application/octet-stream' } }); }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return new Response(`${url.pathname} was not built.`, { status: 404 });
    throw error;
  }
};
const loaded: unknown = await import(pathToFileURL(resolve(root, 'netlify/functions-bundled/search.mjs')).href);
if (typeof loaded !== 'object' || loaded === null || !('default' in loaded) || typeof loaded.default !== 'function') {
  throw new Error('netlify/functions-bundled/search.mjs has no default export handler; run site/build/bundle-netlify-functions.mts first.');
}
const handler = loaded.default as (request: Request) => Promise<Response>;
for (const focus of focuses) {
  const response = await handler(new Request(`${origin}/.netlify/functions/search?object=${encodeURIComponent(focus.id)}`));
  if (!response.ok) throw new Error(`${focus.id}: the search function answered ${response.status} for ${focus.route}: ${(await response.text()).slice(0, 300)}`);
  await writeFile(resolve(dist, focus.id, 'index.html'), await response.text());
}
console.log(`Rendered ${focuses.length} catalogue focus pages on their subjects.`);
