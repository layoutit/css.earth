# Umbriel

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Monochrome uses Paul Schenk’s [2020 LPI Uranian satellites release](https://repository.hou.usra.edu/handle/20.500.11753/1687), original `uumap-cyl-180180.cub`. The unchanged ISIS3 file is losslessly gzipped; both original and compressed identities are pinned in the manifest. The source README is retained alongside it.

This is source-normalized imagery, not calibrated albedo or recovery of terrain in cast shadows. Resolution varies, acquisition shadows and processing seams can remain. A display stretch of 0–1950 source DN retains the bright Wunda ring’s tonal structure; it is not a physical reflectance scale. A narrower trial stretch was rejected because it clipped that feature. The original float data remain intact.

## Evidence

Polar sprites now sample the pinned original photographs directly, preserving the declared coordinates and source gaps. Existing monochrome fallback is retained where a color view already uses it. Each sprite is 1024 × 512 pixels, the one prepared density; latitude-band images, geometry and lighting remain unchanged. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) describes the method and its limits.

| View | Both prepared levels, before → current |
| --- | --- |
| normal | 74.5 → 85.0 kB |

These download sizes refer only to the polar sprites. Decoded dimensions are unchanged. The scene matches [the previous main version](https://github.com/layoutit/css.earth/tree/3efdf2c9ed9047c72409b2730e879123f8c3b9d2/src/planets/umbriel/prepared); [the raster recipe](source/preparation/raster.json) and [asset inventory](runtime-assets.json) bind the current preparation. Existing source-resolution and registration limits still apply.

Lane change (this PR): the terrestrial solid-observation lane was retired for Umbriel; the same pinned inputs and the same decoders (`terrestrial-observation` through the raster lane's `science` adapter) now feed the shared raster lane used by Mercury, Venus, Mars, the Moon and Pluto. The sphere is the shared 16 × 32 mesh (450 leaves, 230 units, 50-pixel tile, 0.005 overlap) with the 256-frame Lambert lighting bank and no atmosphere. Surfaces are painted at 2048 × 1024 (DPR 1) and 4096 × 2048 (DPR 2) — native ISIS cube 919 × 460; the retired 5760 × 2880 atlas was an upsample. Verified with the package, source-closure, minimap and browser conformance checks listed in the pull request; the nomenclature recipe and map edge are unchanged and the labels were re-drawn against the new atlas. No new science review is claimed.

Run of 2026-09-12 (this version): `node tools/objects/dist/prepare-authored.js umbriel --write` prepared the package through the shared raster lane and `tools/objects/observation/interpret.mts`; `node --test tests/objects/unit/umbriel/*.test.mts` passes except the shared runtime-package and import-closure tests that fail identically on `main` (recorded once in the pull request).

A headless Chrome probe (`output/probe-spheres.mts`, ignored scratch) mounted the page on the dev server, selected every lens (normal) with no console errors or failed requests, and pinned a Gazetteer feature from the sidebar search on the standard mesh (feature id 6587).

Gazetteer rims drawn over the prepared equirectangular minimap at both candidate map edges (`output/edge-markers.mjs`) agree with the declared `mapLeftEdgeLongitudeDeg` in `source/preparation/features.json`.

No dated test report is cited in the existing source notes.

### Voyager color lens (run of 2026-09-22, this version)

Sources. The lens uses Voyager 2 ISS narrow-angle GEOMED frames from the PDS Ring-Moon Systems Node
(volumes VGISS_7201–7207, inventoried through the OPUS API): every complete green/violet/ultraviolet
set of Umbriel that the archive holds, 24 frames in 8 sets, listed in
[the frame recipe](source/preparation/voyager-color-frames.json). The camera comes from the pinned
[Voyager 2 Uranus kernel bank](../../spice/voyager/manifest.json): the `ura111` satellite ephemeris,
the `vgr2.ura111` trajectory and the Ring-Moon Systems Node SEDR pointing C-kernel. Observer and Sun
positions for the photometric correction are JPL Horizons vectors at each frame's exposure time.

Placement. `node tools/objects/voyager-iss/author-color-frames.mts umbriel --write` wrote
[the placement report](source/reference/voyager-color-placement.json). The SEDR pointing predicts the
disc; the limb is fitted as one circle (robust levels from the frame's own histogram, a centroid seed
when the whole disc sits in the frame far from the prediction) and the optical centre moves by the
fitted offset; the SEDR errors removed here were 181–198 pixels and the accepted fits have an
RMS of 0.39–1.14 pixels. Each frame is then registered against the Schenk 2020 mosaic rendered
through its own camera (high-passed cross-correlation, search ±30 pixels); a set stands on the frame
that registered best and its other bands register to that anchor, so a band that does not register is
dropped rather than fringed. Applied registrations correlate at 0.23–0.23. 3 frames in
1 sets were placed: set-19860123-0121 (16.9 km/px). 21 frames were not: 9 the limb fit rejected it; 12 no frame of this set registered against the mosaic.
Only pixels above the frame's ground floor (a tenth of the way from its sky level to its disc level,
`limb.groundFloor`) are projected: a disc cut by the frame edge sits on a band of negative values in
the GEOMED border rows, which would otherwise become terrain.

Oracle. `node tools/objects/voyager-iss/oracle.mts umbriel --write` re-places every frame and correlates
its high-passed detail against the mosaic in the frame plane
([report](source/reference/voyager-color-oracle.json)): 3 frames compared, mean
correlation 0.21, mean residual 209.0 km. The mosaic is the same control the
Monochrome lens uses, so the colour lands on the ground the reader already sees.

Colour. Each set is composed as a complete green/violet/ultraviolet triplet, corrected with the same
Lunar-Lambert disk function as the monochrome mosaic to incidence 30°, emission 0°, used within 60°
of both, and ground the finest set views too steeply goes to the next set (`withheld: next-observation`). The other sets are scaled band by band onto the set-19860123-0121 set by weighted least squares over the median ratios of all overlapping pairs on a 0.25° grid (`bandLevels`; gains ).
The archive's filter calibration leaves violet darker than both green and ultraviolet on every one of
the five moons (measured here, Umbriel: violet/green 0.948, ultraviolet/green 1.010), which is also what the
Voyager team's own disk-averaged spectra show (Smith et al. 1986 as plotted by Bell and McCord 1991,
Fig. 2) and which renders purple. Bell and McCord (1991, *Proc. Lunar Planet. Sci.* 21, 473–489;
[ADS 1991LPSC...21..473B](https://ui.adsabs.harvard.edu/abs/1991LPSC...21..473B)) recalibrated the
filters against ground-based spectra (factors UV 1.186 ± 0.08, VIO 1.125 ± 0.04, GRN 0.926 ± 0.03) and
published whole-disc spectra normalised at green; read from their Fig. 2 at ±0.02, Umbriel has
ultraviolet/green 1.03 and violet/green 1.0. The recipe names those ratios (`bandRatios`) and the
composer scales the violet and ultraviolet bands by one gain each (1.055, 1.020) so the
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
ratios; `node --test tests/objects/unit/umbriel/*.test.mts` covers the runtime package with the new lens.

## Known problems

- The Voyager color lens is false colour (green, violet, ultraviolet as red, green, blue) at the observations' own phase angles; no phase normalisation is applied, so a colour seam at a footprint edge is a real difference in viewing geometry. Its whole-disc band ratios are tied to Bell and McCord (1991) read from a figure at ±0.02, and their ultraviolet calibration carries a stated ±10 % uncertainty; the archive's own ratios are in the prepared report.

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Umbriel (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, converts each positive-east centre through `presentation/surface-map.json` with the map’s left edge at 180° E, and anchors it on the mesh; craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The map edge was fixed by drawing Gazetteer rims under both edge hypotheses and keeping the one where the bright Wunda ring on the prepared minimap (±180° cylindrical cube) coincide with the imagery.

Feature notes: 4 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

The neutral grid marks missing observations. The separate limb-profile product uses an older control network displaced by degrees and does not provide continuous elevation coverage.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

<a id="umbriel-source-record"></a>
<a id="dataset-survey"></a>

<details>
<summary>Methods and source notes</summary>

The 919 × 460 floating-point mosaic has a 4,000 m grid, a 584,700 m spherical reference, planetocentric latitude and east-positive longitude. Its bounds are −180…180°, center longitude 180°, and upper-left projected origin (−3,676,000, 920,000) m. These seemingly unusual center/bounds values are applied together, not reinterpreted as a conventional image longitude origin. Only ISIS special pixels are missing; observed low and negative values remain observations.

The embedded history records ISIS `photomet` on 2020-02-15 with ellipsoid angles, maximum emission 79° and incidence 89.7°, followed by filtering/mosaic processing.

Preparation samples at 5760 × 2880 with 64-pixel atlas gutters and 1024-pixel pole tiles to avoid projective face-edge undersampling. This does not add observational detail. WebP q95 encodes the final surface only. Missing observations use the shared neutral grid. Surface, pole, thumbnail, small minimap and 160-pixel context marker (capped by the native crop) derive from the same interpretation. Shared flood and directional lighting remain available. The spherical 450-face scene is a display approximation within the 2000-face budget, not a measured shape mesh.

The candidate dispositions and their source evidence are recorded in the [investigation ledger](investigations.json).

[NASA’s Umbriel overview](https://science.nasa.gov/uranus/moons/umbriel/) supports the cratered appearance, bright Wunda region and Lassell’s 1851 discovery. Radius, synchronous rotation and orbital placement come from the existing vendored JPL/IAU astronomy records at the shared epoch. No visible atmosphere or rings are supported.

</details>

<details>
<summary>Shape, rotation and camera on the shared raster lane</summary>

The recipe declares a sphere of 584.7 km. The retained mesh keeps its spin origin at 0°; the world frame, pole and prime meridian at the shared epoch come from `src/platform/solar-geometry.mts` as for every prepared body. The scene records a 4.1445-day prograde rotation (synchronous: the astronomy package's orbital mean motion) and 0° tilt to its orbit for the 84-second visual rotation; neither drives the physical frame. The camera is the shared solar-system camera (zoom 1.1, -30.59° initial pitch, -99.19° yaw, taken from the retired lane's camera).

</details>
