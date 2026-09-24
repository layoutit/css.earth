# Ariel

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Ariel uses Paul Schenk's September 2020 [Uranian Satellites — Global Mosaics and DEMs](https://repository.hou.usra.edu/handle/20.500.11753/1687), based on Voyager 2 images and revised cartographic control. The original [author README](https://repository.hou.usra.edu/bitstreams/00528589-53e3-496b-ac5d-b6d86fe527c9/download) documents the release.

**Monochrome** displays the source-corrected Voyager mosaic. [Schenk and Moore (2020)](https://doi.org/10.1098/rsta.2020.0102) describes lunar-Lambert normalization of the best-resolved images to reduce planetary shading; the result approximates normal reflectance and is not a true albedo map. Ariel's best mosaic has approximately 1 km image samples, with two smeared terminator images replaced by desmeared versions supplied by Stryk and Stooke. Cast shadows, camera marks, seams, and unequal local resolution remain. No additional photometric recovery is claimed.

**Elevation** displays the release's merged stereogrammetric and photoclinometric DEM. The author README also identifies limb-profile contributions to Ariel's DEM. Values are kilometres above the published reference ellipsoid, not sea level or the application sphere. Fixed cartographic relief uses those actual height units and latitude-dependent pixel spacing. The unshaded numeric legend describes elevation; shading describes slopes. Image-derived errors and smoother lower-resolution patches remain, and the release author recommends contacting him before scientific analyses or proposal use.

## Evidence

Polar sprites now sample the pinned original photographs directly, preserving the declared coordinates and source gaps. Existing monochrome fallback is retained where a color view already uses it. Each sprite is 1024 × 512 pixels, the one prepared density; latitude-band images, geometry and lighting remain unchanged. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) describes the method and its limits.

| View | Both prepared levels, before → current |
| --- | --- |
| normal | 119.9 → 132.8 kB |

