# Eros

## Sources

| View or property | Source and interpretation |
| --- | --- |
| Visible and near-infrared albedo | [USGS/Golish 2023 deblurred MSI release](https://astrogeology.usgs.gov/search/map/near_msi_albedo_mosaics), 550 and 950 nm maps. Dimensionless I/F normalized to zero phase/incidence/emission, both displayed linearly over 0.05–0.40; not a quantitative mineral indicator. |
| Shape and Elevation | [Gaskell ver128q](https://sbnarchive.psi.edu/pds4/non_mission/gaskell.ast-eros.shape-model/data/vertex/ver128q.tab), 196,608 released facets. Elevation is radius minus 8.42 km, not gravitational height. |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/EROS/target) Eros centre-point export, snapshot 2026-09-11, public domain. IAU-adopted names with centre, diameter, extent and name origin; labels appear at the closest zoom only, and a selected feature stays labelled. |

## Evidence

### Native SBMT comparison, 14 September 2026

The [shared SBMT oracle](../../../tools/oracles/sbmt/README.md) reads this body's
full Gaskell ver128q mesh and the 537×244 NEAR MSI exposure M0146235607 directly.
Its [corrected SUM](source/observations/M0146235607.SUM) and
[SPICE INFO](source/observations/M0146235607F4_2P_CIF_DBL.INFO) are separate camera
cases. They give identical sampled image values and matching visible intercepts
between the native reference and cssEarth; the maximum tested UV difference is
0.0817 pixel, within the fixed quarter-pixel comparison limit. These results
cover the probes and software/input pins in the
[committed fixture](../../../tests/oracles/sbmt/projection.json).

The new observation records support preparation tests. The production surface
continues to use the controlled Golish maps listed above. The comparison does
not qualify this individual frame's physical registration or a new photographic
lens. SBMT's archive uses the public access pair published by its client
(`public` / `wide-open`); the acquisition plan records that public authorization
header and verifies each downloaded file's bytes.

The photographic atlas now samples each pinned original grid directly with a 2 × 2 texel footprint. It retains the source frame, coverage policy and fixed-epoch lighting. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) explains the sampling and encoding controls.

| View | Original grid | Both lighting images, before → current |
| --- | --- | --- |
| normal | 10682 × 5341 | 3.74 → 5.40 MB |
| infrared | 10682 × 5341 | 5.96 → 7.82 MB |

Each atlas remains 2048 × 6400 pixels, with 796 retained faces. The scene bytes match [the previous main version](https://github.com/layoutit/css.earth/tree/3efdf2c9ed9047c72409b2730e879123f8c3b9d2/src/planets/eros/prepared). WebP quality is 95; decoded texture size is unchanged. Sampling details and output hashes are recorded in the prepared surface metadata (`prepared/surfaces.json`). Source resolution, gaps and existing registration limitations still apply.

An independent check used trimesh 4.8.3 closest_point_naive to measure 3,200 equal-area radial samples from the full source against every simplified triangle. Mean / 95th percentile / sampled maximum nearest-surface distances were 52.033 / 132.260 / 275.739 m. This is a one-direction sample, not an exhaustive Hausdorff bound. Radial distance alone is misleading near undercuts because the nearest ray intersection can switch surfaces.

The earlier source notes report Headless Chrome 152 checks of the then-selected lenses with Shadows off and on at DPR 1 and 2, plus opposite/polar poses and close zoom.

[Source anchors](../../../tests/objects/unit/anchors/asteroid-calibration.json) checked by the shared [calibration runner](../../../tests/objects/unit/asteroid-calibration.test.mts).

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Eros (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table (this export ships no projection file, so the metadata datum is recorded and the authored radius scales outline sizes), drops the albedo-feature type code, folds repeated rows, and converts each positive-east centre into the body-fixed frame the radial terrain sampler uses for this mesh (longitude 0 toward the mesh +y axis, 90° E toward +x, north +z), then casts that direction through the prepared hit mesh so every anchor and outline point sits on the shape model rather than on a reference sphere. Craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The frame was confirmed on Mimas and Phobos, where Herschel and Stickney fall at local minima of the shape radius.

Landing sites: 1 spacecraft landing, touchdown or impact sites are labelled beside the IAU names (`source/features/sites.json`). Each coordinate quotes the NASA NSSDCA, PDS, LROC, agency or paper page it was read from, with the stated latitude kind and longitude convention; sites are unsized points ranked like a 20 km feature and the caption shows the quoted source sentence with its publisher.

Feature notes: 2 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

Fine triangle-edge artifacts remain visible in smooth areas, particularly Itokawa elevation. They persisted in a flat-color diagnostic and existing PolyCSS overlap variants; they are a rendering limitation, not source terrain.

The source minimum float code (−3.4028226550889045e38) remains missing before
interpolation. Valid faint pixels are not thresholded out. The detached ISIS
label erroneously repeats 0° for MaximumLongitude; the GeoTIFF and PDS4 XML
specify the actual 0–360° grid. The shared scalar reader validates the actual
GeoTIFF. The body remains the independently sized 8.42 km Gaskell mesh;
the 17 km projection radius only converts map coordinates.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<a id="eros-source-record"></a>
<a id="selected-data-and-survey"></a>
<a id="preparation-and-interpretation"></a>
<a id="near-infrared-albedo"></a>
<a id="reproduction"></a>
<a id="qualification-limits"></a>

<details>
<summary>Methods and source notes</summary>

**Preparation and interpretation**

The source shape uses kilometers, right-handed body-fixed axes and east longitude. The shared preparer converts positions to meters and scales them by the independently sourced 8.42 km radius. Original connectivity is welded at exact position duplicates and simplified by meshoptimizer 1.2.0 before texture and lighting baking. The target is 800 native PolyCSS u triangles with 128 px raster cells and a 300 m library error allowance. A regularized error estimate is not a guaranteed maximum surface deviation. The output has 796 faces; meshoptimizer reports 238.584 m estimated error. Exact coincident, oppositely wound pairs left by collapses are removed (4 faces), then every edge must have two opposite incidents. The result has one connected component and Euler characteristic two.

The shared frame is fixed at 2026-09-03 TT. Horizons osculating elements approximate TDB as TT; these conics are not long-term perturbation models. Rotation follows the pinned mission PCK. Shadows use prepared diffuse lighting in that body frame, not runtime physics. Elevation is radial height above the 8420 m sphere, not height above a gravitational equipotential. No geometry or image is synthesized at runtime.

**Reproduction**

Archive members are extracted unmodified from a separately pinned ZIP.

The 550 nm GeoTIFF is equirectangular with center longitude 180 degrees, 10 m pixels and a 17 km projection radius. The archived detached label contains an inconsistent sinusoidal pointer; preparation verifies the actual GeoTIFF georeferencing. The display stretch is 0.05–0.40.

Elevation atlas colors use the nearest point on the full source triangle surface in three dimensions, with a maximum source-to-display distance of 300 m. The radius, barycentric position and facet normal belong to that same source surface; the height subtracts the stated reference-sphere radius. The distance allowance is enforced per prepared atlas texel, independently of meshoptimizer’s estimated error. Equidistant distinct surfaces or projections beyond the bound are withheld with the shared gray grid. No orientation heuristic substitutes a farther source branch. Raster bleed clamps to its retained triangle edge before projection.

The flat longitude/latitude preview cannot represent more than one source surface on a center ray, so ambiguous sample cells and their interpolation footprints are withheld. The three-dimensional Elevation atlas is baked directly from source-surface correspondence and does not paint this preview onto the body. Cartographic relief uses the matched source facet normal in a local east/north/up frame; optional Sun lighting uses that same normal. Full source connectivity is retained before simplification. Photographic/albedo datasets keep their original mapping and are not recalibrated by this scalar correction.

`node --test tools/objects/terrestrial-layers/source-surface.test.mts` checks exact pinned-source facet regressions for Itokawa, Ryugu, Eros and Bennu. `python3 tools/objects/terrestrial-layers/verify-source-surface.py eros` (NumPy required) independently verifies the fixture against every triangle of the full original source using planar projection plus closest edges. These numerical checks establish scalar correspondence; they do not replace browser visual qualification.

**Qualification limits**

**Initial survey, before the 950 nm addition:** Included: the 2023 USGS/Golish deblurred, zero-phase 550 nm albedo mosaic and the matching Gaskell Eros shape family. The 128q shape has 196,608 released facets before simplification. The archive also supplies six other spectral filters and a sinusoidal projection; these are retained in the archive but excluded as redundant or requiring a separately justified spectral composite. Older NEAR MSI basemaps and NLR plate models were considered; the newer corrected mosaic and its registered shape take precedence.

- [Mapping release](https://astrogeology.usgs.gov/search/map/near_msi_albedo_mosaics)
- [Shape](https://sbnarchive.psi.edu/pds4/non_mission/gaskell.ast-eros.shape-model/data/vertex/ver128q.tab)
- [Mission facts](https://science.nasa.gov/solar-system/asteroids/433-eros/)
- Pole and spin: source/reference/eros_alex.tpc.txt

The [USGS 2023 deblurred MSI release](https://astrogeology.usgs.gov/search/map/near_msi_albedo_mosaics)
provides seven filters in two map projections. This addition uses the original
filter 4 **950 nm** equirectangular GeoTIFF, with its PDS4 and ISIS labels.
The 450, 760, 900, 1000 and 1050 nm maps remain outside this selection;
no custom ratio or color composite is synthesized. The 950 nm filter adds a
complementary near-infrared observation to the existing 550 nm albedo.

The two selected maps share 10,682 × 5,341 samples, 10 m pixels, a 17 km
cartographic radius and origin (−53,410, 26,710) m. The release registers them
to the Gaskell control network and normalizes to phase/incidence/emission zero
with a model for each filter. These are dimensionless I/F samples, displayed
with the same linear 0.05–0.40 range so a view switch does not add an independent
brightness normalization. This is not a quantitative mineral indicator.

</details>
