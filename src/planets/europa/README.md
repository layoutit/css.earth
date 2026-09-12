# Europa

## Sources

- The [USGS Voyager/Galileo global mosaic](https://astrogeology.usgs.gov/search/map/europa_voyager_galileo_ssi_global_mosaic_500m) is a 19,631 × 9,816 monochrome GeoTIFF on a nominal 500 m grid.

- The **Enhanced color** lens uses the [USGS controlled Galileo observations](https://stac.astrogeology.usgs.gov/docs/data/jupiter/europa/galileo_individual_images/) (CC0), by Bland, Weller and colleagues. The three sequences are G1ESGLOBAL01 (1996-06-28), 12ESGLOCOL01 (1997-12-16), and 14ESGLOCOL01 (1998-03-29).

- The Elevation view adds the released [USGS controlled Agenor DTM](https://stac.astrogeology.usgs.gov/docs/data/jupiter/europa/europa_controlled_usgs_dtms/).

- The geology view preserves the ten source map units and no-data regions from [Leonard, Patthoff and Senske (2024), SIM 3513](https://pubs.usgs.gov/publication/sim3513), scale 1:15 million.

- The infrared view uses [the registered Galileo NIMS archive](https://doi.org/10.17189/4sz4-5024), observations 17ENGLOBAL01A and 17ENGLOBAL02A, Minnaert-corrected CIOF products.

## Evidence

Polar sprites now sample the pinned original photographs directly, preserving the declared coordinates and source gaps. Existing monochrome fallback is retained where a color view already uses it. Each sprite remains 512 × 256 pixels at density 1 and 1024 × 512 at density 2; latitude-band images, geometry and lighting remain unchanged. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) describes the method and its limits.

| View | Both prepared levels, before → current |
| --- | --- |
| normal | 171.2 → 178.0 kB |

These download sizes refer only to the polar sprites. Decoded dimensions are unchanged. The scene matches [the previous main version](https://github.com/layoutit/css.earth/tree/3efdf2c9ed9047c72409b2730e879123f8c3b9d2/src/planets/europa/prepared); [the raster recipe](source/preparation/raster.json) and [asset inventory](runtime-assets.json) bind the current preparation. Existing source-resolution and registration limits still apply.

Lane change (this PR): the terrestrial solid-observation lane was retired for Europa; the same pinned inputs and the same decoders (`terrestrial-observation`, `terrestrial-observed-color`, `terrestrial-scientific` through the raster lane's `science` adapter) now feed the shared raster lane used by Mercury, Venus, Mars, the Moon and Pluto. The sphere is the shared 16 × 32 mesh (450 leaves, 230 units, 50-pixel tile, 0.005 overlap) with the 256-frame Lambert lighting bank and no atmosphere. Surfaces are painted at 2048 × 1024 (DPR 1) and 4096 × 2048 (DPR 2) — retired 4096 × 2048 atlas (native 500 m mosaic is 19,631 px wide; unchanged budget). Verified with the package, source-closure, minimap and browser conformance checks listed in the pull request; the nomenclature recipe and map edge are unchanged and the labels were re-drawn against the new atlas. No new science review is claimed.

Run of 2026-09-12 (this version): `node tools/objects/dist/prepare-authored.js europa --write` prepared the package through the shared raster lane and `tools/objects/observation/interpret.mts`; `node --test tests/objects/unit/europa/*.test.mts` passes except the shared runtime-package and import-closure tests that fail identically on `main` (recorded once in the pull request).

A headless Chrome probe (`output/probe-spheres.mts`, ignored scratch) mounted the page on the dev server, selected every lens (normal, enhanced, elevation, geology, infrared) with no console errors or failed requests, and pinned a Gazetteer feature from the sidebar search on the standard mesh (feature id 4878).

Gazetteer rims drawn over the prepared equirectangular minimap at both candidate map edges (`output/edge-markers.mjs`) agree with the declared `mapLeftEdgeLongitudeDeg` in `source/preparation/features.json`.

- Original files, STAC metadata, source processing, seven independently Pillow-decoded value anchors, and the exclusion evidence are retained under [source/science/controlled-dtms/](source/science/controlled-dtms/).

- Focused checks are defined in the [unit tests](../../../tests/objects/unit/europa) and [browser profile](../../../tests/objects/browser/europa/browser-profile.mts).

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Europa (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, converts each positive-east centre through `presentation/surface-map.json` with the map’s left edge at 0° E, and anchors it on the mesh; craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries, and the readout longitude counts from the map’s left edge, which here coincides with the Gazetteer origin. The map edge was fixed by cropping the source raster at a landmark’s Gazetteer centre under both hypotheses (see the pull request that added the feature).

Feature notes: 12 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

- **Enhanced color:** It combines 756 nm infrared, 559 nm green, and 404 nm violet as display red, green, and blue. This is not natural color. After geometric normalization and the angle limits below, about 14.3% of the sphere has usable three-band coverage.

- **Photographic coverage:** Observed monochrome forms the base elsewhere; grayscale does not imply measured neutral color. The gray cartographic grid appears only where both sources lack imagery.

- **Elevation:** It retains the original relative stereo heights in meters, with no vertical offset, no conversion to a global reference level, and no globe displacement.

- **Illumination:** This is an approximate disk correction, not calibrated unlit albedo: there is no phase-angle normalization, fitted Europa scattering model, terrain model, or removal of cast shadows.

- **Infrared:** The blue channels differ slightly (0.732919 and 0.740634 µm); this is a spectral color display, not a uniform quantitative abundance map.

[Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="europa-sources-and-presentation"></a>

Europa uses the shared object runtime, camera, shell, lighting placement, and orbital view. Its package owns the imagery and prepared scene. It never mounts inside Jupiter's scene.

Jupiter's context sprite uses a 1024-pixel crop of the credited Hubble image from 5 January 2024. It uses the existing prepared marker contract and stays sharp when Jupiter is large in Europa's sky. Its clouds and photographic orientation are a historical observation, not a simulated view for the pinned epoch. Source bytes are owned by Europa so installation is independent of Jupiter. The scene is fixed at its preparation epoch and does not offer a rotation-speed control. Camera motion, Shadows, and Orbit use the shared controls.

Individual observations range from about 200 m to 20 km per pixel. Differences in source resolution, seams, and observed illumination remain visible. No color, elevation, ocean, or thermal map is inferred from this image.

The GeoTIFF's cylindrical coordinates increase eastward, with a central longitude of 180°. The actual outer left edge is −0.011003118° and the map spans 360.003667706°, with rows running north to south. Native bilinear preparation back-projects each canonical output pixel centre through the GeoTIFF's actual origin and resolution; it does not stretch those bounds to exactly 0–360°. Its projection uses a 1,562,089.9658 m sphere; the rendered mean-radius sphere uses the astronomy catalogue's 1,560.8 km physical radius. It is not a resolved shape model.

The explicit no-data value is zero. Preparation samples to 4096 × 2048 only where every nonzero-weight native bilinear contributor is valid, retaining dark nonzero observations and withholding incomplete or masked footprints. The corrected registration changes prepared monochrome pixels and their co-located color fallback; the original mosaic and controlled I/F source values are unchanged. The shared gray cartographic grid marks missing data. It is not invented terrain. Band textures are reprojected for the shared projective surface geometry; polar textures use the same map and hemisphere-specific longitude mapping.

The source already contains shadows. The Shadows setting adds approximate spherical illumination; with Shadows off, a fixed curvature overlay gives depth. Neither mode recovers unlit albedo or physically relights photographed features. Europa's tenuous oxygen atmosphere does not justify a visible halo.

[NASA's Europa facts](https://science.nasa.gov/jupiter/jupiter-moons/europa/europa-facts/) support the introduction, oxygen atmosphere, and approximate 671,000 km distance from Jupiter. Magnetic evidence strongly suggests a subsurface salty ocean; the ocean is not directly mapped by this globe. Radius, parent, orbital period, and orientation use the checked-in astronomy package. Rotation is presented as synchronous with Europa's approximately 3.55-day orbit. The 5.2 AU badge denotes Jupiter's approximate mean distance from the Sun, not Europa's distance from Jupiter.

At the pinned preparation epoch, the orbital view uses Europa's parent-relative state and Jupiter's gravitational parameter to prepare an ellipse focused on Jupiter. The Sun retains its separate heliocentric position. The shared solar view approximates planet centres using VSOP87 system barycentres; satellites use the package's JPL mean Kepler elements, not a live high-precision ephemeris. The photographed surface uses IAU body orientation without a manual rotation.

The sky uses the same ESO panorama, HYG catalogue, and ICRF preparation as the existing solid bodies. Source hashes, origins, and licenses are pinned in `source/manifest.json`; runtime files are listed in `runtime-assets.json`.

Original imagery remains unchanged and is excluded from Git. Preparation does not require another body's scene.

Exact image dates, band identities, coordinates, source URLs and hashes are pinned beside the source inputs.

These are calibrated 32-bit I/F images with corrected camera pointing, on an east-positive cylindrical grid centred at 180°, radius 1,560,800 m. They have not been photometrically corrected by USGS. Native grids range from 1.375 to 1.570 km per pixel. Higher-density observations take priority. Color appears only where all three bands from the same sequence have valid interpolation footprints; zero no-data, ISIS special pixels, and incomplete boundaries are withheld. Preparation records its surface percentage per observation. The initial display transfer is max(I/F, 0)^(1/2.2) for every channel, after linear I/F normalization. Values remain floating point through presentation level matching, and are only then rounded to 8-bit. Bright corrected values are not clipped before matching. No monochrome detail is transferred into color. The newer controlled dataset and the older monochrome mosaic have different positional accuracy.

The 28ESGLOCOL01 sequence (2000-05-22) was removed from this lens: its 13.832 km-per-pixel imagery covered sharper monochrome with a visibly blurred insert. The lens now uses the monochrome base there, with no invented color. Preparation applies one spherical [Lunar–Lambert disk normalization](https://isis.astrogeology.usgs.gov/9.0.0/Application/presentation/Tabbed/photomet/photomet.html) to every color image, with weights selected by observation:

| Observation | Disk weight L |
| --- | --- |
| 14ESGLOCOL01, March 1998 | 1 (accepted Lommel–Seeliger correction) |
| 12ESGLOCOL01, December 1997 | 0.5 |
| G1ESGLOBAL01, June 1996 | 0.5 |

For each band's surface point, `mu0` and `mu` are the cosines of incidence and emission. The disk function is `D = (1-L)*mu0 + 2*L*mu0/(mu0+mu)`. Linear I/F is multiplied by `D(reference)/D(observation)`, with reference incidence 30° and emission 0°, before the fixed display transfer. The two mixed weights reduce the remaining gradients without the stronger brightening of pure Lambert in the compared patches. They are visual presentation choices, not fitted physical scattering parameters. The [USGS Europa photometry study](https://www.hou.usra.edu/meetings/lpsc2022/pdf/1691.pdf) motivated comparing Lambert; we do not apply its per-band albedo normalization.

All three bands must have incidence and emission at most 75°; otherwise the observed monochrome base is used. This removes about 43% of the previously displayed December color pixels and 25% of the June color pixels on the prepared map. Those difficult edges are withheld, not recovered. There is no inferred color or recovery of unobserved terrain.

`source/photometry/` binds all 20 controlled ISIS labels, including each exact capture ET and body-orientation coefficients, to pinned [JPL Horizons](https://ssd-api.jpl.nasa.gov/doc/horizons.html) geometric Sun and Galileo vectors relative to Europa (ICRF, km, JDTDB). The raw API responses and request URLs are checked in; labels are restored by the existing source acquisition command. Preparation transforms the vectors using the label's adjusted prime meridian (W0 = 36.054°) and [NAIF PCK orientation equations](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/req/pck.html), including nutation/precession. It does not use the older PDS label's west longitudes. Horizons uses its archived Galileo trajectory and current planetary ephemerides, rather than reproducing the original USGS SPICE kernel set exactly. Preparation is offline and reproducible from these pinned inputs.

Both lenses retain the shared Shadows control and prepared globe lighting. Residual photographed shadows and seams can remain; added globe lighting is approximate.

To soften brightness steps against monochrome, preparation fits one display brightness multiplier per color sequence. The fit is the median ratio of monochrome to color luminance (weights 0.2126, 0.7152, 0.0722), using co-located valid pixels within a four-texel strip inside each color footprint. It applies the same multiplier to all three display channels, capped by the brightest channel in the entire sequence so highlights cannot clip. This preserves color ratios and relative detail, subject to 8-bit rounding. No monochrome detail is transferred, no missing data enters the fit, and no feathering or blending is used. This is presentation matching against the contrast-adjusted monochrome mosaic, not additional physical calibration; source I/F files are unchanged. Remaining differences in color, lighting, resolution and positional accuracy can still reveal the boundaries.

The NASA Trek/Jónsson 2015 color mosaic was rejected: its [author documents fictional polar terrain and cloned gaps](https://www.planetary.org/articles/0218-mapping-europa), and its [publication license restricts derivatives](https://www.planetary.org/space-images/color-global-map-of-europa). None of its pixels enter the prepared package.

## Preparation ownership

This package contains authored JSON recipes, source provenance, and generated JSON. Reusable observation masking, projection, lighting, celestial, and retained-scene operations live in `tools/objects/terrestrial-layers/`; no package-local executable preparer or runtime is required.

Delivery keeps the prepared HD texture dimensions. The photographic normal polar sprites sample their pinned source grid directly with a 2 × 2 footprint and retain lossless WebP encoding. Latitude-band and non-photographic prepared assets retain their existing encodings; source maps remain lossless. The shared photographic sky uses quality 95. Lighting stays lossless. Only the selected sky mode is requested on first view.

## Agenor relative stereo terrain

The regional independent relative solution is not combined with other sites. The view's −700…+300 m scale spans the actual −641.9267578125…+218.51205444335938 m source range. Fixed northwest cartographic relief shows slopes; it does not change the numeric legend or imply physical illumination.

The exact Float32 COG is 642×133, with 39,032 finite non-special samples. Its planetocentric equirectangular CRS is centered on 180°E on a 1,560,800 m sphere, with origin (−1236786.1079616144, −1146374.9999678) m and pixel increments (+614.0078951699215, −614.0078951699215) m. This actual reprojected pixel spacing differs from the nominal 450 m DTM post spacing; effective resolved detail is about 3 km. Source documentation gives nominal 52 m vertical precision and an approximately 100 m empirical estimate, not a pointwise accuracy guarantee. The controlled frame differs from the old 2010 mosaic's registration.

The genuine height no-data value and complete bilinear footprints control coverage. The released `FOM` and `ClrConf` files are byte-identical: the retained processing log translates the FOM VRT into both outputs and cubic-resamples the categorical FOM codes. Neither is used as a confidence or quality mask. Exact ignored source TIFFs have acquisition recipes; the CC0 release and source authors retain attribution.

The body-owned lens focus is 142°E, 43.7°S at supported zoom 4. Shared preparation converts it through the actual solid mesh axes and system matrix to existing camera navigation. The X/Y swap in solid PolyCSS leaf coordinates is included; no source interpretation occurs in runtime. The Yelland trial and its broken quality products are retained only for the intake audit. Useful regional framing, source-versus-display visuals, and Chrome conformance remain separate B2 gates.

## B6 mapped science

Colors use the released ArcGIS CMYK symbols converted to RGB; sub-pixel vector detail is not invented. Slight source extent overshoot is clipped to the globe; `nd` remains missing.

Following the archive guide, RGB selects same-parity bands near 1.50, 1.35 and 0.74 µm; exact wavelengths and band numbers are pinned in `source/nims/prepare-composite.json`. Fixed I/F ranges are R 0–0.6, G 0–1.2, B 0–1.5. Endpoint clipping retains calibrated noise and outliers. The first observation has priority in overlap. The USGS 2010 registration grid matches this body's global visible mosaic; it is not the newer 2021 control grid.

Exact bytes, coordinates and validity rules are in the intake plans and receipts. Reproduction: `tools/objects/acquisition/MAPPED-SCIENCE.md`.

The official USGS archive browser maps Individual Investigations to its working CloudFront endpoint in [main.js](https://pdsimage2.wr.usgs.gov/index-style/js/main.js). The original guides prescribe registered GeoTIFF geometry rather than COC backplanes. Unobserved cells remain the shared gray grid; no gap fill is used.

</details>

<details>
<summary>Shape, rotation and camera on the shared raster lane</summary>

The recipe declares a sphere of 1560.8 km. The retained mesh keeps its spin origin at 0°; the world frame, pole and prime meridian at the shared epoch come from `src/platform/solar-geometry.mts` as for every prepared body. The scene records a 3.5255-day prograde rotation (synchronous: the astronomy package's orbital mean motion) and 0° tilt to its orbit for the 84-second visual rotation; neither drives the physical frame. The camera is the shared solar-system camera (zoom 1.1, 40.00° initial pitch, 0.00° yaw, taken from the retired lane's camera). The heliocentric view keeps the orbit around Jupiter and the parent marker now comes from the shared navigation atlas.

</details>
