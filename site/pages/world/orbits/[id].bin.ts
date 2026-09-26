import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { APIRoute, GetStaticPaths } from 'astro';
import { APPLICATION_WORLD_CONTEXT } from '../../../world-context-plan.mts';

// One orbit centre's binary path bank, copied from the Sun's prepared world files at build: the planner worker reads a
// centre's bank when a frame first draws its orbits (packages/renderer/src/universe/world-context/world-context-planner-worker.ts).
const centres = Object.keys(APPLICATION_WORLD_CONTEXT.orbitBanks ?? {});
export const getStaticPaths: GetStaticPaths = async () => centres.map(id => ({ params: { id } }));

export const GET: APIRoute = async ({ params }) => {
  if (typeof params.id !== 'string' || !centres.includes(params.id)) return new Response('Not found', { status: 404 });
  // Astro renders from the project root; a relative module URL would point into the bundled build instead.
  const bytes = await readFile(resolve(process.cwd(), `src/objects/sun/prepared/world-orbits/${params.id}.bin`));
  return new Response(new Uint8Array(bytes), { headers: {
    'Content-Type': 'application/octet-stream',
    'Cache-Control': 'public, max-age=0, must-revalidate',
  } });
};
