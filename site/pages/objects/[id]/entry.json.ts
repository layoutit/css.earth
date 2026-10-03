import type { APIRoute, GetStaticPaths } from 'astro';
import { OBJECT_ENTRY_IDS, objectEntry } from '../../../object-entry.mts';
import { resolveSceneAddressesDeep } from '../../../asset-origin.mts';
import { worldPlaceOf } from '../../../world-places.mts';
import { ancestorsOf } from '../../../objects.mts';
import { APPLICATION_WORLD_CONTEXT } from '../../../world-context-plan.mts';
import { hostedBanksOf } from '../../../hosted-banks.mts';

// One navigable object's prepared entry, read by the page's object directory (site/object-directory.mts) the first time
// it needs that object.
export const getStaticPaths: GetStaticPaths = async () => OBJECT_ENTRY_IDS.map(id => ({ params: { id } }));

// The body each world body orbits, read once: the build reads the whole world (world-context-plan.mts).
let centres: ReadonlyMap<string, string> | null = null;
export const GET: APIRoute = async ({ params }) => {
  const found = params.id ? objectEntry(params.id) : null;
  if (!found) return new Response('Not found', { status: 404 });
  // A world body names the files to read for it here (`world`), root first, with its own row when it is a plain-dot star
  // with nothing round it: a page finds a body through the entry it already reads to open it.
  const world = worldPlaceOf(params.id!);
  // The objects it is inside, nearest first, so a page reads their entries together (object-directory.mts `loadAncestors`).
  const ancestors = ancestorsOf(params.id!).map(object => object.id);
  // The banks the world draws only for this object (site/hosted-banks.mts): a page learns them with the object, never in its code.
  centres ??= new Map(APPLICATION_WORLD_CONTEXT.bodies.flatMap(body => body.orbit ? [[body.id, body.orbit.centerBodyId] as const] : []));
  const banks = hostedBanksOf(params.id!, centres.get(params.id!));
  const entry = { ...(found as Record<string, unknown>), ...(ancestors.length ? { ancestors } : {}), ...(world ? { world } : {}), ...(banks.length ? { banks } : {}) };
  // A flight covers its arrival with the entry's photograph, read as written: it carries its published address.
  return new Response(JSON.stringify(await resolveSceneAddressesDeep(entry)), { headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=0, must-revalidate',
  } });
};
