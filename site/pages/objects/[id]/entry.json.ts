import type { APIRoute, GetStaticPaths } from 'astro';
import { OBJECT_ENTRY_IDS, objectEntry } from '../../../object-entry.mts';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { resolveSceneAddressesDeep } from '../../../asset-origin.mts';
import { parsePreparedWorldContextSummary, starsWithoutSystem } from '@cssearth/objects';
import worldSummary from '../../../../src/objects/sun/prepared/world-context-summary.json';

// One navigable object's prepared entry, read by the page's object directory (site/object-directory.mts) the first time
// it needs that object.
export const getStaticPaths: GetStaticPaths = async () => OBJECT_ENTRY_IDS.map(id => ({ params: { id } }));

// The plain-dot stars nothing orbits, each as a world system of one body (the bake's `world-stars.json`): the world
// summary only lists them, and a page reads a star's row here, from the entry it already reads to open the star.
// Read only for the stars the summary says hold their own row, and asked for again after a failed read.
const rowless = new Set(starsWithoutSystem(parsePreparedWorldContextSummary(worldSummary).deferred));
let stars: Promise<Record<string, unknown>> | null = null;
const worldStars = () => {
  const reading = stars ??= readFile(resolve(process.cwd(), 'src/objects/sun/prepared/world-stars.json'), 'utf8').then(text => JSON.parse(text) as Record<string, unknown>);
  reading.catch(() => { if (stars === reading) stars = null; });
  return reading;
};

export const GET: APIRoute = async ({ params }) => {
  const found = params.id ? objectEntry(params.id) : null;
  if (!found) return new Response('Not found', { status: 404 });
  const worldSystem = rowless.has(params.id!) ? (await worldStars())[params.id!] : undefined;
  if (rowless.has(params.id!) && worldSystem === undefined) throw new TypeError(`src/objects/sun/prepared/world-stars.json holds no row for ${params.id}, which the world summary leaves to its object entry. Run pnpm prepare:world-context.`);
  const entry = worldSystem === undefined ? found : { ...(found as Record<string, unknown>), worldSystem };
  // A flight covers its arrival with the entry's photograph, read as written: it carries its published address.
  return new Response(JSON.stringify(await resolveSceneAddressesDeep(entry)), { headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=0, must-revalidate',
  } });
};
