# EPIC 215138812

## Sources

Its oscillations, recorded in K2 campaign 7, give 0.96 solar masses and 10.9 solar radii; GALAH spectra give 4,981 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4074985088385040384, distance 4,728 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 215138812 (K2 campaign 7): PARAM asteroseismic distance (pc) 4727.578125 (16th-84th percentiles 4599.6875-4853.320312), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.147 ± 0.020 mas (7.2 standard errors), is not used. Radius 10.8886 +/- 0.4295 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 215138812 (K2 campaign 7): PARAM radius (solar radii) 10.888648 (16th-84th percentiles 10.474177-11.333212), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.959 +/- 0.0873 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 215138812 (K2 campaign 7): PARAM mass (solar masses) 0.958951 (16th-84th percentiles 0.879403-1.054011), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,981 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 215138812: GALAH DR3 effective temperature 4981.2373 +/- 198 K (the catalogue's final uncertainty). log g 2.35 from the mass and radius.

**Colour.** A Planck spectrum at 4,981 K, because pARAM fits an extinction A_V = 0.69 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe6cf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,981 K and log g 2.35 (u1 0.628, u2 0.148): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
