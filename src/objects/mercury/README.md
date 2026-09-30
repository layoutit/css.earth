# Mercury

Mercury offers two monochrome maps taken under different sunlight, a three-filter color map, an enhanced-color map, numeric elevation, a gravity map, a crustal-thickness model and an illustrated cross section.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

| View or property | Source and interpretation |
| --- | --- |
| Monochrome: Low Sun / Higher Sun | Native USGS MESSENGER MDIS BDR and LOI GeoTIFFs, edition 1 (2016), from NAC or WAC 750 nm images. |
| Color | Native USGS MDIS MD3 665 m GeoTIFF, edition 1 (2016). Red, green and blue are the 1000, 750 and 430 nm filter images. Not natural color. |
| Enhanced color | Native USGS MDIS 665 m GeoTIFF, edition 1 (2016). Red: principal component 2; green: principal component 1; blue: 430/1000 nm ratio. |
| Topography | [USGS MESSENGER 665 m DEM v2](https://astrogeology.usgs.gov/search/map/mercury_messenger_global_dem_665m), numeric heights above a 2,439.4 km sphere with a matching color scale. |
| Gravity | Free-air gravity anomaly of the MESSENGER gravity model HgM008 ([Genova et al. 2019](https://doi.org/10.1029/2018GL081135)), degree 90, in mGal on a 2,440 km sphere; numeric grid from NASA Mercury Trek. |
| Crust | Crustal-thickness model of Genova et al. (2019) from HgM008 and laser-altimeter topography, in km; a model under assumed densities, not a measurement. |
| Interior | [NASA facts](https://science.nasa.gov/mercury/facts/), retrieved 2026-08-30. A 0.85-radius metallic core and combined mantle/crust shell; colors and fine texture are illustrative. |
| Spectrum | DLR/Zenodo MASCS one-degree cube, [10.5281/zenodo.7433033](https://doi.org/10.5281/zenodo.7433033). The 326-point spectrum is a global area-weighted mean over 350–1000 nm. |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/MERCURY/target) Mercury centre-point export, snapshot 2026-09-11, public domain. 573 IAU-adopted names. |
| Feature traces | [A Global Tectonic Map of Mercury](https://data.mendeley.com/datasets/p43b9wttpj/2), Klimczak, Byrne and Crane, version 2 (2025), CC BY 4.0. 18,451 mapped fault traces. |

The navigation marker is the NASA/JHU APL/Carnegie MESSENGER global view, PIA15162. Feature captions carry the lead summary of each name's English Wikipedia article (CC BY-SA 4.0), recorded in `source/features/notes.json` and credited in the caption.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Native photographic maps

[BDR low Sun](https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_global_basemap_bdr_166m)
and [LOI higher Sun](https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_basemap_loi_global_mosaic_166m)
are 92,160 × 46,080 byte images with native spacing about 166 m. BDR selects
images near 74° solar incidence; LOI selects images near 45°. These are mosaics
of different observations, not two dates.

[Color](https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_basemap_md3_color_global_mosaic_665m)
is the USGS MD3 mosaic (PDS data set `MESS-H-MDIS-5-RDR-MD3-V1.0`), a
23,040 × 11,520 RGB grid of the 1000, 750 and 430 nm filter images.
[Enhanced color](https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_basemap_enhanced_color_global_mosaic_665m)
is made from the same three bands but shows two principal components and a band
ratio. 1000 nm is beyond human vision, so neither is natural color. The
USGS page cites [Denevi et al. (2016)](https://www.hou.usra.edu/meetings/lpsc2016/pdf/1264.pdf)
for the calibration and map products.

The [acquisition recipes](source/maps/native) validate each GeoTIFF's frame, and
the [offline reducer](../../../packages/bake/src/objects/acquisition/geotiff-image.ts)
averages native pixel areas into 4,096 × 2,048 images, keeping the publisher's
stretch. A wholly unobserved footprint receives the shared gray grid; no nearby
color or terrain is used to reconstruct a gap.

Topography is shown with a −6,000 to 6,000 m palette; see the
[shared acquisition and independent-check method](../../../docs/usgs-numeric-surfaces.md).

## Lighting

Mercury is lit with the Kaasalainen–Shkuratov KS3 model that MESSENGER's map
products were corrected with ([Domingue et al. 2016](https://doi.org/10.1016/j.icarus.2015.11.040),
at 748.7 nm), recorded in `source/photometry/domingue-2016-ks3-749nm.json`. Each frame is
the model relative to the flood-lit disc centre, so the default shadowless view
shows the 750 nm map as published at the centre and keeps 68% of that
brightness near the limb, at 84° emission. The color, enhanced-colour and
topography datasets share this lighting bank
([planet limbs](../../../docs/surface-preparation.md#planet-limbs-from-published-laws)).

## Interior, spectrum and features

The rendered 366 km outer shell is the difference between NASA's 2,440 km
planet radius and 2,074 km core radius. The surface spectrum comes from
M. D'Amore's MASCS cube (CC-BY-4.0). The NASA Planetary Spectrum Generator
reports no atmosphere structure for Mercury, so no temperature-pressure chart
is published.

Craters and faculae trace their published diameter as a circle; other types
trace the Gazetteer's extent box. Rupes, dorsa and fossae instead show up to
six of the longest matching tectonic traces inside their published extent.
Landing and impact sites are labelled from `source/features/sites.json`.

## Gravity and crust

Both datasets come from the MESSENGER gravity model HgM008, produced by
A. Genova at NASA Goddard. The PDS Geosciences Node archives the model's
coefficients ([GGMES_100V08 label](source/science/gravity/ggmes_100v08_sha.lbl));
the numeric maps were published by
[NASA Mercury Trek](https://trek.nasa.gov/mercury/) and are sampled to the
nearest native cell, lossless, by the [raster recipe](source/preparation/raster.json).
The citation is
[Genova et al. (2019), Geophysical Research Letters 46, 3625–3633](https://doi.org/10.1029/2018GL081135)
([open manuscript](https://pmc.ncbi.nlm.nih.gov/articles/PMC6662718/)).

| Dataset | Trek product | Grid | Display |
| --- | --- | --- | --- |
| Gravity | `Anomaly_Map_HgM008_Lmax90_16ppd` | 3,600 × 1,800 float64, 0.1° cells, mGal | −150 to +150 mGal, blue to red; 0.14% of the surface lies beyond and takes the endpoint colors |
| Crust | `CrustalThickness_Map_HgM008_16ppd` | 5,760 × 2,880 float32, 0.0625° cells, km | 0 to 70 km, purple to yellow |

**Gravity** is the free-air gravity anomaly: how the pull at 2,440 km radius
differs from that of a round, evenly dense planet. A sum of the PDS coefficients
reproduces the Trek grid within 0.15 mGal at 12 cells, which confirms the
definition, units and placement.

**Crust** is the crustal-thickness model shown in Figure 1C–D of Genova et al.
(2019), which assumed an average thickness of 35 km. Different assumptions give
a different map. Other published crustal models (for
example [Beuthe et al. 2020](https://doi.org/10.1029/2020GL087261)) were not
examined for this dataset.

**Resolution.** MESSENGER flew low only over the north, so features about
105–125 km across are resolved near the north pole but only about 500–700 km
across in the south.

## Evidence

For the Color map, 25 of 25 sampled footprints match the original bytes.
Color and Enhanced color are different products: 26.5% of pixels differ. These are checks of data handling, not instrument accuracy. The Color
dataset has not been baked or inspected in a browser yet, and no browser view
of the gravity and crust maps has been inspected yet.

## Known problems

- Feature outlines are not published nomenclature boundaries. Of the 75 rupes, dorsa and fossae, 9 have no mapped structure inside their extent (Adventure, Astrolabe, Fram, Gjöa, Zarya, Resolution, Vostok, Acadia and Protea Rupes) and keep the extent box. The 32 telescopic albedo features carry no diameter and are not labelled. The view readout counts longitude from the map's left edge, 180° from the Gazetteer's positive-east origin.
- Color and Enhanced color have the same missing polar coverage, beyond about 84° N and 80° S, shown as gray grid.
- The interior's shape shading is illustrative. NASA separately describes the outer shell as "about 400 km", against the rendered 366 km.
- The sky and display rotation are contextual, not an epoch-correct observation.
- The KS3 model's fitted phases run from 23° to 87°; the shadowless frame at 0° is an extrapolation, and it has no opposition surge.
- The crustal model falls below zero in 522 cells inside Rachmaninoff basin (minimum −3.03 km at 27.34° N, 57.34° E). That is not physical; it is shown as published, in the lowest color.
- The crust grid's area-weighted mean is 34.40 km, 0.60 km below the stated 35 km average. The cause is not established.
- Trek's file names say 16 pixels per degree; the gravity grid has 10. Trek's descriptions call both maps northern orthographic projections; the files are global geographic grids.
- The crust GeoTIFF declares NaN as its no-data value, which the shared scientific GeoTIFF reader refuses, so the Crust dataset needs a reader change before it can be prepared.
