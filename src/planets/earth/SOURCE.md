# Earth source record

Earth is prepared from checked, adapter-owned source snapshots. Runtime reads prepared local assets and generated Earth modules. City detail transports prepared geometry and loads the corresponding PNG tiles directly from Terrascope WMTS; it does not derive geographic geometry or resample source pixels in the browser.

## Surface and observation layers

- Normal colour: NASA Earth Observatory, Blue Marble Next Generation, December 2004. The checked 21,600 × 10,800 JPEG is `source/blue-marble-december.jpg`.
- Topography: NASA Earth Observatory, Blue Marble topography and bathymetry, December 2004. The checked 21,600 × 10,800 JPEG is `source/blue-marble-topography.jpg`.
- Clouds: NASA Visible Earth, Blue Marble Clouds. The checked 8,192 × 4,096 TIFF is `source/blue-marble-clouds.tif`.
- Night lights: NASA Earth Observatory, Black Marble 2016. The checked global 3 km, 13,500 × 6,750 JPEG is `source/black-marble-2016.jpg`.
- Navigation marker: NASA image-library Earth globe `GSFC_20171208_Archive_e001016`, checked as `source/earth-navigation.jpg`.

The OpenSpace Earth asset configuration at commit `56e29b54b8592084ff1fef47c2e08de0b22ce516` is checked beside the image sources. It proves the upstream Earth interpretation; the Earth adapter does not fetch OpenSpace assets at runtime.

## Prepared visual atmosphere

`source/openspace/earth-atmosphere.asset` is also the numerical authority for
the visible atmosphere. Preparation parses its 6,377 km planet radius, 70 km
atmosphere height, 680/550/440 nm Rayleigh scattering coefficients, 8 km
Rayleigh scale height, and Mie coefficients, scale height, and anisotropy.
Those values produce the static view bank and its exact outer-radius ratio.
Google Earth Pro supplies only the presentation operator layered over those
Earth facts: a captured Sun-direction uniform, 0.2 camera exposure,
exponential tone mapping, and luminance-driven opacity. Earth irradiance,
twilight width, limb concentration, colour, and density remain body-specific
and are derived from the OpenSpace atmosphere values. The checked
`source/atmosphere/google-earth-pro-presentation-response.json` records the
linked-shader hashes and successful headless layer-isolation gates. It does not
redistribute Google pixels or shader bytes. Google Earth Pro's blue Mars result
is deliberately not treated as a body-colour authority.
The browser mounts the canonical prepared DPR 2 bank, independent of device
DPR; it performs no scattering, geometry, or raster work at runtime.

The normal, topography and night-light lenses each use seven bounded affine surface pages plus a pole atlas, selected once independently of DPR. Preparation folds the projective texture warp into those raster pages. The noise lens reuses the normal surface bank and adds its own retained transparent pages. The city geometry keeps a separate prepared geographic frame for each accepted Earth face; all 450 frames remained byte-identical during the PR #2 integration. `source/city/geographic-rebind.json` records the migration and full pack-hash verification.

Atmosphere and lighting assets retain their existing prepared pairs. Runtime
addresses their canonical high-density assets. Earth lighting and
atmosphere motion use 32 prepared four-frame shards for each density. Every
shard is a 2 by 2 square: 1,016 by 1,016 at logical density and 2,032 by 2,032
for the canonical high-density asset. Runtime retains at most three decoded
shards per material. Camera and material projection transforms are prepared
keyframes transported through paused Web Animations; runtime changes only
animation time, image addresses, and the camera scale.

The cross-section remains a source-backed schematic, not a claim about a
physically tilted interior. At near-pole-on camera angles, one prepared
presentation-only orbit reveals the section faces without changing Earth's
23.4 degree axial-tilt fact. The cutaway is decoded and mounted only after the
user selects it, then retained for the remainder of the mount.

## Atmosphere charts

`source/atmosphere/psg-earth-20260830.cfg` is the expanded NASA GSFC Planetary Spectrum Generator configuration for Earth at 2026-08-30 12:00, followed by the declared 0.35–1.0 µm, R=120, I/F generator block. PSG prepends a human-readable MERRA retrieval warning to this Earth response. That warning is not a PSG configuration record and makes a subsequent radiance request return an empty body. Earth acquisition removes exactly that leading warning line before pinning and resubmitting the configuration. The complete numerical atmosphere remains unchanged.

