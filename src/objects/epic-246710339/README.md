# EPIC 246710339

## Sources

Its oscillations, recorded in K2 campaign 13, give 0.85 solar masses and 9.2 solar radii; APOGEE spectra give 5,024 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3308886377283547904, distance 3,588 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246710339 (K2 campaign 13): PARAM asteroseismic distance (pc) 3588.007812 (16th-84th percentiles 3528.242188-3649.6875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.223 ± 0.023 mas (9.9 standard errors), is not used. Radius 9.2481 +/- 0.2229 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246710339 (K2 campaign 13): PARAM radius (solar radii) 9.248118 (16th-84th percentiles 9.042088-9.487861), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8539 +/- 0.0422 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246710339 (K2 campaign 13): PARAM mass (solar masses) 0.853873 (16th-84th percentiles 0.813113-0.897468), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,024 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246710339: APOGEE DR17 effective temperature 5024.4307 +/- 50 K (the catalogue's final uncertainty). log g 2.44 from the mass and radius.

**Colour.** A Planck spectrum at 5,024 K, because pARAM fits an extinction A_V = 1.00 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6d1. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,024 K and log g 2.44 (u1 0.617, u2 0.156): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
