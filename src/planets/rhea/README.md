# Rhea

Route: `/rhea/`. Cassini and Voyager imagery and scientific maps on a simplified
spacecraft-derived shape.

## Sources

The [source manifest](source/manifest.json) pins input files and metadata.
[NOTICE](NOTICE.md) records credits and reuse terms. The [descriptor](object.json)
and [recipes](source/preparation) specify preparation; [generated provenance](prepared/provenance.json)
connects outputs to inputs, and the [delivery inventory](runtime-assets.json)
identifies the shipped images.

### Monochrome and Enhanced color

[USGS Cassini–Voyager mosaic, 2012](https://astrogeology.usgs.gov/search/map/rhea_cassini_voyager_global_mosaic_417m): 11520 × 5760, 416.75190045277 m/pixel, 764.1 km projection sphere. The catalog download link incorrectly points to the older 833 m Voyager map. The pinned `Rhea_Cassini_Voyager_mosaic_global_417m.tif` matches the catalog dimensions and metadata and includes the March 2012 Cassini flyby. Six Voyager images supply north-polar coverage.

The GeoTIFF has center longitude 180° but origin easting zero: its left edge is 180° E. Shared preparation derives the half-width roll from the actual origin. It does not mirror the map. Exactly zero is documented no-data and gets the shared gray grid; other source pixels remain unchanged apart from resampling and delivery compression.

[NASA/JPL PIA18438](https://www.jpl.nasa.gov/images/pia18438-color-maps-of-rhea-2014/): published 2014-11-04, 12015 × 6008, about 400 m/pixel. Cassini ISS colors extend beyond human vision into ultraviolet and infrared. Paul Schenk calibrated, registered and photometrically corrected the observations. The map begins at 0° E and needs no roll. The source's one-pixel departure from 2:1 is resampled to the common layout.

The color map has no separate validity mask, so all published pixels are retained. Hemisphere differences include real surface alteration and E-ring dust. Photographed shadows, image seams and coarse inserts remain; no inpainting, color synthesis or shadow-removal correction is applied. Shared curvature lighting and optional Shadows remain available on every lens.

Independent landmarks: [Tirawa](https://planetarynames.wr.usgs.gov/Feature/6026), 34.2° N, 151.7° W (208.3° E), and [Inktomi](https://planetarynames.wr.usgs.gov/Feature/14671), 14.1° S, 112.1° W (247.9° E). These source positions check map orientation.

### Elevation

[Weirich, Gaskell, Palmer and Domingue (2025), Rhea SPC Shape Models and Assessment Products V1.0](https://sbn.psi.edu/pds/resource/weirichrheashape.html), NASA PDS, DOI [10.26033/tqxb-q714](https://doi.org/10.26033/tqxb-q714). The original XML label, product description and quality assessment are retained beside the GeoTIFF.

The 2222 × 1111 equirectangular raster stores center-relative radius in meters. Displayed height is `radius * 0.001 - 763.5` km, with a −10 to +10 km color scale. The actual geotransform stops slightly short at the east and south edges. Those narrow strips are marked with the shared gray grid, without extrapolation. All source cells themselves are valid.

The model uses 2719 Cassini images through 2015-02-15. Model spacing is about 2.15 km and the producer’s one-to-two-grid-spacing estimate derives from simulation experience, not independent per-cell Rhea uncertainty. It is a derived terrain model, not direct imagery. Color represents height; brightness adds fixed northwest relief at true height scale. Geometry follows a simplified source mesh and shared globe lighting remains active.

### Physical model and delivery

The astronomy package supplies Rhea's Saturn-relative orbit, IAU orientation and 764.5 km display scale reference. [NASA](https://science.nasa.gov/saturn/moons/rhea/) rounds the radius to 764 km. Keep that physical value separate from the 764.1 km monochrome projection sphere and 763.5 km elevation datum. The very tenuous exosphere does not justify a visible halo; proposed rings are not rendered.

Map preparation uses the shared 8192 × 4096 intermediate layout and 1024-pixel pole products. The final source-mesh scene samples these maps into prepared per-triangle atlases. Prepared surface/pole atlases use WebP quality 90 with lossless alpha; intermediate maps remain lossless. Native observations are downsampled, and larger textures would not increase the terrain model's detail.

### Shape and relative albedo

The native global Q128 OBJ is 98,306 vertices and 196,608 triangles in kilometres, north along +Z and longitude zero along +X. Exact source topology is retained before simplification. Preparation uses the measured candidate of 2,000 faces with regularize:false, under a 7,635 m display approximation ceiling (1% of the model reference radius). This is a display approximation budget, not scientific uncertainty. The original photographic-map projection radii remain separate from shape geometry and the numeric elevation datum.

Relative albedo uses the published 2025 GeoTIFFs and their original equatorial/polar projections. Values are dimensionless and normalized around 1; the archive gives a nominal 0–2 domain. The visible 0.5–1.5 scale saturates above 1.5. No height conversion or relief shading is applied to this quantity. It is a secondary SPC brightness product, less validated than topography. The [producer’s assessment, page 1](source/science/b2-intake/rheashapeassessment.pdf)
documents terrain and shadow effects in its values; it is neither geometric albedo nor calibrated reflectance. Rhea used calibrated ISS frames. Source sigma is internal maplet agreement, not absolute height uncertainty.

The Shape lens uses the shared neutral grid over the source mesh to distinguish geometry from imagery. The Photographic views retain pre-existing image seams, shadows and local control differences. Source reference radii and projections do not become spherical geometry constraints. The original Q128 spacing is about 8.6 km; finer numeric maps do not imply the simplified silhouette retains that full detail.

The relative-albedo GeoTIFF ends at 359.151742419° East and 89.575871210° South with its exact delivered pixel scale, leaving narrow longitude and south-polar gaps. These remain missing; the nominal global product is not stretched to force complete raster coverage. Independent tests check source cells and both unfilled strips.

### Cassini VIMS infrared and ice absorption

The [pinned VIMS interpretation](source/vims/INTERPRETATION.md) contains the
source and field definitions and conversion limits for the two added views.
The source is Scipioni and Combe's Cassini VIMS mosaic collection,
DOI [10.17189/ctqe-ta30](https://doi.org/10.17189/ctqe-ta30). Manifest entries
prefixed `rhea-vims-source-` pin the cube, wavelengths, original labels and guide;
`source/vims/prepare-maps.json` and the shared acquisition converter specify
our conversion. The archived mission-to-mosaic reduction is not reproduced here.

Infrared displays three measured reflectance channels in false color. Ice
absorption is a continuum-relative indicator derived from those spectra;
it is not ice percentage, crystallinity, grain size or temperature. Missing
samples remain missing. Absolute registration at fractions of a native pixel
remains unresolved. The B7 source review and test results are linked below.

## Evidence

These reports describe earlier tests. None were rerun for this documentation change.

| Check | Recorded result or limit | Report |
| --- | --- | --- |
| B2 shape and scientific maps | The 2,000-face mesh is closed and connected, with Euler characteristic 2. In 8,000 one-way barycentric source-distance samples, the maximum was 5,700.82 m, 95th percentile 2,867.32 m and RMS 1,460.13 m. Sampling does not establish a full maximum-error bound or scientific uncertainty. | [B2 delivery](../../../docs/moons/b2-preparation/final/DELIVERY.md) |
| B7 VIMS conversion | Independent checks of the Dione/Rhea source cubes and their interpretation. The mission's original reduction is accepted as supplied. | [Source review](../../../docs/moons/b7-cassini-atlas/evidence/source/SOURCE-REVIEW.md) |
| B7 browser and installation | Selected views at DPR 1 and 2, saved screenshots and installation results. The reports retain limits involving public Settings access and full-suite tests. | [Visual review](../../../docs/moons/b7-cassini-atlas/VISUAL-REVIEW.md), [integrated results](../../../docs/moons/b7-cassini-atlas/evidence/integration/qualification.json) |

## Known problems

The simplified mesh does not retain all source detail. Image seams, photographed
shadows and gaps in the numeric maps remain. The VIMS ice-absorption view must
keep its stated meaning; it cannot support a claim about ice percentage.
Check each report's tested version and unfinished checks before reusing its result.

The older [observations catalog](source/observations/catalog.json) still says the
relative-albedo product was excluded. The current recipe and content include
that view. The catalog needs correction; its exclusion is not current.
