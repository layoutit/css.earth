# EPIC 247597409

## Sources

Its oscillations, recorded in K2 campaign 13, give 1.29 solar masses and 10.6 solar radii; APOGEE spectra give 4,712 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3418348837205940480, distance 2,208 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247597409 (K2 campaign 13): PARAM asteroseismic distance (pc) 2208.4375 (16th-84th percentiles 2157.324219-2261.074219), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.385 ± 0.016 mas (23.9 standard errors), is not used. Radius 10.6034 +/- 0.3475 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247597409 (K2 campaign 13): PARAM radius (solar radii) 10.603367 (16th-84th percentiles 10.267878-10.962903), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.2881 +/- 0.0935 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247597409 (K2 campaign 13): PARAM mass (solar masses) 1.288076 (16th-84th percentiles 1.200129-1.387143), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,712 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247597409: APOGEE DR17 effective temperature 4711.5790000000015 +/- 50 K (the catalogue's final uncertainty). log g 2.5 from the mass and radius.

**Colour.** A Planck spectrum at 4,712 K, because pARAM fits an extinction A_V = 1.01 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c5. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,712 K and log g 2.5 (u1 0.711, u2 0.087): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
