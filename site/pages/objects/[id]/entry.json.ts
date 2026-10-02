import type { APIRoute, GetStaticPaths } from 'astro';
import { OBJECT_ENTRY_IDS, objectEntry } from '../../../object-entry.mts';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { resolveSceneAddressesDeep } from '../../../asset-origin.mts';

// One navigable object's prepared entry, read by the page's object directory (site/object-directory.mts) the first time
// it needs that object.
export const getStaticPaths: GetStaticPaths = async () => OBJECT_ENTRY_IDS.map(id => ({ params: { id } }));

// The plain-dot stars nothing orbits, each as a world system of one body (the bake's `world-stars.json`): the world
// summary only lists them, and a page reads a star's row here, from the entry it already reads to open the star.
let stars: Promise<Record<string, unknown>> | null = null;
const worldStars = () => stars ??= readFile(resolve(process.cwd(), 'src/objects/sun/prepared/world-stars.json'), 'utf8')
  .then(text => JSON.parse(text) as Record<string, unknown>);

export const GET: APIRoute = async ({ params }) => {
  const found = params.id ? objectEntry(params.id) : null;
  if (!found) return new Response('Not found', { status: 404 });
  const worldSystem = (await worldStars())[params.id!];
  const entry = worldSystem === undefined ? found : { ...(found as Record<string, unknown>), worldSystem };
  // A flight covers its arrival with the entry's photograph, read as written: it carries its published address.
  return new Response(JSON.stringify(await resolveSceneAddressesDeep(entry)), { headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=0, must-revalidate',
  } });
};
