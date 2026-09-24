# Dione

The [navigation marker](source/preparation/navigation.json) retains its existing source-map crop and silhouette, with the shared prepared full-phase curvature shading (35% ambient, 65% diffuse). It is a stylized identifier, not an observer projection or illumination at the scene epoch.

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

| View | Source and interpretation |
| --- | --- |
| Monochrome | [USGS Cassini–Voyager mosaic](https://astrogeology.usgs.gov/search/map/dione_cassini_voyager_global_mosaic_154m), 2010, about 154 m/pixel. Exactly zero marks gaps; other dark pixels remain observed. |
| Enhanced color | [PIA18434](https://www.jpl.nasa.gov/images/pia18434-color-maps-of-dione-2014/), 2014. Ultraviolet/infrared colors extend beyond human vision; producer calibration, registration and photometric correction are retained. |
| Shape and Elevation | [Weirich et al. 2025 SPC V1.0](https://doi.org/10.26033/bxx6-g543); Elevation is radius minus 561.4 km, colored over −7.5 to +7.5 km. |
| Relative albedo | The same SPC release’s dimensionless brightness field, less validated than topography; not geometric albedo or calibrated reflectance. Its 0.5–1.5 display clips above 1.5. |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/DIONE/target) Dione centre-point export, snapshot 2026-09-11, public domain. IAU-adopted names with centre, diameter, extent and name origin; labels appear at the closest zoom only, and a selected feature stays labelled. |

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Evidence

The photographic atlas now samples each pinned original grid directly with a 2 × 2 texel footprint. It retains the source frame, coverage policy and fixed-epoch lighting. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) explains the sampling and encoding controls.

| View | Original grid | Both lighting images, before → current |
| --- | --- | --- |
| normal | 23040 × 11520 | 13.56 → 17.78 MB |
| enhanced | 14134 × 7067 | 10.71 → 16.03 MB |

Each atlas remains 2048 × 16000 pixels, with 2000 retained faces. The scene bytes match [the previous main version](https://github.com/layoutit/css.earth/tree/3efdf2c9ed9047c72409b2730e879123f8c3b9d2/src/planets/dione/prepared). WebP quality is 95; decoded texture size is unchanged. Sampling details and output hashes are recorded in the prepared surface metadata (`prepared/surfaces.json`). Source resolution, gaps and existing registration limitations still apply.

Both photographic views were inspected with Shadows on and off in Chromium at
DPR 1 on revision `3dc424757`, with no script errors or missing image requests.
The [enhanced-color capture](evidence/native-source-enhanced.png) shows the
published color differences and fine crater texture on the retained geometry.
This is a display check; independent map-to-shape registration remains separate.

Independent landmarks: [Palinurus](https://planetarynames.wr.usgs.gov/Feature/4555) at 3.3° S, 63° W (297° E), and [Janiculum Dorsa](https://planetarynames.wr.usgs.gov/Feature/14379) near 24.6° N, 144.1° W (215.9° E). Bright trailing-hemisphere fractures lie near 90° E. These check orientation across the source maps.

Qualification status: source intake and recipe proposal. Final mesh selection (where applicable), restored-source and prepared browser/visual gates remain pending. No readiness is claimed.

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Dione (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, and converts each positive-east centre into the body-fixed frame the radial terrain sampler uses for this mesh (longitude 0 toward the mesh +y axis, 90° E toward +x, north +z), then casts that direction through the prepared hit mesh so every anchor and outline point sits on the shape model rather than on a reference sphere. Craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The frame was confirmed on Mimas and Phobos, where Herschel and Stickney fall at local minima of the shape radius.

Feature notes: 2 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

Different control networks, photographed shadows, seams and coarse inserts remain. No inpainting, synthetic color, polar repetition or patch correction is applied. The shared curvature overlay and optional directional Shadows operate on both lenses.

Model spacing is about 1.58 km. The producer’s one-to-two-grid-spacing accuracy estimate derives from simulation experience, not independent per-cell Dione uncertainty. Increasing texture dimensions adds no terrain detail. This release includes roughly 1040 additional images compared with the previous archived model, through June 2017.

Geographic registration, silhouette and feature review remain pending. The original photographic-map projection radii remain separate from shape geometry and the numeric elevation datum.

The photographic runtime images were published to their content-addressed asset
URLs on 12 September 2026. This does not establish availability of every scientific
view or qualify its registration.

SPC sigma measures internal maplet agreement, not absolute height uncertainty. Dione used calibrated ISS images.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<a id="dione-sources-and-preparation"></a>
<a id="photographic-lenses"></a>
<a id="elevation"></a>
<a id="geometry-and-delivery"></a>
<a id="b2-source-shape-and-relative-albedo"></a>

<details>
<summary>Methods and source notes</summary>

**Elevation**

The 2222 × 679 equatorial map spans 55° S–55° N; two 444 × 444 polar stereographic maps provide higher latitudes. Shared preparation samples each actual geotransform, honoring raster bounds and documented latitude limits. Small gaps near the 55° joins remain marked rather than extrapolated.

**Geometry and delivery**

The astronomy package supplies the Saturn-relative orbit, IAU orientation and the [JPL satellite table](https://ssd.jpl.nasa.gov/sats/phys_par/sep.html) mean radius of 561.40 km; the recipe display scale reference uses the same value. [NASA](https://science.nasa.gov/saturn/moons/dione/) rounds the mean radius to 562 km. Keep this physical radius distinct from the monochrome map's 563 km projection sphere and elevation's 561.4 km datum. The elevation colors and source-mesh silhouette are separate products with distinct resolutions. No visible atmosphere or cutaway is added.

Map preparation retains the shared 8192 × 4096 intermediate layout and 1024-pixel
pole products for their existing consumers. The final photographic source-mesh
atlases now sample the original 23K monochrome and 14K color grids directly at the
retained triangle coordinates, with a 2 × 2 texel footprint and WebP quality 95.
The other prepared maps and scientific views keep their existing processing.

Pinned URLs, source bytes and hashes are in `source/manifest.json`. The shared acquisition recipe restores every large source; runtime uses prepared assets only.

**B2 source shape and relative albedo**

The native global Q128 OBJ is 98,306 vertices and 196,608 triangles in kilometres, north along +Z and longitude zero along +X. Exact source topology is retained before simplification. Preparation uses the measured candidate of 2,000 faces with regularize:false, under a 5,614 m display approximation ceiling (1% of the model reference radius). This is a display approximation budget, not scientific uncertainty. The closed candidate has Euler characteristic 2, one component and 2,000 faces. Its 8,000 one-way barycentric source-distance samples have maximum 4851.62 m, 95th percentile 2463.15 m and RMS 1298.41 m. These samples do not establish a full Hausdorff bound.

The Shape lens uses the shared neutral gray over the source mesh to distinguish geometry from imagery. The Photographic views retain pre-existing image seams, shadows and local control differences. Source reference radii and projections do not become spherical geometry constraints. The original Q128 spacing is about 6.32 km; finer numeric maps do not imply the simplified silhouette retains that full detail.

- [USGS Cassini–Voyager global mosaic](https://astrogeology.usgs.gov/search/map/dione_cassini_voyager_global_mosaic_154m): 2010 edition, 23040 × 11520, about 154 m per source pixel on a 563 km cartographic sphere. Its equirectangular GeoTIFF has center longitude 0° and eastward raster x. Preparation rolls the 180° E left edge by half a width; it does not mirror the image. Exactly zero is documented no-data and receives the shared gray grid. Other values remain observed terrain, including shadows. Source resolution varies; Voyager images fill some Cassini gaps.
- [NASA/JPL enhanced-color map PIA18434](https://www.jpl.nasa.gov/images/pia18434-color-maps-of-dione-2014/): 2014, 14134 × 7067, about 250 m per source pixel. Ultraviolet and infrared extend the colors beyond human vision. Paul Schenk calibrated, registered and photometrically corrected the contributing images. The north-up map starts at 0° E and is not rolled. There is no separate validity mask: all published pixels are preserved. Hemisphere differences reflect surface alteration and E-ring dust as well as residual photographed shading; they are not removed as shadows.

[Weirich, Gaskell, Palmer and Domingue (2025), Dione SPC Shape Models and Assessment Products V1.0](https://sbn.psi.edu/pds/resource/weirichdioneshape.html), NASA PDS, DOI [10.26033/bxx6-g543](https://doi.org/10.26033/bxx6-g543). The original product description and XML labels are retained with the three GeoTIFFs.

Global values are center-relative radius in meters. Displayed elevation is `radius * 0.001 - 561.4` km, with a −7.5 to +7.5 km color scale. Brightness adds northwest relief at true height scale. The shared globe lighting and Shadows remain available. Geometry follows a simplified source mesh.

New relative albedo uses the published 2025 GeoTIFFs and their original equatorial/polar projections. Values are dimensionless and normalized around 1; the archive gives a nominal 0–2 domain. The visible 0.5–1.5 scale saturates above 1.5. No height conversion or relief shading is applied to this quantity. It is a secondary SPC brightness product, less validated than topography, and is neither geometric albedo nor calibrated reflectance. Tethys used uncalibrated ISS inputs; Dione and Rhea used calibrated frames. Source sigma is internal maplet agreement, not absolute height uncertainty.

</details>
