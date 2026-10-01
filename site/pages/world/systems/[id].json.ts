import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { APIRoute, GetStaticPaths } from 'astro';
import { WORLD_SYSTEM_BATCH_COUNT, WORLD_SYSTEM_HOSTS, worldSystemBatch } from '../../../world-context-plan.mts';

// One system's bodies, copied from the Sun's prepared world files at build (`world-systems/<star id>.json`): a page reads its
// own and navigation the one it flies to (site/world-context-plan.mts). `batch-<n>` lists a few hundred of them, in id
// order, so the systems a page does not show arrive in a few requests after its first view.
const batches = Array.from({ length: WORLD_SYSTEM_BATCH_COUNT }, (_, index) => `batch-${index}`);
export const getStaticPaths: GetStaticPaths = async () => [...WORLD_SYSTEM_HOSTS, ...batches].map(id => ({ params: { id } }));

// Astro renders from the project root; a relative module URL would point into the bundled build instead.
const read = (id: string) => readFile(resolve(process.cwd(), `src/objects/sun/prepared/world-systems/${id}.json`), 'utf8');
const json = (body: string) => new Response(body, { headers: {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=0, must-revalidate',
} });

export const GET: APIRoute = async ({ params }) => {
  const id = typeof params.id === 'string' ? params.id : '';
  const batch = batches.indexOf(id);
  if (batch >= 0) return json(`[${(await Promise.all(worldSystemBatch(batch).map(async host => (await read(host)).trim()))).join(',')}]\n`);
  if (!WORLD_SYSTEM_HOSTS.includes(id)) return new Response('Not found', { status: 404 });
  return json(await read(id));
};
