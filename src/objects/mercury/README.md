# Mercury

Mercury offers two monochrome maps taken under different sunlight, a three-filter color map, an enhanced-color map, numeric elevation, a gravity map, a crustal-thickness model and an illustrated cross section.

The [navigation marker recipe](source/preparation/navigation.json) retains the existing credited image and crop, then prepares a circular alpha edge so the photographic background cannot cover surrounding objects. The same silhouette is used by its larger context image where configured.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

| View or property | Source and interpretation |
| --- | --- |
| Monochrome: Low Sun / Higher Sun | Native USGS MESSENGER MDIS BDR and LOI GeoTIFFs, edition 1 (2016), from NAC or WAC 750 nm images. The existing arrows switch between them. |
| Color | Native USGS MDIS MD3 665 m GeoTIFF, edition 1 (2016). Red, green and blue are the 1000, 750 and 430 nm filter images. Not natural color. Gray grid marks missing coverage. |
| Enhanced color | Native USGS MDIS 665 m GeoTIFF, edition 1 (2016). Red: principal component 2; green: principal component 1; blue: 430/1000 nm ratio. Gray grid marks missing coverage. |
| Topography | [USGS MESSENGER 665 m DEM v2](https://astrogeology.usgs.gov/search/map/mercury_messenger_global_dem_665m), numeric heights above a 2,439.4 km sphere with a matching color scale. |
| Gravity | Free-air gravity anomaly of the MESSENGER gravity model HgM008 ([Genova et al. 2019](https://doi.org/10.1029/2018GL081135)), degree 90, in mGal on a 2,440 km sphere; numeric grid from NASA Mercury Trek. See [Gravity and crust](#gravity-and-crust). |
| Crust | Crustal-thickness model of Genova et al. (2019) from HgM008 and laser-altimeter topography, in km; a model under assumed densities, not a measurement. |
| Interior | [NASA facts](https://science.nasa.gov/mercury/facts/), retrieved 2026-08-30. A 0.85-radius metallic core and combined mantle/crust shell; colors and fine texture are illustrative. |
| Spectrum | DLR/Zenodo MASCS one-degree cube, [10.5281/zenodo.7433033](https://doi.org/10.5281/zenodo.7433033). The 326-point spectrum is a global area-weighted mean over 350–1000 nm. |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/MERCURY/target) Mercury centre-point export, snapshot 2026-09-11, public domain. 573 IAU-adopted names with centre, diameter, extent and name origin; labels appear at the closest zoom only, and a selected feature stays labelled. |
| Feature traces | [A Global Tectonic Map of Mercury](https://data.mendeley.com/datasets/p43b9wttpj/2), Klimczak, Byrne and Crane, version 2 (2025), CC BY 4.0. 18,451 mapped fault traces; the longest inside each rupes, dorsum or fossae extent draw that feature's outline. |

## Native photographic maps

[BDR low Sun](https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_global_basemap_bdr_166m)
and [LOI higher Sun](https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_basemap_loi_global_mosaic_166m)
are 92,160 × 46,080 byte images with native spacing about 166 m. BDR selects
images near 74° solar incidence (Sun about 16° above the horizon); LOI selects
images near 45° incidence. Both were controlled against a global elevation model
and photometrically corrected by the publisher. USGS stretched BDR's original
I/F range 0.0005–0.25 and LOI's 0.005–about 0.2 into 8-bit images. Their displayed
brightness values are not on the same scale. These are mosaics of different
observations, not two dates or a change in the globe's Shadows setting.

[Enhanced color](https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_basemap_enhanced_color_global_mosaic_665m)
is a 23,040 × 11,520 RGB image, about 665 m per native pixel. Its colors emphasize
surface differences; they are not natural color or a classification of minerals.
The PDS3 label's product name says `256PPD`, but its dimensions, map scale and the
GeoTIFF itself specify **64 pixels per degree**. Preparation uses that actual grid.

[Color](https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_basemap_md3_color_global_mosaic_665m)
is the USGS MD3 mosaic (PDS data set `MESS-H-MDIS-5-RDR-MD3-V1.0`), the same
23,040 × 11,520 RGB grid. USGS puts the 1000, 750 and 430 nm filter images in red,
green and blue. The 3-color map campaign images were corrected to 30° incidence,
0° emission and 30° phase, and each pixel averages every image that met the scale,
lighting and detector-temperature limits. USGS stretched about 0–0.2 reflectance
into 8 bits. The enhanced mosaic is made from the same three bands, but shows two
principal components and a band ratio instead of the bands themselves. 1000 nm is
beyond human vision, so neither is natural color. The USGS page cites
[Denevi et al. (2016)](https://www.hou.usra.edu/meetings/lpsc2016/pdf/1264.pdf) for the
calibration and map products.

The [acquisition recipes](source/maps/native) validate the GeoTIFF encoding and
its planetocentric, positive-east, north-up frame on a 2,439.4 km sphere. The
[offline reducer](../../../packages/bake/src/objects/acquisition/geotiff-image.ts) reads bounded
row windows and averages native pixel areas into 4,096 × 2,048 images. It keeps
the publisher's stretch and −180° left edge. An all-zero source pixel is missing;
a black channel in an otherwise nonzero RGB pixel remains an observation. A
partly observed display footprint averages only its observed area; a wholly
unobserved footprint receives the shared gray grid. No nearby color or terrain
is used to reconstruct a gap.

The existing raster preparation packs those maps and their pole sprites. The
three photographic maps use the shared lossy WebP lane; numeric elevation stays
lossless. The geometry, camera, 4K texture dimensions, published photometric law
and existing interior illustration are retained. The old Trek BDR snapshot is
still the interior illustration's outer surface.

## Evidence

The [native-byte checks](evidence/native-maps) compare representative compact
pixels with independently read original bytes, using the publisher's detached
PDS3 labels for offsets and coordinates. The checker performs explicit pixel
area sums without the production GeoTIFF decoder. Conversion receipts identify
the complete original files, compact outputs, missing coverage and partial
footprints. These are checks of data handling, not instrument accuracy.

The Color map (27 September 2026, on `ccbf483de8`) went through the same reducer
and an independent check: 25 of 25 footprints match the original bytes, 15 of them
observed and 10 in the polar gray grid ([check](evidence/native-maps/md3-check.json),
[conversion receipt](evidence/native-maps/md3-conversion.json)). The original file
is 796,539,539 bytes; the reducer read it in row windows of at most 0.55 MB. Its
256,870 missing and 17,555 partial display pixels are the same count as the
enhanced map's. The [comparison](evidence/native-maps/md3-vs-enhanced.json) shows
the two are different products: 26.5% of pixels differ at pixelmatch threshold 0.1,
and the Color map's blue mean is 97 against the enhanced map's 134
([both maps](evidence/native-maps/md3-vs-enhanced.webp)). The Color dataset has not
been baked or inspected in a browser yet.

The [qualification record](evidence/native-maps/qualification.json) records the
tested inputs, unchanged geometry, inspected browser views, delivery and focused
checks: 75 independent native footprints agree, and all 76 runtime files installed from the published asset host into an empty directory. The normal and enhanced surface maps are 2.48 MB and 3.55 MB; the new LOI map adds 2.93 MB. No cold-load timing was measured. Earlier JPEG timings and resampling comparisons apply only to the
[previous Trek-based preparation](README.md#evidence),
not to these native-derived WebP files.

## Known problems

The interior’s shape shading is illustrative in both exterior-lighting states.

Feature outlines are not published nomenclature boundaries. Craters and faculae trace their published diameter as a circle; planitiae, montes, valles and catenae trace the Gazetteer’s latitude–longitude extent box. Rupes, dorsa and fossae show mapped tectonic traces instead: the up-to-six longest contractional (rupes, dorsa) or extensional (fossae) structures whose vertices lie inside the padded published extent, each at least a quarter of the longest. Those are the mapped structures near the name, not a Gazetteer boundary; 66 of 75 such features match, and the 9 without a mapped structure inside their extent (Adventure, Astrolabe, Fram, Gjöa, Zarya, Resolution, Vostok, Acadia and Protea Rupes) keep the extent box. Selecting a feature flies the camera over its centre at a distance that frames its published diameter, never farther than the observer already is. The 32 telescopic albedo features carry no diameter and are not labelled. The export repeats 8 features (one row per map quadrangle); preparation keeps the first row and records a maximum centre separation of 0.16° and diameter difference of 0.85 km. The view readout counts longitude from the map’s left edge, 180° from the Gazetteer’s positive-east origin.

Color and Enhanced color have the same missing polar coverage, beyond about 84° N and 80° S, shown as gray grid. The 366 km rendered outer shell is the difference between the cited radii; NASA separately describes it as “about 400 km.” The sky and display rotation are contextual, not an epoch-correct observation. The PSG source specifies no atmosphere structure, so no temperature-pressure chart is supplied.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<a id="mercury-sources"></a>

- The color, enhanced-colour and topography datasets share the 750 nm lighting bank ([planet limbs](../../../docs/surface-preparation.md#planet-limbs-from-published-laws)).

<details>
<summary>Methods and source notes</summary>

- Default surface: native USGS MESSENGER MDIS BDR, edition 1. The higher-Sun LOI mosaic is in the same Monochrome selector; see the source and reduction notes above.
- Enhanced dataset: native USGS RGB GeoTIFF, edition 1, with observed coverage retained. The former modeled polar completion and qualitative terrain-color legend are retired.
- Topography dataset: USGS MESSENGER 665 m numeric DEM v2 (2016). The detached ISIS label defines 0.5 m per native integer and a 2,439.4 km reference sphere. The map is rolled from its 180° central meridian into the common −180° display domain. Its generated legend uses the same −6,000 to 6,000 m palette as the numeric surface.
- Navigation marker: NASA/JHU APL/Carnegie MESSENGER global view, PIA15162.
- Physical facts and retained 3D cutaway: NASA Science's Mercury facts record, retrieved 2026-08-30. The only radial boundary claimed is the 0.85-radius metallic core; mantle and crust remain one combined outer shell. The rendered 366 km shell is the arithmetic difference between NASA's published 2,440 km planet radius and 2,074 km core radius, while the source's separate “about 400 km” statement is retained as an approximate published value. Interior colors and fine texture are explicitly declared illustrative presentation choices, and the optional Interior legend is marked schematic while using the exact prepared presentation palette. Preparation applies source-qualified depth/contact shading to the section faces, prepared object-space lighting to the retained core and outer cutaway, and a dedicated high-resolution default exterior light frame. None is represented as a direct observation or as sunlight inside Mercury.
- Cutaway preparation follows the accepted Saturn presentation schema: the same wedge is removed from the exterior and the 8-by-32 retained metallic-core sphere, including their lossless polar assets, ahead of runtime. The two radial section faces occupy separate halves of a lossless 2048-by-2048 logical atlas, stored at 4096 by 4096. A prepared presentation-only pitch assist begins above 55 degrees of camera control so the meridional section remains readable in the pole-on dataset; it does not change Mercury's physical axial-tilt claim. These are prepared presentation mechanics, not additional claims about Mercury's measured internal boundaries.
- Surface spectrum: a 326-point, 350–1000 nm global area-weighted mean prepared from M. D'Amore's DLR/Zenodo MESSENGER MASCS one-degree spectral cube (DOI `10.5281/zenodo.7433033`, CC-BY-4.0). The committed snapshot records the exact 197,099,868-byte archive identity, aggregation rule, parsed counts, and the archive/record count discrepancy.
- Atmospheric context: a pinned NASA GSFC Planetary Spectrum Generator configuration explicitly reports `ATMOSPHERE-STRUCTURE` as `None`. Mercury's thin exosphere is described separately, so the object package deliberately publishes no temperature-pressure chart.
- Surface density: the [raster recipe](source/preparation/raster.json) prepares every image once, at the canonical density. The dataset maps are 4160 by 3072 pixels (4096 texels around the equator); mount and startup decode them directly. The earlier 1x maps and the silhouette texture levels that switched between them were retired with every raster-lane 1x file.
- Surface map format: the four photographic maps use the shared WebP encoder; elevation uses lossless WebP. Each packed map remains 4,160 × 3,072 pixels, with 4,096 equatorial texels. No runtime texture levels or new geometry are introduced.
- Prepared lighting: the Kaasalainen–Shkuratov KS3 model that MESSENGER's map products were corrected with ([Domingue et al. 2016](https://doi.org/10.1016/j.icarus.2015.11.040), eq. 43 and Table 9 at 748.7 nm: c_l 0.6424, phase slope 0.5628 per radian), recorded in `source/photometry/domingue-2016-ks3-749nm.json`. Each frame is the model relative to the flood-lit disc centre, so the default shadowless view shows the 750 nm map as published at the centre and keeps 68% of that brightness near the limb, at 84° emission; the old Lambert frame with its 0.35 floor and 0.05 ambient term is gone. Mercury left the shared `sphere` bank for its own 256-frame bank. The camera transforms the same fixed direction used by the baked cube Sun, selects the nearest prepared phase from view-space light Z, and rotates that retained overlay to the same view-space azimuth; no lighting pixels are calculated at runtime. The model's fitted phases run from 23° to 87°; the shadowless frame at 0° is an extrapolation, and the exponential phase term has no opposition surge. See [planet limbs](../../../docs/surface-preparation.md#planet-limbs-from-published-laws).
- Feature traces: version 2 of Klimczak, Byrne and Crane’s “A Global Tectonic Map of Mercury” (Mendeley Data, DOI `10.17632/p43b9wttpj.2`, CC BY 4.0), whose `Combined_Tectonic_Map` shapefile holds 18,451 polylines in Plate Carrée metres on a 2,440,000 m sphere with a `Fault_Type` of contractional landform, extensional landform or trough. Preparation verifies the pinned archive, decodes the polylines and attributes, converts metres to east longitude and latitude, and for each Gazetteer rupes, dorsum or fossae selects the traces of the matching class whose vertices lie 90% inside the published extent padded by 0.3°, keeps the up-to-six longest that are at least a quarter of the leader, and decimates them to 240 vertices on the mesh sphere. The 300 m datum difference is below the label precision.
- Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Mercury (`MERCURY_nomenclature_center_pts.zip`, retrieved 2026-09-11 from the USGS Astrogeology download bucket), whose FGDC metadata declares the use constraint “Public domain.” Preparation verifies the pinned archive bytes, reads the dBase attribute table and the `GCS_Mercury_2000` projection (2,439,700 m sphere, matching the authored radius), drops the albedo-feature type code, folds repeated rows, converts each positive-east centre to a unit direction through the same `presentation/surface-map.json` axes the minimap uses with the map’s left edge at 180° E, and scales it to the mesh’s raw 11,500-unit radius. Features are ranked by diameter; craters and faculae get a small-circle rim (centre, east and north vectors), other types a 64-vertex polygon along their published extent box. The runtime fetches and byte-verifies the catalogue, projects the prepared anchors through the current camera each frame, fades labels toward the limb, admits them by prepared priority without overlap, and shows them only at the closest zoom. The hovered feature’s caption (name, type, diameter, name origin) and its outline, drawn as retained screen chords like the orbit lines, come from the same prepared record.

Landing sites: 1 spacecraft landing, touchdown or impact sites are labelled beside the IAU names (`source/features/sites.json`). Each coordinate quotes the NASA NSSDCA, PDS, LROC, agency or paper page it was read from, with the stated latitude kind and longitude convention; sites are unsized points ranked like a 20 km feature and the caption shows the quoted source sentence with its publisher.

Feature notes: 486 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

</details>

## Gravity and crust

Both datasets come from the MESSENGER gravity model HgM008, produced by
A. Genova at NASA Goddard from radio tracking of MESSENGER through the end of
the mission (April 30, 2015). The PDS Geosciences Node archives only the
model's spherical-harmonic coefficients, with the
[GGMES_100V08 label](source/science/gravity/ggmes_100v08_sha.lbl) (degree and
order 100, reference radius 2,440.0 km, Kaula constraint 4.0e-5/L²). The
numeric maps were computed by the same team and published by
[NASA Mercury Trek](https://trek.nasa.gov/mercury/). The
[acquisition plan](source/preparation/acquisition.json) extracts each GeoTIFF
from its Trek download archive unchanged. The citation is
[Genova et al. (2019), Geophysical Research Letters 46, 3625–3633](https://doi.org/10.1029/2018GL081135)
([open manuscript](https://pmc.ncbi.nlm.nih.gov/articles/PMC6662718/)).

| Dataset | Trek product | Grid | Display |
| --- | --- | --- | --- |
| Gravity | `Anomaly_Map_HgM008_Lmax90_16ppd` | 3,600 × 1,800 float64, 0.1° cells, mGal | −150 to +150 mGal, blue to red; 0.14% of the surface lies beyond and takes the endpoint colors |
| Crust | `CrustalThickness_Map_HgM008_16ppd` | 5,760 × 2,880 float32, 0.0625° cells, km | 0 to 70 km, purple to yellow |

Both grids are global, planetocentric, positive east and north up on a
2,439.7 km sphere, with no missing cells. The [raster recipe](source/preparation/raster.json)
samples the nearest native cell for each display pixel and keeps the result
lossless; no values are smoothed or filled.

**Gravity** is the free-air gravity anomaly: how the pull at 2,440 km radius
differs from that of a round, evenly dense planet. It includes the degree-2
terms from Mercury's flattening and tidal shape; removing them changes the map
by about 18 mGal at the equator and pole. A sum of the PDS coefficients
(degrees 2–90, weighted by l − 1) reproduces the Trek grid within 0.15 mGal at
12 cells, which confirms the definition, units and placement. The Trek gravity
disturbance map (weight l + 1) is the same field with different amplitudes and
is not shown; see the [investigation ledger](investigations.json).

**Crust** is the crustal-thickness model shown in Figure 1C–D of Genova et al.
(2019). They assumed a uniform crust density of 2,800 kg/m³, a crust–mantle
density contrast of 400 kg/m³ and an average thickness of 35 km, and used
degrees 2–60 of gravity and topography with finite-amplitude corrections.
Different assumptions give a different map. Other published crustal models (for
example [Beuthe et al. 2020](https://doi.org/10.1029/2020GL087261)) were not
examined for this dataset.

**Resolution.** Trek's degree-strength map for HgM008 gives the highest
spherical-harmonic degree the tracking data resolve. It falls from 45.6–73.0
north of 60° N to 10.9–15.1 south of 30° S, because MESSENGER flew low only over
the north. By the usual half-wavelength rule (π × 2,440 km ÷ degree), features
about 105–125 km across are resolved near the north pole but only about
500–700 km across in the south. Southern patterns in both datasets are broad for
that reason, not because the crust is smooth there. The map is used as a stated
limit, not as its own dataset.

The [gravity checks](evidence/gravity/checks.json) record ranges, coverage,
spot values at Gazetteer centres, the coefficient comparison and the
degree-strength bands. They check decoding, units and placement, not the
gravity solution or the crustal model. No browser view has been inspected yet.

### Known problems

- The crustal model falls below zero in 522 cells inside Rachmaninoff basin
  (minimum −3.03 km at 27.34° N, 57.34° E). That is not physical; it is shown as
  published, in the lowest color.
- The crust grid's area-weighted mean is 34.40 km, 0.60 km below the stated
  35 km average. The cause is not established.
- Trek's file names say 16 pixels per degree; the gravity grid has 10. Trek's
  descriptions call both maps northern orthographic projections; the files are
  global geographic grids.
- The crust GeoTIFF declares NaN as its no-data value. The shared scientific
  GeoTIFF reader compares that declaration with the recipe's number and
  refuses the file, so the Crust dataset needs a reader change before it can be
  prepared.

## Numeric USGS grid

The selected native GeoTIFF, detached labels and compact-grid recipe are linked
from [the source manifest](source/manifest.json). The compact grid keeps native
samples; the display applies the declared units and palette. See the
[shared acquisition and independent-check method](../../../docs/usgs-numeric-surfaces.md).
No new terrain displacement is introduced.

## Numeric-map qualification

The [retained numeric checks](evidence/usgs-numeric/numeric-checks.json) bind
the compact input digests and tested processing files, count coverage, and
compare native byte samples at hemispheres, seams, extrema and gaps. Their
calibration check runs before the display coverage masks; it does not validate
the original instrument or scientific model.

The [fresh-install receipt](evidence/usgs-numeric/delivery.json) verifies 1,500
runtime files (210,933,400 bytes) across the 13 changed bodies and the shared
Sun world metadata, with no reused files. All 15 compact source grids restored
from the source cache with native fallback disabled and matched byte for byte.

The [browser evidence](evidence/usgs-numeric/browser.json) records the earlier
map descriptions, legends and retained scene. It includes screenshots; the
[validation record](evidence/usgs-numeric/validation.json) names the checks
and the local full-build limitation. These checks do not measure instrument
accuracy or establish how well readers understand the explanations.

The [current-main integration check](../moon/evidence/usgs-numeric/integration.json) records the
build, all 11 grouped selectors, source labels and phone playback. It explains
which earlier scientific and browser evidence still applies to this version.
