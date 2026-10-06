import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { APIRoute, GetStaticPaths } from 'astro';
import { worldPlaceFiles } from '../../../server/world-places.mts';

// One object's places, copied at build from its own package (`src/objects/<id>/prepared/places.json`): where each of its
// children's systems is and the range its orbits are authored to, read after a page's first view so the camera reads a
// system's file when it comes near (site/world/world-approach.mts).
export const getStaticPaths: GetStaticPaths = async () => worldPlaceFiles().map(id => ({ params: { id } }));

export const GET: APIRoute = async ({ params }) => {
  const id = typeof params.id === 'string' ? params.id : '';
  if (!worldPlaceFiles().includes(id)) return new Response('Not found', { status: 404 });
  // Astro renders from the project root; a relative module URL would point into the bundled build instead.
  return new Response(await readFile(resolve(process.cwd(), `src/objects/${id}/prepared/places.json`), 'utf8'), { headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=0, must-revalidate',
  } });
};
