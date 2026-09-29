# EPIC 229048388

## Sources

Its oscillations, recorded in K2 campaign 10, give 1.12 solar masses and 12.4 solar radii; APOGEE spectra give 4,932 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3696050569183962624, distance 6,116 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 229048388 (K2 campaign 10): PARAM asteroseismic distance (pc) 6116.09375 (16th-84th percentiles 5869.53125-6370.9375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.132 ± 0.019 mas (6.9 standard errors), is not used. Radius 12.3912 +/- 0.6827 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 229048388 (K2 campaign 10): PARAM radius (solar radii) 12.391202 (16th-84th percentiles 11.728172-13.093583), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.1204 +/- 0.1431 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 229048388 (K2 campaign 10): PARAM mass (solar masses) 1.120388 (16th-84th percentiles 0.98475-1.271048), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,932 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 229048388: APOGEE DR17 effective temperature 4931.7563 +/- 50 K (the catalogue's final uncertainty). log g 2.3 from the mass and radius.

**Colour.** A Planck spectrum at 4,932 K, because pARAM fits an extinction A_V = -0.01 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe5cd. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,932 K and log g 2.3 (u1 0.642, u2 0.137): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
