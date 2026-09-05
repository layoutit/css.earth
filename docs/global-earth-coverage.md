# Global Earth coverage and Buenos Aires noise

Earth can search 34,135 GeoNames cities and fly to their prepared camera poses. Geographic coverage comes from the WorldCover source inventory, independently of the search catalogue. The Buenos Aires noise lens overlays the city's published 2025 daytime estimates.

## Delivery and limits

| Content | Delivery | Bound |
| --- | --- | --- |
| Globe, lenses and shell | Prepared local application assets | One mounted object |
| City names and camera destinations | Lazy local catalogue | 34,135 cities; eight retained result rows |
| WorldCover imagery | Unchanged 256-pixel PNGs from Terrascope WMTS | Four concurrent image loads |
| Geographic placement | Immutable compressed geometry ranges | Three concurrent requests; 96 resident sections; 12 MiB decoded transport data |
| Visible detail and replacement | Fixed retained CSS image pool | 512 slots; 128 MiB RGBA-equivalent reservation |
| Buenos Aires noise | 16 prepared transparent WebP tiles | 32 retained slots; source colours and legend |

The memory limits describe the application's pools and decoded transport data. They do not measure Chrome's full process or GPU memory. The noise overlay reuses the normal surface image bank. It does not decode another copy of the globe textures.

When a wide view needs more image pieces than the fixed pool can hold, it shows the existing Blue Marble surface. Detail resumes as the camera moves closer. Tile groups stay complete and the pool does not grow during flights.

The source listing extends from 60° south to 83° north and includes water and nodata. It is a footprint inventory, not a land mask or a guarantee of valid pixels everywhere. Blue Marble remains behind the available detail. Terrascope's availability and production traffic terms remain external dependencies; unlimited free traffic is unproven.

## Prepared release

`src/planets/earth/source/city/wmts-release.json` pins version `fef1519d5f243617`:

- 94,072,860 tile addresses at levels 5–14, in 19,174 regional packs and 458 coarse packs.
- 106,963,238 prepared image pieces and 25,344,236,995 compressed geometry bytes.
- Exact range responses, compressed and decoded sizes, and SHA-256 hashes checked before publication.
- No imagery downloaded during the global geometry preparation.

PR #2's affine base raster pages and this feature's geographic frames coexist. All 450 geographic frames remained byte-identical across the integration. The migration rechecked every pack hash without building a second full copy of the world. Its proof is pinned in `src/planets/earth/source/city/geographic-rebind.json`.

The regular globe now uses PR #2's seven bounded surface pages. Topography and night lights retain their 8× zoom limit. Normal imagery and the noise lens support the prepared city-detail range. The accepted city flight keeps its 4.5-second pose interpolation; wheel, pointer, Escape and document hiding cancel it, and reduced motion jumps to the destination.

## Reproduction and checks

Run these from the feature checkout:

```sh
pnpm acquire:planets -- --verify-only
pnpm test
pnpm build
pnpm test:browser http://127.0.0.1:4298
pnpm test:earth-global
node src/planets/earth/test/wmts-tree-browser.mjs --global --sample=buenos-aires --noise --mobile
node src/planets/earth/test/city-lens-walkthrough.mjs http://127.0.0.1:4298
node src/planets/earth/test/noise-destination-browser.mjs http://127.0.0.1:4298
```

The shared browser suite needs a development server from this checkout at the supplied URL. The global browser harness starts its own server and exercises the normal app delivery path. It requires the matching local geometry release. Browser harnesses should run sequentially.

`pnpm prepare:earth-global` reproduces the world, resumes verified regions, and reserves 8 GiB of disk headroom. Allow approximately 25.4 GB for the release, in addition to sources and preparation space. A changed geometry recipe creates a new version, so account for both versions before rebuilding. The completed-version pointer is published only after refinement and full hash verification.

## Deployment boundary

The global packs live outside `public` and `dist`. Development and preview read exact ranges from `.local/wmts-global/<version>/`. Production points to `https://earth-assets.lowpoly.cc/scenes/earth/wmts-<version>/`.

The new global release has not been uploaded. Before deployment:

1. Upload the pinned 19,632 pack files to that immutable prefix; check uploaded sizes and hashes against the release inventory.
2. Allow the application origin and GET/HEAD through R2 CORS; allow the `Range` header and expose `Content-Range`, `Content-Length`, `Accept-Ranges` and `ETag`. The older city-image CORS file does not provide this complete range contract.
3. Configure caching for `.pack` objects and verify real 206 responses, visible CORS headers and cache behaviour through the public custom domain.
4. Run the city walkthrough and range checks against production before calling the deployment ready.

The legacy `publish:earth-city` command publishes the earlier city-image experiment; it does not publish this global WMTS geometry release. Provider imagery is loaded directly and is not reuploaded.

## Visual evidence

![Complete publisher footprint coverage](images/global-earth-coverage.png)

![Buenos Aires noise after integrating PR 2](images/global-earth-buenos-aires-noise.png)

The integration recording follows the actual UI: Earth → search Buenos Aires → fly → noise lens → closer zoom. The global Chrome check covers Buenos Aires, Helsinki, Svalbard, the antimeridian, a face seam, Tokyo and a return visit, at DPR 1 and DPR 2. It verifies retained node identity, bounded residency and the exact same canonical data selection at both densities.

Local recording, screenshots and detailed reports are kept under `output/earth-city/global-completion/` and `output/playwright/`. They are excluded from Git. Desktop Chrome and mobile viewport emulation are evidence for those environments; physical mobile devices and production delivery remain unproven.
