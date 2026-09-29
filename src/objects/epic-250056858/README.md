# EPIC 250056858

## Sources

Its oscillations, recorded in K2 campaign 15, give 1.02 solar masses and 7.1 solar radii; GALAH spectra give 4,532 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6262231577940245376, distance 1,048 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 250056858 (K2 campaign 15): PARAM asteroseismic distance (pc) 1047.783203 (16th-84th percentiles 1013.916016-1081.318359), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.944 ± 0.015 mas (61.9 standard errors), is not used. Radius 7.1154 +/- 0.2671 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 250056858 (K2 campaign 15): PARAM radius (solar radii) 7.115434 (16th-84th percentiles 6.855696-7.38995), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0229 +/- 0.0946 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 250056858 (K2 campaign 15): PARAM mass (solar masses) 1.022896 (16th-84th percentiles 0.93265-1.121886), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,532 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 250056858: GALAH DR3 effective temperature 4532.1797 +/- 83 K (the catalogue's final uncertainty). log g 2.74 from the mass and radius.

**Colour.** A Planck spectrum at 4,532 K, because pARAM fits an extinction A_V = 0.49 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffdebd. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,532 K and log g 2.74 (u1 0.773, u2 0.036): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
