# Mars sources

Mars shows Viking visible imagery, MOLA relief and THEMIS infrared observations on the shared raster lane used by Mercury and Venus, with modeled atmosphere charts and IAU nomenclature labels. The dataset selector groups Chlorine, Iron, Silicon, Potassium and Thorium under one entry (see [dataset groups](../../../docs/reader-text.md#dataset-groups)). Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Sources

| View or quantity | Source |
| --- | --- |
| Visible surface | [Viking MDIM 2.1](https://astrogeology.usgs.gov/ckan/dataset/7131d503-cdc9-45a5-8f83-5126c0fd397e/resource/5ea881c6-01b3-41fa-a7af-42d2131b54f1/download/mars_viking_mdim21_clrmosaic_1km.jpg), colorized by NASA Ames |
| Elevation | [USGS MOLA numeric DEM](https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m), meters above the GMM-2B areoid |
| Albedo | [MGS TES bolometric albedo](https://astrogeology.usgs.gov/search/map/mars_mgs_tes_global_bolometric_albedo_map_7410m), [Christensen et al. (2001)](https://doi.org/10.1029/2000JE001370), 8 pixels per degree |
| Thermal inertia | [MGS TES nightside thermal inertia](https://pds-geosciences.wustl.edu/missions/mgs/tes-timap.html), [Putzig and Mellon (2007)](https://doi.org/10.1016/j.icarus.2007.05.013), 20 pixels per degree |
| Dust cover | [MGS TES dust cover index](https://www.mars.asu.edu/~ruff/DCI/dci.html), [Ruff and Christensen (2002)](https://doi.org/10.1029/2001JE001580), 16 pixels per degree |
| Infrared display | Mars Odyssey THEMIS daytime infrared mosaic from the [USGS Astrogeology WMS](source/manifest.json) |
| Geology | [Tanaka et al. (2014), USGS SIM 3292](https://pubs.usgs.gov/sim/3292/): 1,311 polygons and 44 units at 1:20,000,000 |
| Water equivalent, chlorine, iron, silicon, potassium, thorium | [Odyssey GRS ELEMTS v1](https://pds-geosciences.wustl.edu/missions/odyssey/grs_elements.html), observations 4 June 2002–3 April 2005 |
| Magnetic field | [Langlais et al. (2019)](https://doi.org/10.1029/2018JE005854), degree/order 134 |
| Crust thickness | [Wieczorek et al. (2022) Figure 2 example](https://doi.org/10.1029/2022JE007298) from [Zenodo 6477509](https://zenodo.org/records/6477509) |
| Surface limb | [Vincendon 2013](https://doi.org/10.1016/j.pss.2012.12.005), mean phase function from OMEGA and CRISM |
| Limb halo | [NASA Planetary Spectrum Generator](https://psg.gsfc.nasa.gov/) single-scattering limb model, run locally ([profile](source/atmosphere/psg-limb.json)) |
| Landform and mineral catalogues | Eleven published surveys through their [NASA Trek](https://trek.nasa.gov/mars/) GIS layers, listed [below](#landform-and-mineral-catalogues-27-september-2026) |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/MARS/target) Mars centre-point export, snapshot 2026-09-11, public domain |
| Feature notes | Lead summaries of English Wikipedia articles (CC BY-SA 4.0, retrieved 2026-09-12), credited in each caption |
| Surface panoramas | Five natural-colour 360° panoramas from the [Mastcam-Z 360° Panorama Collection](https://mastcamz.asu.edu/mastcam-zs-360-panorama-collection/) (NASA/JPL-Caltech/ASU/MSSS; [Bell et al. 2025, LPSC abstract 1719](https://www.hou.usra.edu/meetings/lpsc2025/pdf/1719.pdf)), each placed at the rover's [PDS PLACES](https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_rover_places/data_localizations/) localisation for its sols |
| Navigation marker | NASA/ESA Hubble [full-disc Mars portrait](https://esahubble.org/images/heic1609a/) (2016), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Dimensions, placement and charts | USGS, JPL and NASA PSG records; editorial text from NASA Science topic `107740` |

The visible mosaic keeps its collective Viking-orbiter credit; the pinned image does not identify individual contributors. See [Inputs](source/manifest.json) · [Recipe](object.json) · [Credits](NOTICE.md) · [Contributor guide](../README.md).

## Processing

Photographic datasets are resampled with Lanczos3 to 4,096 by 2,048 texels, packed into 16 latitude bands and encoded as WebP. Numeric datasets use nearest sampling and the lossless lane. No exposure or sharpening curve is applied. Each dataset also gets a 1,024 by 512 pole image sampled from the original photographs.

- Elevation colours MOLA heights on a −9,000 to 22,000 m scale.
- Albedo is read from the USGS float32 GeoTIFF and checked against [the raster recipe](source/preparation/raster.json).
- Thermal inertia is read from the PDS3 grid by the `pds3-grid` reader. Infilled cells are withheld (8.46% of the planet).
- Dust cover is read from a VICAR file by the `vicar-grid` reader. The fill value 0.85 is withheld.
- Geology uses the published legend fills in [the colour table](source/geology/sim3292-colors.json).
- GRS maps keep their unsmoothed 5° bins, negative estimates and missing cells. Water equivalent is hydrogen expressed as H₂O, not a map of exposed ice. Thorium is shown in ppm.
- The magnetic field is evaluated by pyshtools on the 3,393.5 km sphere through the [magnetic recipe](source/preparation/magnetic.json) and [the preparation command](../../../packages/bake/cli/prepare-magnetic-map.mts). It shows radial field, blue inward and red outward.
- Crust thickness assumes 39 km beneath InSight and a crust density of 2,900 kg/m³. [The converter](../../../packages/bake/cli/prepare-mars-crust.mts) only reverses rows and adds coordinates. This example is not a unique consensus model.
- Named features are placed through `presentation/surface-map.json`. Craters trace a rim circle; other types their published extent box. Fourteen landing, touchdown or impact sites and 2 traverse paths quote their source page in `source/features/sites.json`.

The disc is lit by Vincendon's mean surface law (Hapke with w 0.85 and 17° roughness), with the atmosphere removed. One law lights all three channels, and the limb keeps three quarters of the centre's brightness ([planet limbs](../../../docs/surface-preparation.md#planet-limbs-from-published-laws)). The halo outside the disc comes from a PSG limb profile of PSG's Mars template with Mars Climate Database dust and water ice, computed by [acquire-psg-limb-table.mts](../../../packages/bake/cli/acquire-psg-limb-table.mts). The reflectance spectrum and temperature-pressure charts are static SVGs from a pinned PSG configuration. The browser makes no PSG request.

### Surface panoramas (30 September 2026)

The Imagery tab lists five Mastcam-Z panoramas: Octavia E. Butler Landing (sols 3–11), Van Zyl Overlook (53–64), Three Forks sample depot (690–692), Belva crater (789–791) and Bright Angel (1178). Their list is [`source/panoramas/panoramas.json`](source/panoramas/panoramas.json); the images are manifest inputs restored from their ASU links.

- **Projection.** ASU states that most images are "a simple cylindrical projection, with 0° azimuth (due north …) in the center" and "typically" +10° at the top. The preparation reads each image with one scale in both axes, the width spanning 360°, north in the middle and +10° at the top row. The measured spans are 77° to 100° of elevation, whole degrees, as one scale predicts.
- **Placement.** Each panorama stands where the rover's last localised drive on or before its first sol left it (PLACES `m2020_best_tactical.csv`); before the first drive, at the origin of that drive's site frame. A drive during the panorama's sols stops the preparation.
- **Delivery.** Each image is resampled bilinearly into the six 2048-pixel faces of a sky cube (about 23 pixels a degree) in the lossy lane, 1.2 to 2 MB a panorama, loaded only when opened. The standpoints are also point features (`PN`) in the feature catalogue.

### Landform and mineral catalogues (27 September 2026)

These datasets draw catalogues over the Viking mosaic, shown grey at 35% brightness. The shared [`geology-grid.py`](../../../packages/bake/src/objects/acquisition/geology-grid.py) paints each into a 4,096 × 2,048 grid of 5.2 km cells.

| Dataset | Source | Drawn as |
| --- | --- | --- |
| Dune fields | [Hayward et al. (2007)](https://pubs.usgs.gov/of/2007/1158/), 547 fields | Cells inside a field outline |
| Valley networks | [Hynek et al. (2010)](https://doi.org/10.1029/2009JE003548), 9,879 networks | Every cell a centreline crosses |
| Alluvial fans | [Moore and Howard (2005)](https://doi.org/10.1029/2004JE002352), [Kraal et al. (2008)](https://doi.org/10.1016/j.icarus.2007.09.028), 44 fans | One cell per fan |
| Gullies | [Harrison et al. (2015)](https://doi.org/10.1016/j.icarus.2015.01.022), 4,978 sites | One cell per site, by slope orientation |
| Glacier-like forms | [Souness et al. (2012)](https://doi.org/10.1016/j.icarus.2011.10.020), 1,309 | One cell per centre |
| Recessional glacier-like forms | [Brough et al. (2016)](https://doi.org/10.1016/j.icarus.2016.03.006), 436 | One cell per centre |
| Glacial valleys | [Fassett et al. (2010)](https://doi.org/10.1016/j.icarus.2010.02.021), 102 | One cell per valley point |
| Present-day changes | [Daubar et al. (2013)](https://doi.org/10.1016/j.icarus.2013.04.009), [Dundas et al. (2014)](https://doi.org/10.1002/2013JE004482), [(2015)](https://doi.org/10.1016/j.icarus.2014.05.013), [McEwen et al. (2014)](https://doi.org/10.1038/ngeo2014), [Ojha et al. (2014)](https://doi.org/10.1016/j.icarus.2013.12.021), 508 HiRISE sites | One cell per site, by source catalogue |
| Hydrous detections | [Carter et al. (2013)](https://doi.org/10.1029/2012JE004145), 1,648 | One cell per detection, by instrument |
| Mineral classes | [Ehlmann and Edwards (2014)](https://doi.org/10.1146/annurev-earth-060313-055024), 4,572 in five classes | One cell per site, by class |
| Chloride deposits | [Osterloo et al. (2010)](https://doi.org/10.1029/2010JE003613), 642 deposits | Cells inside a deposit outline |

A coloured cell holds at least one catalogued feature; no size is drawn. A white cell holds features of more than one class. Unmarked ground is not proof of absence.

## Evidence

- Albedo spans 0.061–0.32. Syrtis Major is dark and Arabia and Tharsis are bright, as in Ruff and Christensen (2002).
- Thermal inertia reads Syrtis Major 193, Arabia 47 and Arsia 11.
- Dust cover reproduces the paper: Arabia 0.922, Syrtis Major 0.973, Mare Erythraeum 0.968 against its 0.970 regional average.
- The magnetic grid spans −8,365 to 11,206 nT, consistent with Figure 6b's −8,520 to 11,260 nT.
- Crust thickness spans 5.579–116.811 km, consistent with the paper's rounded 6–117 km.
- Every catalogue point lands in a cell of its own class or the shared class.

## Known problems

- THEMIS shows qualitative infrared response, not calibrated temperature or one observation date. Rows north of about 87.5° N and south of about 88.8° S are black: missing coverage, not dark terrain. The dataset is a USGS WMS snapshot (2026-09-16).
- Albedo cells poleward of about 87° hold a constant fill of 0.06 and show as missing. Each cell blends several seasons.
- MOLA's interpolated regions are inherited from the USGS product.
- The PSG halo is a model, not a measurement: single scattering only, with the Sun one degree above the horizon and one dust and ice snapshot. The real halo may be brighter and changes with season and dust storms.
- Small features fall below the 5.2 km catalogue cells: 89 of 547 dune fields and 347 of 642 chloride deposits hold no cell centre.
- The catalogue grids are not yet seen in a browser, and the pole images have not been checked for the underlay.
- Nomenclature outlines are not published boundaries.
- The first column of the Viking MDIM 2.1 map is nearly black. A thin dark line can show along 180° E at close zoom.
- The camera and background sky do not represent an observer at a stated epoch.
- A panorama's top edge is placed at ASU's "typical" +10°. It is checked only at Octavia E. Butler Landing, where the horizon falls near 0°; the other four spans differ from the typical 80°, so their horizons may sit a few degrees off.
- Above a panorama's top edge and below its bottom edge nothing was imaged: the view shows black there.
- The cube faces hold about a quarter of the published resolution (83 pixels a degree for most images).
