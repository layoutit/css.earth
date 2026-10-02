# Eros

## Sources

| View or property | Source and interpretation |
| --- | --- |
| Visible and near-infrared albedo | [USGS/Golish 2023 deblurred MSI release](https://astrogeology.usgs.gov/search/map/near_msi_albedo_mosaics), all seven filters: 450, 550, 760, 900, 950, 1000 and 1050 nm. Dimensionless I/F normalized to zero phase/incidence/emission, both displayed linearly over 0.05–0.40; not a quantitative mineral indicator. |
| Shape and Elevation | [Gaskell ver128q](https://sbnarchive.psi.edu/pds4/non_mission/gaskell.ast-eros.shape-model/data/vertex/ver128q.tab), 196,608 released facets. Elevation is radius minus 8.42 km, not gravitational height. |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/EROS/target) Eros centre-point export, public domain. Labels appear at the closest zoom only, and a selected feature stays labelled. 2 names carry a caption note from their English Wikipedia article (CC BY-SA 4.0), kept with the article link and revision in `source/features/notes.json`. One spacecraft landing site is labelled (`source/features/sites.json`). |
| Ponds | [Roberts Eros Ponds Catalog V1.1](https://doi.org/10.26033/4dqc-8067), PDS Small Bodies Node, 2021: 334 ponds found by P. C. Thomas in NEAR MSI images, relocated on the Gaskell shape with SBMT. Each has a body-fixed centre and one characteristic diameter; 326 are drawn. |
| Composition facts | NEAR X-ray spectrometer ratios from [Lim and Nittler (2009)](https://doi.org/10.1016/j.icarus.2008.09.018); landing-site gamma-ray values from [Peplowski et al. (2015)](https://doi.org/10.1111/maps.12434) and [Evans et al. (2001)](https://doi.org/10.1111/j.1945-5100.2001.tb01854.x). Factsheet values, not maps. |

[Mission facts](https://science.nasa.gov/solar-system/asteroids/433-eros/). Pole and spin: source/reference/eros_alex.tpc.txt.

## Reflected light

One wavelength group contains all seven NEAR MSI maps, ordered from 450 to 1050 nm. The arrows select blue, green and five near-infrared bands. Darker areas reflect less light in the selected band. The 550 nm view is the default, and the `normal` and `infrared` links select 550 and 950 nm.

The seven maps share 10,682 × 5,341 samples, 10 m pixels and a 17 km cartographic radius. The release registers them to the Gaskell control network and normalizes to phase/incidence/emission zero with a model for each filter. Every band uses the same linear 0.05–0.40 I/F display range, so a view switch does not add a brightness normalization. Source gaps remain gray. A few source values lie well beyond the display range and clip to black or white. No custom ratio or color composite is made.

## Ponds

Ponds are smooth, flat deposits of fine material in the floors of small hollows, found mostly near the equator at both ends of the long axis, as the catalogue's [bundle description](https://sbnarchive.psi.edu/pds4/non_mission/ast-eros.roberts.ponds-catalog_V1_1/document/bundle_description.txt) summarises; [Roberts et al. (2014)](https://doi.org/10.1111/maps.12348) discuss their origin and flatness. The Ponds view draws the catalogue in cyan, the color the catalogue's own SBMT table uses, over the 550 nm photograph in grey at 35% brightness. The dimming is a presentation choice. The cyan differs by at least 47 OKLab units from every dimmed photograph value (median 69.6).

- Each pond is drawn at its published diameter (7.4 to 213.6 m, median 49.9 m). Ponds are rarely round and some catalogue rows are parts of one long deposit, so the circle shows size, not outline.
- Grey ground is not proof that no pond is there. The count follows image resolution, especially below 30 m ([Roberts et al. 2014, Icarus](https://doi.org/10.1016/j.icarus.2014.07.004)).
- 8 of the 334 centres (ponds 1, 2, 10, 129, 216, 218, 219 and 255) lie 66 to 384 m from the Gaskell ver128q surface and are left out. The other 326 lie within 27.4 m of it (median 2.3 m).
- The smallest ponds, a few metres across, can be smaller than one map pixel.

## Composition

NEAR measured elements with an X-ray and a gamma-ray spectrometer. The archive holds only their spectra, not abundance maps, and the published results cannot make a map: the X-ray values average eight solar flares over large parts of the surface, and the useful gamma-ray data were taken after landing, at one spot.

| Quantity | Value | Where | Source |
| --- | --- | --- | --- |
| Mg/Si | 0.753 (+0.078/−0.055) | Eight-flare average, top tens to hundreds of micrometres | Lim and Nittler (2009), Table 9, uncorrected |
| Fe/Si | 1.678 (+0.338/−0.320) | Same | Same |
| S/Si | 0.005 ± 0.008; H, L and LL chondrites 0.111–0.114 | Same | Same |
| Fe/Si by mass | 1.19 ± 0.30 (2 SD) | Landing site, tens of centimetres deep | Peplowski et al. (2015), Table 2, BGO |
| Hydrogen | 1,100 ppm (400–2,700 ppm, 2 SD) | Landing site | Peplowski et al. (2015) |
| Potassium | 0.07% (±40%) | Landing site | Evans et al. (2001), Table 1 |

Lim and Nittler (2009) recalibrated the X-ray data of [Nittler et al. (2001)](https://doi.org/10.1111/j.1945-5100.2001.tb01856.x) and found their results consistent within the uncertainties. The extracts and uncertainty meanings are in [the factsheet review](source/editorial/factsheet-review.json). Peplowski (2016) reports global Fe, Th and K from the orbital gamma-ray data; its full text could not be read, so those values are not shown ([ledger](investigations.json)).

## Evidence

The mesh is simplified with meshoptimizer 1.2.0 to 796 faces, one connected component with Euler characteristic two. Measured from 3,200 equal-area samples of the full source, mean / 95th percentile / sampled maximum nearest-surface distances were 52.033 / 132.260 / 275.739 m. This is a one-direction sample, not an exhaustive Hausdorff bound.

The [shared SBMT oracle](../../../packages/bake/src/objects/layers/terrestrial/fixtures/sbmt/README.md) reads the full Gaskell ver128q mesh and NEAR MSI exposure M0146235607 directly. The native reference and cssEarth give identical sampled image values and matching visible intercepts; the maximum tested UV difference is 0.0817 pixel. This does not qualify the frame's physical registration.

The native-value check compares all seven samplers with independent reads of the original ISIS labels. At most 0.13% of valid native samples in any band lie outside the common display range.

Pond centres reproduce their printed latitude, longitude and distance within 0.009° and 1.1 m. Most ponds are too small to see at 10 m pixels, so no offset between catalogue and photographs is claimed.

## Known problems

Shadows on uses the package's diffuse display lighting. It does not reconstruct the mission's photometric model. Compare band brightness with Shadows off.

The supplied 1000 nm PDS4 XML repeats the 550 nm product's logical identifier. Its filename and the ISIS label's FilterNumber 6 / Center 1000 nm identify the selected band.

Named feature outlines are not published nomenclature boundaries. Anchors are cast onto the shape model rather than a reference sphere.

Fine triangle-edge artifacts remain visible in smooth areas. They are a rendering limitation, not source terrain.

Elevation is radial height above the 8420 m sphere, not height above a gravitational equipotential. Where the shape has undercuts, cells with more than one source surface on a ray are withheld with the gray grid. The detached ISIS label erroneously repeats 0° for MaximumLongitude; the GeoTIFF and PDS4 XML specify the actual 0–360° grid.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
