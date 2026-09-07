import { SITE_ORIGIN } from "../seo.mjs";

export function GET() {
  return new Response(
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`,
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
}
