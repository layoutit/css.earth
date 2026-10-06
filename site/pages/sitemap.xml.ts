import { OBJECTS } from "../directory/objects.mts";
import { homeSeo, objectSeo } from "../content/seo.mts";
import { ROOT_OBJECT_ID } from "../model/root-object.mts";

/** The site's own page, `/`, then every page `/<id>/`: each object's. */
export function GET() {
  const root = OBJECTS.find(object => object.id === ROOT_OBJECT_ID);
  const pages = [...(root ? [homeSeo(objectSeo(root))] : []), ...OBJECTS.map(page => objectSeo(page))];
  const urls = pages.map((page) => `  <url><loc>${page.canonical}</loc></url>`).join("\n");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } },
  );
}
