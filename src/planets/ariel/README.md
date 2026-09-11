# Ariel

## Sources

Ariel uses Paul Schenk's September 2020 [Uranian Satellites — Global Mosaics and DEMs](https://repository.hou.usra.edu/handle/20.500.11753/1687), based on Voyager 2 images and revised cartographic control. The original [author README](https://repository.hou.usra.edu/bitstreams/00528589-53e3-496b-ac5d-b6d86fe527c9/download) is retained in [the retained author notes](source/observations/aaReadMe_uranian_MAP_DEM.txt).

**Monochrome** displays the source-corrected Voyager mosaic. [Schenk and Moore (2020)](https://doi.org/10.1098/rsta.2020.0102) describes lunar-Lambert normalization of the best-resolved images to reduce planetary shading; the result approximates normal reflectance and is not a true albedo map. Ariel's best mosaic has approximately 1 km image samples, with two smeared terminator images replaced by desmeared versions supplied by Stryk and Stooke. Cast shadows, camera marks, seams, and unequal local resolution remain. No additional photometric recovery is claimed.

**Elevation** displays the release's merged stereogrammetric and photoclinometric DEM. The author README also identifies limb-profile contributions to Ariel's DEM. Values are kilometres above the published reference ellipsoid, not sea level or the application sphere. Fixed cartographic relief uses those actual height units and latitude-dependent pixel spacing. The unshaded numeric legend describes elevation; shading describes slopes. Image-derived errors and smoother lower-resolution patches remain, and the release author recommends contacting him before scientific analyses or proposal use.

## Evidence

Kachina Chasmata's Gazetteer centre has mosaic imagery but no valid DEM sample, which the numeric regression preserves.

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Ariel (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, converts each positive-east centre through `presentation/surface-map.json` with the map’s left edge at 180° E, and anchors it on the mesh; craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The map edge was fixed by drawing Gazetteer rims under both edge hypotheses and keeping the one where Kachina Chasmata and the named craters on the prepared minimap (±180° cylindrical cube) coincide with the imagery.

Only source-valid samples are interpolated. ISIS special pixels become the shared neutral grid. Low intensity is not by itself a missing-data rule. The northern region unseen by Voyager is not reconstructed, mirrored, or filled with another body's texture. The paper discusses faint Uranus-shine observations of northern terrain; their existence is not treated as global mapped coverage.

The DEM contains sparse curved limb-profile tracks outside the denser image-derived terrain coverage; those are real source-valid samples, not continuous regional coverage. They remain visible without filling their surroundings.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

<a id="selected-interpretation"></a>
<a id="source-grid-and-preparation"></a>
<a id="dataset-survey"></a>

<details>
<summary>Methods and source notes</summary>

**Source grid and preparation**

The selected original files are `aumap-cyl-180180.cub` and `audem-ZTL-cyl-180180.cub`. Both are 3652 × 1826 ISIS3 Real/Lsb cubes tiled in 332 × 166 samples. Their labels declare simple cylindrical projection, planetocentric latitude, positive-east longitude, a −180…180° range, center longitude 180°, equatorial mapping radius 581100 m, polar radius 577700 m, upper-left origin (−3652000, 913000) m, and 1000 m pixels. The shared loader registers these into the application's 0…360° maps before preparing retained surface and pole atlases.

The mosaic's own ISIS history records `photomet` on 2020-02-22 with ellipsoid angles, maximum emission 70°, maximum incidence 89.9°, followed by the release's low/high-frequency mosaicking and display stretch. Preparation retains this supplied processing and applies one linear 0–3000 DN display stretch, clamping display endpoints while keeping valid dark samples valid. This is a display choice, not a conversion to physical reflectance. The source values span approximately −895 to 8699 DN; bright outliers exceed the display range. Small-map comparisons at upper bounds 2400, 3000, and 3600 DN informed the selected contrast.

The DEM's numeric extrema are approximately −7.024 and +5.796 km. Its displayed scale is −8 to +6 km. Northwest cartographic lighting uses a unit direction (−0.5 east, +0.5 north, +0.7071 up), ambient 0.25, and the actual 1000 m/km height conversion without height exaggeration.

Both lenses use the same fixed 5760 × 2880 prepared sampling bank, 64-pixel projective gutters and 1024-pixel pole tiles independently of DPR. This density supports the retained projective mapping and does not add native detail. The shared 452-face sphere uses the vendored 578.9 km mean radius; elevation colors do not displace its geometry. Both views support shared flood curvature and optional directional Shadows. The default camera targets 270° E, 50° S.

Minimaps and thumbnails use the same prepared interpretation. The navigation/context marker is a purpose-sized crop of observed southern terrain, with shared full-phase curvature; it is not a new full-disc observation. Its original normalized-map crop is (2200, 1100), 700 × 700 pixels. Original cube bytes are retained unchanged inside gzip with both original and compressed hashes in the manifest. Content-addressed source URLs allow automated restoration without the upstream browser challenge; large source binaries are excluded from Git and runtime installation.

**Dataset survey**

| Candidate | Disposition |
| --- | --- |
| Schenk/LPI 2020 native corrected mosaic | Selected as Monochrome for revised registration, documented photometry, and original floating-point data. |
| Schenk/LPI 2020 merged numeric DEM | Selected as the conceptually distinct Elevation lens, with its own validity and ellipsoid datum. |
| [JPL simulator Ariel map](https://space.jpl.nasa.gov/tmaps/uranus.html), 1440 × 720 at 4 pixels/degree | Excluded as a duplicate lower-density display mosaic; original LPI data has stronger mapping and processing provenance. |
| [USGS Ariel Voyager control network](https://astrogeology.usgs.gov/search/map/ariel_voyager_image_control_network) | Registration support, not an additional image or measured-scalar lens. This release republishes RAND and Jigsaw control solutions. |
| [NASA PIA01351 clear-filter image](https://science.nasa.gov/photojournal/bright-patches-on-ariel/) | Excluded: 47 km image detail and disc projection add no mapped surface capability to the selected mosaic. |
| [Beddingfield et al. 2025 medial-groove/geology work](https://www.hou.usra.edu/meetings/lpsc2025/pdf/1126.pdf), followed by [Tonoian et al. structural mapping](https://meetingorganizer.copernicus.org/EPSC-DPS2025/EPSC-DPS2025-1554.html) | Unresolved complementary interpretive candidate. The examined releases describe geological figures and continued structural mapping, but did not establish a downloadable georeferenced unit raster/vector closure suitable for this renderer. No geological lens is claimed. |

Physical/orbital values come from the vendored astronomy package: JPL satellite elements and IAU/NAIF Ariel rotation at the shared epoch. [NASA's Ariel overview](https://science.nasa.gov/uranus/moons/ariel/) supplies editorial and discovery facts. No atmospheric shell is supported.

</details>
