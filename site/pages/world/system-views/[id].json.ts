import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { APIRoute, GetStaticPaths } from 'astro';
import { systemViewFile } from '@cssearth/objects';
import { SYSTEM_VIEW_HOSTS } from '../../../world/systems/system-framing.mts';
import { requireObject } from '../../../directory/objects.mts';

// One system's camera candidates, copied at build from the package of the system its host is inside
// (`src/objects/<system>/prepared/views/<host>.json`): navigation fetches the system it frames
// (site/world/systems/world-system-views.mts), so no page downloads every system's.
export const getStaticPaths: GetStaticPaths = async () => [...SYSTEM_VIEW_HOSTS].map(id => ({ params: { id } }));

export const GET: APIRoute = async ({ params }) => {
  if (typeof params.id !== 'string' || !SYSTEM_VIEW_HOSTS.has(params.id)) return new Response('Not found', { status: 404 });
  // Astro renders from the project root; a relative module URL would point into the bundled build instead.
  const owner = requireObject(params.id).parent;
  if (owner === undefined) return new Response('Not found', { status: 404 });
  const bytes = await readFile(resolve(process.cwd(), `src/objects/${owner}/prepared/${systemViewFile(params.id)}`));
  return new Response(new Uint8Array(bytes), { headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=0, must-revalidate',
  } });
};
