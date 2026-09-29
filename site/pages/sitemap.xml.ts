import { OBJECTS } from "../objects.mts";
import { focusSeo, objectSeo } from "../seo.mts";

/** Every page, `/<id>/`: each scene, each catalogue subject and each overview. */
export function GET() {
  const pages = OBJECTS.map(object => object.kind === "prepared-focus" ? focusSeo(object) : objectSeo(object));
  const urls = pages.map((page) => `  <url><loc>${page.canonical}</loc></url>`).join("\n");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } },
  );
}