These download sizes refer only to the polar sprites. Decoded dimensions are unchanged. The scene matches [the previous main version](https://github.com/layoutit/css.earth/tree/3efdf2c9ed9047c72409b2730e879123f8c3b9d2/src/planets/ariel/prepared); [the raster recipe](source/preparation/raster.json) and [asset inventory](inventory.json) bind the current preparation. Existing source-resolution and registration limits still apply.

Lane change (this PR): the terrestrial solid-observation lane was retired for Ariel; the same pinned inputs and the same decoders (`terrestrial-observation`, `terrestrial-scientific` through the raster lane's `science` adapter) now feed the shared raster lane used by Mercury, Venus, Mars, the Moon and Pluto. The sphere is the shared 16 × 32 mesh (450 leaves, 230 units, 50-pixel tile, 0.005 overlap) with the 256-frame Lambert lighting bank and no atmosphere. Surfaces are painted at 2048 × 1024 (DPR 1) and 4096 × 2048 (DPR 2) — native ISIS cube 3652 × 1826; the retired 5760 × 2880 atlas was an upsample (2880/2 = 1440 is not a multiple of 64). Verified with the package, source-closure, minimap and browser conformance checks listed in the pull request; the nomenclature recipe and map edge are unchanged and the labels were re-drawn against the new atlas. No new science review is claimed.

Run of 2026-09-12 (this version): `node tools/objects/dist/prepare-authored.js ariel --write` prepared the package through the shared raster lane and `tools/objects/observation/interpret.mts`; `node --test tests/objects/unit/ariel/*.test.mts` passes except the shared runtime-package and import-closure tests that fail identically on `main` (recorded once in the pull request).

A headless Chrome probe (`output/probe-spheres.mts`, ignored scratch) mounted the page on the dev server, selected every lens (normal, elevation) with no console errors or failed requests, and pinned a Gazetteer feature from the sidebar search on the standard mesh (feature id 6638).

Gazetteer rims drawn over the prepared equirectangular minimap at both candidate map edges (`output/edge-markers.mjs`) agree with the declared `mapLeftEdgeLongitudeDeg` in `source/preparation/features.json`.

Kachina Chasmata's Gazetteer centre has mosaic imagery but no valid DEM sample, which the numeric regression preserves.

### Voyager color lens (run of 2026-09-22, this version)

Sources. The lens uses Voyager 2 ISS narrow-angle GEOMED frames from the PDS Ring-Moon Systems Node
(volumes VGISS_7201–7207, inventoried through the OPUS API): every complete green/violet/ultraviolet
set of Ariel that the archive holds, 21 frames in 7 sets, listed in
[the frame recipe](source/preparation/voyager-color-frames.json). The camera comes from the pinned
[Voyager 2 Uranus kernel bank](../../spice/voyager/manifest.json): the `ura111` satellite ephemeris,
the `vgr2.ura111` trajectory and the Ring-Moon Systems Node SEDR pointing C-kernel. Observer and Sun
positions for the photometric correction are JPL Horizons vectors at each frame's exposure time.

Placement. `node tools/objects/voyager-iss/author-color-frames.mts ariel --write` wrote
[the placement report](source/reference/voyager-color-placement.json). The SEDR pointing predicts the
disc; the limb is fitted as one circle (robust levels from the frame's own histogram, a centroid seed
when the whole disc sits in the frame far from the prediction) and the optical centre moves by the
fitted offset; the SEDR errors removed here were 56–179 pixels and the accepted fits have an
RMS of 0.37–1.17 pixels. Each frame is then registered against the Schenk 2020 mosaic rendered
through its own camera (high-passed cross-correlation, search ±30 pixels); a set stands on the frame
that registered best and its other bands register to that anchor, so a band that does not register is
dropped rather than fringed. Applied registrations correlate at 0.22–0.52. 9 frames in
3 sets were placed: set-19860124-1438 (1.3 km/px), set-19860123-0140 (17.7 km/px), set-19860122-2015 (19.8 km/px). 12 frames were not: 9 no frame of this set registered against the mosaic; 3 the limb fit rejected it.
Only pixels above the frame's ground floor (a tenth of the way from its sky level to its disc level,
`limb.groundFloor`) are projected: a disc cut by the frame edge sits on a band of negative values in
the GEOMED border rows, which would otherwise become terrain.

Oracle. `node tools/objects/voyager-iss/oracle.mts ariel --write` re-places every frame and correlates
its high-passed detail against the mosaic in the frame plane
([report](source/reference/voyager-color-oracle.json)): 9 frames compared, mean
correlation 0.39, mean residual 25.1 km. The mosaic is the same control the
Monochrome lens uses, so the colour lands on the ground the reader already sees.

Colour. Each set is composed as a complete green/violet/ultraviolet triplet, corrected with the same
Lunar-Lambert disk function as the monochrome mosaic to incidence 30°, emission 0°, used within 60°
of both, and ground the finest set views too steeply goes to the next set (`withheld: next-observation`). The other sets are scaled band by band onto the set-19860124-1438 set by weighted least squares over the median ratios of all overlapping pairs on a 0.25° grid (`bandLevels`; gains set-19860122-2015: 0.877, 0.843, 0.845; set-19860123-0140: 0.892, 0.887, 0.906).
The archive's filter calibration leaves violet darker than both green and ultraviolet on every one of
the five moons (measured here, Ariel: violet/green 0.873, ultraviolet/green 0.972), which is also what the
Voyager team's own disk-averaged spectra show (Smith et al. 1986 as plotted by Bell and McCord 1991,
Fig. 2) and which renders purple. Bell and McCord (1991, *Proc. Lunar Planet. Sci.* 21, 473–489;
[ADS 1991LPSC...21..473B](https://ui.adsabs.harvard.edu/abs/1991LPSC...21..473B)) recalibrated the
filters against ground-based spectra (factors UV 1.186 ± 0.08, VIO 1.125 ± 0.04, GRN 0.926 ± 0.03) and
published whole-disc spectra normalised at green; read from their Fig. 2 at ±0.02, Ariel has
ultraviolet/green 1.05 and violet/green 1.0. The recipe names those ratios (`bandRatios`) and the
composer scales the violet and ultraviolet bands by one gain each (1.145, 1.081) so the
cosine-weighted means over the coloured footprint meet them; spatial colour differences are
Voyager's own. The ordering agrees with independent measurements: Karkoschka (2001, *Icarus* 151,
51) finds the moons grey with a slightly red slope and Miranda slightly bluish, and DeColibus et al.
(2026, *Planet. Sci. J.*, [doi:10.3847/PSJ/ae4a1b](https://doi.org/10.3847/PSJ/ae4a1b)) measure
V/B of 1.03–1.05 with Oberon and Titania the reddest. The whole lens then takes one brightness gain
against the monochrome base (the median over every footprint boundary); the brightest 0.1 % of texels
may clip. The prepared map is in [evidence](evidence/voyager-color/map.png).

Tests. `node --test tools/objects/voyager-iss/*.test.mts tools/objects/terrestrial-layers/photometric-observations.test.mts`
covers the limb fit, the tile writer's ground floor, and the composer's withheld, band-level,
band-ratio and non-positive-sample rules on synthetic frames;
`node --test tests/objects/unit/uranian-moons/voyager-color.test.mts` reads this moon's reports and
checks the placement, registration and oracle numbers above, that every tile of a complete set is
pinned with its geometry label, and that the prepared report carries the measured and published
ratios; `node --test tests/objects/unit/ariel/*.test.mts` covers the runtime package with the new lens.

## Known problems

- The Voyager color lens is false colour (green, violet, ultraviolet as red, green, blue) at the observations' own phase angles; no phase normalisation is applied, so a colour seam at a footprint edge is a real difference in viewing geometry. Its whole-disc band ratios are tied to Bell and McCord (1991) read from a figure at ±0.02, and their ultraviolet calibration carries a stated ±10 % uncertainty; the archive's own ratios are in the prepared report.

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Ariel (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, converts each positive-east centre through `presentation/surface-map.json` with the map’s left edge at 180° E, and anchors it on the mesh; craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The map edge was fixed by drawing Gazetteer rims under both edge hypotheses and keeping the one where Kachina Chasmata and the named craters on the prepared minimap (±180° cylindrical cube) coincide with the imagery.

Feature notes: 5 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

Only source-valid samples are interpolated. ISIS special pixels become the shared neutral grid. Low intensity is not by itself a missing-data rule. The northern region unseen by Voyager is not reconstructed, mirrored, or filled with another body's texture. The paper discusses faint Uranus-shine observations of northern terrain; their existence is not treated as global mapped coverage.

The DEM contains sparse curved limb-profile tracks outside the denser image-derived terrain coverage; those are real source-valid samples, not continuous regional coverage. They remain visible without filling their surroundings.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<a id="selected-interpretation"></a>
<a id="source-grid-and-preparation"></a>
<a id="dataset-survey"></a>

<details>
<summary>Methods and source notes</summary>

**Source grid and preparation**

The selected original files are `aumap-cyl-180180.cub` and `audem-ZTL-cyl-180180.cub`. Both are 3652 × 1826 ISIS3 Real/Lsb cubes tiled in 332 × 166 samples. Their labels declare simple cylindrical projection, planetocentric latitude, positive-east longitude, a −180…180° range, center longitude 180°, equatorial mapping radius 581100 m, polar radius 577700 m, upper-left origin (−3652000, 913000) m, and 1000 m pixels. The shared loader registers these into the application's 0…360° maps before preparing retained surface and pole atlases.

The mosaic's own ISIS history records `photomet` on 2020-02-22 with ellipsoid angles, maximum emission 70°, maximum incidence 89.9°, followed by the release's low/high-frequency mosaicking and display stretch. Preparation retains this supplied processing and applies one linear 0–3000 DN display stretch, clamping display endpoints while keeping valid dark samples valid. This is a display choice, not a conversion to physical reflectance. The source values span approximately −895 to 8699 DN; bright outliers exceed the display range. Small-map comparisons at upper bounds 2400, 3000, and 3600 DN informed the selected contrast.

The DEM's numeric extrema are approximately −7.024 and +5.796 km. Its displayed scale is −8 to +6 km. Northwest cartographic lighting uses a unit direction (−0.5 east, +0.5 north, +0.7071 up), ambient 0.25, and the actual 1000 m/km height conversion without height exaggeration.

Both lenses use the same fixed 5760 × 2880 prepared sampling bank, 64-pixel projective gutters and 1024-pixel pole tiles independently of DPR. This density supports the retained projective mapping and does not add native detail. The shared 450-face sphere uses the vendored 578.9 km mean radius; elevation colors do not displace its geometry. Both views support shared flood curvature and optional directional Shadows. The default camera targets 270° E, 50° S.

Minimaps and thumbnails use the same prepared interpretation. The navigation/context marker is a purpose-sized crop of observed southern terrain, with shared full-phase curvature; it is not a new full-disc observation. Its original normalized-map crop is (2200, 1100), 700 × 700 pixels. Original cube bytes are retained unchanged inside gzip with both original and compressed hashes in the manifest. Content-addressed source URLs allow automated restoration without the upstream browser challenge; large source binaries are excluded from Git and runtime installation.

The candidate dispositions and their source evidence are recorded in the [investigation ledger](investigations.json).

Physical/orbital values come from the vendored astronomy package: JPL satellite elements and IAU/NAIF Ariel rotation at the shared epoch. [NASA's Ariel overview](https://science.nasa.gov/uranus/moons/ariel/) supplies editorial and discovery facts. No atmospheric shell is supported.

</details>

<details>
<summary>Shape, rotation and camera on the shared raster lane</summary>

The recipe declares a sphere of 578.9 km. The retained mesh keeps its spin origin at 0°; the world frame, pole and prime meridian at the shared epoch come from `src/platform/solar-geometry.mts` as for every prepared body. The scene records a 2.5207-day prograde rotation (synchronous: the astronomy package's orbital mean motion) and 0° tilt to its orbit for the 84-second visual rotation; neither drives the physical frame. The camera is the shared solar-system camera (zoom 1.1, 37.55° initial pitch, -104.50° yaw, taken from the retired lane's camera).

</details>