`source/atmosphere/psg-earth-r120-rif.txt` is the checked PSG radiance response. Its full numerical output is unchanged. Only the synthesis-clock and execution-time comment lines are normalized so the same pinned response can be restored deterministically. Preparation converts the complete sample set and the configuration's ordered pressure/temperature layers to static SVG charts.

## Moon facts and star presentation

The checked JPL Solar System Dynamics physical-parameter and mean-element pages provide the Moon's radius, density, mean orbital distance, inclination, period, and Earth GM. `source/moon/earth-moon.json` is a generated normalization that records those values and both authority hashes.

The Moon is a separate object package and route. Earth keeps only the checked
relationship facts used by its information panel; the Earth scene does not
prepare, mount, animate, toggle, or request a Moon representation.

The starfield is a presentation layer prepared from HYG Database v4.1 at commit `c7f7f883fe678cc7680169a50ccd7dcc49b060ce`. It is not a view tied to the Earth observation epoch. Preparation deterministically selects the brightest finite entries and rasterizes them to a static background.

## Editorial and interior

`data/planets/earth.json` is prepared from NASA Science record 48583, `Facts About Earth`. NASA's block-feed endpoint currently fails server-side for this record. Earth acquisition therefore validates the canonical WordPress record and parses the same selected headings from its checked `content.rendered` field. The shared editorial tool and contract are unchanged.

`source/interior/earth-interior.json` is an adapter-owned presentation specification based on the layer radii and descriptions in the checked NASA Science editorial snapshot. It is explicitly schematic; it is not a seismic tomography product.

## Typography

The Earth heading outline is extracted at preparation time from Inter Variable 4.001, commit `9221beed3`, weight 500, optical size 28. The checked font and exact outline source are declared in the source manifest. Runtime does not load a planet-specific font.

## Reproduction

Run:

```sh
node src/planets/earth/tools/acquire.mjs
node src/planets/earth/tools/prepare.mjs
node src/planets/earth/tools/acquire.mjs --verify-only
```

`--refresh` is explicit and fail-closed: every refreshed authority must match the committed byte size and SHA-256 before publication.

## Global city-detail delivery

