import type { APIRoute, GetStaticPaths } from 'astro';
import { OBJECT_ENTRY_IDS, objectEntry } from '../../../object-entry.mts';
import { resolveSceneAddressesDeep } from '../../../asset-origin.mts';
import { worldPlaceOf } from '../../../world-places.mts';
import { ancestorsOf } from '../../../objects.mts';

// One navigable object's prepared entry, read by the page's object directory (site/object-directory.mts) the first time
// it needs that object.
export const getStaticPaths: GetStaticPaths = async () => OBJECT_ENTRY_IDS.map(id => ({ params: { id } }));

export const GET: APIRoute = async ({ params }) => {
  const found = params.id ? objectEntry(params.id) : null;
  if (!found) return new Response('Not found', { status: 404 });
  // A world body names the files to read for it here (`world`), root first, with its own row when it is a plain-dot star
  // with nothing round it: a page finds a body through the entry it already reads to open it.
  const world = worldPlaceOf(params.id!);
  // The objects it is inside, nearest first, so a page reads their entries together (object-directory.mts `loadAncestors`).
  const ancestors = ancestorsOf(params.id!).map(object => object.id);
  const entry = { ...(found as Record<string, unknown>), ...(ancestors.length ? { ancestors } : {}), ...(world ? { world } : {}) };
  // A flight covers its arrival with the entry's photograph, read as written: it carries its published address.
  return new Response(JSON.stringify(await resolveSceneAddressesDeep(entry)), { headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=0, must-revalidate',
  } });
};
