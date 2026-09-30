# EPIC 212470781

## Sources

Its oscillations, recorded in K2 campaign 6, give 1.18 solar masses and 10.6 solar radii; APOGEE spectra give 4,860 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3609210896007822080, distance 3,104 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212470781 (K2 campaign 6): PARAM asteroseismic distance (pc) 3104.414062 (16th-84th percentiles 3065.351562-3144.375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.297 ± 0.018 mas (16.9 standard errors), is not used. Radius 10.6308 +/- 0.28 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212470781 (K2 campaign 6): PARAM radius (solar radii) 10.630752 (16th-84th percentiles 10.453927-11.014013), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.1838 +/- 0.0792 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212470781 (K2 campaign 6): PARAM mass (solar masses) 1.183799 (16th-84th percentiles 1.125113-1.283602), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,860 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212470781: APOGEE DR17 effective temperature 4860.2617 +/- 50 K (the catalogue's final uncertainty). log g 2.46 from the mass and radius.

**Colour.** A Planck spectrum at 4,860 K, because pARAM fits an extinction A_V = 0.11 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe4ca. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,860 K and log g 2.46 (u1 0.665, u2 0.121): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
