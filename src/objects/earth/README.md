# Earth

`/earth/` — Archival imagery and scientific maps. Layers have different dates;
clouds are not live weather. Dataset selection is manual at every zoom.

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

The [navigation marker recipe](source/preparation/navigation.json) retains the existing credited image and crop, then prepares a circular alpha edge so the photographic background cannot cover surrounding objects. The same silhouette is used by its larger context image where configured.

## Sources

| View | Source | What it means |
| --- | --- | --- |
| Surface and clouds | NASA Blue Marble, July 2004 surface plus archival cloud TIFF | Brightness is adjusted for display. Surface and clouds are separate observations. Deep ocean is shaded from depth, not observed water colour. |
| Elevation | [GEBCO_2026](https://doi.org/10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa) | Sampled modeled height relative to sea level. Relief shading is exaggerated; globe geometry is unchanged. |
| Night lights | [NASA VJ146A4.002](https://doi.org/10.5067/VIIRS/VJ146A4.002), 2025, via Jurij Stare | Annual radiance in logarithmic false color. Gaps and aurora remain; this is not ground-level sky darkness. |
| Atmosphere and charts | Authored atmosphere parameter record; NASA Planetary Spectrum Generator (PSG) | Simulated atmosphere, spectrum and temperature/pressure charts. Atmosphere brightness is adjusted for display. |
| Interior | NASA schematic layers; [GLAD-M35 r0.1](https://doi.org/10.1093/gji/ggae270) | Modeled seismic wave speeds above or below the mean at each depth, not temperature. Crust and core are schematic. |
| ENSO | [NASA MUR v4.1](https://doi.org/10.5067/GHGMR-4FJ04), 7 September 2026, via GIBS | Sea-surface temperature anomaly imagery relative to 2003–2014; published color bins, not a raw numerical field. |

City search runs on the GeoNames places catalogue in [source/places](source/places/) (see
[City coordinates](#city-coordinates)). The WorldCover city imagery pages and the Buenos Aires noise lens
were removed with their preparation machinery in the pull request that enabled this search; their last
source records are in the repository history before that change.

## Evidence

The linked reports identify their tested sources, prepared files and limitations.

- **Softer lighting, 10 September 2026:** the applied Shadows-off view matches
  the selected 25% white-overlay preview exactly. Checked in Chrome at DPR 1/2,
  with directional lighting and the surface, clouds, elevation, night-light and
  ENSO views. TypeScript, preparation build and 35 focused checks passed.
  [Verification and limits](evidence/soft-light-overlay.json) ·
  [Before](evidence/soft-light-before.png) · [After](evidence/soft-light-after.png) ·
  [Absolute difference](evidence/soft-light-diff.png).

- **Surface:** source restoration, 179-file image installation and browser checks.
  The report records an ownership-test failure and excludes full-suite success.
  [Surface verification results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/earth/cloud-free-default/README.md).
- **Photographic source sampling, 12 September 2026:** the pinned July JPEG and
  cloud TIFF were sampled at the existing atlas footprints, then 58 current
  surface assets were staged and applied. The 29 clear-surface files total
  18,087,832 bytes, up 1,972,070 bytes (12.24%) from the baseline inventory;
  the 29 cloud files total 33,073,610 bytes, up 1,264,694 bytes (3.98%). The
  51,161,442-byte combined download is 3,236,764 bytes larger. This receipt
  verifies source, recipe, raster-plan and texture-level pins. On revision
  `3dc424757`, both views displayed at whole-globe scale with Shadows on and off
  in Chromium at DPR 1, without script errors. Close-zoom behavior has the
  limitation below; these captures do not qualify texture-level selection.
- **Scientific maps:** numeric height checks, six independent tomography anchors and
  geographic registration. [Elevation](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/earth-elevation/README.md) ·
  [Tomography](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/planet-cross-sections.md) · [Night-light interpretation](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/earth-night-lights.md) ·
  [MUR native pixel checks](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/earth-enso/mur-native-witnesses.json).
- **Retired geographic release:** the September 5 report records 19,632 published objects and
  25,344,236,995 bytes verified for release `fef1519d5f243617`, with Chrome checks at
  device pixel ratios (DPR) 1 and 2. This is dated delivery evidence, not a live availability check or
  application deployment. [Geometry delivery report](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/global-earth-coverage.md).

## Known problems

- **Close zoom, observed 12 September 2026:** wheel input reaching 4× zoom kept
  the clear surface on 512-pixel pages and showed missing tiles over Asia in the
  local Chromium run. The same camera and unchanged renderer reproduced the
  problem with the previous pinned photographic assets and the new assets.
  Waiting for application readiness and rebuilding the renderer did not resolve
  it. The cause is not established; native-source preparation does not fix this
  runtime behavior. Whole-globe display passed the focused visual check.

Named features: Earth has no IAU nomenclature, so its names come from Natural Earth 1:10m vectors (public domain) pinned under `source/features/`: countries (retrieved 2026-09-15), populated places, geographic region points and areas, marine areas and river centrelines (retrieved 2026-09-12). A short list of world-famous landmarks (`source/features/landmarks.json`) transcribes each Wikidata item's English label, description and coordinate location (P625, CC0, retrieved 2026-09-15). Countries anchor at Natural Earth's label point and draw no boundary; places and landmarks are unsized points; regions and seas trace their bounding box; rivers trace their centreline. Anchors are cast onto the rendered ellipsoid through the paged lane's own surface sampler (`tools/objects/surface-features/ellipsoid.ts`), and the runtime parser checks every anchor against the ellipsoid band recorded in the plan. Natural Earth's and Wikidata's names, ranks and geometry are their editors' choices, not an official gazetteer.

Default map labels ([features recipe](source/preparation/features.json)): only oceans, continents, countries, capitals, cities, the landmarks and eight named highlights (Sahara, Himalayas, Andes, Alps, Rocky Mountains, Nile, Amazon, Mediterranean Sea) label the map. Every other Natural Earth name (seas, bays, capes, plains, island groups, rivers, research stations) stays searchable and labels the map only while selected. Labels are admitted by class tier (ocean, continent, country, capital, landmark and highlight, city), then by Natural Earth's rank. A name competes from the zoom share where the camera shows the Earth at the scale of its Natural Earth minimum label zoom: the farthest camera view matches web-map zoom 1.1 and the closest 4.4, derived from the Earth silhouette radius of 836 CSS px measured at camera zoom 4 (`2·836·π / 256 = 2^4.36`; zoom 0.42 gives `2^1.11`). Names Natural Earth shows only beyond zoom 4.4 stay off the map, and capitals and cities never appear before share 0.5, past the whole-globe view (measured at share 0.383, camera zoom 0.995). Split Natural Earth parts with one name label the map once.

The public feature transport keeps those default map labels in the first-interaction catalogue. Search-only names are deterministically sharded by feature id; selecting one verifies and loads only its bank, while the global search index retains the original prepared order.

Named features run of 2026-09-15 (this version): `node tools/objects/dist/prepare-authored.js earth --write` (707 s, every pinned Earth source present and verified) prepared 5,467 names: 258 countries, 3,000 populated places, 48 landmarks and the geographic regions, seas and river centrelines. 456 label the map by default (171 countries, 88 capitals, 129 cities, 48 landmarks, 7 continents, 5 oceans and 8 highlights); the rest are search-only. Of the 301 delivered Earth files only `earth-features.json` changed; the provenance basis stays `prepared`. `tests/objects/unit/earth/features.test.mts` checks the default classes, country label points, the city zoom floor and search-only names against the delivered catalogue. The three captures in [`evidence/default-labels/`](evidence/default-labels/) show the default view, one wheel step closer and the closest view at 1400 × 900 CSS px on the local dev server.

- Night-light coverage stops at 75° N and 65° S. The mirror lacks quality bands;
  aurora and transient lights cannot be filtered further.
- ENSO uses NASA's display colors and clipped anomaly range. Transparent land,
  ice and unavailable imagery remain gaps; the display does not reconstruct
  continuous temperature measurements from RGB.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation settings](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Blue Marble brightness and alternative imagery</summary>

- Normal colour: NASA Earth Observatory, Blue Marble Next Generation, July 2004. The pinned 21,600 × 10,800 cloud-free JPEG is `source/blue-marble-july.jpg`; December remains an archival comparison input.
- Deep ocean: the NASA topography and bathymetry edition of the same month, pinned as `source/blue-marble-july-bathymetry.jpg` on the same 21,600 × 10,800 grid. Only its ocean is used; its land carries baked relief shading and is not used.
- Clouds: NASA Visible Earth, Blue Marble Clouds. The checked 8,192 × 4,096 TIFF is `source/blue-marble-clouds.tif`.
- Navigation marker: NASA image-library Earth globe `GSFC_20171208_Archive_e001016`, checked as `source/earth-navigation.jpg`.

The atmosphere parameters used in preparation are stated in `source/atmosphere/model.json`,
with the sources each value is adapted from.

The July mosaic uses a display-only midtone lift: each sampled RGB code value becomes
`round(255 * (value / 255) ** (1 / 1.25))`. Black and white endpoints are unchanged.
This is a presentation adjustment, not radiometric calibration or recovered albedo.

For the clear and cloud views, preparation bilinearly samples the complete 21,600 × 10,800
July grid at each existing page or polar-footprint coordinate instead of first resampling it to
the 8,192 × 4,096 canonical map. The cloud view independently samples the complete
8,192 × 4,096 cloud TIFF at the same geographic coordinate, applies the midtone lift to the
July value, then applies the existing cloud alpha recipe. This keeps the source grids separate;
it does not make the July surface and cloud observation simultaneous or turn display RGB into
calibrated albedo.

Deep ocean in the plain edition is not an observation. Stöckli et al. (2005), section 2.4,
states that deep ocean pixels there are replaced by an arbitrary ocean reflectance, and the
pinned JPEG carries that as one exact code value, `(2, 5, 20)`. Measured over three
256 × 256 deep-ocean tiles the standard deviation is 0.00 per channel, and of the
134,955,917 pixels whose eight neighbours are all exactly that value only 1,476, eleven per
million, differ at all, never by more than two code values. Preparation therefore reads the
plain source value and takes the ocean sample from the bathymetry edition wherever every
channel is within two code values of `(2, 5, 20)`. That test selects 64.4396% of the sphere
by area, below the 70.8% water share, because shallow and coastal water is real MODIS
observation and stays untouched. The replacement weight rises from nothing at the edge of
that region to full over 40 source pixels, about 74 km at the equator, on a smoothstep of
the chamfer distance into the region. This is a display choice: it keeps the boundary with
observed water free of a visible step, and it means a narrow strip of every coast keeps the
original fill. The ocean sample does not receive the midtone lift; land, ice, lakes and
shallow water are unchanged.

Deep ocean colour in the clear and cloud views is therefore shaded from depth, not observed
water colour. It is not a measurement of sea surface reflectance and it is not a calibrated
depth scale; for depth numbers use the elevation view.

Each view's surface is 56 pages. A page holds eight neighbouring cells of one latitude row, a
90° block, at 1,024, 2,048 or 4,096 pixels wide, whichever gives it the smallest area. A browser
decodes a whole image to draw any part of it and never draws a face turned away, so a view decodes
only the blocks it shows. The seven latitude-band pages used before each ran round the globe, so
every view decoded all of them: 109 megapixels at the closest level, which zooming decoded again
because the set outgrew Chrome's decode cache. Modelled on the baked cell layout for a 1,280 × 800
view, the closest level now decodes 41, 23, 14 and 8 megapixels for globes 1,100, 1,500, 1,900
and 3,000 px wide, against 63, 44, 32 and 28 before. On 2026-09-25 the rebake left every cell's
alpha identical to the band pages; colour moved by 1.5 levels in 255 on average from lossy
re-encoding at the new positions, with edge contrast 1.15% higher, not softer. The first view's
smallest level is 271 KB in 56 files, against 247 KB in seven. A page also takes the sharper
level only while its faces may be seen; one off screen or behind the globe keeps the smallest.
Measured on 2026-09-25 in headless Chrome at 1,280 × 800 CSS px and DPR 2, a zoomed-in view drew
24 of 56 pages at the sharpest level and decoded 40.8 megapixels of surface, against 94.7 for
the seven band pages; the default view decoded 17.3 against 23.7. The zoomed-in frame differed
from the band pages in 29 of 4.1 million pixels (pixelmatch, threshold 0.1). Each page keeps its texture levels,
halved exactly, and each view keeps one 2,048 × 512 pole atlas. The pole atlas has
the same levels, reduced by the same ratio (256, 512 and 1,024 pixels wide), so the first view
loads its poles at the pages' level: 2.7 KB instead of 85 KB for Visible color. The density-8 atlas,
four-pixel gutter and 450 retained surface leaves are unchanged.
No source projection, Earth geometry, lighting, atmosphere, scientific palette or runtime
selection rule changed. The same adjusted base still feeds the clear surface, cloud composite,
cutaway exterior, thumbnails, minimaps, the pole atlas and every texture level; the original
source JPEGs remain unchanged. Dataset selection is manual at every zoom level.

The two polar caps are rastered at their own 256-pixel cell size. They used to share the
interior shells' four-times raster scale, so Safari backed each cap with a 1,024-pixel layer
of 36 MB. On the iPhone 17 Pro simulator, during a four-drag Earth capture
(`tools/performance/ios-capture.mts`, 2026-09-22), each cap layer is now 2.3 MB, and
composited layers total 153.2 MB, down from 220.7 MB. In the same session, applying the
256-pixel caps to the live page left the rendered frame pixel-for-pixel identical.

Visible color and Cloud coverage share the adjusted July surface. Cloud coverage adds the
archival NASA cloud TIFF using the existing alpha recipe. The sources are not simultaneous
observations or live weather.

One retained surface displays the selected image bank.

With Shadows off, Earth uses a white limb overlay at one quarter of the original
shading alpha. This display adjustment brightens the edge without modifying the
source imagery. The directional Shadows bank is unchanged. The atmosphere shows its
full-phase frame, the evenly lit limb, instead of following the Sun, so turning the globe
keeps one prepared atmosphere image loaded instead of decoding a new one for each phase.
That frame is its own image (`earth-atmosphere-flood@2x.webp`, 1,016 pixels with its gutter)
instead of a quarter of the last four-frame row, so the first view downloads 37 KB of
atmosphere instead of 158 KB, and does not fetch the two neighbouring rows. It goes through the
lossy lane with exact alpha, like the rows. Outside the interior view the page's markup leaves out the cutaway's 522 hidden nodes
(`hiddenSubtrees` in the prepared variants); the runtime builds them from their prepared records when it takes over the
page. The Earth page's compressed HTML fell from 96 KB to 74 KB. Before the bake, a patched build that showed this frame
from its own image matched the unchanged build pixel for pixel, once settled, at 412 × 823 (DPR 2) and 1,280 × 800.
Other bodies retain their existing lighting.

The [cloud-free comparison](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/earth/cloud-free-default/README.md) considered
December with clouds, cloud-free December and cloud-free July; July was selected for clearer
northern land. Recent daily VIIRS imagery remains an unqualified candidate because of polar
gaps and daily mosaic incompleteness. Sentinel-2 mosaics were surveyed but not qualified for
complete global coverage and account-free acquisition.

</details>

<details>
<summary>Elevation sampling, datum and shading</summary>

[GEBCO_2026](https://www.gebco.net/data-products-gridded-bathymetry-data/gebco2026-grid), DOI
10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa, supplies signed meters relative to mean sea
level. The primary land-and-ice-surface version is used. This is a terrain model integrating
measured and estimated seafloor depths; the 15 arc-second cell spacing does not imply
measurements at that spacing everywhere.

The publisher notes local coastal datum exceptions.

The 20 pinned DAP2 latitude blocks contain 120 or 240 rows and together sample native indices
4:10:43194 in latitude and 4:10:86394 in longitude: 8,640 × 4,320 scalar values at 2.5
arc-minute spacing. It is a sampled overview, not a full-resolution DEM or a peak-preserving
average. Latitude runs south to north, longitude west to east, and native cells are
center-registered.

Both coordinate arrays and the provider metadata are retained and validated. Acquisition uses
the shared download operator with deterministic gzip encoding. Blocks are rejected on
truncation, wrong coordinates, overlaps or gaps; only a complete globe is accepted.

The existing paged-ellipsoid preparation bilinearly samples heights onto the 8,192 × 4,096
globe raster before coloring. The authored palette spans −10,000 to +10,000 m, saturating
deeper trenches. Local cartographic relief reuses the scientific-raster finite-difference
helper with a 6,371,008.8 m reference sphere, latitude-adjusted east-west spacing, 4× slope
exaggeration, northwest light at 45° elevation, and 60% ambient contribution.

This changes image shading, not globe geometry. Shared flood and directional lighting remain
supported. The numeric legend is unshaded and uses the identical palette; globe pages, poles,
thumbnail and minimap share the same interpretation.

We selected GEBCO_2026 for the global numeric model. NOAA ETOPO 2022 remains an older
alternative; the previous Blue Marble base plus relief is excluded because its land colors do
not encode elevation. That exclusion still stands: the visible views take only the ocean of
the Blue Marble topography and bathymetry edition, never its relief-shaded land. The
[elevation report](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/earth-elevation/README.md)
records the source download, numerical checks, browser views and file sizes.

</details>

<details>
<summary>Night-light averaging and missing pixels</summary>

The [NASA VJ146A4.002 product](https://doi.org/10.5067/VIIRS/VJ146A4.002) contains NOAA-20
VIIRS yearly, moonlight- and atmosphere-corrected radiance. The [public
mirror](https://www.lightpollutionmap.info/help.html), by Jurij Stare, identifies its 2025
raster as the `AllAngle_Composite_Snow_Free` band. We use the numerical radiance band from the
processed annual product, not raw detector measurements or the site's sky-brightness model.

The actual downloaded TIFF is one Float32 band, 86,400 × 33,600 pixel-area cells in EPSG:4326,
spanning 180°W–180°E and 75°N–65°S. Pixel spacing is 15 arc-seconds (about 500 m at the
equator). Its declared missing value is Float32 −999.9; zero is valid, thresholded background,
not a missing pixel.

The archive identity and numerical samples are recorded in
`source/science/night-lights-2025/provenance.json`.

Preparation averages numeric radiance over the 8,192 × 4,096 display cells, weighting overlaps
by spherical area. It excludes missing samples and marks a display cell missing if less than
half its area has observations. It then applies an authored warm logarithmic color transfer,
with 0.25 nW/cm²/sr softening and saturation at 100 nW/cm²/sr.

These are display parameters, not calibration factors. No glow, invented lights, background
geography or sky-brightness conversion is added. The globe, poles, thumbnail, minimap and
legend all use this interpretation.

Missing coverage is gray.

This mirror contains no observation-count or quality bands. We cannot perform an additional
quality selection: aurora and transient lighting remain in the source, especially at high
latitudes. This is a 2025 annual snow-free observation, not a live map, a complete census of
artificial lighting or a measurement of how dark the sky looks from the ground.

Source survey checked 2026-09-09: direct NASA 2025 annual granules require Earthdata
authentication; NASA GIBS annual display mosaics still offer only 2012/2016; the EOG VNL v2.2
download directory returns HTTP 401. OpenGeoHub's public 2024 derivative is older and rescales
the numeric values. The selected public NASA-derived 2025 numerical mosaic retains the original
float radiance units and has verifiable grid metadata and explicit attribution.

</details>

<details>
<summary>ENSO anomaly imagery and offline restoration</summary>

The ENSO view uses the 7 September 2026 NASA GIBS MUR v4.1 sea-surface temperature
anomaly image relative to a 2003–2014 climatology. Its separately dated NOAA
advisory provides context; the map and advisory are not live feeds.

The 1 km imagery grid is 40,960 × 20,480 pixels: 3,200 original 512-pixel PNG tiles.
The [receipt](source/science/mur-gibs-receipt.json) pins each tile's URL, bytes,
hash and response date; populated tiles must attest the requested layer and date.
A tile without those headers is accepted only when decoded alpha shows that it
contains no observations. The 47,638,424 source bytes are retained in the
45,833,893-byte `source/science/mur-gibs-tiles.tar.gz` archive.

Pixel-center nearest sampling creates a 16,384 × 8,192 intermediate before globe
atlas sampling. Display resolution does not retain every native source pixel.
The pinned [NASA color table](source/science/mur-gibs-colormap.xml) supplies 0.1 °C
bins and saturation below −3 and at +3 °C. RGB is not inverted into continuous
measurements; transparent land, ice and unavailable observations stay gray.

Shared source restoration rebuilds a missing `source/science/mur-gibs.png` from
the tile archive and verifies its expected mosaic hash before preparation.
The [original acquisition, native witnesses and browser evidence](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/earth-enso.md)
record the qualified snapshot. The earlier CoralTemp comparison used a different
1991–2020 baseline and display range, so it is not a resolution-only comparison.

</details>

<details>
<summary>Atmosphere parameters and normalized PSG responses</summary>

`source/atmosphere/model.json` is the numerical authority for the visible atmosphere: an
authored record whose values are adapted from the OpenSpace RenderableAtmosphere tuning and
Bruneton and Neyret (2008), cited in the file. Preparation reads its 6,377 km planet radius, 70 km atmosphere height, 680/550/440
nm Rayleigh scattering coefficients, 8 km Rayleigh scale height, and Mie coefficients, scale
height, and anisotropy. Those values produce the static view bank and its exact outer-radius
ratio.

Google Earth Pro supplies only the presentation operator layered over those Earth facts: a
captured Sun-direction uniform, 0.2 camera exposure, exponential tone mapping, and
luminance-driven opacity. Earth irradiance, twilight width, limb concentration, colour, and
density remain body-specific and are derived from the atmosphere record. The checked
`source/atmosphere/google-earth-pro-presentation-response.json` records the shader hashes and
results from tests that render the atmosphere separately.

It does not redistribute Google pixels or shader bytes. Google Earth Pro's blue Mars result is
deliberately not treated as a body-colour authority. The browser uses the same prepared
high-resolution images on every device; it performs no scattering, geometry, or raster work at
runtime.

#### Chart inputs

`source/atmosphere/psg-earth-20260830.cfg` is the expanded NASA GSFC Planetary Spectrum
Generator configuration for Earth at 2026-08-30 12:00, followed by the declared 0.35–1.0 µm,
R=120, I/F generator block. PSG prepends a human-readable MERRA retrieval warning to this Earth
response. That warning is not a PSG configuration record and makes a subsequent radiance
request return an empty body.

Earth acquisition removes exactly that leading warning line before pinning and resubmitting the
configuration. The complete numerical atmosphere remains unchanged.

`source/atmosphere/psg-earth-r120-rif.txt` is the checked PSG radiance response. Its full
numerical output is unchanged. Only the synthesis-clock and execution-time comment lines are
normalized so the same pinned response can be restored deterministically.

Preparation converts the complete sample set and the configuration's ordered
pressure/temperature layers to static SVG charts.

</details>

<details>
<summary>Mantle tomography calculation and subset reproduction</summary>

`data/object-information/earth.json` is prepared from NASA Science record 48583, `Facts About Earth`.
NASA's block-feed endpoint currently fails server-side for this record. Earth acquisition
therefore validates the canonical WordPress record and parses the same selected headings from
its checked `content.rendered` field.

The shared editorial tool and contract are unchanged.

`source/interior/earth-interior.json` supplies schematic layer geometry based on NASA Science's
[Earth facts](https://science.nasa.gov/earth/facts/). NASA gives rounded sizes (1,221 km inner-core
radius, about 2,300 km outer core, 2,900 km mantle, 30 km crust on land), which sum to more
than Earth's radius. The package keeps the inner core and crust and fits the outer core and mantle
to a 6,378 km equatorial radius: 2,257 km and 2,870 km. NASA calls the mantle a hot, viscous
layer; the legend uses that wording.
The separate Mantle tomography dataset samples **GLAD-M35 r0.1 (2024)**, a seismic inverse
model by Cui et al., distributed through EarthScope EMC. The model is not a photograph, a
temperature measurement, or evidence for detailed core imagery.

The Cross section and Mantle tomography views share schematic cutaway geometry and the
exterior's physical frame, including its 23.4° axial tilt. The wedge cuts through every layer,
including the inner core. Mantle colors are unshaded so they match the velocity-anomaly legend;
the crust and core use illustrative shading.

Muted core colors distinguish those schematic layers from the modeled mantle.

#### Mantle tomography source and interpretation

- Selected: [GLAD-M35](https://data.earthscope.org/app/products/portal/emc_model_viewer.html?id=EMC-GLAD-M35),
  [paper](https://doi.org/10.1093/gji/ggae270). The published NetCDF has 289 depths
  (10–2,890 km in 10 km steps), 181 latitudes and 361 longitudes (1° steps).
  We use `vsv`, vertically polarized shear-wave velocity in km/s. The r0.1
  release flattens the 410/660 km boundary topography described by the authors.
- Considered: [SEMUCB-WM1](https://ds.iris.edu/ds/products/emc-semucb-wm1/),
  another downloadable whole-mantle shear-velocity model. It remains a useful
  independent comparison; this view uses one identified model, without blending
  incompatible inversions. No claim is made that GLAD-M35 is the newest model.

The checked-in 520,307-byte numeric subset contains depth means, both cut planes, and the outer
mantle shell slice. `interior/tomography.json` records the original 343,763,392-byte NetCDF's
URL and SHA-256. Catalog and metadata snapshots retain the provider's revision, variable
definitions and citations.

Normal preparation uses this pinned subset, and does not need Python or the complete volume.

The color quantity is `100 * (Vsv / horizontalMeanVsv(depth) - 1)`. The mean weights the exact
spherical areas of latitude cells; longitude integration counts the coincident −180/+180
endpoint once. The published endpoint values differ by up to 0.080645084 km/s (20 km depth,
55°N).

The extractor averages that pair before periodic sampling. This display reference is **not
STW105**, which is the reference used by the underlying inversion. Upper-mantle radial
anisotropy means `Vsv` must not be relabeled as isotropic shear speed.

The existing cut geometry samples 67.5°E and 180° meridians. The source raster's antimeridian
origin is 180° from the mesh's longitude origin, as with Blue Marble. Source latitude increases
northward; texture rows increase southward.

We linearly interpolate velocity and the depth reference independently, then compute the
percentage. No noise or additional spatial detail is synthesized. The 1°/10 km sample spacing
does not imply that features of that size are resolved.

Depth uses normalized ellipsoid radius times a 6,371 km reference radius. This is the display's
spherical depth convention, not a local Moho reconstruction. The mantle shell is sampled at
29.967 km; the radial faces sample depth through the volume.

Geometry remains schematic (including its uniform 30 km crust). Only mantle material receives
the data colors. Source depths outside 10–2,890 km are gray, with no extrapolation into the
core.

The fixed diverging palette saturates at ±3%; neutral is the mean at that depth. The same
palette prepares the legend and thumbnail. Crust, outer core and inner core remain schematic.

Mantle textures use WebP q90; polar alpha textures remain lossless. This is display
compression, not numeric source quantization. The original numeric values remain pinned.

The [encoding
comparison](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/planet-cross-sections/tomography/encoding.json) records
errors and size measurements for the tested version.

To reproduce the source subset, install `numpy==2.3.5` and `h5py==3.14.0` in an isolated Python
environment, download the URL pinned in `tomography.json`, then:

```sh
python tools/objects/paged-ellipsoid/extract-tomography.py \
  /path/to/GLAD-M35.r0.1-n4c.nc \
  src/objects/earth/source/interior/tomography.json \
  src/objects/earth/source/interior/glad-m35-vsv-subset.f32.gz
node tools/objects/dist/prepare-authored.js earth --write
```

The extractor verifies the upstream SHA-256 and source axes before reading the volume. The
checked subset allows deterministic offline JS texture preparation. The numeric tests compare
six independently decoded NetCDF anchors, including both hemispheres and both meridians, and
verify registration against the prepared geographic frame.

</details>

<a id="city-coordinates"></a>

#### City coordinates

`source/places/` holds the GeoNames cities15000 snapshot with its country, region and
license records, acquired September 4, 2026: 34,135 populated places above 15,000 people or
capitals; it is not every settlement. GeoNames data is CC BY 4.0 and is attributed in the search UI.

Preparation verifies the snapshot hashes, normalizes names and aliases, maps each place onto the
prepared globe faces and writes `earth-places.json` with a hash/size descriptor. The search fetches
that catalogue on demand, verifies its identity, matches the prepared labels and flies the camera to
the selected place's prepared controls (angles rounded to hundredths of a degree: city navigation,
not a survey marker). No geocoder or geometry derivation runs in the browser. Every place opens as an
overview of the globe at its coordinates; there is no city-level imagery.


<details>
<summary>Moon facts, sky image and typography</summary>

The [Moon record](source/moon/earth-moon.json) keeps the selected JPL physical and
mean-element values: radius 1,737.4 km, density 3.344 g/cm³, mean orbital distance
384,400 km, inclination 5.16°, period 27.322 days and Earth GM 398,600.436 km³/s².
It identifies the source URLs and hashes of the responses used for extraction.

The Moon is a separate object package and route. Earth keeps only the checked relationship
facts used by its information panel; the Earth scene does not prepare, mount, animate, toggle,
or request a Moon representation.

It is not the displayed photograph, and the panorama is not tied to the Earth imagery’s epoch.

</details>
