import type { APIRoute, GetStaticPaths } from 'astro';
import bankAssets from '../../../prepared/prepared-context-bank-assets.json';

// One bank's prepared files by path (prepare-catalog.mts `splitContextObjectAssets`): the world reads a bank's list when a
// body's dataset first shows it (application-world-resources.mts), so no page carries the lists of banks it does not show.
const banks: Record<string, Record<string, string>> = bankAssets;
export const getStaticPaths: GetStaticPaths = () => Object.keys(banks).map(id => ({ params: { id } }));

export const GET: APIRoute = ({ params }) => {
  const files = typeof params.id === 'string' ? banks[params.id] : undefined;
  if (!files) return new Response('Not found', { status: 404 });
  return new Response(JSON.stringify(files) + '\n', { headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=0, must-revalidate',
  } });
};
