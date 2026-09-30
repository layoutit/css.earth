# EPIC 217088564

## Sources

Its oscillations, recorded in K2 campaign 7, give 2.87 solar masses and 18.7 solar radii; APOGEE spectra give 5,024 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4085050464497182336, distance 7,289 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 217088564 (K2 campaign 7): PARAM asteroseismic distance (pc) 7289.140625 (16th-84th percentiles 7186.015625-7383.515625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.244 ± 0.019 mas (12.9 standard errors), is not used. Radius 18.6535 +/- 0.3199 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 217088564 (K2 campaign 7): PARAM radius (solar radii) 18.653463 (16th-84th percentiles 18.25696-18.896661), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 2.8719 +/- 0.104 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 217088564 (K2 campaign 7): PARAM mass (solar masses) 2.871908 (16th-84th percentiles 2.730433-2.938389), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,024 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 217088564: APOGEE DR17 effective temperature 5024.4336 +/- 99 K (the catalogue's final uncertainty). log g 2.35 from the mass and radius.

**Colour.** A Planck spectrum at 5,024 K, because pARAM fits an extinction A_V = 0.61 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6d1. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,024 K and log g 2.35 (u1 0.616, u2 0.156): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
