import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { APIRoute, GetStaticPaths } from 'astro';
import { WORLD_DOT_BANKS } from '../../../directory/world-context-plan.mts';

// The dots of the plain stars inside one object (the bake's `plain-stars` bank: the catalogued stars of another galaxy
// that the map does not label or open by click), copied at build from that object's package. The world draws them while
// that object or a body inside it is selected.
export const getStaticPaths: GetStaticPaths = async () => WORLD_DOT_BANKS.map(id => ({ params: { id } }));

export const GET: APIRoute = async ({ params }) => {
  if (typeof params.id !== 'string' || !WORLD_DOT_BANKS.includes(params.id)) return new Response('Not found', { status: 404 });
  // Astro renders from the project root; a relative module URL would point into the bundled build instead.
  const bytes = await readFile(resolve(process.cwd(), `src/objects/${params.id}/prepared/plain-stars.bin`));
  return new Response(new Uint8Array(bytes), { headers: {
    'Content-Type': 'application/octet-stream',
    'Cache-Control': 'public, max-age=0, must-revalidate',
  } });
};
