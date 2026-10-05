# Deimos

Deimos is drawn on the Ernst et al. SPC shape model with a monochrome mosaic, elevation, relative albedo and slope.

## Sources

- Monochrome uses [Stooke's Viking/MRO mosaic in the PDS Small Bodies Maps archive](https://sbn.psi.edu/pds/resource/stookemaps.html). [Stooke's map guide](https://sbnarchive.psi.edu/pds3/multi_mission/MULTI_SA_MULTI_6_STOOKEMAPS_V3_0/document/00_map_guide.html) identifies the added HiRISE observations ESP_012065_9000 and ESP_012068_9000 and revised control near 60°E, and states that the maps are in the public domain but should not be used without proper credit. The mosaic keeps separate capture credits for the Viking orbiters and the Mars Reconnaissance Orbiter; the Viking identities remain unresolved ([shared catalogue contract](../../../docs/architecture/exploration-catalog.md)).

- The shape is version 002 of the [Ernst et al. (2023) SPC model](https://doi.org/10.1186/s40623-023-01814-7) from the [SBMT March 2025 release](https://sbmt.jhuapl.edu/shared-files/), at 83 m spacing: 98,306 vertices and 196,608 triangles. Elevation samples its radius, referenced to a 6.2 km sphere and displayed over −2.5 to +2.5 km.

- Relative albedo preserves the archive scale without an absolute-albedo claim. Slope is gravity-relative under the source authors' rotation, uniform-density and Mars-distance assumptions.

- Named features come from the IAU/USGS Gazetteer of Planetary Nomenclature (public domain), pinned under `source/features/`. Feature notes for 2 names are the lead summary of their English Wikipedia article (CC BY-SA 4.0), recorded in `source/features/notes.json` and credited in the caption.

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

[Inputs](source/manifest.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Processing

The original mosaic is 7200 × 3600, north up and east-positive. Its 20 pixels/degree grid is approximately 5.4 m/pixel at a 6.2 km equator; much of the map has markedly poorer effective resolution. The photographic atlas samples the original grid directly ([shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation)).

Preparation simplifies the original mesh to a 1,600-face native triangle presentation. Every one of the 196,608 facet-science rows is registered to its source triangle, and display colors use the nearest source triangle within 100 m.

Gazetteer anchors are cast onto the prepared shape, not a reference sphere. Craters and faculae trace a rim circle, other types their published extent box.

## Evidence

Four barycentric samples per retained face gave a maximum distance of 69.40 m; these are sampled rendering errors, not source measurement uncertainty or an exhaustive bound.

## Known problems

- The map retains photographed shading, seam adjustments and polar interpolation from its author. It has no supplied validity mask; dark values and blurred areas are not treated as missing solely from their brightness or appearance. We do not claim uniform observed global coverage, remove shadows by arbitrary brightness scaling, or create new terrain.
- Only part of Deimos has detailed SPC support; the rest of the mesh is less constrained. The newer shape and older mosaic have separate control histories.
- This is radial height, not elevation above a geoid. Facets whose released Albedo attribute is NaN are withheld from the scientific datasets. This support rule does not claim a complete image-coverage mask.
- Feature outlines are not published nomenclature boundaries.
- Every display atlas is 2,509 × 2,611 pixels, 64 × 64 texels a face, which reduces display detail, not the source map. Until 5 October 2026 the layout was twice those dimensions, and picking a dataset froze an iPad's page for 5 to 13 seconds; it now takes 223 to 353 ms. The camera's turn toward a dataset's data still runs at 45 to 70 ms a frame over the 1,600 faces.