The normal lens loads the official [ESA WorldCover 2021 RGB composite through Terrascope WMTS](https://docs.terrascope.be/Developers/WebServices/OGC/MapProxy.html). The browser places each unchanged 256-pixel PNG using prepared CSS matrices and rectangular texture crops. It does not download COG files or resample imagery. The imagery remains subject to the provider's availability and [terms](https://terrascope.be/en/terms-use); unlimited free production traffic is not established.

`source/city/worldcover-rgbnir-2021.json.gz` is the pinned publisher listing observed on 2026-09-04: 19,359 source objects, with latitude extent 60 degrees south to 83 degrees north. It describes source footprints, including water and nodata, rather than a land mask or pixel-validity guarantee. It does not supply Antarctica or the far northern gap. Blue Marble remains the fallback outside available imagery.

`source/city/wmts-release.json` pins release `fef1519d5f243617`: 94,072,860 WMTS tile addresses at levels 5–14, 106,963,238 prepared image pieces, and 25,344,236,995 compressed geometry bytes across 19,632 packs. The global root has 458 stubs. Coarse packs cover levels 5–7; regional packs contain separately compressed ranges for levels 8–10 and 11–14. Runtime requests only visible prepared branches. Encoded and decoded lengths and SHA-256 hashes are verified before records become resident.

Geometry is prepared against the accepted Earth face planes. Regular-face seams, Mercator subdivisions, cap mapping and the visible square-cap apron are prepared offline. The polar projection test independently samples the prepared transforms back into provider pixel coordinates. A source image may have several placement pieces; each tile's pieces form one replacement group. No runtime geometry generation, source raster processing, DPR-specific dataset selection, or scene renderer substitution is used.

The retained imagery pool has 512 fixed slots: at most 256 for the new view and 256 for replacement. Its RGBA-equivalent reservation limit is 128 MiB. Metadata is bounded to 96 compressed sections and 12 MiB of decoded transport data, with three simultaneous metadata requests and four image loads. These limits are not a claim about the browser's total process or GPU memory. Loading a section that proves an empty view retains that proof while its conservative bounds remain visible, preventing repeated eviction and reload.

The global geometry is outside `public` and `dist`. Local development and preview serve exact byte ranges from `.local/wmts-global/<version>/`. The production plan points to `https://earth-assets.lowpoly.cc/scenes/earth/wmts-<version>/`. Publishing those packs, exposing `Content-Range` through CORS, and verifying CDN cache behavior are separate deployment work. The current local completion evidence does not claim that global packs have been deployed.

Reproduce with `pnpm prepare:earth-global`. It uses four workers by default, resumes hash-verified regions, and reserves 8 GiB of free disk space. A full preparation needs roughly 25.4 GB for the final geometry, plus ordinary source assets and preparation headroom. The completed-version pointer is written only after refinement and full pack-hash verification; integration consumes that pointer. Do not start another full version on a space-constrained machine without accounting for both versions.

`pnpm test:earth-global` exercises the real app delivery path in Google Chrome at DPR 1 and 2, across Buenos Aires, Helsinki, Svalbard, the antimeridian, a coarse-face seam and Tokyo, then revisits the first view. It checks bounded residency, exact range responses, source image loading and retained DOM identity. Phone emulation is available with `--mobile`; it is not physical-device evidence. Provider nodata and coarse fallback patches remain visible in some coastal and polar views.

The earlier resampled-COG experiments remain reproducible from `source/city/manifest.json`, their pinned source windows and the legacy preparation/publishing tools. Their local fixtures and published receipts are tested separately. They do not define the current normal-lens dataset, and their older deployment commands do not publish the new global packs.

## Buenos Aires daytime noise lens

The optional lens uses [Buenos Aires APrA's 2025 daytime noise estimates](https://data.buenosaires.gob.ar/dataset/mapa-ruido), licensed under [CC BY 2.5 Argentina](https://creativecommons.org/licenses/by/2.5/ar/). This is an annual estimated noise map, not live sensor readings. The original CRS84 GeoJSON is pinned as `source/noise/buenos-aires-day-2025.geojson.gz`; its source URL, compressed and decoded SHA-256 hashes, year, units and license are recorded beside it.

`tools/prepare-noise-lens.mjs` rasterizes the 181 source features offline, preserving the official 30–95 dBA color bins. Sixteen lossless transparent WebP tiles total 3,659,288 bytes. Their prepared CSS transforms align them with the same accepted Earth face as the base imagery. Uncolored locations have no estimate. The lens has a fixed 32-slot retained pool, 16 tiles at most, a prepared Buenos Aires camera destination and a visible source legend. Independent point-in-polygon tests compare geographic source samples with the prepared raster colors.

## City selection

Earth supplies an optional destination capability to the shared shell. The shell
owns the search input, eight retained result buttons, selected-place panel,
keyboard controls and return action. Selecting a place keeps the same Earth
scene mounted and switches to its normal lens with motion paused.

`source/places/` holds a checked-in GeoNames cities15000 snapshot and its country,
region and license records, acquired September 4, 2026. The snapshot contains
34,135 populated-place records. Its scope is cities above 15,000 people or
capitals; it is not every settlement. GeoNames data is CC BY 4.0 and receives
visible attribution in the shell.

`tools/prepare-places.mjs` verifies source hashes, normalizes names and aliases,
and prepares camera controls against the accepted Earth face projection. It
writes `earth-places.json` and a hash/size descriptor. Runtime fetches this local
catalogue only when city search is used, verifies its identity, searches prepared
labels, and transports the selected camera controls. No geocoder or geometry
derivation runs in the browser. The existing camera rounds control angles to
hundredths of a degree; this is city navigation, not a precision survey marker.

Place coverage and imagery coverage are distinct. Locations within the pinned WorldCover source footprints open at 1024x; other locations open an overview and report that detail is unavailable. City search does not control which geographic regions are prepared. The accepted animated fly-to is preserved, and surface lenses remain available after selecting a destination. Prepared footprint coverage does not certify every source pixel.
Validation: `node --test src/planets/earth/test/places.test.mjs` and
`node src/planets/earth/test/places-browser.mjs http://127.0.0.1:4228`.
The browser check uses real Google Chrome at DPR 1 and 2 plus phone-size
emulation. It exercises search, keyboard selection, camera centering, imagery
loading, globe return, globally available destinations and retained scene identity. Phone
emulation is not physical-device proof. Reports and actual screenshots are in
`output/playwright/city-selection/`.
