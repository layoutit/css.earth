# EPIC 216786105

## Sources

Its oscillations, recorded in K2 campaign 7, give 1.02 solar masses and 10.1 solar radii; GALAH spectra give 4,665 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4084775792744278528, distance 3,373 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 216786105 (K2 campaign 7): PARAM asteroseismic distance (pc) 3373.007812 (16th-84th percentiles 3252.5-3492.578125), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.298 ± 0.018 mas (16.8 standard errors), is not used. Radius 10.1374 +/- 0.4534 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 216786105 (K2 campaign 7): PARAM radius (solar radii) 10.137431 (16th-84th percentiles 9.702392-10.609236), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0228 +/- 0.1083 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 216786105 (K2 campaign 7): PARAM mass (solar masses) 1.022799 (16th-84th percentiles 0.922358-1.139012), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,665 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 216786105: GALAH DR3 effective temperature 4665.3467 +/- 130 K (the catalogue's final uncertainty). log g 2.44 from the mass and radius.

**Colour.** A Planck spectrum at 4,665 K, because pARAM fits an extinction A_V = 0.63 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe1c3. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,665 K and log g 2.44 (u1 0.725, u2 0.076): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
