import type { APIRoute, GetStaticPaths } from 'astro';
import { SCENE_OBJECTS } from '../../../objects.mts';
import { firstViewTransport } from '../../../first-view-transport.mts';

// The transport a page's first mount reads; see `first-view-transport.mts`.
export const getStaticPaths: GetStaticPaths = async () => SCENE_OBJECTS.map(({ id }) => ({ params: { id } }));

export const GET: APIRoute = async ({ params }) => {
  if (typeof params.id !== 'string' || !SCENE_OBJECTS.some(object => object.id === params.id)) {
    return new Response('Not found', { status: 404 });
  }
  return new Response(await firstViewTransport(params.id), { headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=0, must-revalidate',
  } });
};
