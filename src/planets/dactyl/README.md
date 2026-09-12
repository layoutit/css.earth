# Dactyl

Dactyl, discovered beside Ida in Galileo images, was the first moon found orbiting an asteroid.

## Representation

A smooth ellipsoid at the dimensions measured from Galileo images: 1.6 × 1.4 × 1.2 km. Craters and surface imagery are not represented; the grid marks missing imagery.

Approximate orbital placement. The 1993 encounter did not determine a unique orbit; the present orbital phase is illustrative. A synchronous orientation is assumed, not measured.

The shared missing-imagery grid covers the surface. The body uses the existing generic object adapter, one shared world camera and retained PolyCSS geometry. The selector detail is **Galileo**.

## Scientific sources

- [Veverka et al. (1996)](https://doi.org/10.1006/icar.1996.0045): Galileo dimensions, shape and surface observations.
- [Belton et al. (1996)](https://doi.org/10.1006/icar.1996.0044): Discovery and encounter orbit constraints.
- [Petit et al. (1997)](https://doi.org/10.1006/icar.1997.5788): Long-term orbit stability and candidate solutions.

[Measurements and source selection](source/measurements.json) · [Exact source pins](source/manifest.json) · [Reuse terms](NOTICE.md).

The dimensions describe a smooth envelope. Galileo’s resolved craters are evidence for a future surface view; they are not synthesized on this ellipsoid. The generic Celestia rock texture is excluded.

## Orbital placement

[Source parameters](source/orbit/published-parameters.json) separate published constraints from assumptions. The illustration places zero mean anomaly at JD 2461286.5 TT (3 September 2026), rather than extrapolating an uncertain encounter phase. A dashed orbit and circular selected marker distinguish this approximation. No uncertainty region, confidence interval or exact current phase is claimed. The fixed-epoch loader rejects other epochs.

## Evidence

The [browser conformance report](evidence/dactyl-conformance.json) passed desktop/mobile input, picking, wheel/pinch zoom, lighting, single-scene lifecycle and retained identity at DPR 1/2. Its [DPR 1 video](evidence/dactyl-dpr-1.webm) and [DPR 2 video](evidence/dactyl-dpr-2.webm) retain the input sequences. These were captured at `514f6b497`; body geometry, asset banks and input/lifecycle code remain unchanged in the final renderer at `66448c17d`. The production check below repeats the navigation and presentation affected by later changes.

![Dactyl with Shadows off](evidence/dactyl-shadows-false.png)

The [Shadows-on view](evidence/dactyl-shadows-true.png) was also inspected. These production captures use Chrome 152.0.7977.84, 1440 × 1000 at DPR 1, renderer commit `66448c17d` and browser-review commit `437ecb0b2`. Documentation-only moves preserve the original report and image bytes. They show the adopted shape with the missing-imagery grid; they do not establish photographic registration or mission-model parity.

![Dactyl’s approximate orbit around Ida](evidence/dactyl-approximate-orbit.png)

The [production navigation check](../dinkinesh/evidence/galileo-lucy/production-review.json) verifies visible **(approx)** labels, dashed paths, the standard **1 px** circle/orbit stroke, and selection of Ida with one mounted scene. Alternating existing retained segments carry the dashes; approximate circles omit the ordinary selected-body thickening. [Integrated checks and their limits](../dinkinesh/README.md#integrated-validation) cover the combined catalog.

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Dactyl (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and the metadata datum, drops the albedo-feature type code, folds repeated rows, and converts each positive-east centre into the body-fixed frame the radial terrain sampler uses for this mesh (longitude 0 toward the mesh +y axis, 90° E toward +x, north +z), then casts that direction through the prepared hit mesh so every anchor and outline point sits on the shape model rather than on a reference sphere. Craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries.

Named features run of 2026-09-12 (this version): the catalogue labels 2 IAU names on the hit mesh (nothing skipped); `tests/objects/unit/surface-features.test.mts` verifies the pinned bytes, the body-frame anchors and the hit-mesh radius band, and a headless Chrome probe (`output/probe-spheres.mts`, ignored scratch) mounted the page, selected every lens and pinned Acmon from the sidebar search with no console errors or failed requests.

The label-discovery update restores the current Gazetteer ZIP and records its
new byte pin. Its prepared names, coordinates, diameters, notes and mesh anchors
match the previous catalogue exactly. Both names become eligible while the
whole moon fits on screen; their projected size and facing still control display.

## Preparation

[Reproduction instructions](../../../tools/objects/source-authoring/galileo-lucy/README.md). The canonical prepared mesh contains 512 triangles, independent of device DPR. Sources, conversion and reduction happen before runtime.
