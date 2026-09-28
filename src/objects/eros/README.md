# Eros

## Sources

| View or property | Source and interpretation |
| --- | --- |
| Visible and near-infrared albedo | [USGS/Golish 2023 deblurred MSI release](https://astrogeology.usgs.gov/search/map/near_msi_albedo_mosaics), all seven filters: 450, 550, 760, 900, 950, 1000 and 1050 nm. Dimensionless I/F normalized to zero phase/incidence/emission, both displayed linearly over 0.05–0.40; not a quantitative mineral indicator. |
| Shape and Elevation | [Gaskell ver128q](https://sbnarchive.psi.edu/pds4/non_mission/gaskell.ast-eros.shape-model/data/vertex/ver128q.tab), 196,608 released facets. Elevation is radius minus 8.42 km, not gravitational height. |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/EROS/target) Eros centre-point export, snapshot 2026-09-11, public domain. IAU-adopted names with centre, diameter, extent and name origin; labels appear at the closest zoom only, and a selected feature stays labelled. |
| Ponds | [Roberts Eros Ponds Catalog V1.1](https://doi.org/10.26033/4dqc-8067), PDS Small Bodies Node, 2021: 334 ponds found by P. C. Thomas in NEAR MSI images, relocated on the Gaskell shape with SBMT. Each has a body-fixed centre and one characteristic diameter; 326 are drawn. |
| Composition facts | NEAR X-ray spectrometer ratios from [Lim and Nittler (2009)](https://doi.org/10.1016/j.icarus.2008.09.018); landing-site gamma-ray values from [Peplowski et al. (2015)](https://doi.org/10.1111/maps.12434) and [Evans et al. (2001)](https://doi.org/10.1111/j.1945-5100.2001.tb01854.x). Factsheet values, not maps. |

## Reflected light

One wavelength group contains all seven NEAR MSI maps, ordered from 450 to 1050 nm. The arrows select blue, green and five near-infrared bands. Darker areas reflect less light in the selected band. The existing 550 nm view remains the default, and the previous `normal` and `infrared` links still select 550 and 950 nm.

Every band uses the same linear 0.05–0.40 I/F display range. The publisher corrected the data to zero incidence, emission and phase, and applied the 2023 deblurring method. Source gaps remain gray. A few source values lie well beyond the display range; they clip to black or white without being reclassified as missing. Residual shading and original mapping uncertainty remain.

## Ponds

Ponds are smooth, flat deposits of fine material in the floors of small hollows, found mostly near the equator at both ends of the long axis, as the catalogue's [bundle description](https://sbnarchive.psi.edu/pds4/non_mission/ast-eros.roberts.ponds-catalog_V1_1/document/bundle_description.txt) summarises; [Roberts et al. (2014)](https://doi.org/10.1111/maps.12348) discuss their origin and flatness. The Ponds view draws the [Roberts Eros Ponds Catalog V1.1](https://doi.org/10.26033/4dqc-8067) in cyan, the colour the catalogue's own SBMT table uses, over the 550 nm photograph in grey at 35% brightness and 6 bits per channel, as the Mars and Phobos catalogue views do. The dimming is a presentation choice. The cyan differs by at least 47 OKLab units from every dimmed photograph value (median 69.6; every fourth native sample of the 550 nm map, 14.25 million values).

- Each pond is drawn at its published diameter (7.4 to 213.6 m, median 49.9 m): every point of the shape within half the diameter of the pond centre, measured in a straight line. Ponds are rarely round and some catalogue rows are parts of one long deposit, so the circle shows size, not outline.
- Grey ground is not proof that no pond is there. Thomas found the ponds in images of uneven resolution, and the count follows image resolution, especially below 30 m ([Roberts et al. 2014, Icarus](https://doi.org/10.1016/j.icarus.2014.07.004), as the bundle description reports).
- 8 of the 334 centres (ponds 1, 2, 10, 129, 216, 218, 219 and 255) lie 66 to 384 m from the Gaskell ver128q surface and are left out. The other 326 lie within 27.4 m of it (median 2.3 m).
- The smallest ponds, a few metres across, can be smaller than one map pixel.
- On the body, a map pixel that falls in no circle shows the photograph exactly as the 550 nm view samples it (the same pixel footprint on the original map), then dimmed. The flat minimap uses the 550 nm view's flat map the same way.

## Composition

NEAR measured elements with an X-ray and a gamma-ray spectrometer. The archive holds only their spectra, not abundance maps, and the published results cannot make a map: the X-ray values average eight solar flares over large parts of the surface, and the useful gamma-ray data were taken after landing, at one spot. They appear as factsheet facts with their sources.

| Quantity | Value | Where | Source |
| --- | --- | --- | --- |
| Mg/Si | 0.753 (+0.078/−0.055) | Eight-flare average, top tens to hundreds of micrometres | Lim and Nittler (2009), Table 9, uncorrected |
| Fe/Si | 1.678 (+0.338/−0.320) | Same | Same |
| S/Si | 0.005 ± 0.008; H, L and LL chondrites 0.111–0.114 | Same | Same |
| Fe/Si by mass | 1.19 ± 0.30 (2 SD) | Landing site, tens of centimetres deep | Peplowski et al. (2015), Table 2, BGO |
| Hydrogen | 1,100 ppm (400–2,700 ppm, 2 SD) | Landing site | Peplowski et al. (2015) |
| Potassium | 0.07% (±40%) | Landing site | Evans et al. (2001), Table 1 |

Lim and Nittler (2009) recalibrated the X-ray data of [Nittler et al. (2001)](https://doi.org/10.1111/j.1945-5100.2001.tb01856.x) and found their results consistent within the uncertainties; their mineral-mixing-corrected column is not used. The extracts, table locations and uncertainty meanings are in [the factsheet review](source/editorial/factsheet-review.json). Peplowski (2016) reports global Fe, Th and K from the orbital gamma-ray data; its full text could not be read, so those values are not shown ([ledger](investigations.json)).

## Evidence

### Native SBMT comparison, 14 September 2026

The [shared SBMT oracle](../../../tests/oracles/sbmt/README.md) reads this body's
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

The photographic atlas samples each original grid directly with a 2 × 2 texel footprint. It retains the source frame, coverage policy and fixed-epoch lighting. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) explains the sampling and encoding controls.

| Existing view | Original grid |
| --- | --- |
| normal | 10682 × 5341 |
| infrared | 10682 × 5341 |

Current atlases are 3503 × 3720 pixels, with 796 retained faces. The [delivery record](evidence/spectral-bands/delivery-and-browser.json) records each encoded file size and decoded RGBA estimate. Existing mesh leaves and full-size surface atlases match the main revision named there. Sampling details are in `prepared/surfaces.json`; source resolution, gaps and registration limits still apply.

An independent check used trimesh 4.8.3 closest_point_naive to measure 3,200 equal-area radial samples from the full source against every simplified triangle. Mean / 95th percentile / sampled maximum nearest-surface distances were 52.033 / 132.260 / 275.739 m. This is a one-direction sample, not an exhaustive Hausdorff bound. Radial distance alone is misleading near undercuts because the nearest ray intersection can switch surfaces.

The earlier source notes report Headless Chrome 152 checks of the then-selected lenses with Shadows off and on at DPR 1 and 2, plus opposite/polar poses and close zoom.

[Source anchors](../../../tests/objects/unit/anchors/asteroid-calibration.json) checked by the shared [calibration runner](../../../tests/objects/unit/asteroid-calibration.test.mts).

The [native-value check](evidence/spectral-bands/native-values.json) compares all seven production samplers with independent float32 byte reads and coordinates from the original ISIS labels, including fractional footprints, source extrema and gaps. It verifies decoding and display transfer; it does not revalidate the mission’s calibration or physical registration.

The native check passed 1,701 source probes. At most 0.13% of valid native samples in any band lie outside the common display range. The [restoration check](evidence/spectral-bands/source-restoration.json) extracted every added input and label through the production acquisition recipe into an empty directory and matched the preparation inputs byte for byte; it reused the cached publisher ZIP.

The [delivery and browser record](evidence/spectral-bands/delivery-and-browser.json) identifies the tested inventories and the 27 September 2026 run. All seven wavelength controls, keyboard stepping and mobile layout passed in Headless Chrome; each switch kept one mounted scene. Eros’s existing default and infrared links were also checked. Every body asset installed from R2 into an empty destination with matching size and hash. The body install is 37.80 MB; this is not measured cold page transfer. Existing full-size atlases and mesh leaves are unchanged.

Inspected evidence: [native map](evidence/spectral-bands/blue-native-map.webp), [overview](evidence/spectral-bands/overview.webp), [lighting](evidence/spectral-bands/lighting.webp), [close view](evidence/spectral-bands/close.webp), [phone controls](evidence/spectral-bands/phone.webp). The flat native map and rendered body are different projections, so no pixel-parity claim is made.

### Ponds registration, 28 September 2026

The [registration record](evidence/ponds/registration.json) names the input bytes and results. The table's label, record count and field units match the recipe; every row's centre reproduces its printed latitude, longitude and distance within 0.009° and 1.1 m. Centres were projected to the full ver128q mesh with a 60 m limit chosen before measuring (a little under half the 131.9 m median facet edge). In the app on 28 September 2026 (headless Chromium, this bake), the Ponds view showed the cyan ponds over the dimmed photograph on the body and in the minimap. Compared with the 550 nm map, most ponds are too small to see at 10 m pixels, so no offset between catalogue and photographs is claimed.

## Known problems

Shadows on uses the package’s existing diffuse display lighting. It does not reconstruct the mission’s photometric model. Compare band brightness with Shadows off.

The supplied 1000 nm PDS4 XML repeats the 550 nm product’s logical identifier. Its filename and the ISIS label’s FilterNumber 6 / Center 1000 nm identify the selected band. We preserve the original labels and identify this source by its archive member, rather than adopt the conflicting identifier.

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

`node --test tests/objects/terrestrial/source-surface.test.mts` checks exact pinned-source facet regressions for Itokawa, Ryugu, Eros and Bennu. `python3 tests/objects/terrestrial/verify-source-surface.py eros` (NumPy required) independently verifies the fixture against every triangle of the full original source using planar projection plus closest edges. These numerical checks establish scalar correspondence; they do not replace browser visual qualification.

**Qualification limits**

The initial survey selected 550 nm, and a later addition selected 950 nm. This update includes the five remaining filters as comparable monochrome views. All seven use the archive’s Simple Cylindrical GeoTIFFs and the existing Gaskell Eros shape. The alternative sinusoidal products remain unused. The 128q shape has 196,608 released facets before simplification. Older basemaps and NLR plate models remain outside this selection.

- [Mapping release](https://astrogeology.usgs.gov/search/map/near_msi_albedo_mosaics)
- [Shape](https://sbnarchive.psi.edu/pds4/non_mission/gaskell.ast-eros.shape-model/data/vertex/ver128q.tab)
- [Mission facts](https://science.nasa.gov/solar-system/asteroids/433-eros/)
- Pole and spin: source/reference/eros_alex.tpc.txt

The [USGS 2023 deblurred MSI release](https://astrogeology.usgs.gov/search/map/near_msi_albedo_mosaics)
provides seven filters in two map projections. All seven original equirectangular
GeoTIFFs are selected, with their PDS4 and ISIS labels. No custom ratio or
color composite is synthesized.

The seven selected maps share 10,682 × 5,341 samples, 10 m pixels, a 17 km
cartographic radius and origin (−53,410, 26,710) m. The release registers them
to the Gaskell control network and normalizes to phase/incidence/emission zero
with a model for each filter. These are dimensionless I/F samples, displayed
with the same linear 0.05–0.40 range so a view switch does not add an independent
brightness normalization. This is not a quantitative mineral indicator.

</details>
