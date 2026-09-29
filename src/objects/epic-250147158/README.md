# EPIC 250147158

## Sources

Its oscillations, recorded in K2 campaign 15, give 1.03 solar masses and 11.1 solar radii; GALAH spectra give 5,117 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6263907233662036480, distance 2,823 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 250147158 (K2 campaign 15): PARAM asteroseismic distance (pc) 2822.8125 (16th-84th percentiles 2711.289062-2930.078125), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.328 ± 0.017 mas (19.5 standard errors), is not used. Radius 11.137 +/- 0.463 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 250147158 (K2 campaign 15): PARAM radius (solar radii) 11.137024 (16th-84th percentiles 10.693579-11.619666), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0296 +/- 0.0999 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 250147158 (K2 campaign 15): PARAM mass (solar masses) 1.029612 (16th-84th percentiles 0.939927-1.139643), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,117 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 250147158: GALAH DR3 effective temperature 5117.3433 +/- 108 K (the catalogue's final uncertainty). log g 2.36 from the mass and radius.

**Colour.** A Planck spectrum at 5,117 K, because pARAM fits an extinction A_V = 0.36 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe8d4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,117 K and log g 2.36 (u1 0.592, u2 0.172): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
