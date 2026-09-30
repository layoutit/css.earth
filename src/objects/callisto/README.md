# Callisto

Callisto is a moon of Jupiter, shown as a mean-radius sphere with three surface datasets: a global monochrome mosaic, Galileo color and a partial infrared view.

## Sources

- The **Monochrome** dataset uses the public-domain USGS [Voyager/Galileo global mosaic](https://astrogeology.usgs.gov/search/map/callisto_galileo_voyager_global_mosaic_1km).
- The **Galileo color** dataset uses the official USGS RGBA copy of NASA/JPL/DLR [PIA03456](https://science.nasa.gov/photojournal/global-callisto-in-color/), recorded in May 2001 and released on August 22, 2001. The [USGS release](https://www.usgs.gov/media/images/callisto-galileo-ssi-color-mosaic) marks it public domain.
- The **infrared** view uses [the registered Galileo NIMS archive](https://doi.org/10.17189/4sq6-x165), observations G8CNADLIND01A and G8CNGLOBAL02A, Minnaert-corrected CIOF products.
- **Named features** come from the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Callisto (public domain per its FGDC metadata), kept under `source/features/`. 12 labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0), kept with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.
- [NASA's facts](https://science.nasa.gov/jupiter/jupiter-moons/callisto/facts/) provide the brief introductory content.

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json). NASA Photojournal figure PIA00844 did not qualify as a map view: it lacks a labelled map grid and a colour scale with units. See [NOTICE.md](NOTICE.md) for credits.

## Processing

**Monochrome.** The original GeoTIFF is 15,138 × 7,569 pixels, one 8-bit band, approximately 1 km grid spacing. USGS describes [Lunar–Lambert normalization and linear overlap matching](https://astrogeology.usgs.gov/search/map/callisto_voyager_galileo_image_mosaic_map) in this mosaic family. We keep that processing and do not run a second, unconstrained flattening. Photographed crater relief and residual seams remain. The GeoTIFF declares `GDAL_NODATA=0`. Only exact zero and pixels whose resampling footprint includes that no-data are treated as missing and painted with the shared neutral gray grid. No texture or color is invented for gaps. No elevation product is supplied.

**Galileo color.** No new radiometric correction or normalization is applied. The roughly 640-pixel disk supplies approximately 8 km class detail near its center; foreshortening worsens it toward the edge. A frozen perspective camera registers the published plate to the independent controlled USGS monochrome mosaic. Eight Gazetteer landmarks, including Vili, Valfodr, Alfr, Bran and Loni, match the same visible impact structures. The derived 1,440 × 720 RGBA GeoTIFF samples only the original plate, never the reference map. There is no globally filled color map. Selecting this dataset faces the observed hemisphere. Reproduce the checked-in derivative with Python 3, numpy, Pillow and rasterio:

`python3 src/objects/callisto/source/preparation/prepare-galileo-color.py`

Use `--output-directory /tmp/callisto-reproduction` for an isolated comparison. A normal body bake does not need Python.

**Infrared.** Following the archive guide, RGB selects same-parity bands near 0.77, 2.25 and 3.66 µm. The exact band centers are recorded in `source/nims/prepare-composite.json`. Fixed I/F display ranges are R 0–0.45, G 0–0.45, B 0–0.2. The regional Asgard/Lindr observation has priority in overlap. Source geometry follows the USGS 2013 registration grid. Unobserved cells remain the shared gray grid. Reproduction: `packages/bake/src/objects/acquisition/MAPPED-SCIENCE.md`.

**Named features.** Preparation reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, converts each positive-east centre through `presentation/surface-map.json` with the map's left edge at 0° E, and anchors it on the mesh. Craters and faculae trace a rim circle, other types their published extent box.

**Globe.** Callisto uses the shared raster lane with the shared 16 × 32 sphere mesh and Lambert lighting bank, and no atmosphere. Surfaces are painted at one 8192 × 4096 density for every DPR; polar sprites are 1024 × 512 pixels and sample the original photographs directly. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) describes the method. The recipe declares a sphere of 2410.3 km. The world frame, pole and prime meridian at the shared epoch come from `src/platform/solar-geometry.mts`. GeoTIFF x increases east from 0° to 360°, centered on 180°. [Valhalla](https://planetarynames.wr.usgs.gov/Feature/6284), at 14.7° N, 56° W (304° E), lies on the right side of the source raster. The source prime meridian constant, 259.51° at J2000, agrees with the vendored IAU model.

The [marker recipe](source/preparation/navigation.json) crops and resizes the source map as a stylized navigation marker with the shared full-phase curvature shading (35% ambient, 65% diffuse). It is not a view at the scene epoch.

## Evidence

The Galileo color fit's two training quadrants and two disjoint held-out quadrants are recorded in [source/validation/galileo-color-registration.json](source/validation/galileo-color-registration.json). An independent review sampled the original 15,138 × 7,569 reference at its exact GeoTIFF coordinates without adjusting the fit: upper-right and lower-left unblurred correlations were 0.713 and 0.573.

Gazetteer rims drawn over the prepared minimap agree with the declared `mapLeftEdgeLongitudeDeg` in `source/preparation/features.json`.

## Known problems

- Original observations range from 400 m to 60 km per pixel. Coarse observed patches are retained; a fine grid spacing does not make them high resolution.
- **Galileo color:** These are published processed colors, not calibrated I/F, reflectance ratios or measured albedo. An explicit 65° emission limit retains 28.735% of the sphere; unseen, grazing and nonopaque source regions remain missing. Photographed shading, soft detail and color fringing remain.
- Local 0–1 pixel diagnostic offsets were never applied and do not establish a global absolute positional accuracy. The scene is a mean-radius sphere, not a measured terrain mesh.
- **Infrared:** This is a partial spectral-color view, not natural color or a mineral-abundance map.
- **Named features:** Outlines are not published nomenclature boundaries. The readout longitude counts from the map's left edge, which here coincides with the Gazetteer origin.

[Inputs](source/manifest.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
