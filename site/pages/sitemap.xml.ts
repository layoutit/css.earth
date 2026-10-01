import { OBJECTS, OVERVIEWS } from "../objects.mts";
import { objectSeo } from "../seo.mts";

/** Every page, `/<id>/`: each object and each level. */
export function GET() {
  const pages = [...OBJECTS, ...OVERVIEWS].map(page => objectSeo(page));
  const urls = pages.map((page) => `  <url><loc>${page.canonical}</loc></url>`).join("\n");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } },
  );
}
