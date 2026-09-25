import type { APIRoute, GetStaticPaths } from 'astro';
import { SCENE_OBJECTS } from '../../../../objects.mts';
import { assetHashSplit, assetOrigin } from '../../../../asset-origin.mts';
import { preparedAssetGroupFile } from '../../../../../src/renderers/css/dist/index.js';

// The hashes a page does not embed, one file per resource group (`assetHashSplit`). Only a build that publishes to an
// asset origin writes them; without one every address stays same-origin and needs no hash.
export const getStaticPaths: GetStaticPaths = async () => {
  if (!assetOrigin()) return [];
  const paths = [];
  for (const { id } of SCENE_OBJECTS) for (const [group, hashes] of (await assetHashSplit(id)).groups)
    paths.push({ params: { id, group: preparedAssetGroupFile(group).replace(/\.json$/u, '') }, props: { hashes } });
  return paths;
};

export const GET: APIRoute = ({ props }) => new Response(JSON.stringify(props.hashes), { headers: {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=0, must-revalidate',
} });
