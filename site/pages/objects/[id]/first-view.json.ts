import type { APIRoute, GetStaticPaths } from 'astro';
import { OBJECTS, SCENE_OBJECTS, PAGES } from '../../../objects.mts';
import { ROOT_OBJECT_ID } from '../../../model/root-object.mts';
import { builtScenePaths } from '../../../server/built-pages.mts';
import { firstViewTransport } from '../../../server/first-view-transport.mts';

// The transport a page's first mount reads; see `first-view-transport.mts`.
export const getStaticPaths: GetStaticPaths = async () => builtScenePaths(SCENE_OBJECTS.map(({ id }) => ({ params: { id } })), PAGES, ROOT_OBJECT_ID);

export const GET: APIRoute = async ({ params }) => {
  if (typeof params.id !== 'string' || !SCENE_OBJECTS.some(object => object.id === params.id)) {
    return new Response('Not found', { status: 404 });
  }
  return new Response(await firstViewTransport(params.id), { headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=0, must-revalidate',
  } });
};
