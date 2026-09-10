# Arrokoth

## Sources

[Porter (2024), NASA PDS](https://doi.org/10.26007/97r3-1e19) supplies the New
Horizons shape and fitted LORRI albedo model. Checked 2026-09-09. The 2019 flyby
constrains southern detail; the unseen northern surface is modeled. The opening view shows its fitted grayscale albedo on the southern, imaged
hemisphere. Shape model remains available as the unmapped grid. Both views use
the same released two-lobed shape.

## Evidence

2026-09-10: the default changes to Modeled albedo and faces the imaged southern
hemisphere. The [current view checks](evidence/spacecraft-default/validation.json)
bind the tested code and assets to the [opening view](evidence/spacecraft-default/default-dpr1.png).
All 35 runtime image hashes, the source UV attribution, and the 1,000-face
prepared terrain match the previous revision. No imagery upload is required.
The source and minimap tests pass, as does the tooling TypeScript check.
The broader density conformance run failed its empty-sky double-click check;
that failure is retained in the report. No full-site build or all-body suite
was run for this presentation change.

2026-09-09: corrected acquisition instructions and recovered provenance from
existing pins. Source and prepared output identities are unchanged; no new
preparation or browser run. The [original prepared record](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/src/planets/arrokoth/prepared/provenance.json) remains available.

The [three-body qualification](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/trans-neptunian/qualification.json)
and [production browser record](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/trans-neptunian/browser-validation.json)
retain their [original build identities](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/non-belt-populations/README.md#evidence-identity). All three routes passed at DPR 1 and 2;
those captures predate the combined population build.

The [PNG/FITS registration check](../../../tests/objects/fixtures/arrokoth/arrokoth-registration.json)
compares 24 decoded anchors. A [recorded albedo drag](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/trans-neptunian/drag-report.json)
retained all 111,002 scene nodes and made no interaction requests. It covered one
local headless workload, mostly facing uniform source fill; [inspected images](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/trans-neptunian/README.md#delivered-browser-evidence)
show mapped southern detail separately.

## Known problems

- The albedo release has no observation-coverage mask. Its broad uniform baseline
  is retained source fill, not evidence of measured global albedo.
- The paper and PDS XML disagree on pole and period metadata. The revised paper
  pole is used with an arbitrary meridian; no precision spin phase is claimed.
- Unseen northern shape is modeled. Shared-edge triangle ties limit exact texture
  correspondence; no local terrain accuracy is inferred.

[Inputs](source/manifest.json) · [Preparation](source/preparation/terrestrial.json) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods

<details>
<summary>Released shape, albedo registration and source disagreements</summary>

## Shape and orientation

New Horizons explored this cold-classical Kuiper-belt contact binary in 2019.
The released mesh has 20,484 vertices and 40,960 faces in two overlapping closed
lobes. Preparation simplifies the full source connectivity to 1,000 native raster
triangles; it does not construct a joining neck or use centre-ray reconstruction.
Southern detail is constrained by flyby imagery; the unseen side is a source model
estimate.

The revised pole comes from the bundled Porter paper Table 2. Its PDS XML gives
an inconsistent earlier pole. The paper pole is used with an arbitrary reference
meridian. Shadows and Orbit default off. Source recipes pin units and model axes;
geometry is prepared before runtime.

## Albedo

The opening view is a fitted scalar model, stretched to grayscale over 0.03–0.08.
The release's uniform baseline is retained unchanged. No confidence mask is
invented from that fill. The default framing faces southern detail; rotating to
the northern side exposes the archive's unconstrained fill. This is a
spacecraft-derived model, not an observed global photograph.
Surface spectra and unresolved observations are not reconstructed surface textures.

The original per-corner OBJ UV indices define two south-polar projections. Each
simplified surface point transfers to a closest original source triangle within
the 250 m limit. Bilinear sampling stays in that UV domain. Either incident
triangle may win a shared-boundary tie, so exact texel correspondence is not
claimed there. Flat latitude/longitude previews withhold directions with multiple
source intersections; 3D transfer uses local surface points.

The PDS PNG and raw FITS arrays have opposite row order. Twenty-four independent
PNG anchors reproduce FITS values within 3e-6 albedo using the label's approximate
integer conversion. Lower-left OBJ V indexes raw FITS rows directly. The
[registration record](../../../tests/objects/fixtures/arrokoth/arrokoth-registration.json)
binds those checks to exact source hashes.

## Source survey

The released albedo FITS supplies no explicit observational coverage mask and its
broad uniform baseline is not resolved imagery. The default view states that
limitation next to the active dataset. Porter fitted 30 approach images, weighted
by their original resolution; the two source UV islands preserve those fitted
values on their corresponding lobes. The decoded release spans
0.031881675–0.079999998, entirely inside the existing 0.03–0.08 display range.
The lower approximate value discussed in the paper is not substituted for the
actual release.

The [2023 geophysics archive](https://pdssbn.astro.umd.edu/holdings/nh-a-lorri_mvic-5-geophys-v1.0/data/albedo/)
also releases `CA06_STACK_NORMALREFLECTANCE`: nine LORRI images transformed into
the geometry of `lor_0408626332_0x636_sci`, with reference acquisition time
2019-01-01 05:26:54 UTC. Its [label](https://pdssbn.astro.umd.edu/holdings/nh-a-lorri_mvic-5-geophys-v1.0/data/albedo/ca06_stack_normal_reflect.lbl)
describes signed I/F samples and anomalously bright limb artifacts. It remains
unresolved for this display: Porter 2024 revises the pole and recenters the body,
so the old image needs a controlled registration to this exact mesh.
The companion hemispherical-albedo raster differs only by a multiplicative
factor and would not add independent terrain detail. The archive's thermal
products are simulations on an older mesh, not measured temperature images.
No new surface dataset is introduced by the default-view change.

The bundled paper and PDS XML disagree on the pole, and the XML calls a sub-day
period an orbital period. Buie et al. (2020) gives 15.9380 ±0.0005 h; the Porter
archive labels 0.6632553 days as an orbital period. The panel reports only about
15.9 hours. No precision spin rate is installed.

[Family source and preparation account](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/trans-neptunian/README.md).

</details>
