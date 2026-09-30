# EPIC 212143959

## Sources

Its oscillations, recorded in K2 campaign 5, give 1.02 solar masses and 10.2 solar radii; APOGEE spectra give 4,778 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 677904585597471488, distance 1,013 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212143959 (K2 campaign 5): PARAM asteroseismic distance (pc) 1013.261719 (16th-84th percentiles 985.175781-1033.662109), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.935 ± 0.016 mas (59.2 standard errors), is not used. Radius 10.215 +/- 0.3587 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212143959 (K2 campaign 5): PARAM radius (solar radii) 10.215045 (16th-84th percentiles 9.769386-10.486705), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.018 +/- 0.102 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212143959 (K2 campaign 5): PARAM mass (solar masses) 1.018037 (16th-84th percentiles 0.900203-1.104127), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,778 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212143959: APOGEE DR17 effective temperature 4777.753 +/- 50 K (the catalogue's final uncertainty). log g 2.43 from the mass and radius.

**Colour.** A Planck spectrum at 4,778 K, because pARAM fits an extinction A_V = 0.17 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c7. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,778 K and log g 2.43 (u1 0.689, u2 0.103): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
