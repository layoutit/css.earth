import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { APIRoute, GetStaticPaths } from 'astro';
import { resolveWorldBillboards } from '../../../asset-origin.mts';
import { worldHolderFiles } from '../../../world-places.mts';

// One holder's bodies, copied from the Sun's prepared world files at build (each holder's own `src/objects/<holder>/prepared/members.json`: a star's system, `<star>-system`, or the asteroid dot
// bank's object): a page reads
// its own body's, navigation the one it flies to and the camera the one it comes near (site/world-context-plan.mts).
export const getStaticPaths: GetStaticPaths = async () => worldHolderFiles().map(id => ({ params: { id } }));

// Astro renders from the project root; a relative module URL would point into the bundled build instead.
// Each billboard carries its published address (asset-origin.mts).
const read = async (id: string) => resolveWorldBillboards(await readFile(resolve(process.cwd(), `src/objects/${id}/prepared/members.json`), 'utf8'));
const json = (body: string) => new Response(body, { headers: {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=0, must-revalidate',
} });

export const GET: APIRoute = async ({ params }) => {
  const id = typeof params.id === 'string' ? params.id : '';
  if (!worldHolderFiles().includes(id)) return new Response('Not found', { status: 404 });
  return json(await read(id));
};
