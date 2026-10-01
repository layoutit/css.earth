import type { APIRoute, GetStaticPaths } from 'astro';
import { OBJECT_ENTRY_IDS, objectEntry } from '../../../object-entry.mts';
import { resolveSceneAddressesDeep } from '../../../asset-origin.mts';

// One navigable object's prepared entry, read by the page's object directory (site/object-directory.mts) the first time
// it needs that object.
export const getStaticPaths: GetStaticPaths = async () => OBJECT_ENTRY_IDS.map(id => ({ params: { id } }));

export const GET: APIRoute = async ({ params }) => {
  const entry = params.id ? objectEntry(params.id) : null;
  if (!entry) return new Response('Not found', { status: 404 });
  // A flight covers its arrival with the entry's photograph, read as written: it carries its published address.
  return new Response(JSON.stringify(await resolveSceneAddressesDeep(entry)), { headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=0, must-revalidate',
  } });
};
