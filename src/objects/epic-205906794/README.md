# EPIC 205906794

## Sources

Its oscillations, recorded in K2 campaign 3, give 0.86 solar masses and 16.0 solar radii; APOGEE spectra give 4,431 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2594342082814922752, distance 3,625 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205906794 (K2 campaign 3): PARAM asteroseismic distance (pc) 3624.921875 (16th-84th percentiles 3547.148438-3723.476562), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.282 ± 0.023 mas (12.3 standard errors), is not used. Radius 15.9815 +/- 0.6072 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205906794 (K2 campaign 3): PARAM radius (solar radii) 15.981536 (16th-84th percentiles 15.513851-16.728302), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8632 +/- 0.0717 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205906794 (K2 campaign 3): PARAM mass (solar masses) 0.863159 (16th-84th percentiles 0.811832-0.955271), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,431 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205906794: APOGEE DR17 effective temperature 4430.56 +/- 50 K (the catalogue's final uncertainty). log g 1.97 from the mass and radius.

**Colour.** A Planck spectrum at 4,431 K, because pARAM fits an extinction A_V = 0.14 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdcb9. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,431 K and log g 1.97 (u1 0.793, u2 0.023): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
