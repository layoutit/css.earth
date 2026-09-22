# Triton

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Michael Bland / USGS, [High Resolution Voyager 2 Images of Neptune’s Moon
Triton](https://doi.org/10.5066/P9MGH7FB), 2023 processing of 1989 Voyager images.
We use the CLEAR-filter frames in `fully_processed.zip`, at their native
approximately 335–1633 m/pixel scales. Their calibrated float I/F, corrected
locations, per-frame GeoTIFF grids and ISIS metadata remain authoritative.
USGS removed reseaux and corner marks with local interpolation; we do not add
terrain, fill coverage or borrow another body's surface.

Paul Schenk / LPI's [2014 global color map](https://www.lpi.usra.edu/icy_moons/neptune/triton/),
`tnmap-cyl-KH.jpg`, 14,138 × 7,069, approximately 600 m/pixel at the equator.
LPI documents image selection, radiometric calibration, geographic registration,
photometric correction and mosaic assembly. NASA/JPL supplied Voyager images;
credit Paul Schenk, Lunar and Planetary Institute. Public use is permitted with
that credit. Orange/green/blue filter images approximate natural color with
enhanced contrast. Color resolution varies across observations.

Paul Schenk / LPI's [2021 orange/blue/ultraviolet global mosaic](https://repository.hou.usra.edu/items/bcb44bc8-5140-48eb-b561-12326d7bb6e7)
(Schenk et al. 2021, *Remote Sensing* 13:3476), `tnmap-cyl-KH-obu.jpg`, 14,165 × 7,083,
is the Ultraviolet color lens: orange, blue and ultraviolet filters shown as red,
green and blue, declared false colour. The LPI repository answers scripted
requests with a browser challenge, so the JPEG is mirrored byte for byte on R2
and restored from there; credit Paul Schenk / LPI / USRA and NASA/JPL Voyager 2.

The Voyager color lens is built here from Voyager 2 ISS frames, not from a
published map. Two frame sets feed it:

- Twelve green, violet and ultraviolet frames near closest approach
  (c1139257–c1139323, 1.44–1.62 km/pixel) from Bland's controlled release above,
  already placed by its bundle adjustment; we only reproject each orthophoto.
- Fifteen approach frames at 4.0–25 km/pixel (five green/violet/ultraviolet
  triplets: c1138657/703/715, c1137715/721/727, c1137159/221/245,
  c1133848/859/923 and c1132134/141/400) as the PDS Ring-Moon Systems Node
  GEOMED products from volume VGISS_8207, geometrically corrected and
  calibrated (`REFLECTANCE_SCALING_FACTOR` 1e-4 turns the stored DN into I/F).
  Bland et al. excluded the ~4 km/pixel colour by scope; Schenk et al. (2021)
  used these frames in their bundle adjustment but released only the mosaic.
  We place them ourselves (below). Each frame is pinned with its PDS origin and
  restored from there; the per-frame equirectangular tiles the placement writes
  (`observations/voyager-color/*.equi.tif`, 38 tiles, 87 MB) are mirrored on R2
  and regenerate byte-identically from the pinned inputs.

The camera comes from a pinned [Voyager 2 Neptune kernel bank](../../spice/voyager/manifest.json):
NAIF leap seconds, `pck00010`, the Voyager 2 clock, frames and ISS narrow-angle
instrument kernels, the `vgr2_nep097` trajectory and the Ring-Moon Systems Node
SEDR pointing C-kernel. No reconstructed (C-smithed) pointing exists for the
Neptune encounter, so the SEDR pointing is corrected here by a limb fit.
Observer and Sun positions for the photometric correction are JPL Horizons
vectors at each frame's exposure time.

## Evidence

Polar sprites now sample the pinned original photographs directly, preserving the declared coordinates and source gaps. Existing monochrome fallback is retained where a color view already uses it. Each sprite is 1024 × 512 pixels, the one prepared density; latitude-band images, geometry and lighting remain unchanged. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) describes the method and its limits.

| View | Both prepared levels, before → current |
| --- | --- |
| enhanced | 160.4 → 169.7 kB |

