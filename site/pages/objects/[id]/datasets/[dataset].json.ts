import type { APIRoute, GetStaticPaths } from 'astro';
import { OBJECTS, SCENE_OBJECTS, PAGES } from '../../../../directory/objects.mts';
import { ROOT_OBJECT_ID } from '../../../../model/root-object.mts';
import { builtScenePaths } from '../../../../server/built-pages.mts';
import { preparedDatasetIds, readPreparedDatasetBytes } from '../../../../server/object-page-data.mts';

// A dataset's tables, which the object transport leaves out and a selection reads when it shows that dataset
// (dataset-tables.ts in @cssearth/objects). Only the scenes a build prerenders read their datasets.
export const getStaticPaths: GetStaticPaths = async () => {
  const scenes = builtScenePaths(SCENE_OBJECTS.map(({ id }) => ({ params: { id } })), PAGES, ROOT_OBJECT_ID);
  return (await Promise.all(scenes.map(async ({ params: { id } }) =>
    (await preparedDatasetIds(id)).map(dataset => ({ params: { id, dataset } }))))).flat();
};

export const GET: APIRoute = async ({ params }) => {
  const { id, dataset } = params;
  if (typeof id !== 'string' || typeof dataset !== 'string' || !SCENE_OBJECTS.some(object => object.id === id) ||
      !(await preparedDatasetIds(id)).includes(dataset)) {
    return new Response('Not found', { status: 404 });
  }
  return new Response(new Uint8Array(await readPreparedDatasetBytes(id, dataset)), { headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=0, must-revalidate',
  } });
};
