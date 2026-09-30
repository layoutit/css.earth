# EPIC 212638013

## Sources

Its oscillations, recorded in K2 campaign 6, give 1.07 solar masses and 9.3 solar radii; APOGEE spectra give 5,156 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3615484541852716032, distance 4,809 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212638013 (K2 campaign 6): PARAM asteroseismic distance (pc) 4808.75 (16th-84th percentiles 4651.132812-4972.5), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.200 ± 0.025 mas (8.1 standard errors), is not used. Radius 9.3365 +/- 0.4109 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212638013 (K2 campaign 6): PARAM radius (solar radii) 9.336459 (16th-84th percentiles 8.937739-9.759638), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0677 +/- 0.1123 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212638013 (K2 campaign 6): PARAM mass (solar masses) 1.067724 (16th-84th percentiles 0.96167-1.186273), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,156 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212638013: APOGEE DR17 effective temperature 5155.960999999998 +/- 50 K (the catalogue's final uncertainty). log g 2.53 from the mass and radius.

**Colour.** A Planck spectrum at 5,156 K, because pARAM fits an extinction A_V = 0.11 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe8d5. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,156 K and log g 2.53 (u1 0.583, u2 0.179): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
