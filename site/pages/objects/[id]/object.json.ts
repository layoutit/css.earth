import type { APIRoute, GetStaticPaths } from 'astro';
import { SCENE_OBJECTS } from '../../../objects.mts';
import { readPreparedObjectBytes } from '../../../object-page-data.mts';

export const getStaticPaths: GetStaticPaths = async () => SCENE_OBJECTS.map(({ id }) => ({ params: { id } }));

export const GET: APIRoute = async ({ params }) => {
  if (typeof params.id !== 'string' || !SCENE_OBJECTS.some(object => object.id === params.id)) {
    return new Response('Not found', { status: 404 });
  }
  const { bytes } = await readPreparedObjectBytes(params.id);
  return new Response(new Uint8Array(bytes), { headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=0, must-revalidate',
  } });
};
