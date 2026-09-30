// Entry script: node site/build/prerender-focus-pages.mts (in build:deploy, after bundle-netlify-functions.mts)
/**
 * The page of anything the world draws (a catalogue subject, an overview) is the world host's page with it selected
 * (site/pages/[id].astro). The search function renders that selection (the scene, card and datasets, and a focus's
 * camera; an overview's camera is framed on arrival) into the page for any query URL. This renders it into each such
 * static page once, through the same bundled function, so the page opens on its subject with or without JavaScript.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readPreparedObjects } from '@cssearth/objects/node';

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
const pages = readPreparedObjects(root).objects.filter(object => object.kind !== 'scene').map(object => object.id);
for (const id of pages) {
  const response = await handler(new Request(`${origin}/.netlify/functions/search?object=${encodeURIComponent(id)}`));
  if (!response.ok) throw new Error(`${id}: the search function answered ${response.status} for /${id}/: ${(await response.text()).slice(0, 300)}`);
  await writeFile(resolve(dist, id, 'index.html'), await response.text());
}
console.log(`Rendered ${pages.length} pages of drawn subjects on their subjects.`);
