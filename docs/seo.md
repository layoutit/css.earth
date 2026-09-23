# SEO and sharing

The shared layout emits each object's title, description, canonical URL, and
Open Graph/Twitter metadata in static HTML. Object descriptions come from the
`OBJECTS` registry. `site/seo.mts` owns the production origin and the
shared metadata format.

Object routes such as `/earth/` and `/saturn/` are canonical. The homepage is
an Earth alias and declares `/earth/` as canonical. Query parameters and shared
camera fragments do not change metadata. The sitemap contains one canonical
URL per registered object, and `/robots.txt` advertises it.

Bodies without a committed capture advertise the default Earth capture, so a
share preview never points at a missing file. `node tools/prepare/prepare-social-images.mts --object=<id>`
adds a body's own capture and the page then advertises it.

Social previews are plain screenshots of each actual CSS scene, with the
application controls hidden and the scene centered. They have no added text,
branding, or artwork. The checked-in JPEGs are served directly from
`public/social/`; they add no requests to ordinary page loads.

## Refresh previews

Use prepared assets matching the inventories and real Chrome:

```sh
pnpm setup:assets
pnpm build
node tools/prepare/prepare-social-images.mts                  # all registered objects
# node tools/prepare/prepare-social-images.mts --object=earth # one object
pnpm build                          # include the new images
node --test site/test/seo-discovery.test.mts
```

Inspect the images before committing them. A new object needs its own capture.
The social-image preparer starts and closes a preview on port 4266; pass
`--base-url=http://localhost:4210` to capture an existing server instead.

## Check metadata and deployment

`site/test/seo-discovery.test.mts` checks the reachability algorithm with synthetic
page graphs. It does not crawl a running site. Inspect the built HTML and an
already-running preview for titles, descriptions, canonical URLs, headings,
sitemap coverage and image dimensions. The retired `seo-browser.mts` runner and
its `output/seo/report.json` are not current verification entry points.

After deployment, verify HTTPS and host redirects, canonical URLs, robots and
sitemap responses, and real 404 responses on the chosen host. Submit the sitemap
in Search Console and inspect the homepage and representative object pages.
Indexing and real-user Core Web Vitals require deployed-site evidence.
