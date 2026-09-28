# Phobos

## Sources

- Monochrome uses [Stooke's DLR-controlled multi-mission mosaic](https://astrogeology.usgs.gov/search/map/phobos_viking_global_mosaic_5m), distributed as a 14400 × 7200 byte GeoTIFF.

- Elevation samples the newer Ernst/SBMT shape model, using radial height in kilometres above an authored 11.1 km reference sphere and a −3.5 to +3.5 km palette.

- Relative albedo preserves the archive scale without an absolute-albedo claim. Slope is gravity-relative under the source authors’ rotation, uniform-density and Mars-distance assumptions.

- Crater catalogue draws the rims of the 9,224 craters in the [PH9224GT catalogue](https://doi.org/10.1016/j.asr.2013.11.006) of Salamunićcar et al. (2014), from the [NASA Phobos Trek GIS layer](https://trek.nasa.gov/phobos/trekarcgis/rest/services/phobos/PH9224GT_Phobos2000/MapServer). Each crater is a centre and an angular radius; `packages/bake/src/objects/acquisition/geology-grid.py` marks every 0.125° cell (24 m) its rim circle crosses, plus the centre cell, in `source/craters/phobos-crater-rims.tif` (plan `source/craters/prepare-grid.json`, receipt beside it: 220,719 rim cells). Other cells show the Monochrome mosaic in grey at 35% brightness and 6 bits per channel.

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Evidence

The photographic atlas now samples each pinned original grid directly with a 2 × 2 texel footprint. It retains the source frame, coverage policy and fixed-epoch lighting. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) explains the sampling and encoding controls.

| View | Original grid | Both lighting images (surface + shadow) |
| --- | --- | --- |
| normal | 14400 × 7200 | 10.93 MB (7,680,016 + 3,252,062 bytes) |

Each atlas is 5010 × 5217 pixels, with 1600 retained faces. The scene bytes match the previous main version. WebP quality is 95. Sampling details and output hashes are recorded in the prepared surface metadata (`prepared/surfaces.json`). Source resolution, gaps and existing registration limitations still apply.

- Exact GeoTIFF origin, scale and missing value are checked by the recipe.

- **Crater catalogue registration.** The catalogue names 15 of its craters. Their centres lie 0.16–0.95 km from the IAU Gazetteer centres (Skyresh 3.25 km, where the Gazetteer itself is 3.1 km from the crater's dip in the shape). Measured against the dip each crater makes in the SPC shape (depth-weighted centre below a plane fitted to a ring at 1.4–2 radii), the catalogue centres are 0.06–0.64 km off: Stickney 0.63 km (radius 3.9 km), Hall 0.28 km (3.1 km), Roche 0.42 km (1.0 km). Over the Stooke mosaic the Stickney, Limtoc and Hall rims follow the photographed bowls. Catalogue and mesh both use planetocentric east longitude, so the rim grid lands on the mesh by direction, as the Monochrome map does.

- Four barycentric samples per retained face gave a maximum distance of 201.67 m for Phobos; these are sampled rendering errors, not source measurement uncertainty or an exhaustive bound.

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Phobos (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, and converts each positive-east centre into the body-fixed frame the radial terrain sampler uses for this mesh (longitude 0 toward the mesh +y axis, 90° E toward +x, north +z), then casts that direction through the prepared hit mesh so every anchor and outline point sits on the shape model rather than on a reference sphere. Craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The frame was confirmed on Mimas and Phobos, where Herschel and Stickney fall at local minima of the shape radius.

Feature notes: 3 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

- This is an illuminated observation mosaic, not recovered albedo. Stooke explicitly describes artistic adjustments where opposing lighting meets and an approximate registration to DLR control. We retain that limitation and do not claim that local crater shadows have been removed.

- **Crater catalogue:** the rims come from an automated detector with hand-checked candidates, so unmarked ground is not proof of no crater. The four largest entries, 8.6–17.9 km across, are wider than Stickney, carry no IAU name and are shown as published. Craters smaller than a 24 m cell show as one cell.

- This is radial height, not elevation above a geoid. This presentation is a low-resolution approximation of the released model, not the original scientific mesh.

- **Relative albedo and slope:** Complete atlas transfer qualification remains a separate preparation check. The authored support policy withholds any facet whose released Albedo field is non-finite in both new views; this is not a complete photographic coverage mask.

## Mars Express and Trek layers reviewed

We checked the Phobos layers that [NASA Phobos Trek](https://trek.nasa.gov/phobos/) offers from Mars Express work, and traced each to its producer, on 2026-09-27 and 2026-09-28. Only the crater catalogue became a lens. The [investigation ledger](investigations.json) keeps each decision and what would reopen it.

- **HRSC 100 m DEM** ([Willner et al. 2010](https://doi.org/10.1016/j.epsl.2009.07.033); USGS GeoTIFF and the 2016 PDS release MEX-MSA-HRSC-5-REFDR-PHOBOS-MAPS-V1.0). Its label calls the values “Height above Spheroid” on the 11.1 km sphere: the quantity Elevation already shows. Sampled in the app's frame, HRSC minus SPC height has mean −15 m and RMS 284 m (r = 0.975); the difference is a smooth two-hemisphere pattern of about ±0.5 km, not new terrain. The HRSC atlas's dynamic heights exist only as contours on map sheets.
- **MExLab SRC and Viking DEM** ([Karachevtseva et al. 2014](https://doi.org/10.1016/j.pss.2013.12.015)). Trek's copy is a 1° grid of height above the 11.08 km sphere (RMS 340 m against SPC). Same quantity, coarser.
- **Roughness, 1 km baseline** (both the MExLab and the HRSC versions). Trek credits them to JPL and states no formula or unit. The values are signed and follow the DEM minus its local mean (r = 0.93 for both), so they show local relief from an older DEM.
- **HRSC V/NIR spectral index.** The only public copy is a colour picture with seven legend classes and an unexplained white class. The producer's PDS release holds four regional colour image sets, not an index grid.
- **PH9224GT crater catalogue.** Added as the Crater catalogue lens (above). Trek's crater count and abundance maps are binnings of the same catalogue and were not added.

[Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="phobos-sources-and-preparation"></a>

## Selected views

Its 40 pixels/degree grid is about 4.84 m/pixel at the reference equator; effective image detail varies. North is up, longitude increases eastward and zero longitude is at the map center. The source reference sphere is 11.1 km.

The source's zero no-data value is resolved before interpolation. Genuine dark observations are retained.

Cartographic relief derives from the same measured model used for geometry; the app’s directional Shadows control remains separate.

## Shape and frame

The [Ernst et al. (2023) SPC shape](https://doi.org/10.1186/s40623-023-01814-7) is the 148 m version of the [SBMT March 2025 release](https://sbmt.jhuapl.edu/shared-files/), version 004. Its 98,306 XYZ vertices and 196,608 triangles are retained as a pinned OBJ archive. Coordinates are in kilometres in the source body-fixed frame. Preparation simplifies the original indexed mesh to a 1,600-face native triangle presentation; there is no radial remeshing, spherical substitute or invented terrain.

Physical size, orbit and IAU rotation use the vendored astronomy package at the shared scene epoch. Shape and cartographic products have different source histories; their registration must be inspected at Stickney and the opposite hemisphere. A display mesh cannot remove the source mosaic's residual control errors.

Inputs, original URLs, byte lengths and SHA-256 pins are recorded in `source/manifest.json`. The [Stooke map guide](https://sbnarchive.psi.edu/pds3/multi_mission/MULTI_SA_MULTI_6_STOOKEMAPS_V3_0/document/00_map_guide.html) (Stooke Small Bodies Maps V3.0, MULTI-SA-MULTI-6-STOOKEMAPS-V3.0) states that the maps are in the public domain but should not be used without proper credit; the SBMT label accompanies the mesh. Prepared surface, lighting, minimap and navigation imagery must be generated from this same interpretation. Shared controls, camera and shell remain generic.

## B2 facet science and terrain

Every one of the 196,608 source table rows is registered to its source triangle. Display colors use the nearest full-source triangle within the authored distance limit; they are not interpolated across facets. Original table row IDs are retained in the preparation atlas index.

The full source mesh now supplies a 1,600-face native triangle presentation. The authored transfer limit is 250 m.

The facet-science flat preview is explicitly 640 × 320, with nearest, lossless packing for its minimap and temporary projective textures. It makes 204,800 unique-ray queries per lens; ambiguous radial intersections remain missing. This is a display-preview resolution, not a new scientific grid. The complete 196,608-row source tables, native triangle atlas dimensions and original-row atlas indices are unchanged. Native material colors still query the full source surface directly and never sample this reduced flat preview.

</details>

## Catalogue attribution

The Stooke mosaic retains its collective Viking-orbiter capture credit. Its source record now marks the individual mission and vehicle identities as unresolved. The separate Viking mission and vehicle catalogue records do not establish which orbiter supplied this mosaic’s observations. See the [shared catalogue contract](../../../docs/architecture/exploration-catalog.md) and this body’s [source manifest](source/manifest.json). Dataset bytes and rendering are unchanged by this metadata migration.
