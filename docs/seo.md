# SEO and sharing

The shared layout emits each object's title, description, canonical URL, and
Open Graph/Twitter metadata in static HTML. Object descriptions live in the
existing `OBJECTS` registry. `site/seo.mjs` owns the production origin and the
shared metadata format.

Object routes such as `/earth/` and `/saturn/` are canonical. The homepage is
an Earth alias and declares `/earth/` as canonical. Query parameters and shared
camera fragments do not change metadata. The sitemap contains one canonical
URL per registered object, and `/robots.txt` advertises it.

Social previews are plain screenshots of each actual CSS scene, with the
application controls hidden and the scene centered. They have no added text,
branding, or artwork. The checked-in JPEGs are served directly from
`public/social/`; they add no requests to ordinary page loads.

To refresh previews after a scene changes, use the prepared assets matching
the checked-in inventories and real Chrome:

```sh
pnpm setup:assets
pnpm build
pnpm prepare:social                  # all registered objects
# pnpm prepare:social --object=earth # one object
pnpm build                          # include the new images
pnpm test:seo http://localhost:4210 # use the existing server
```

Inspect the images before committing them. A newly registered object needs its
own capture. The SEO check reads the existing server on 4210 (or the supplied
URL) with JavaScript disabled. It checks metadata, headings, homepage reachability,
sitemap coverage, and referenced image dimensions. To inspect production output,
point it at an already-running preview of that build. It never starts another
server. Results are written to `output/seo/report.json`.

After deployment, verify HTTPS and host redirects, canonical URLs, robots and
sitemap responses, and real 404 responses on the chosen host. Submit the sitemap
in Search Console and inspect the homepage and representative object pages.
Indexing and real-user Core Web Vitals require deployed-site evidence.
