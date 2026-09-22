# Rhea

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

`/rhea/` — Cassini and Voyager data on a simplified spacecraft-derived shape.

## Sources

| View | Source | What it means |
| --- | --- | --- |
| Monochrome | USGS Cassini–Voyager mosaic, 2012 | About 417 m/pixel. Source shadows and seams remain; documented gaps are gridded. |
| Enhanced color | [NASA/JPL PIA18438](https://www.jpl.nasa.gov/images/pia18438-color-maps-of-rhea-2014/) | Includes ultraviolet and infrared information, beyond human-eye color. |
| Shape and elevation | [Weirich et al. (2025), v1.0](https://doi.org/10.26033/tqxb-q714) | Shape reduced to 2,000 faces. Color shows modeled height above a 763.5 km reference sphere. |
| Relative albedo | [Weirich et al. (2025), v1.0](https://doi.org/10.26033/tqxb-q714) | Relative brightness, with no units. Terrain and shadows affect its values; it is not calibrated reflectance. |
| Infrared and ice absorption | [Scipioni/Combe VIMS collection](https://doi.org/10.17189/ctqe-ta30) | Infrared is false color. Absorption is a spectral indicator, not ice percentage, grain size or temperature. |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/RHEA/target) Rhea centre-point export, snapshot 2026-09-11, public domain. IAU-adopted names with centre, diameter, extent and name origin; labels appear at the closest zoom only, and a selected feature stays labelled. |

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Evidence

The photographic atlas now samples each pinned original grid directly with a 2 × 2 texel footprint. It retains the source frame, coverage policy and fixed-epoch lighting. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) explains the sampling and encoding controls.

| View | Original grid | Both lighting images, before → current |
| --- | --- | --- |
| normal | 11520 × 5760 | 6.66 → 9.69 MB |
| enhanced | 12015 × 6008 | 15.34 → 20.46 MB |

Each atlas remains 2048 × 16000 pixels, with 2000 retained faces. The scene bytes match [the previous main version](https://github.com/layoutit/css.earth/tree/3efdf2c9ed9047c72409b2730e879123f8c3b9d2/src/planets/rhea/prepared). WebP quality is 95; decoded texture size is unchanged. Sampling details and output hashes are recorded in the prepared surface metadata (`prepared/surfaces.json`). Source resolution, gaps and existing registration limitations still apply.

Existing reports; no body tests were rerun for this documentation edit.

- **Shape:** the mesh was closed and connected. The largest distance between the
  source shape and simplified display mesh in 8,000 sampled comparisons was
  5,700.82 m; sampling does not establish a full error bound.
  [Shape and delivery results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/moons/b2-preparation/final/DELIVERY.md).
- **VIMS:** reading and interpreting the original spectral files were checked independently.
  The mission team's earlier processing was not rerun.
  [Source review](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/moons/b7-cassini-atlas/evidence/source/SOURCE-REVIEW.md).
- **Browser and delivery:** selected views at device pixel ratios (DPR) 1 and 2, with saved images and
  installation results. Settings access and full-suite checks remained incomplete.
  [Visual review](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/moons/b7-cassini-atlas/VISUAL-REVIEW.md) ·
  [Run results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/moons/b7-cassini-atlas/evidence/integration/qualification.json).

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Rhea (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, and converts each positive-east centre into the body-fixed frame the radial terrain sampler uses for this mesh (longitude 0 toward the mesh +y axis, 90° E toward +x, north +z), then casts that direction through the prepared hit mesh so every anchor and outline point sits on the shape model rather than on a reference sphere. Craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The frame was confirmed on Mimas and Phobos, where Herschel and Stickney fall at local minima of the shape radius.

Feature notes: 4 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

- Shape simplification removes detail. Image seams, shadows and numeric-map gaps remain.
- Absolute VIMS registration at fractions of a source pixel is unresolved.
- The [old catalog](source/observations/catalog.json) still says relative albedo was
  excluded, although the current recipe and content include it.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation settings](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Photographic map origins and landmark checks</summary>

[USGS Cassini–Voyager mosaic,
2012](https://astrogeology.usgs.gov/search/map/rhea_cassini_voyager_global_mosaic_417m): 11520
× 5760, 416.75190045277 m/pixel, 764.1 km projection sphere. The catalog download link
incorrectly points to the older 833 m Voyager map. The pinned
`Rhea_Cassini_Voyager_mosaic_global_417m.tif` matches the catalog dimensions and metadata and
includes the March 2012 Cassini flyby.

Six Voyager images supply north-polar coverage.

The GeoTIFF has center longitude 180° but origin easting zero: its left edge is 180° E. Shared
preparation derives the half-width roll from the actual origin. It does not mirror the map.

Exactly zero is documented no-data and gets the shared gray grid; other source pixels remain
unchanged apart from resampling and delivery compression.

[NASA/JPL PIA18438](https://www.jpl.nasa.gov/images/pia18438-color-maps-of-rhea-2014/):
published 2014-11-04, 12015 × 6008, about 400 m/pixel. Cassini ISS colors extend beyond human
vision into ultraviolet and infrared. Paul Schenk calibrated, registered and photometrically
corrected the observations.

The map begins at 0° E and needs no roll. The source's one-pixel departure from 2:1 is
resampled to the common layout.

The color map has no separate validity mask, so all published pixels are retained. Hemisphere
differences include real surface alteration and E-ring dust. Photographed shadows, image seams
and coarse inserts remain; no inpainting, color synthesis or shadow-removal correction is
applied.

Shared curvature lighting and optional Shadows remain available on every lens.

Independent landmarks: [Tirawa](https://planetarynames.wr.usgs.gov/Feature/6026), 34.2° N,
151.7° W (208.3° E), and [Inktomi](https://planetarynames.wr.usgs.gov/Feature/14671), 14.1° S,
112.1° W (247.9° E). These source positions check map orientation.

</details>

<details>
<summary>Height conversion, shape approximation and albedo limits</summary>

[Weirich, Gaskell, Palmer and Domingue (2025), Rhea SPC Shape Models and Assessment Products
V1.0](https://sbn.psi.edu/pds/resource/weirichrheashape.html), NASA PDS, DOI
[10.26033/tqxb-q714](https://doi.org/10.26033/tqxb-q714). The original XML label, product
description and quality assessment are retained beside the GeoTIFF.

The 2222 × 1111 equirectangular raster stores center-relative radius in meters. Displayed
height is `radius * 0.001 - 763.5` km, with a −10 to +10 km color scale. The actual
geotransform stops slightly short at the east and south edges.

Those narrow strips are marked with the shared gray grid, without extrapolation. All source
cells themselves are valid.

The model uses 2719 Cassini images through 2015-02-15. Model spacing is about 2.15 km and the
producer’s one-to-two-grid-spacing estimate derives from simulation experience, not independent
per-cell Rhea uncertainty. It is a derived terrain model, not direct imagery.

Color represents height; brightness adds fixed northwest relief at true height scale. Geometry
follows a simplified source mesh and shared globe lighting remains active.

#### Shape and albedo

The native global Q128 OBJ is 98,306 vertices and 196,608 triangles in kilometres, north along
+Z and longitude zero along +X. Exact source topology is retained before simplification. The
displayed mesh has 2,000 faces.

Preparation uses `regularize: false` and a 7,635 m simplification limit (1% of the model
reference radius). This is a display approximation budget, not scientific uncertainty. The
original photographic-map projection radii remain separate from shape geometry and the numeric
elevation datum.

Relative albedo uses the published 2025 GeoTIFFs and their original equatorial/polar
projections. Values are dimensionless and normalized around 1; the archive gives a nominal 0–2
domain. The visible 0.5–1.5 scale saturates above 1.5.

No height conversion or relief shading is applied to this quantity. It is a secondary SPC
brightness product, less validated than topography. The [producer’s assessment, page
1](source/science/b2-intake/rheashapeassessment.pdf) documents terrain and shadow effects in
its values; it is neither geometric albedo nor calibrated reflectance.

Rhea used calibrated ISS frames. Source sigma is internal maplet agreement, not absolute height
uncertainty.

The Shape lens uses the shared neutral gray over the source mesh to distinguish geometry from
imagery. The Photographic views retain pre-existing image seams, shadows and local control
differences. Source reference radii and projections do not become spherical geometry
constraints.

The original Q128 spacing is about 8.6 km; finer numeric maps do not imply the simplified
silhouette retains that full detail.

The relative-albedo GeoTIFF ends at 359.151742419° East and 89.575871210° South with its exact
delivered pixel scale, leaving narrow longitude and south-polar gaps. These remain missing; the
nominal global product is not stretched to force complete raster coverage. Independent tests
check source cells and both unfilled strips.

#### Sampled shape errors

The B2 mesh had Euler characteristic 2 and one connected component. The 8,000 one-way
barycentric samples had 95th percentile distance 2,867.32 m and RMS 1,460.13 m. These are
display approximation measurements, not source uncertainty.

</details>

<details>
<summary>Physical references and image preparation</summary>

The astronomy package supplies Rhea's Saturn-relative orbit, IAU orientation and the
[JPL satellite table](https://ssd.jpl.nasa.gov/sats/phys_par/sep.html) mean radius of 763.50 km;
the recipe display scale reference uses the same value. [NASA](https://science.nasa.gov/saturn/moons/rhea/) rounds the radius
to 764 km. Keep that physical value separate from the 764.1 km monochrome projection sphere and
763.5 km elevation datum.

The very tenuous exosphere does not justify a visible halo. Rings are not rendered: the
debris disk inferred by [Jones et al. 2008](https://doi.org/10.1126/science.1151524) was not
found by the Cassini imaging search of [Tiscareno et al. 2010](https://doi.org/10.1029/2010GL043663),
and the reader text states both results.

Map preparation retains the shared 8192 × 4096 latitude-band layout and 1024-pixel pole products.
The normal and enhanced photographic atlases sample their pinned original grids directly with a
2 × 2 footprint into the fixed per-triangle layout and use WebP quality 95. Latitude bands,
scientific products and their lossless inputs retain their existing preparation and encoding.

Native observations are downsampled, and larger textures would not increase the terrain model's
detail.

</details>

<details>
<summary>VIMS input records and conversion</summary>

The [pinned VIMS interpretation](source/vims/INTERPRETATION.md) contains the source and field
definitions and conversion limits for the two added views. The source is Scipioni and Combe's
Cassini VIMS mosaic collection, DOI [10.17189/ctqe-ta30](https://doi.org/10.17189/ctqe-ta30).
Manifest entries prefixed `rhea-vims-source-` pin the cube, wavelengths, original labels and
guide; `source/vims/prepare-maps.json` and the shared acquisition converter specify our
conversion.

The archived mission-to-mosaic reduction is not reproduced here.

Infrared displays three measured reflectance channels in false color. Ice absorption is a
continuum-relative indicator derived from those spectra; it is not ice percentage,
crystallinity, grain size or temperature. Missing samples remain missing.

Absolute registration at fractions of a native pixel remains unresolved. The source review
and test results are linked in [Evidence](#evidence).

</details>
