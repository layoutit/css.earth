# EPIC 211976234

## Sources

Its oscillations, recorded in K2 campaign 5, give 1.13 solar masses and 10.2 solar radii; GALAH spectra give 4,656 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 675611279219361920, distance 3,038 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211976234 (K2 campaign 5): PARAM asteroseismic distance (pc) 3038.4375 (16th-84th percentiles 2931.328125-3174.375), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.305 ± 0.021 mas (14.6 standard errors), is not used. Radius 10.2224 +/- 0.5004 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211976234 (K2 campaign 5): PARAM radius (solar radii) 10.222366 (16th-84th percentiles 9.747608-10.748418), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.1321 +/- 0.1323 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211976234 (K2 campaign 5): PARAM mass (solar masses) 1.132075 (16th-84th percentiles 1.010515-1.27516), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,656 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211976234: GALAH DR3 effective temperature 4656.0205 +/- 128 K (the catalogue's final uncertainty). log g 2.47 from the mass and radius.

**Colour.** A Planck spectrum at 4,656 K, because pARAM fits an extinction A_V = 0.07 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe0c2. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,656 K and log g 2.47 (u1 0.729, u2 0.073): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
