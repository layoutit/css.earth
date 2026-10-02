# Phobos

Phobos is drawn on the Ernst et al. SPC shape model with a monochrome mosaic, elevation, relative albedo, slope and a crater catalogue.

## Sources

- Monochrome uses [Stooke's DLR-controlled multi-mission mosaic](https://astrogeology.usgs.gov/search/map/phobos_viking_global_mosaic_5m), distributed as a 14400 × 7200 byte GeoTIFF. The [Stooke map guide](https://sbnarchive.psi.edu/pds3/multi_mission/MULTI_SA_MULTI_6_STOOKEMAPS_V3_0/document/00_map_guide.html) (Stooke Small Bodies Maps V3.0, MULTI-SA-MULTI-6-STOOKEMAPS-V3.0) states that the maps are in the public domain but should not be used without proper credit. The mosaic keeps its collective Viking-orbiter capture credit; which orbiter supplied its observations is unresolved ([shared catalogue contract](../../../docs/architecture/exploration-catalog.md)).

- The shape is the 148 m version of the [Ernst et al. (2023) SPC shape](https://doi.org/10.1186/s40623-023-01814-7) from the [SBMT March 2025 release](https://sbmt.jhuapl.edu/shared-files/), version 004: 98,306 vertices and 196,608 triangles. Elevation samples it as radial height in kilometres above an authored 11.1 km reference sphere, with a −3.5 to +3.5 km palette.

- Relative albedo preserves the archive scale without an absolute-albedo claim. Slope is gravity-relative under the source authors' rotation, uniform-density and Mars-distance assumptions.

- Crater catalogue draws the rims of the 9,224 craters in the [PH9224GT catalogue](https://doi.org/10.1016/j.asr.2013.11.006) of Salamunićcar et al. (2014), from the [NASA Phobos Trek GIS layer](https://trek.nasa.gov/phobos/trekarcgis/rest/services/phobos/PH9224GT_Phobos2000/MapServer).

- Named features come from the IAU/USGS Gazetteer of Planetary Nomenclature (public domain), pinned under `source/features/`. Feature notes for 3 names are the lead summary of their English Wikipedia article (CC BY-SA 4.0), recorded in `source/features/notes.json` and credited in the caption.

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

[Inputs](source/manifest.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Processing

Preparation simplifies the original mesh to a 1,600-face native triangle presentation; there is no radial remeshing, spherical substitute or invented terrain. The photographic atlas samples the original grid directly ([shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation)). Every one of the 196,608 facet-science rows is registered to its source triangle, and display colors use the nearest source triangle within 250 m.

For the crater catalogue, `packages/bake/src/objects/acquisition/geology-grid.py` marks every 0.125° cell (24 m) each rim circle crosses, plus the centre cell, in `source/craters/phobos-crater-rims.tif` (220,719 rim cells). Other cells show the Monochrome mosaic in gray at 35% brightness.

Gazetteer anchors are cast onto the prepared shape, not a reference sphere. Craters and faculae trace a rim circle, other types their published extent box.

## Evidence

- The catalogue names 15 of its craters. Their centres lie 0.16–0.95 km from the IAU Gazetteer centres, and 0.06–0.64 km from the dip each crater makes in the SPC shape: Stickney 0.63 km (radius 3.9 km), Hall 0.28 km (3.1 km), Roche 0.42 km (1.0 km). Over the Stooke mosaic the Stickney, Limtoc and Hall rims follow the photographed bowls.
- The feature frame was confirmed where Stickney falls at a local minimum of the shape radius.
- Four barycentric samples per retained face gave a maximum distance of 201.67 m; these are sampled rendering errors, not source measurement uncertainty or an exhaustive bound.

## Mars Express and Trek layers reviewed

We checked the Phobos layers that [NASA Phobos Trek](https://trek.nasa.gov/phobos/) offers from Mars Express work. Only the crater catalogue became a dataset.

- **HRSC 100 m DEM** ([Willner et al. 2010](https://doi.org/10.1016/j.epsl.2009.07.033)) shows the same quantity as Elevation. HRSC minus SPC height has mean −15 m and RMS 284 m (r = 0.975).
- **MExLab SRC and Viking DEM** ([Karachevtseva et al. 2014](https://doi.org/10.1016/j.pss.2013.12.015)) is the same quantity, coarser.
- **Roughness, 1 km baseline** states no formula or unit and follows local relief from an older DEM.
- **HRSC V/NIR spectral index** exists publicly only as a color picture, not an index grid.

## Known problems

- This is an illuminated observation mosaic, not recovered albedo. Stooke explicitly describes artistic adjustments where opposing lighting meets and an approximate registration to DLR control. We retain that limitation and do not claim that local crater shadows have been removed.
- The crater rims come from an automated detector with hand-checked candidates, so unmarked ground is not proof of no crater. The four largest entries, 8.6–17.9 km across, are wider than Stickney, carry no IAU name and are shown as published. Craters smaller than a 24 m cell show as one cell.
- This is radial height, not elevation above a geoid. This presentation is a low-resolution approximation of the released model, not the original scientific mesh.
- Shape and cartographic products have different source histories. A display mesh cannot remove the source mosaic's residual control errors.
- Relative albedo and slope withhold any facet whose released Albedo field is non-finite; this is not a complete photographic coverage mask.
- Feature outlines are not published nomenclature boundaries.
