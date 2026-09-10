# Arrokoth

## Sources

[Porter (2024), NASA PDS](https://doi.org/10.26007/97r3-1e19) supplies the New
Horizons shape and fitted LORRI albedo model. Checked 2026-09-09. The 2019 flyby
constrains southern detail; the unseen northern surface is modeled. The default
grid and optional grayscale albedo view use the released two-lobed shape.

## Evidence

The [three-body qualification](../../../docs/trans-neptunian/qualification.json)
and [production browser record](../../../docs/trans-neptunian/browser-validation.json)
retain their [original build identities](../../../docs/non-belt-populations/README.md#evidence-identity). All three routes passed at DPR 1 and 2;
those captures predate the combined population build.

The [PNG/FITS registration check](../../../docs/trans-neptunian/arrokoth-registration.json)
compares 24 decoded anchors. A [recorded albedo drag](../../../docs/evidence/trans-neptunian/drag-report.json)
retained all 111,002 scene nodes and made no interaction requests. It covered one
local headless workload, mostly facing uniform source fill; [inspected images](../../../docs/trans-neptunian/README.md#delivered-browser-evidence)
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

The optional view is a fitted scalar model, stretched to grayscale over 0.03–0.08.
The release's uniform baseline is retained unchanged. No confidence mask is
invented from that fill, and the default remains the normal missing-data grid.
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
[registration record](../../../docs/trans-neptunian/arrokoth-registration.json)
binds those checks to exact source hashes.

## Source survey

The released albedo FITS supplies no explicit observational coverage mask and its
broad uniform baseline is not resolved imagery. The optional model view preserves
that limitation.

The bundled paper and PDS XML disagree on the pole, and the XML calls a sub-day
period an orbital period. Buie et al. (2020) gives 15.9380 ±0.0005 h; the Porter
archive labels 0.6632553 days as an orbital period. The panel reports only about
15.9 hours. No precision spin rate is installed.

[Family source and preparation account](../../../docs/trans-neptunian/README.md).

</details>
