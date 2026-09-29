# EPIC 211912988

## Sources

Its oscillations, recorded in K2 campaign 5, give 0.86 solar masses and 10.5 solar radii; APOGEE spectra give 4,885 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 659723233118648960, distance 3,655 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211912988 (K2 campaign 5): PARAM asteroseismic distance (pc) 3654.84375 (16th-84th percentiles 3509.648438-3799.335938), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.275 ± 0.020 mas (14.0 standard errors), is not used. Radius 10.4648 +/- 0.5373 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211912988 (K2 campaign 5): PARAM radius (solar radii) 10.464843 (16th-84th percentiles 9.950361-11.024899), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8567 +/- 0.1033 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211912988 (K2 campaign 5): PARAM mass (solar masses) 0.856716 (16th-84th percentiles 0.760672-0.967318), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,885 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211912988: APOGEE DR17 effective temperature 4885.052 +/- 50 K (the catalogue's final uncertainty). log g 2.33 from the mass and radius.

**Colour.** A Planck spectrum at 4,885 K, because pARAM fits an extinction A_V = 0.04 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe4cb. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,885 K and log g 2.33 (u1 0.657, u2 0.127): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
