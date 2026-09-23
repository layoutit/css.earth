import type { APIRoute } from 'astro';
import { atlasTree, readObjects } from '../../../atlas/src/objects.mts';
import { navigationTreeArtifact } from '../../../atlas/src/navigation-tree-data.mts';
import { applicationTreeDestination } from '../../navigation/navigation-tree-destination.mts';

// The application's own tree, so the pin the shell renders addresses this file.
const artifact = navigationTreeArtifact(atlasTree(readObjects(), applicationTreeDestination));

export function getStaticPaths() {
  return [{ params: { sha256: artifact.sha256 }, props: { text: artifact.text } }];
}

export const GET: APIRoute = ({ params, props }) => {
  if (params.sha256 !== artifact.sha256 || props.text !== artifact.text) return new Response('Not found', { status: 404 });
  return new Response(artifact.text, { headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=31536000, immutable',
  } });
};
