import { SCENE_OBJECTS } from "../objects.mts";
import { objectSeo } from "../seo.mts";

export function GET() {
  const urls = SCENE_OBJECTS.map((object) =>
    `  <url><loc>${objectSeo(object).canonical}</loc></url>`).join("\n");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } },
  );
}
