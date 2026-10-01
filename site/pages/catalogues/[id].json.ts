import type { APIRoute } from 'astro';
import { DOT_CATALOGUE_DATA } from '../../dot-catalogue-data.mts';

export function getStaticPaths() { return DOT_CATALOGUE_DATA.map(catalog => ({ params: { id: catalog.id }, props: { text: catalog.text } })); }
export const GET: APIRoute = ({ props }) => {
  if (typeof props.text !== 'string') throw new TypeError('Prepared catalogue text is missing.');
  return new Response(props.text, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
