# EPIC 249224398

## Sources

Its oscillations, recorded in K2 campaign 15, give 1.55 solar masses and 14.7 solar radii; GALAH spectra give 4,933 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6237907013476846848, distance 5,727 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249224398 (K2 campaign 15): PARAM asteroseismic distance (pc) 5727.1875 (16th-84th percentiles 5484.53125-5978.984375), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.122 ± 0.020 mas (6.2 standard errors), is not used. Radius 14.7174 +/- 0.8877 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249224398 (K2 campaign 15): PARAM radius (solar radii) 14.717367 (16th-84th percentiles 13.879461-15.65493), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.55 +/- 0.2157 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249224398 (K2 campaign 15): PARAM mass (solar masses) 1.550027 (16th-84th percentiles 1.353947-1.785426), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,933 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249224398: GALAH DR3 effective temperature 4933.4375 +/- 181 K (the catalogue's final uncertainty). log g 2.29 from the mass and radius.

**Colour.** A Planck spectrum at 4,933 K, because pARAM fits an extinction A_V = 0.62 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe5cd. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,933 K and log g 2.29 (u1 0.642, u2 0.138): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
