# EPIC 210704526

## Sources

Its oscillations, recorded in K2 campaign 4, give 1.44 solar masses and 11.5 solar radii; APOGEE spectra give 5,038 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 44869321479792640, distance 2,551 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210704526 (K2 campaign 4): PARAM asteroseismic distance (pc) 2551.191406 (16th-84th percentiles 2465.957031-2590.234375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.451 ± 0.015 mas (29.6 standard errors), is not used. Radius 11.5101 +/- 0.5868 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210704526 (K2 campaign 4): PARAM radius (solar radii) 11.51007 (16th-84th percentiles 10.785976-11.959477), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.4425 +/- 0.1693 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210704526 (K2 campaign 4): PARAM mass (solar masses) 1.442526 (16th-84th percentiles 1.241085-1.579755), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,038 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210704526: APOGEE DR17 effective temperature 5037.9087 +/- 50 K (the catalogue's final uncertainty). log g 2.48 from the mass and radius.

**Colour.** A Planck spectrum at 5,038 K, because pARAM fits an extinction A_V = 0.86 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe7d1. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,038 K and log g 2.48 (u1 0.614, u2 0.158): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
