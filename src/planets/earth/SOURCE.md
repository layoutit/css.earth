# Earth source record

Earth is prepared from checked, adapter-owned source snapshots. Runtime reads prepared local assets and generated Earth modules. City detail transports prepared geometry and loads the corresponding PNG tiles directly from Terrascope WMTS; it does not derive geographic geometry or resample source pixels in the browser.

## Surface and observation layers

- Normal colour: NASA Earth Observatory, Blue Marble Next Generation, July 2004. The pinned 21,600 × 10,800 cloud-free JPEG is `source/blue-marble-july.jpg`; December remains an archival comparison input.
- Elevation: GEBCO_2026 numeric land/ice-surface and seafloor height model. See the GEBCO preparation record below; the former Blue Marble shaded-color topography image is retired.
- Clouds: NASA Visible Earth, Blue Marble Clouds. The checked 8,192 × 4,096 TIFF is `source/blue-marble-clouds.tif`.
- Night lights: NASA Black Marble VJ146A4 Collection 2, 2025 annual snow-free radiance. The public GeoTIFF mosaic by Jurij Stare is pinned in `source/science/night-lights-2025/radiance.zip`; see the interpretation below. The 2016 JPEG is retained only as an archival comparison input.
- Navigation marker: NASA image-library Earth globe `GSFC_20171208_Archive_e001016`, checked as `source/earth-navigation.jpg`.

The OpenSpace Earth asset configuration at commit `56e29b54b8592084ff1fef47c2e08de0b22ce516` is checked beside the image sources. It proves the upstream Earth interpretation; the Earth adapter does not fetch OpenSpace assets at runtime.

The July mosaic uses a display-only midtone lift before atlas rasterization:
each RGB code value becomes `round(255 * (value / 255) ** (1 / 1.25))`.
Black and white endpoints are unchanged. This is a presentation adjustment,
not radiometric calibration or recovered albedo. The same adjusted base feeds
the clear surface, cloud composite, cutaway exterior, thumbnails and minimaps;
the original source JPEG remains unchanged. Scientific dataset palettes and
the prepared lighting/atmosphere banks are unaffected. Dataset selection is
manual and remains selected while zooming.

## Annual night lights

