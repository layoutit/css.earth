# Betelgeuse circumstellar volumes

## Sources

This package draws the material around Betelgeuse as four prepared volumes, one dataset each, around the star's own sphere:

- `zimpol-v`: the polarised dust VLT/SPHERE-ZIMPOL measured on 3 December 2024.
- `emission-2020`: the 4 micrometre light outside the photosphere in the VLTI/MATISSE reconstruction of February 2020, the same image the sphere is painted from.
- `sio-2023`: silicon monoxide around the star in an ALMA line cube of August 2023, the one dataset placed in depth by its own measured velocities.
- `veil-2019-12`: the dust clump Montargès et al. (2021) fitted to the Great Dimming of December 2019, drawn from their published numbers.

## The 2024 polarised dust

The shell is the degree of linear polarisation measured by VLT/SPHERE-ZIMPOL in the V band on 3 December 2024, from the ESO Phase 3 collection `BETELGEUSE-B` (programme 114.28H9.001) that accompanies Montargès et al. (2026, [A&A 711, L12](https://doi.org/10.1051/0004-6361/202661023)). It uses the intensity image `SPHERE_ZIMPOL_Betelgeuse_P1_V_phase3.fits` and the polarisation map `SPHERE_ZIMPOL_Betelgeuse_P1_V_DOLP.fits`. The two are not pixel-aligned, so each is read about its own stellar centre. Registered against Fig. B.1 of the paper (in `source/previews/`), the centre lies 0.35 stellar radii from the paper's own marker.

The map has no third axis. Instead of extruding it, the package fits its radial profile against three simple envelopes and draws the best:

| envelope | residual against a profile of 1.41e-2 |
|---|---|
| spherical shell, radius 3.50 R★, gaussian thickness 1.20 R★ | 4.28e-3 |
| steady outflow, ρ ∝ r^−0.70 | 6.23e-3 |
| constant depth, what an extrusion assumes | 6.94e-3 |

Each sky column is spread along the shell, both in front of the star and behind it. The shell radius is inferred, not measured.

## The 4 micrometre light outside the disc

The VLTI/MATISSE reconstruction that paints Betelgeuse's sphere (see [Betelgeuse](../betelgeuse/README.md)) carries a fifth of its flux outside the published 42.45 mas disc. It is resolved emission, not the instrument. From 1.19 to 2.36 stellar radii the best-fitting envelope is a steep steady outflow, density as r^−7.95. Its colour is the reconstruction's own heat scale.

## The silicon monoxide around the star

ALMA project 2022.A.00026.S observed Betelgeuse in band 6 from 3 to 27 August 2023 ([archive](https://almascience.org/aq/?result_view=observation&projectCode=2022.A.00026.S)), in the SiO v=0 J=5–4 line at 217.105 GHz. `packages/bake/authoring/betelgeuse-shell/reduce-alma-sio.mts` cuts the archive cube and continuum image to the region around the star. The beam is 1.4 by 1.0 stellar radii.

The star lies 4.8 stellar radii from the archive's phase centre, and every SiO position is measured from the star in the continuum image. Outside the star the gas forms a lopsided ring, brightest 2.4 stellar radii out, weighted toward the east-south-east. The absorption in front of the star gives a wind speed of 21.3 km/s, and each channel is placed along the line of sight on a spherical outflow at that speed. The colour is viridis, marked false colour.

## The December 2019 clump

This dataset is not an image. It is the dust clump Montargès et al. (2021, [Nature 594, 365](https://doi.org/10.1038/s41586-021-03546-8), preprint [arXiv 2201.10551](https://arxiv.org/abs/2201.10551)) fitted to the SPHERE images of the Great Dimming: a sphere of radius 6.5 au, south and slightly west of the star and between it and us. The paper works at 222 pc and this scene at 168 pc, so the numbers are read as angles: the sphere is 1.38 stellar radii in radius. December 2019 is the only epoch shipped.

The clump dims the star behind it. The line of sight through its centre carries an optical depth of ln 10, from the paper's report that the southern hemisphere went ten times darker. Its scattered light is drawn at four percent of the photosphere's surface brightness, a display choice.

## Preparation

`packages/bake/authoring/betelgeuse-shell/author.mts` samples each dataset into a 96³ density grid in `source/`, which the nebula delivery bakes into slabs. This package ships no catalogue entry: its delivery names `attachedTo: "betelgeuse"`, and each of Betelgeuse's datasets shows at most one of these volumes. Only the 2019 clump draws in front of the star.

## Evidence

- Every number quoted here is measured by the script and recorded in `source/provenance.json#/measured`.
- East and west are checked on the rendered page: the light the SiO dataset adds lies at 147 degrees, where the ring's weight predicts 164 and a mirrored volume would put it at 280.
- At the default zoom most of the SiO ring lies outside the view.

## Known problems

- This package is a proof of concept that a body can sit inside a prepared volume.
- The 2024 shell and the 4 micrometre envelope are inferred from one projected profile each, and the 2019 clump is a published model. Nothing here measures how far along the line of sight any of this material lies.
- The 2024 map's masked disc leaves an empty cap toward Earth and another away from it: that is the mask made visible, not a structure.
- The polarisation colour is the paper's `inferno` colour map, a legend, not colour.
- The SiO outflow model places gas that is falling back as if it were leaving. A further 29 percent of the masked flux lies 8 to 14 stellar radii to the north, beyond the volume, and may be an artefact; it is not drawn.
- The 4 micrometre light starts 1.19 stellar radii out and is one reconstruction of one epoch.
- The clump is not clipped at the limb, and its extinction is grey.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Prepared outputs](inventory.json) · [Credits](source/provenance.json)
