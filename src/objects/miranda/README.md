# Miranda

Miranda is shown with Voyager 2's monochrome mosaic, a stereo elevation model, a digitized historical geology map, a Voyager false-colour dataset and IAU feature names.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Miranda uses Paul Schenk's September 2020 [Uranian Satellites — Global Mosaics and DEMs](https://repository.hou.usra.edu/handle/20.500.11753/1687), based on Voyager 2 images and updated control networks. Both original ISIS3 cubes contain 6294 × 3147 floating-point samples on a 240 m simple-cylindrical grid. Grid spacing is not uniform effective image or elevation resolution. The release's [author README](https://repository.hou.usra.edu/bitstreams/00528589-53e3-496b-ac5d-b6d86fe527c9/download) documents the release.

**Monochrome** uses `mumap-cyl-180180.cub`, already `photomet`-normalized by the author, with one linear display stretch from 0–2400 DN to 0–255. This is a display of the published mosaic, not newly calibrated reflectance.

**Elevation** uses `mudem-ZT-cyl.cub`, the merged stereogrammetry and photoclinometry product, in kilometres relative to the published reference ellipsoid. The scale spans −6 to +7 km and includes the observed extrema (approximately −5.51 to +6.36 km). A shared northwest hillshade adds slope detail.

**Geology** uses Thomson and Baynham's [2026 digitized historical map](https://zenodo.org/records/20817533), released under CC BY 4.0, retained in `source/science/geology-2026/`. This is an interpretation of Voyager-era surface units, not measured composition.

**Voyager color** uses Voyager 2 ISS narrow-angle GEOMED frames from the PDS Ring-Moon Systems Node (volumes VGISS_7201–7207, inventoried through the OPUS API), listed in [the frame recipe](source/preparation/voyager-color-frames.json). The camera comes from the pinned [Voyager 2 Uranus kernel bank](../../spice/voyager/manifest.json); observer and Sun positions are JPL Horizons vectors. The band ratios are tied to Bell and McCord (1991, *Proc. Lunar Planet. Sci.* 21, 473–489; [ADS 1991LPSC...21..473B](https://ui.adsabs.harvard.edu/abs/1991LPSC...21..473B)).

**Named features** come from the [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/SearchResults?Target=98_Miranda) centre-point shapefile (retrieved 2026-09-11, public domain). Three names carry the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), pinned in `source/features/notes.json` and credited in the caption.

Physical and orbital values come from JPL satellite elements and IAU/NAIF rotation. [NASA's overview](https://science.nasa.gov/uranus/moons/miranda/) supplies editorial facts.

## Processing

Shared preparation decodes the ISIS3 tiles into the shared raster lane used by Mercury, Venus, Mars, the Moon and Pluto: a 235.7 km sphere with a Lambert lighting bank and no atmosphere. ISIS special pixels stay missing and show as the gray grid.

The geology archive stores page coordinates under an incompatible Earth CRS, so the reviewed `registration.json` maps them onto the moon. Its 18 polygon categories keep their original names and colors and are sampled nearest-neighbor with no interpolation. Reproduce it with `python packages/bake/src/objects/acquisition/prepare-geologic-categories.py src/objects/miranda/source/preparation/geology-conversion.json`.

For the colour dataset, [`author-color-frames.mts`](../../../packages/bake/authoring/voyager-iss/author-color-frames.mts) fits each frame's limb and registers it against the Schenk mosaic seen through its own camera. A set with a band that does not register is dropped rather than fringed. Each green/violet/ultraviolet set is corrected with the same Lunar-Lambert disk function as the monochrome mosaic, to incidence 30° and emission 0°. The archive's calibration leaves violet darker than green, which renders purple, so the violet and ultraviolet bands take one gain each (1.111, 1.004) to meet Bell and McCord's whole-disc ratios (ultraviolet/green 1.06, violet/green 1.03). Spatial colour differences are Voyager's own.

## Evidence

- The prepared normal map correlates 0.88 against its georeferenced source from 0° E and 0.03 from 180° E, so the map starts at 0° E ([where the prepared map starts](../../../docs/surface-preparation.md#where-the-prepared-map-starts)).
- Landmark differences at Elsinore, Arden and Inverness are 1.3–3.3° (approximately 5–14 km); these are not uncertainty bounds for every unit boundary.
- Of 12 colour frames in 4 sets, 3 frames in 1 set were placed (set-19860124-1503, 1.1 km/px). Limb fits have an RMS of 1.17–1.75 pixels.
- The [oracle report](source/reference/voyager-color-oracle.json) compares 3 frames against the mosaic: mean correlation 0.36, mean residual 9.4 km. See also [the placement report](source/reference/voyager-color-placement.json).
- The ordering of the colours agrees with Karkoschka (2001, *Icarus* 151, 51), who finds Miranda slightly bluish, and DeColibus et al. (2026, *Planet. Sci. J.*, [doi:10.3847/PSJ/ae4a1b](https://doi.org/10.3847/PSJ/ae4a1b)).

## Known problems

- The Voyager color dataset is false colour (green, violet, ultraviolet as red, green, blue) at the observations' own phase angles. A colour seam at a footprint edge is a real difference in viewing geometry. Bell and McCord's ratios are read from a figure at ±0.02, and their ultraviolet calibration carries a stated ±10 % uncertainty.
- Local cast shadows, camera marks and mosaic seams remain in the monochrome mosaic. Source errors and smooth lower-resolution patches remain in the elevation model.
- No northern hemisphere is synthesized, mirrored or borrowed. Geology covers approximately 44.2% of the surface.
- Nomenclature outlines are not published boundaries.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