The [NASA VJ146A4.002 product](https://doi.org/10.5067/VIIRS/VJ146A4.002)
contains NOAA-20 VIIRS yearly, moonlight- and atmosphere-corrected radiance.
The [public mirror](https://www.lightpollutionmap.info/help.html), by Jurij
Stare, identifies its 2025 raster as the `AllAngle_Composite_Snow_Free` band.
We use the raw data, not the site's rendered map or sky-brightness model.
The actual downloaded TIFF is one Float32 band, 86,400 × 33,600 pixel-area
cells in EPSG:4326, spanning 180°W–180°E and 75°N–65°S. Pixel spacing is
15 arc-seconds (about 500 m at the equator). Its declared missing value is
Float32 −999.9; zero is valid, thresholded background, not a missing pixel.
The archive identity and numerical samples are recorded in
`source/science/night-lights-2025/provenance.json`.

Preparation averages numeric radiance over the 8,192 × 4,096 display cells,
weighting overlaps by spherical area. It excludes missing samples and marks a
display cell missing if less than half its area has observations. It then
applies an authored warm logarithmic color transfer, with 0.25 nW/cm²/sr
softening and saturation at 100 nW/cm²/sr. These are display parameters,
not calibration factors. No glow, invented lights, background geography or
sky-brightness conversion is added. The globe, poles, thumbnail, minimap and
legend all use this interpretation. Missing coverage is gray.

This mirror contains no observation-count or quality bands. We cannot perform
an additional quality selection: aurora and transient lighting remain in the
source, especially at high latitudes. This is a 2025 annual snow-free
observation, not a live map, a complete census of artificial lighting or a
measurement of how dark the sky looks from the ground.

Source survey checked 2026-09-09: direct NASA 2025 annual granules require
Earthdata authentication; NASA GIBS annual display mosaics still offer only
2012/2016; the EOG VNL v2.2 download directory returns HTTP 401. OpenGeoHub's
public 2024 derivative is older and rescales the numeric values. The selected
public NASA-derived 2025 raw mosaic retains the original float radiance units
and has verifiable grid metadata and explicit attribution.

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

The original Cross section dataset retains the schematic NASA Science layers.
Mantle tomography is a separate dataset that combines modeled mantle velocities
with the same schematic crust and core. Selecting either uses a
prepared north-up camera at 145° E, 20° N, looking obliquely into the cut, then follows the shared camera's
normal orbit controls. The cutaway and exterior use the same physical frame;
Earth's 23.4 degree axial tilt is unchanged. The mantle and outer-core pole
atlases use the same removed wedge as their shells. Shadows selects prepared
lit or unlit exterior banks. Scientific mantle colors are unshaded so they share
the legend's transfer; the crust and core retain illustrative shape shading.
The wedge now passes through the inner core too, with matching transparent polar
regions. The inner core is no longer an uncut sphere protruding through the
section. In tomography, authored muted core colors distinguish schematic layers
from the measured quantity; the original structure dataset retains its palette.
Both datasets use the same geometry, camera limits and zoom. The revised cut
removes 30 hidden inner-core faces (516 interior leaves, down from 546).

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

`source/interior/earth-interior.json` supplies schematic layer geometry based on
NASA Science. The separate Mantle tomography dataset samples **GLAD-M35 r0.1 (2024)**, a seismic inverse
model by Cui et al., distributed through EarthScope EMC. The model is not a
photograph, a temperature measurement, or evidence for detailed core imagery.

### Mantle tomography source and interpretation

- Selected: [GLAD-M35](https://data.earthscope.org/app/products/portal/emc_model_viewer.html?id=EMC-GLAD-M35),
  [paper](https://doi.org/10.1093/gji/ggae270). The published NetCDF has 289 depths
  (10–2,890 km in 10 km steps), 181 latitudes and 361 longitudes (1° steps).
  We use `vsv`, vertically polarized shear-wave velocity in km/s. The r0.1
  release flattens the 410/660 km boundary topography described by the authors.
- Considered: [SEMUCB-WM1](https://ds.iris.edu/ds/products/emc-semucb-wm1/),
  another downloadable whole-mantle shear-velocity model. It remains a useful
  independent comparison; this view uses one identified model, without blending
  incompatible inversions. No claim is made that GLAD-M35 is the newest model.
- Giant-planet gravity and seismology constrain radial structure and diffuse
  cores, but were not selected as spatially resolved interior appearance maps.

The checked-in 520,307-byte numeric subset contains depth means, both cut planes,
and the outer mantle shell slice. `interior/tomography.json` records the original
343,763,392-byte NetCDF's URL and SHA-256. Catalog and metadata snapshots retain
the provider's revision, variable definitions and citations. Normal preparation
uses this pinned subset, and does not need Python or the complete volume.

The color quantity is `100 * (Vsv / horizontalMeanVsv(depth) - 1)`. The mean
weights the exact spherical areas of latitude cells; longitude integration
counts the coincident −180/+180 endpoint once. The published endpoint values
differ by up to 0.080645084 km/s (20 km depth, 55°N). The extractor averages
that pair before periodic sampling. This display reference is **not STW105**,
which is the reference used by the underlying inversion. Upper-mantle radial
anisotropy means `Vsv` must not be relabeled as isotropic shear speed.

The existing cut geometry samples 67.5°E and 180° meridians. The source raster's
antimeridian origin is 180° from the mesh's longitude origin, as with Blue
Marble. Source latitude increases northward; texture rows increase southward.
We linearly interpolate velocity and the depth reference independently, then
compute the percentage. No noise or additional spatial detail is synthesized.
The 1°/10 km sample spacing does not imply that features of that size are resolved.

Depth uses normalized ellipsoid radius times a 6,371 km reference radius. This
is the display's spherical depth convention, not a local Moho reconstruction.
The mantle shell is sampled at 29.967 km; the radial faces sample depth through
the volume. Geometry remains schematic (including its uniform 30 km crust).
Only mantle material receives the data colors. Source depths outside 10–2,890 km
are gray, with no extrapolation into the core. The fixed diverging palette
saturates at ±3%; neutral is the mean at that depth. The same palette prepares
the legend and thumbnail. Crust, outer core and inner core remain schematic.

Section and mantle surface textures use WebP q90; polar alpha textures remain
lossless. Preparation compared q70/80/90/95 and lossless. On interior mantle
pixels away from layer boundaries, q90's mean maximum RGB-channel difference
was 1.91/255 (99th percentile 7/255); the canonical cut-plane atlas decreased
from 600,026 to 111,944 bytes in the initial encoding trial. The current atlas
changes only its schematic core palette; its exact delivered size is recorded
in `runtime-assets.json`. This is display compression, not numeric source
quantization. The original numeric values remain pinned.

To reproduce the source subset, install `numpy==2.3.5` and `h5py==3.14.0` in an
isolated Python environment, download the URL pinned in `tomography.json`, then:

```sh
python tools/objects/paged-ellipsoid/extract-tomography.py \
  /path/to/GLAD-M35.r0.1-n4c.nc \
  src/planets/earth/source/interior/tomography.json \
  src/planets/earth/source/interior/glad-m35-vsv-subset.f32.gz
node tools/objects/dist/prepare-authored.js earth --write
```

The extractor verifies the upstream SHA-256 and source axes before reading the
volume. The checked subset allows deterministic offline JS texture preparation.
The numeric tests compare six independently decoded NetCDF anchors, including
both hemispheres and both meridians, and verify registration against the
prepared geographic frame.

## Typography

The Earth heading outline is extracted at preparation time from Inter Variable 4.001, commit `9221beed3`, weight 500, optical size 28. The checked font and exact outline source are declared in the source manifest. Runtime does not load a planet-specific font.

## Reproduction

Run:

```sh
node tools/objects/dist/operations.js acquire earth
node tools/objects/dist/prepare-authored.js earth --write
node tools/objects/dist/operations.js acquire earth --verify-only
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
Validation: `node --test tests/objects/unit/earth/places.test.mjs` and
`node tests/objects/browser/earth/places-browser.mjs http://127.0.0.1:4228`.
The browser check uses real Google Chrome at DPR 1 and 2 plus phone-size
emulation. It exercises search, keyboard selection, camera centering, imagery
loading, globe return, globally available destinations and retained scene identity. Phone
emulation is not physical-device proof. Reports and actual screenshots are in
`output/playwright/city-selection/`.

## GEBCO elevation preparation (2026-09-09)

[GEBCO_2026](https://www.gebco.net/data-products-gridded-bathymetry-data/gebco2026-grid), DOI 10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa, supplies signed meters relative to mean sea level. The primary land-and-ice-surface version is used. This is a terrain model integrating measured and estimated seafloor depths; the 15 arc-second cell spacing does not imply measurements at that spacing everywhere. The publisher notes local coastal datum exceptions.

The 20 pinned DAP2 latitude blocks contain 120 or 240 rows and together sample native indices 4:10:43194 in latitude and 4:10:86394 in longitude: 8,640 × 4,320 scalar values at 2.5 arc-minute spacing. It is a sampled overview, not a full-resolution DEM or a peak-preserving average. Latitude runs south to north, longitude west to east, and native cells are center-registered. Both coordinate arrays and the provider metadata are retained and validated. Acquisition uses the shared download operator with deterministic gzip encoding. Blocks are rejected on truncation, wrong coordinates, overlaps or gaps; only a complete globe is accepted.

The existing paged-ellipsoid preparation bilinearly samples heights onto the 8,192 × 4,096 globe raster before coloring. The authored palette spans −10,000 to +10,000 m, saturating deeper trenches. Local cartographic relief reuses the scientific-raster finite-difference helper with a 6,371,008.8 m reference sphere, latitude-adjusted east-west spacing, 4× slope exaggeration, northwest light at 45° elevation, and 60% ambient contribution. This changes image shading, not globe geometry. Shared flood and directional lighting remain supported. The numeric legend is unshaded and uses the identical palette; globe pages, poles, thumbnail and minimap share the same interpretation.

Candidate disposition: GEBCO_2026 selected for the current global numeric model; NOAA ETOPO 2022 remains a documented older alternative; the previous Blue Marble base plus relief is excluded because its land colors do not encode elevation. Source acquisition, scientific anchors, mounted views and payload results are recorded with the PR evidence.

## Cloud-free surface and automatic cloud coverage selection

The default Visible color dataset uses the July 2004 monthly composite without clouds. Cloud coverage combines that same surface with the existing archival NASA cloud TIFF using the established alpha recipe; the two sources are not simultaneous observations or live weather. The two maps are baked before runtime and switched through the shared dataset selection transaction. The dataset list, caption, preview and attribution follow the committed selection.

Earth owns the two dataset ids and zoom thresholds in `source/content/object.json`. Clouds are selected below 72% of the responsive opening zoom; visible color returns above 88%. The gap prevents oscillation. Manual choices remain until another threshold crossing, and the rule never replaces other scientific datasets. Switching preserves camera orientation, motion and zoom.

The prepared surface blend pair adds a 280 ms opacity transition between those two datasets. Both use the same July surface; a second set of prepared surface leaves carries the cloud composite over that clear base. Only the leaves fade, preserving the 3D carrier. Cloud pages are first acquired when Cloud coverage is selected and then retained until Earth is unmounted so a reverse fade never loses its texture. No intermediate images are generated or downloaded. Other datasets switch immediately, and reduced-motion preferences disable the fade.

Compared at identical browser framing: current December with clouds, cloud-free December, and cloud-free July. July was selected for clearer northern land. Recent daily VIIRS imagery remains a future cloud-dataset candidate because of polar gaps and daily mosaic incompleteness. Newer Sentinel-2 mosaics were surveyed but not qualified for complete global coverage and account-free acquisition.

Source: https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/
