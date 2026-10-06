import type { APIRoute, GetStaticPaths } from 'astro';
import { OBJECT_ENTRY_IDS, objectEntry } from '../../../server/object-entry.mts';
import { resolveSceneAddressesDeep } from '../../../server-assets/asset-origin.mts';
import { worldPlaceOf } from '../../../server/world-places.mts';
import { OBJECTS, ancestorsOf } from '../../../directory/objects.mts';
import { APPLICATION_WORLD_CONTEXT } from '../../../directory/world-context-plan.mts';
import { hostedBanksOf } from '../../../world/hosted-banks.mts';
import { surroundedBody, surroundingHosts } from '../../../world/surrounded-body.mts';
import bankAssets from '../../../prepared/prepared-context-bank-assets.json' with { type: 'json' };
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// One navigable object's prepared entry, read by the page's object directory (site/directory/object-directory.mts) the first time
// it needs that object.
export const getStaticPaths: GetStaticPaths = async () => OBJECT_ENTRY_IDS.map(id => ({ params: { id } }));

// The body each world body orbits, read once: the build reads the whole world (world-context-plan.mts).
let centres: ReadonlyMap<string, string> | null = null;
// The objects whose picture lies on walls around their middle, read once: each context bank's descriptor says it
// (`properties.surrounds`). The banks are the ones the catalogue prepared; their descriptors are read from the tree, as
// the page data is (object-page-data.mts), because the module that holds them is the browser's.
let surrounding: Promise<ReadonlySet<string>> | null = null;
const readSurrounding = async (root = process.cwd()) => surroundingHosts(Object.fromEntries(await Promise.all(Object.keys(bankAssets).map(async id =>
  [id, JSON.parse(await readFile(resolve(root, 'src/objects', id, 'object.json'), 'utf8')) as unknown] as const))));
export const GET: APIRoute = async ({ params }) => {
  const found = params.id ? objectEntry(params.id) : null;
  if (!found) return new Response('Not found', { status: 404 });
  // A world body names the files to read for it here (`world`), root first, with its own row when it is a plain-dot star
  // with nothing round it: a page finds a body through the entry it already reads to open it.
  const world = worldPlaceOf(params.id!);
  // The objects it is inside, nearest first: a page reads from this list which ones it needs (object-directory.mts
  // `ancestorIds`, `loadHolder`), and reads a zoom centre's together (`loadAncestors`).
  const ancestors = ancestorsOf(params.id!).map(object => object.id);
  // The banks the world draws only for this object (site/world/hosted-banks.mts): a page learns them with the object, never in its code.
  centres ??= new Map(APPLICATION_WORLD_CONTEXT.bodies.flatMap(body => body.orbit ? [[body.id, body.orbit.centerBodyId] as const] : []));
  const banks = hostedBanksOf(params.id!, centres.get(params.id!));
  // The body its walls surround, when its picture lies on walls: a zoom in on it leads to that body (object-directory.mts `loadInner`).
  const inner = surroundedBody(OBJECTS, await (surrounding ??= readSurrounding()), params.id!);
  const entry = { ...(found as Record<string, unknown>), ...(ancestors.length ? { ancestors } : {}), ...(inner ? { inner } : {}), ...(world ? { world } : {}), ...(banks.length ? { banks } : {}) };
  // A flight covers its arrival with the entry's photograph, read as written: it carries its published address.
  return new Response(JSON.stringify(await resolveSceneAddressesDeep(entry)), { headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=0, must-revalidate',
  } });
};