These download sizes refer only to the polar sprites. Decoded dimensions are unchanged. The scene matches [the previous main version](https://github.com/layoutit/css.earth/tree/3efdf2c9ed9047c72409b2730e879123f8c3b9d2/src/planets/triton/prepared); [the raster recipe](source/preparation/raster.json) and [asset inventory](inventory.json) bind the current preparation. Existing source-resolution and registration limits still apply.

Lane change (this PR): the terrestrial solid-observation lane was retired for Triton; the same pinned inputs and the same decoders (`terrestrial-mosaic`, `terrestrial-observation` through the raster lane's `science` adapter) now feed the shared raster lane used by Mercury, Venus, Mars, the Moon and Pluto. The sphere is the shared 16 × 32 mesh (450 leaves, 230 units, 50-pixel tile, 0.005 overlap) with the 256-frame Lambert lighting bank and no atmosphere. Surfaces are painted at 7168 × 3584 (DPR 1) and 14336 × 7168 (DPR 2) — retired 14336 × 7168 atlas from the controlled orthographic mosaic. Verified with the package, source-closure, minimap and browser conformance checks listed in the pull request; the nomenclature recipe and map edge are unchanged and the labels were re-drawn against the new atlas. No new science review is claimed.

Run of 2026-09-12 (this version): `node tools/objects/dist/prepare-authored.js triton --write` prepared the package through the shared raster lane and `tools/objects/observation/interpret.mts`; `node --test tests/objects/unit/triton/*.test.mts` passes except the shared runtime-package and import-closure tests that fail identically on `main` (recorded once in the pull request).

A headless Chrome probe (`output/probe-spheres.mts`, ignored scratch) mounted the page on the dev server, selected every lens (normal, enhanced) with no console errors or failed requests, and pinned a Gazetteer feature from the sidebar search on the standard mesh (feature id 16356).

Gazetteer rims drawn over the prepared equirectangular minimap at both candidate map edges (`output/edge-markers.mjs`) agree with the declared `mapLeftEdgeLongitudeDeg` in `source/preparation/features.json`.

No dated test report is cited in the existing source notes.

### Voyager color lens (run of 2026-09-22, this version)

Placement. `node tools/objects/voyager-iss/author-color-frames.mts triton --write`
placed every frame and wrote [the placement report](source/reference/voyager-color-placement.json).
For a GEOMED frame the recorded SEDR pointing predicts the disc; the limb is then
found on the sunlit side (steepest drop from disc to sky along rays from the
predicted centre, robust levels from the frame's own histogram), fitted as one
circle, and the camera's optical centre is moved by the fitted offset. The SEDR
errors removed were 49–256 pixels; every accepted fit has at least 80 edge
points and an RMS below 1.3 pixels. Frames whose limb leaves the frame or whose
crescent gives no clean limb are rejected by the fit and never placed; the
recipe lists only the fifteen that passed.

Oracle. `node tools/objects/voyager-iss/oracle.mts triton --frames <GEOMED directory> --write`
places the controlled release's own colour frames the same way, with no datum
shift, and cross-correlates their high-passed detail against Bland's orthophotos
of the same frames ([report](source/reference/voyager-color-oracle.json)). The
residual is a constant offset: nine of the twelve frames give a clean limb
(three are rejected by the fit: limb outside the frame or no single circle),
their residuals run 19–30 km with a mean of 0.74° in longitude and −0.82° in
latitude and an RMS scatter of 5 km between frames. Bland et al. state their
own absolute alignment as about one degree, so the offset is within their
uncertainty. The recipe applies `datumShiftDegrees` 0.78°, −0.80°, the value
measured when the frames were authored; this run's mean differs from it by
under 1 km, below the 2.4 km tile cell, so the tiles were not re-authored.
With it, limb-placed frames land on the controlled grid the Monochrome lens
already uses.

Colour. Each observation is composed as a complete green/violet/ultraviolet
triplet, corrected with the same Lunar-Lambert disk function as the monochrome
mosaic to incidence 30°, emission 0°, and used only within 60° of both. The two
calibrations disagree: where the Bland orthophotos and the 4.7 km/pixel GEOMED
triplet see the same ground, Bland's `voycal` I/F is darker by a different
factor in each band (green 1.35, violet 1.19, ultraviolet 1.28 as GEOMED ÷ Bland
medians). The GEOMED values reproduce Nelson et al. (1990, *GRL* 17:1761)
disc-integrated colour: green ÷ violet 1.21 here against their geometric
albedos 0.81 ÷ 0.68 = 1.19, while the Bland frames give 1.06. So the recipe
names the 4.7 km set as the level reference and every other observation is
scaled onto it band by band, by weighted least squares over the median ratios
of all overlapping pairs on a 0.25° grid (`bandLevels`; the solved gains and
every pair are in `prepared/assets.json`). Bland's frames view about half of
their own footprint beyond 60° emission; the recipe's `withheld:
next-observation` lets the 4.7 km triplet, which views that ground more
squarely, own those texels instead of leaving them grey. Both policies are
documented in [the colour preparation guide](../../../docs/color-preparation.md#current-routes-and-scope-of-the-repair).
The whole lens then takes one brightness gain against the monochrome base, the median over every footprint boundary (a per-observation match would re-open the seams, and the two coarsest sets never border the base); the brightest 0.1 % of texels may clip.

Tests. `node --test tools/objects/voyager-iss/*.test.mts tools/objects/terrestrial-layers/photometric-observations.test.mts`
covers the limb fit, the tile writer and both composer policies on synthetic
data; `node --test tests/objects/unit/triton/*.test.mts` pins the placement
report, the manifest pins, the solved gains and the withheld counts of this run.

## Known problems

- The Voyager color lens is false colour (green, violet, ultraviolet as red, green, blue) at the observations' own phase angles, 39°–62° for the Bland set and wider for the approach frames; no phase normalisation is applied, so a colour seam at a footprint edge is a real difference in viewing geometry. The limb-placed frames carry the controlled release's roughly one-degree absolute alignment plus the 2–4 km scatter of our fit; Schenk et al. (2021) place the same frames by bundle adjustment but released only their mosaic. The oracle's raw GEOMED frames of the Bland colour set are not pinned in the manifest; the report names them and their PDS volume.
- The Gazetteer shapefile export for Triton publishes a diameter for only 4 of its 63 adopted names (the four craters); the other 59 rows carry neither a diameter nor a usable extent in the export, so preparation tallies them as skipped (`prepared/features.json`) and only the four craters are labelled until the export carries sizes.

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Triton (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, converts each positive-east centre through `presentation/surface-map.json` with the map’s left edge at 180° E, and anchors it on the mesh; craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The map edge was fixed by drawing Gazetteer rims under both edge hypotheses and keeping the one where Bubembe Regio, Boynne Sulci and the named cavi all falling inside the Voyager coverage of the cylindrical mosaic coincide with the imagery.

Feature notes: 7 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

The original unannotated LPI map runs from 180° W to 180° E, north at the top.
Preparation rolls it to the shared 0–360° east-positive globe convention.
The source's black northern region was not illuminated by Voyager. Exact black
background is withheld before resampling, and all interpolation taps must remain
valid. The USGS `GlobalFill` derivative is not used: it interpolates over map grid
lines. Neither color nor Monochrome silently fills the other's gaps.

Triton has a thin nitrogen atmosphere. These observations do not justify a
visible atmospheric halo or an elevation lens inferred from brightness.

No phase, atmosphere-scattering or terrain-shadow inversion is
claimed. Incidence/emission above 80° and amplification above 6 are withheld
geometrically; low brightness alone never marks missing terrain.

The per-frame Lunar-Lambert correction reduces acquisition shading;
it is not a recovered calibrated albedo map. Local terrain shading, source
resolution changes and some patch transitions remain. Frame-level correction
and exposure receipts are generated in `prepared/surfaces.json`.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<a id="monochrome"></a>
<a id="enhanced-color"></a>
<a id="presentation-and-reproduction"></a>

<details>
<summary>Methods and source notes</summary>

The generic authored solid-body package provides one retained 450-leaf sphere,
shared shell, flood lighting and optional Sun Shadows. Its 1,352.6 km mean
radius, Neptune parent orbit, pole and synchronous retrograde rotation come from
the vendored JPL/NAIF/IAU astronomy sources. The opening camera faces measured
southern terrain. It does not move, stretch or replace observations.

**Monochrome**

The TIFFs and original ISIS metadata specify orthographic center **15° east,
18° north**, positive-east longitude, radius 1,352,600 m. The release prose says
15° west; the embedded grid and corresponding original label control these
pixels. The opposite orthographic hemisphere is rejected before sampling.
All bilinear samples must be observed; ISIS special values remain unavailable.

Correction runs on individual calibrated frames before composition, using the
existing Lunar-Lambert implementation (weight 0.5, 30° incidence / 0° emission
reference). Sun and Voyager 2 vectors are pinned JPL Horizons ICRF/km responses
at each ISIS cache epoch; the frame's own PCK00009 coefficients transform them
into the map's body frame. Horizons ephemerides can differ from the original
NEP081 kernels.

Coarser frames establish levels; finer valid observations replace them. Robust
co-located overlap ratios set one bounded exposure multiplier per frame
(0.67–1.5). Source detail stays within its own observation. The fixed display
transfer is I/F divided by 0.9 with gamma 1.4.

**Presentation and reproduction**

The 14,336 × 7,168 preparation grid retains approximately 593 m equatorial
texels. It does not make the coarser observations sharper. Source masks become
the shared gray coverage grid. The enhanced photographic polar sprites sample
their pinned source grid directly with a 2 × 2 footprint and retain lossless WebP
encoding; latitude-band surfaces retain their existing q90 encoding with lossless
alpha. Poles and 640-pixel previews are prepared separately. Previews center
longitude zero so the observed region is continuous; globe coordinates stay
unchanged. Both datasets retain the app's flood and directional lighting.

</details>

<details>
<summary>Shape, rotation and camera on the shared raster lane</summary>

The recipe declares a sphere of 1352.6 km. The retained mesh keeps its spin origin at 0°; the world frame, pole and prime meridian at the shared epoch come from `src/platform/solar-geometry.mts` as for every prepared body. The scene records a 5.8770-day retrograde rotation (synchronous with the retrograde orbit; IAU pole) and 0° tilt to its orbit for the 84-second visual rotation; neither drives the physical frame. The camera is the shared solar-system camera (zoom 1.1, 0.08° initial pitch, 84.34° yaw, taken from the retired lane's camera).

</details>
