import type { APIRoute } from 'astro';
import { PREPARED_CATALOGUE_INDEX_TEXT } from '../../prepared-catalogue-index.mts';

export const prerender = true;

export const GET: APIRoute = () => new Response(PREPARED_CATALOGUE_INDEX_TEXT, {
  headers: { 'content-type': 'application/json; charset=utf-8' },
});
