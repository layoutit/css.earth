import type { APIRoute, GetStaticPaths } from 'astro';
import { PREPARED_CATALOGUE_INDEX_PIN, PREPARED_CATALOGUE_INDEX_TEXT } from '../../prepared-catalogue-index.mts';

export const prerender = true;

export const getStaticPaths: GetStaticPaths = () => [{
  params: { sha256: PREPARED_CATALOGUE_INDEX_PIN.sha256 },
}];

export const GET: APIRoute = ({ params }) => {
  if (params.sha256 !== PREPARED_CATALOGUE_INDEX_PIN.sha256) return new Response(null, { status: 404 });
  return new Response(PREPARED_CATALOGUE_INDEX_TEXT, {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};
