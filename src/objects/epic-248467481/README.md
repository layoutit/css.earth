# EPIC 248467481

## Sources

Its oscillations, recorded in K2 campaign 14, give 0.92 solar masses and 13.6 solar radii; APOGEE spectra give 4,586 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3807758266209935744, distance 3,153 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248467481 (K2 campaign 14): PARAM asteroseismic distance (pc) 3153.4375 (16th-84th percentiles 3027.148438-3295.46875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.269 ± 0.020 mas (13.7 standard errors), is not used. Radius 13.6232 +/- 0.7296 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248467481 (K2 campaign 14): PARAM radius (solar radii) 13.623155 (16th-84th percentiles 12.974863-14.434037), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9243 +/- 0.1134 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248467481 (K2 campaign 14): PARAM mass (solar masses) 0.92429 (16th-84th percentiles 0.827208-1.053919), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,586 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248467481: APOGEE DR17 effective temperature 4585.840999999999 +/- 50 K (the catalogue's final uncertainty). log g 2.14 from the mass and radius.

**Colour.** A Planck spectrum at 4,586 K, because pARAM fits an extinction A_V = 0.09 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfbf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,586 K and log g 2.14 (u1 0.746, u2 0.060): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
