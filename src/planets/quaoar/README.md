# Quaoar

## Sources

[Margoti et al. (2026), accepted ApJ](https://arxiv.org/abs/2607.06450) fits a
three-dimensional oblate body to 36 stellar-occultation campaigns, using the ring
plane as a pole constraint. [Pereira et al. (2023)](https://doi.org/10.1051/0004-6361/202346365)
supplies the two ring radii. Checked 2026-09-09. The body uses a missing-data grid;
both rings are schematic.

## Evidence

The [three-body qualification](../../../docs/trans-neptunian/qualification.json)
and [production browser record](../../../docs/trans-neptunian/browser-validation.json)
retain their [original build identities](../../../docs/non-belt-populations/README.md#evidence-identity). All three routes passed at DPR 1 and 2;
those captures predate the combined population build.

The recorded scene has 480 body triangles and 20 retained ring tiles.
[Ring-image check](../../../docs/trans-neptunian/ring-image-check.json) · [Inspected views](../../../docs/trans-neptunian/README.md#delivered-browser-evidence).

## Known problems

- Oblate versus triaxial shape remains unresolved. The pole assumes alignment with
  the rings; 8.8394 h versus 17.6788 h spin interpretations remain model-dependent.
- Ring widths are drawn as uniform circular bands. The dense arc is not
  reconstructed, and gray color and opacity are not measured reflectance or optical depth.
- Surface detail is unresolved. No sidereal spin or precise rotational phase is installed.

[Inputs](source/manifest.json) · [Preparation](source/preparation/terrestrial.json) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods

<details>
<summary>Occultation shape, schematic rings and alternative interpretations</summary>

## Shape and orientation

This large Kuiper-belt object has two known rings. The adopted oblate fit has
equatorial semiaxes 566.1 km and polar semiaxis 511.2 km. Pole RA 259.7°, DEC 53.4°
inherits the measured ring-plane prior; the meridian is arbitrary. A competing
triaxial interpretation remains possible. The 8.8394 h and 17.6788 h period
interpretations are model-dependent, so neither is installed as a sidereal spin.

The source recipe pins units, assumptions and numerical axes. The scene uses 480
prepared native raster triangles. Shadows and Orbit default off; the grid marks
unmapped terrain.

## Rings

The adopted Q1R and Q2R radii are 4057.2 km and 2520 km. Q1R uses the 76.4 km width
of the tenuous component measured at one Gemini chord as a circular schematic.
Its actual width varies with azimuth; the dense arc is not reconstructed. Q2R uses
the published typical 10 km width. Uniform gray and display opacity are
illustrative. Both bands use the shared terrestrial ring preparation capability.

## Source survey

The 572.5 MB supplementary archive contains lightcurves and model profiles, not a
resolved surface texture. It was not downloaded for the published numeric fit.
Surface spectra and unresolved observations are not reconstructed surface textures.
The oblate/triaxial and spin-period alternatives remain open.

[Family source and preparation account](../../../docs/trans-neptunian/README.md).

</details>
