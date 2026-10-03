import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { APIRoute, GetStaticPaths } from 'astro';
import { OBJECT_TREE_ROOT } from '@cssearth/objects';
import { WORLD_DOT_BANKS } from '../../../world-context-plan.mts';

// A dot bank of the world's own (the bake's `plain-stars` banks: the catalogued stars of other galaxies that the map does
// not label or open by click), copied at build from the root object's package. The world draws them once its first view
// is up.
export const getStaticPaths: GetStaticPaths = async () => WORLD_DOT_BANKS.map(id => ({ params: { id } }));

export const GET: APIRoute = async ({ params }) => {
  if (typeof params.id !== 'string' || !WORLD_DOT_BANKS.includes(params.id)) return new Response('Not found', { status: 404 });
  // Astro renders from the project root; a relative module URL would point into the bundled build instead.
  const bytes = await readFile(resolve(process.cwd(), `src/objects/${OBJECT_TREE_ROOT}/prepared/${params.id}.bin`));
  return new Response(new Uint8Array(bytes), { headers: {
    'Content-Type': 'application/octet-stream',
    'Cache-Control': 'public, max-age=0, must-revalidate',
  } });
};
