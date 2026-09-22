# Bennu

## Sources

| View or property | Source and interpretation |
| --- | --- |
| Albedo and Monochrome | [NASA SVS release](https://svs.gsfc.nasa.gov/5069): 6.25 cm zero-phase albedo on OLA v20 and separate 5 cm PolyCam basemap. They use different normalization/control and do not fill each other’s gaps. |
| Spectral composite | [USGS MapCam](https://astrogeology.usgs.gov/search/map/bennu-osiris-rex-ocams-photometric-mosaics-25cm), [DellaGiustina et al. 2020](https://figshare.com/articles/journal_contribution/Maps_DellaGiustina_et_al_Science_2020_abc3660/12996494). False color: red x/v (847/550 nm), green 698 nm band strength, blue b′/v (473/550 nm); no mineral abundance is inferred. |
| Shape and Elevation | [OLA v20 PTM](https://svs.gsfc.nasa.gov/vis/a000000/a005000/a005069/g_00880mm_alt_ptm_0000n00000_v020.obj); radius minus 241 m, not gravitational height. |

## Evidence

The photographic atlas now samples each pinned original grid directly with a 2 × 2 texel footprint. It retains the source frame, coverage policy and fixed-epoch lighting. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) explains the sampling and encoding controls.

| View | Original grid | Both lighting images, before → current |
| --- | --- | --- |
| normal | 25134 × 12568 | 7.26 → 9.06 MB |
| surface | 31417 × 15709 | 11.69 → 13.40 MB |

Each atlas remains 2048 × 6400 pixels, with 800 retained faces. The scene bytes match [the previous main version](https://github.com/layoutit/css.earth/tree/3efdf2c9ed9047c72409b2730e879123f8c3b9d2/src/planets/bennu/prepared). WebP quality is 95; decoded texture size is unchanged. Sampling details and output hashes are recorded in the prepared surface metadata (`prepared/surfaces.json`). Source resolution, gaps and existing registration limitations still apply.

An independent check used trimesh 4.8.3 closest_point_naive to measure 3,200 equal-area radial samples from the full source against every simplified triangle. Mean / 95th percentile / sampled maximum nearest-surface distances were 1.468 / 3.965 / 10.120 m. This is a one-direction sample, not an exhaustive Hausdorff bound. Radial distance alone is misleading near undercuts because the nearest ray intersection can switch surfaces.

The earlier source notes report Headless Chrome 152 checks of the then-selected lenses with Shadows off and on at DPR 1 and 2, plus opposite/polar poses and close zoom.

[Source anchors](../../../tests/objects/unit/anchors/asteroid-calibration.json) checked by the shared [calibration runner](../../../tests/objects/unit/asteroid-calibration.test.mts).

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Bennu (retrieved 2026-09-12, re-retrieved 2026-09-18, public domain as USGS-produced data; the export ships no FGDC record, so the pin cites the USGS Copyrights and Credits statement) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table (no projection file or metadata: the authored radius scales outline sizes), drops the albedo-feature type code, folds repeated rows, and converts each positive-east centre into the body-fixed frame the radial terrain sampler uses for this mesh (longitude 0 toward the mesh +y axis, 90° E toward +x, north +z), then casts that direction through the prepared hit mesh so every anchor and outline point sits on the shape model rather than on a reference sphere. Craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries.

Landing sites: 1 spacecraft landing, touchdown or impact sites are labelled beside the IAU names (`source/features/sites.json`). Each coordinate quotes the NASA NSSDCA, PDS, LROC, agency or paper page it was read from, with the stated latitude kind and longitude convention; sites are unsized points ranked like a 20 km feature and the caption shows the quoted source sentence with its publisher.

Named features run of 2026-09-18 (this version, re-pinned from the 2026-09-12 run): the refreshed catalogue labels 37 IAU names on the hit mesh (nothing skipped); `tests/objects/unit/surface-features.test.mts` verifies the pinned bytes, the body-frame anchors and the hit-mesh radius band against the 2026-09-18 export. The Gazetteer regenerates this export on its own schedule (USGS Astrogeology, observed weekly): the 2026-09-12 snapshot’s exact bytes were superseded upstream and were not recoverable from git history, this repository’s other checkouts or the R2 source mirror, so the manifest is re-pinned to the 2026-09-18 bytes; `source/manifest.json` and `source/features/manifest.json` record the acquisition. The 2026-09-12 run’s headless Chrome probe (`output/probe-spheres.mts`, ignored scratch), which mounted the page, selected every lens and pinned Roc Saxum from the sidebar search with no console errors or failed requests, has not been re-run against the 2026-09-18 export.

Fine triangle-edge artifacts remain visible in smooth areas, particularly Itokawa elevation. They persisted in a flat-color diagnostic and existing PolyCSS overlap variants; they are a rendering limitation, not source terrain.

The spectral composite covers approximately ±65°; its 250 m cartographic radius does not rescale the 241 m OLA shape. Spherical mapping cannot perfectly register individual boulders to the simplified silhouette.

The zero-phase albedo map covers about 55° S–55° N and leaves poles missing. The differently normalized PolyCam mosaic remains separate. The publisher’s 0.002–0.007 albedo stretch is retained.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<a id="bennu-source-record"></a>
<a id="selected-data-and-survey"></a>
<a id="spectral-composite"></a>
<a id="preparation-and-interpretation"></a>
<a id="reproduction"></a>
<a id="qualification-limits"></a>

<details>
<summary>Methods and source notes</summary>

**Spectral composite**

The release description calls the color product 8-bit, but its actual TIFF and
ISIS label specify four unsigned 16-bit bands. The mapped TIFF has grayscale
photometric tags and unspecified extra bands. An independent strip-byte audit
matches all four bands exactly to the original Figshare RGB TIFF, including its
associated alpha. The original embeds GIMP's sRGB profile. The recipe therefore
reads bands 0/1/2 as sRGB display codes and band 3 as alpha. Only full-alpha,
non-fill samples qualify; partial-alpha boundary pixels are withheld before
resampling. Fully opaque channels are divided by 257 for byte display, with no
new contrast curve. Individual zero channels remain valid; all-channel zero is
source fill. This interpretation is bound in the source audit, not inferred
from how an image looks.

The four individual MapCam albedo bands and scalar ratio FITS products remain
outside this selection: the released composite supplies the intended spectral
view without creating a new palette. Original color bytes and map metadata are
pinned; the legacy albedo and PolyCam views retain their own data and coverage.

**Preparation and interpretation**

The source shape uses kilometers, right-handed body-fixed axes and east longitude. The shared preparer converts positions to meters and scales them by the independently sourced 0.241 km radius. Original connectivity is welded at exact position duplicates and simplified by meshoptimizer 1.2.0 before texture and lighting baking. The target is 800 native PolyCSS u triangles with 128 px raster cells and a 10 m library error allowance. A regularized error estimate is not a guaranteed maximum surface deviation. The output has 800 faces; meshoptimizer reports 9.372 m estimated error. Exact coincident, oppositely wound pairs left by collapses are removed (0 faces), then every edge must have two opposite incidents. The result has one connected component and Euler characteristic two.

The shared frame is fixed at 2026-09-03 TT. Horizons osculating elements approximate TDB as TT; these conics are not long-term perturbation models. Rotation follows the pinned mission PCK. Shadows use prepared diffuse lighting in that body frame, not runtime physics. Elevation is radial height above the 241 m sphere, not height above a gravitational equipotential. No geometry or image is synthesized at runtime.

**Reproduction**

Elevation atlas colors use the nearest point on the full source triangle surface in three dimensions, with a maximum source-to-display distance of 10 m. The radius, barycentric position and facet normal belong to that same source surface; the height subtracts the stated reference-sphere radius. The distance allowance is enforced per prepared atlas texel, independently of meshoptimizer’s estimated error. Equidistant distinct surfaces or projections beyond the bound are withheld with the shared gray grid. No orientation heuristic substitutes a farther source branch. Raster bleed clamps to its retained triangle edge before projection.

The flat longitude/latitude preview cannot represent more than one source surface on a center ray, so ambiguous sample cells and their interpolation footprints are withheld. The three-dimensional Elevation atlas is baked directly from source-surface correspondence and does not paint this preview onto the body. Cartographic relief uses the matched source facet normal in a local east/north/up frame; optional Sun lighting uses that same normal. Full source connectivity is retained before simplification. Photographic/albedo datasets keep their original mapping and are not recalibrated by this scalar correction.

`node --test tools/objects/terrestrial-layers/source-surface.test.mjs` checks exact pinned-source facet regressions for Itokawa, Ryugu, Eros and Bennu. `python3 tools/objects/terrestrial-layers/verify-source-surface.py bennu` (NumPy required) independently verifies the fixture against every triangle of the full original source using planar projection plus closest edges. These numerical checks establish scalar correspondence; they do not replace browser visual qualification.

**Qualification limits**

Included: the 6.25 cm zero-phase albedo map on OLA v20, the separate 5 cm global PolyCam basemap, and OLA v20 PTM shape. The albedo poles are missing and remain marked; the photographic basemap is independently labeled. NASA SVS explicitly documents spherical mapping to this shape and the basemap/albedo distinction. Excluded: OLA v21 as the primary mesh, to keep the selected albedo’s v20 registration; centimeter-scale sample-site tiles are local products outside this global-body package. The v20 Poisson model contains small disconnected components; meshoptimizer’s documented Prune flag is used within the authored error allowance.

- [Mapping release](https://svs.gsfc.nasa.gov/5069)
- [Shape](https://svs.gsfc.nasa.gov/vis/a000000/a005000/a005069/g_00880mm_alt_ptm_0000n00000_v020.obj)
- [Mission facts](https://science.nasa.gov/mission/osiris-rex/)
- Pole and spin: source/reference/bennu_v17.tpc

The [USGS MapCam release](https://astrogeology.usgs.gov/search/map/bennu-osiris-rex-ocams-photometric-mosaics-25cm)
adds the published false-color composite from [DellaGiustina et al. (2020)](https://figshare.com/articles/journal_contribution/Maps_DellaGiustina_et_al_Science_2020_abc3660/12996494).
It is a separate lens. Red is x/v (847/550 nm), green is w-band strength near
698 nm, and blue is b′/v (473/550 nm), overlaid on v-band normal reflectance.
The authors filtered ratio maps with a 7 × 7 boxcar and removed shadows using
their v-band mask. Preparation does not recalculate ratios or infer minerals.

The exact map is 6,284 × 2,268 with a 250 m cartographic radius, 0.25 m pixels,
origin (−785.5, 283.5) m and east-positive, planetocentric longitude. Its cropped
rows cover approximately ±65° and must not be stretched to the poles. Projection
offsets are 3141.5 / 1133.5 in the shared PDS pixel convention. The map's control
and cartographic radius do not replace the independently sized 241 m OLA mesh.
Local boulder alignment to that simplified silhouette remains approximate.

The albedo view covers approximately 55 degrees south to 55 degrees north and marks missing poles. Its publisher stretch maps 0.002–0.007 albedo to codes 1–254. The monochrome basemap uses different phase normalization (Minnaert at 30 degrees) and source control (SPC v28), so it remains a separate view rather than filling the albedo gaps. Spherical mapping cannot register individual boulders perfectly to the simplified OLA silhouette.

</details>

## Catalogue attribution

The OSIRIS-REx inputs remain explicitly attributed to the OSIRIS-REx mission and spacecraft. The vehicle’s later OSIRIS-APEX mission is represented separately in the catalogue; its participation does not give APEX credit for the Bennu observations. See the [shared catalogue contract](../../../docs/architecture/exploration-catalog.md) and this body’s [source manifest](source/manifest.json). Dataset bytes and rendering are unchanged by this metadata migration.
