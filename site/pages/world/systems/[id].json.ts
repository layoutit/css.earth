import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { APIRoute, GetStaticPaths } from 'astro';
import { resolveWorldBillboards } from '../../../server-assets/asset-origin.mts';
import { worldFiles } from '../../../server/world-places.mts';

// One object's world bodies, copied at build from its own package (`src/objects/<id>/prepared/members.json`: the bodies
// inside it, a system drawn as its host; or the asteroid dot bank's rows): a page reads the files of the objects it is
// inside, navigation those of the body it flies to and the camera a system's as it comes near (site/directory/world-context-plan.mts).
export const getStaticPaths: GetStaticPaths = async () => worldFiles().map(id => ({ params: { id } }));

// Astro renders from the project root; a relative module URL would point into the bundled build instead.
// Each billboard carries its published address (asset-origin.mts).
const read = async (id: string) => resolveWorldBillboards(await readFile(resolve(process.cwd(), `src/objects/${id}/prepared/members.json`), 'utf8'));
const json = (body: string) => new Response(body, { headers: {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=0, must-revalidate',
} });

export const GET: APIRoute = async ({ params }) => {
  const id = typeof params.id === 'string' ? params.id : '';
  if (!worldFiles().includes(id)) return new Response('Not found', { status: 404 });
  return json(await read(id));
};
