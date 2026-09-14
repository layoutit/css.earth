import type { APIRoute } from 'astro';
import { FOCUS_CATALOG_DATA } from '../../focus-catalog-data.mts';

export function getStaticPaths() { return FOCUS_CATALOG_DATA.map(catalog => ({ params: { id: catalog.id }, props: { text: catalog.text } })); }
export const GET: APIRoute = ({ props }) => {
  if (typeof props.text !== 'string') throw new TypeError('Prepared catalogue text is missing.');
  return new Response(props.text, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
