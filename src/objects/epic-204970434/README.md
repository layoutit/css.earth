# EPIC 204970434

## Sources

Its oscillations, recorded in K2 campaign 2, give 1.95 solar masses and 15.8 solar radii; APOGEE spectra give 4,827 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4130505439095442944, distance 3,984 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 204970434 (K2 campaign 2): PARAM asteroseismic distance (pc) 3983.59375 (16th-84th percentiles 3789.53125-4198.828125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.364 ± 0.017 mas (21.9 standard errors), is not used. Radius 15.8161 +/- 0.8219 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 204970434 (K2 campaign 2): PARAM radius (solar radii) 15.816135 (16th-84th percentiles 15.00141-16.645283), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.9485 +/- 0.2147 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 204970434 (K2 campaign 2): PARAM mass (solar masses) 1.94849 (16th-84th percentiles 1.735864-2.165249), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,827 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 204970434: APOGEE DR17 effective temperature 4827.258 +/- 50 K (the catalogue's final uncertainty). log g 2.33 from the mass and radius.

**Colour.** A Planck spectrum at 4,827 K, because pARAM fits an extinction A_V = 0.67 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c9. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,827 K and log g 2.33 (u1 0.674, u2 0.115): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
