import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { APIRoute, GetStaticPaths } from 'astro';
import { APPLICATION_WORLD_CONTEXT, APPLICATION_WORLD_FILE_OF } from '../../../directory/world-context-plan.mts';

// One body's binary orbit bank, copied at build from the package of the object whose file has the body
// (`src/objects/<object>/prepared/orbits/<body>.bin`): the planner worker reads a bank when a frame first draws its orbit
// (packages/renderer/src/universe/world-context/world-context-planner-worker.ts).
const banks = Object.keys(APPLICATION_WORLD_CONTEXT.orbitBanks ?? {});
export const getStaticPaths: GetStaticPaths = async () => banks.map(id => ({ params: { id } }));

export const GET: APIRoute = async ({ params }) => {
  const holder = typeof params.id === 'string' && banks.includes(params.id) ? APPLICATION_WORLD_FILE_OF.get(params.id) : undefined;
  if (holder === undefined) return new Response('Not found', { status: 404 });
  // Astro renders from the project root; a relative module URL would point into the bundled build instead.
  const bytes = await readFile(resolve(process.cwd(), `src/objects/${holder}/prepared/orbits/${params.id}.bin`));
  return new Response(new Uint8Array(bytes), { headers: {
    'Content-Type': 'application/octet-stream',
    'Cache-Control': 'public, max-age=0, must-revalidate',
  } });
};
