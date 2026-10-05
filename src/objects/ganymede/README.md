# Ganymede

Ganymede is Jupiter's largest moon. Its globe offers the USGS Monochrome and False color mosaics, the DLR mosaic with Juno images, the Collins et al. (2013) geologic map, and VLT/MUSE measured maps. The rendered shape is a mean-radius sphere, not a resolved terrain mesh.

The navigation marker uses the source map as a stylized identifier. The [marker recipe](source/preparation/navigation.json) crops and resizes it, then prepares a circular alpha edge and the shared full-phase curvature shading (35% ambient, 65% diffuse). It is not a view at the scene epoch.

## Sources

- [USGS Voyager/Galileo monochrome mosaic, 1 km](https://astrogeology.usgs.gov/search/map/ganymede_voyager_galileo_ssi_global_mosaic_1km): 16539 × 8270, one unsigned-byte band.
- [USGS Voyager/Galileo color mosaic, 1.4 km](https://astrogeology.usgs.gov/search/map/ganymede_voyager_galileo_ssi_color_global_mosaic_1_4km): 11520 × 5760, three unsigned-byte bands. [USGS map I-2762](https://pubs.usgs.gov/imap/i2762/) and the [USGS globe description](https://astrogeology.usgs.gov/search/map/ganymede_voyager_galileo_image_mosaic_globe) describe its processing.
- **DLR mosaic**: [DLR_Ganymede_Voyager-Galileo-Juno_V1.0](https://doi.org/10.57780/esa-fcj5pf3), the DLR JANUS team's 2022 global mosaic in the ESA Planetary Science Archive ([data set page](https://www.cosmos.esa.int/web/psa/dlr_ganymede_voyager-galileo-juno_v1.0) · [product guide](https://archives.esac.esa.int/psa/ftp/Guest-Storage-Facility/DLR_Ganymede_Voyager-Galileo-Juno_V1.0/PUG-DLR-Ganymede-v2.pdf)): 46080 × 23040, 128 pixels per degree (358.77 m). It re-projects 118 Voyager and 88 Galileo images on the [Zubarev et al. (2016)](https://doi.org/10.1134/S0038094616050087) control network ([Kersten et al. 2021](https://doi.org/10.1016/j.pss.2021.105310)) and lays JunoCam images from the 7 June 2021 flyby on top ([Kersten et al. 2022](https://doi.org/10.5194/epsc2022-450)). Licence CC BY-NC 3.0 IGO under the [ESA Space Science Archive terms](https://www.cosmos.esa.int/web/esdc/terms-and-conditions); credit ESA/DLR and cite “European Space Agency, 2022, DLR_Ganymede_Voyager-Galileo_Juno_V1.0, 10.57780/esa-fcj5pf3”.
- The Geology view uses the global geologic map of Collins et al. (2013), [USGS SIM 3237](https://doi.org/10.3133/sim3237), at 1:15,000,000: the `GeologyUnits` shapefile from the [database ZIP](https://pubs.usgs.gov/sim/3237/downloads/Ganymede_SIM3237_Database.zip), with unit names from the [map sheet](https://pubs.usgs.gov/sim/3237/pdf/sim3237_mapsheet.pdf).
- The VLT/MUSE views use original July 2019 measured maps from King et al. The [source interpretation](source/muse/INTERPRETATION.md) defines units, coordinates, coverage and registration limits.
- The VLT/SPHERE composition release of [King and Fletcher (2022)](https://doi.org/10.1029/2022JE007323) is [Zenodo 6390469](https://doi.org/10.5281/zenodo.6390469), with native source [fit_SPHERE.json.gz](https://github.com/ortk95/king-2022-global-modelling-ganymede-surface-composition/blob/1ff2f7069a194f6ce356604072077352b4c78f4a/fit_SPHERE.json.gz) and [conversion record](source/composition/model-conversion.json). Its Ice fraction and Dark material views are withheld (see Known problems).
- **Lighting:** the lunar-like (Lommel–Seeliger) law [Squyres and Veverka (1981)](https://doi.org/10.1016/0019-1035%2881%2990203-7) found in Voyager images. See [Lighting law](#lighting-law).
- Named features come from the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile (retrieved 2026-09-11, public domain per its FGDC metadata). 68 names carry a caption note from the lead of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), credited in the caption beside the IAU naming year.
- [NASA Ganymede facts](https://science.nasa.gov/jupiter/jupiter-moons/ganymede/facts/) support the introduction, ocean interpretation, thin oxygen atmosphere and approximately 1.07 million km orbit.

Source selections, trials and open questions are in the [investigation ledger](investigations.json).

[Inputs](source/manifest.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Processing

**Photographic views.** Monochrome keeps the USGS observation mosaic. False color maps SSI 991 nm to red, 559 nm to green and 413 nm to blue. We keep the published USGS processing and add no guessed photometric model. Zero is no-data and incomplete footprints are withheld; missing color uses co-located monochrome. Maps are 8192 × 4096 (about 2.02 km per equatorial texel). [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) describes the method.

**DLR mosaic.** The recipe reads the GeoTIFF with the `geotiff-byte-monochrome` route, which checks the grid, origin, sphere and no-data value and keeps the 8-bit values. The texture goes through the lossy lane like the other photographs.

**Geology.** Each of the 3,046 polygons is colored by its `UNITNAME`, the field the authors' own ArcMap project symbolizes. Converted from ArcMap's stored CIE L\*a\*b\*, the 20 units NASA Trek also serves match Trek's RGB exactly. `UNITNAME` keeps the three palimpsest classes (p1, p2, pu) that the `Unit` field merges into `p`. The values and colors are in [display-categories.json](source/science/geology-sim3237/display-categories.json). The shared shapefile sampler paints the polygons at each output pixel centre; overlaps are withheld. Colors mark map units, not surface color or composition.

**Composition.** The two withheld views use posterior medians for `derived_total_ices` and `derived_total_synthetic`. The fit is resampled only by reversing latitude, reordering longitudes and repeating the seam: no smoothing or gap fill.

**Map edge.** The prepared map starts at 0° E. Read through its georeferenced source, the prepared normal map correlates 0.90 from 0° E and −0.07 from 180° E. Preparation refuses a declared edge the source contradicts ([where the prepared map starts](../../../docs/surface-preparation.md#where-the-prepared-map-starts)).

## Lighting law

The globe is lit with the lunar-like law [Squyres and Veverka (1981)](https://doi.org/10.1016/0019-1035%2881%2990203-7) found in Voyager clear-filter images at 10° to 124° phase: I = A F(α) μ0/(μ0 + μ), the Lommel–Seeliger law, which has no parameter. That paper is closed. The authors' own summary, page 67 of NASA's [Reports of Planetary Geology Program 1980](https://ntrs.nasa.gov/citations/19810007392), is open and prints the function for Ganymede's cratered and grooved terrain. The law is recorded in [`source/photometry/squyres-veverka-1981-lommel-seeliger-clear.json`](source/photometry/squyres-veverka-1981-lommel-seeliger-clear.json).

Each lighting frame is the law relative to the flood-lit disc centre. With the Sun behind the viewer this law is flat: the limb is as bright as the centre. At 0.98 of the radius the overlay alpha is 0, where the authored bank this replaces reached 0.49. See [planet limbs](../../../docs/surface-preparation.md#planet-limbs-from-published-laws).

## Evidence

The geologic polygons cover 99.60% of the sphere. Gray covers 0.40%, beyond 80° N and 80° S where the map has no polygons. Overlaps cover 0.001%. Gazetteer centres of features the map text names fall in the expected unit in 13 of 15 cases when longitudes are read east-positive, and 3 of 15 when read west-positive. The two misses are large features whose centre lands on a neighbouring unit. This checks gross registration; it is not a measured offset.

The Juno images in the DLR mosaic cover 13.0% of the globe, about 310° to 60° east and 14° S to 70° N, around Tros crater. There they show craters and grooves that the USGS mosaic blurs. Fine detail inside that footprint is 0.55 against 0.50 for the USGS mosaic; outside it the DLR mosaic is no sharper (0.52 against 0.54). The DLR mosaic has imagery on 99.88% of the sphere, the USGS mosaic on 99.57%. It is a separate view because its control network differs: tile correlation finds shifts of a median 7 texels (14 km), up to 28 texels (57 km).

The withheld composition grids match the original release exactly after float32 rounding across all 64,800 nodes.

## Known problems

- **Lighting law:** One law lights the whole globe; the authors say bright craters follow it only approximately. Its phase function is drawn in a figure and not printed, so frames with Shadows on carry no phase term. Its emission limit, 86.2°, is derived here.
- **DLR mosaic:** its features sit a median 14 km (up to about 57 km) from the labels and other views. DLR cut or interpolated artefacts and matched brightness by hand, including on the Juno images; its guide also reports an unexplained shift along the 180° meridian. Brightness is not comparable with the USGS mosaic. The CC BY-NC 3.0 IGO licence excludes commercial use without an ESA licence.
- **Photographic views:** Neither is unlit calibrated albedo or natural eye color. Terrain shadows and varying source resolution, about 400 m–20 km/pixel, remain.
- **Color coverage:** In the 210–250° west sector, Voyager supplied green/blue while red was synthesized. This package uses the observed monochrome base throughout that sector (110–150° east).
- **Feature outlines:** Craters and faculae trace a rim circle and other types their extent box; these are not published nomenclature boundaries. The readout longitude counts from the map's left edge, 180° from the Gazetteer origin.
- **Composition:** The 1° node grid is a resampling container; SPHERE resolves roughly 100–150 km features. Ice fraction and dark material are fitted MCMC model abundances, not direct detections. `fit_SPHERE.json.gz` names only the 2015 observation, though its valid mask matches the union of the 2015/2021 SPHERE masks; [the footprint comparison](evidence/composition/registration.json) does not establish each cell's epoch.
- **Composition reuse:** Zenodo lists the release as `other-open`, but neither the tag nor the paper grants rights to the numerical files. The two views are withheld until explicit reuse terms exist.
- **Geology attributes:** four polygons carry a `UNITNAME` that differs from their `TERRAIN` and `Unit` fields. The largest, record 1946 (545,327 km², south-west of Barnard Regio), is young light grooved material by `UNITNAME` but dark cratered by the others; its mosaic brightness does not settle the question. The separate label points disagree with the polygon unit at 129 of 3,042 comparable locations.
- **Geology structures:** contacts, grooves, furrows, crater rims and other line and point symbols are not shown. Geology has not been baked or checked in a browser since the color change.
